/* globals
ClockwiseSweepPolygon,
canvas,
Ray,
PIXI,
NormalizedRectangle,
PolygonEdge,
PolygonVertex
*/

/**
 * @typedef {Map<number,PolygonVertex>} VertexMap
 */

/**
 * @typedef {Set<PolygonEdge>} EdgeSet
 */

/**
 * @typedef {PointSourcePolygonConfig} ClockwiseSweepPolygonConfig
 * @property {number} [density=12]  The desired density of padding rays, a number per PI
 * @property {number} [aMin]        The minimum angle of emission
 * @property {number} [aMax]        The maximum angle of emission
 * @property {PolygonRay} [rMin]    The minimum ray of emission
 * @property {PolygonRay} [rMax]    The maximum ray of emission
 * @property {boolean} [hasLimitedRadius] Does this polygon have a limited radius?
 * @property {boolean} [hasLimitedAngle]  Does this polygon have a limited angle?
 * @property {number} [rayDistance] The radius of rays emitted as part of the computation
 * @property {number} [radius2]     The squared radius of the polygon, for faster computation later
 * @property {number} [radiusE]     A small epsilon used for avoiding floating point precision issues
 */

/**
 * @typedef {Ray} PolygonRay
 * @property {CollisionResult} result
 */

Math.roundFast = function roundFast(number) {
  return number + 0.5 << 0;
  return (number + (number > 0 ? 0.5 : -0.5)) << 0;
}

/**
 * Intersect this PIXI.Polygon with a PIXI.Circle.
 * For now, convert the circle to a Polygon approximation and use intersectPolygon.
 * In the future we may replace this with more specialized logic which uses the line-circle intersection formula.
 * @param {PIXI.Circle} circle        A PIXI.Circle
 * @param {object} [options]          Options which configure how the intersection is computed
 * @param {number} [options.density]    The number of points which defines the density of approximation
 * @returns {PIXI.Polygon}            The intersected polygon
 */
PIXI.Polygon.prototype.intersectCircle = function(circle, {density=60}={}) {
  const approx = circle.toPolygon({density});
  return this.intersectPolygon(approx);
};

/* -------------------------------------------- */

/**
 * Intersect this PIXI.Polygon with a PIXI.Rectangle.
 * For now, convert the rectangle to a Polygon and use intersectPolygon.
 * In the future we may replace this with more specialized logic which uses the line-line intersection formula.
 * @param {PIXI.Rectangle} rect       A PIXI.Rectangle
 * @returns {PIXI.Polygon}            The intersected polygon
 */
// PIXI.Polygon.prototype.intersectRectangle = function(rect) {
//   const other = rect.toPolygon();
//   return this.intersectPolygon(other);
// };



/**
 * A PointSourcePolygon implementation that uses CCW (counter-clockwise) geometry orientation.
 * Sweep around the origin, accumulating collision points based on the set of active walls.
 * This algorithm was created with valuable contributions from https://github.com/caewok
 *
 * @extends PointSourcePolygon
 */
export class ClockwiseSweepPolygonNew extends PointSourcePolygon {

  /**
   * The configuration of this polygon.
   * @type {ClockwiseSweepPolygonConfig}
   */
  config = {};

  /**
   * A mapping of vertices which define potential collision points
   * @type {VertexMap}
   */
  vertices = new Map();

  /**
   * The set of edges which define potential boundaries of the polygon
   * @type {EdgeSet}
   */
  edges = new Set();

  /**
   * A collection of rays which are fired at vertices
   * @type {PolygonRay[]}
   */
  rays = [];

  /* -------------------------------------------- */

  /**
   * @override
   * @param {Point} origin                        The provided polygon origin
   * @param {ClockwiseSweepPolygonConfig} config  The provided configuration object
   */
  initialize(origin, config) {
    super.initialize(origin, config);
    const cfg = this.config;

    // Round the origin point
    // TODO: is it safe to do this with tokens which require a center offset to break ties with walls?
    origin.x = Math.roundFast(origin.x);
    origin.y = Math.roundFast(origin.y);

    // Configure limited radius
    cfg.hasLimitedRadius = cfg.radius > 0;
    cfg.radius = cfg.radius ?? canvas.dimensions.maxR;
    cfg.radius2 = Math.pow(cfg.radius, 2);
    cfg.radiusE = 0.5 / cfg.radius;
    cfg.rayDistance = Math.pow(canvas.dimensions.maxR, 2);

    // Configure limited angle
    cfg.aMin = -Math.PI;
    cfg.aMax = Math.PI;
    cfg.angle = cfg.angle ?? 360;
    cfg.rotation = cfg.rotation ?? 0;
    cfg.hasLimitedAngle = cfg.angle !== 360;
    cfg.density = cfg.density ?? 12;

    // Configure bounding rays
    if ( cfg.hasLimitedAngle ) {
      cfg.aMin = Math.normalizeRadians(Math.toRadians(cfg.rotation + 90 - (cfg.angle / 2)));
      cfg.aMax = cfg.aMin + Math.toRadians(cfg.angle);
      cfg.rMax = this._roundRayVertices(Ray.fromAngle(origin.x, origin.y, cfg.aMax, cfg.rayDistance));
    }
    cfg.rMin = this._roundRayVertices(Ray.fromAngle(origin.x, origin.y, cfg.aMin, cfg.rayDistance));

    // Define polygon boundary shapes
    cfg.boundaryShapes ||= [];
    if ( cfg.hasLimitedRadius ) this.#configureLimitedRadius(origin, cfg.radius);
    if ( cfg.hasLimitedAngle ) this.#configureLimitedAngle(origin, cfg.angle, cfg.rotation);
  }

  /* -------------------------------------------- */

  /**
   * Configure a provided limited radius as a circular polygon boundary shape.
   * @param {Point} origin      The polygon origin point
   * @param {number} radius     The configured circle radius
   */
  #configureLimitedRadius(origin, radius) {
    this.config.boundaryShapes.push(new PIXI.Circle(origin.x, origin.y, radius));
  }

  /* -------------------------------------------- */

  /**
   * Configure a limited angle and rotation into a triangular polygon boundary shape.
   * @param {Point} origin      The polygon origin point
   * @param {number} angle      The limited angle of emission
   * @param {number} rotation   The central angle of rotation
   */
  #configureLimitedAngle(origin, angle, rotation) {
    // TODO
  }

  /* -------------------------------------------- */

  /**
   * Round vertices of a ray segment
   * @param {PolygonRay} ray    The provided ray
   * @returns {PolygonRay}      The ray with rounded vertices
   */
  _roundRayVertices(ray) {
    ray.A.x = Math.round(ray.A.x);
    ray.A.y = Math.round(ray.A.y);
    ray.B.x = Math.round(ray.B.x);
    ray.B.y = Math.round(ray.B.y);
    return ray;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _compute() {

    // Step 1 - Identify candidate edges
    this._identifyEdges();

    // Step 2 - Construct vertex mapping
    this._identifyVertices();

    // Step 3 - Radial sweep over endpoints
    this._executeSweep();

    // Step 4 - Construct un-restricted polygon
    this._constructPolygonPoints();

    // Step 5 - Constrain with boundary shapes
    this._constrainBoundaryShapes();
  }

  /* -------------------------------------------- */
  /*  Edge Configuration                          */
  /* -------------------------------------------- */

  /**
   * Translate walls and other obstacles into edges which limit visibility
   * @private
   */
  _identifyEdges() {
    const {type, hasLimitedAngle, hasLimitedRadius} = this.config;

    // Add edges for placed Wall objects
    const walls = this._getWalls();
    for ( let wall of walls ) {
      if ( !this.constructor.testWallInclusion(wall, this.origin, type) ) continue;
      const edge = PolygonEdge.fromWall(wall, type);
      this.edges.add(edge);
    }

    // Add edges for the canvas boundary
    for ( let boundary of canvas.walls.boundaries ) {
      this.edges.add(PolygonEdge.fromWall(boundary, type));
    }

    // Restrict edges to a limited angle
    if ( hasLimitedAngle ) {
      this._restrictEdgesByAngle(); // TODO, there may still be a use case for this
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the super-set of walls which could potentially apply to this polygon.
   * @returns {Wall[]}
   * @protected
   */
  _getWalls() {
    if ( !this.config.boundaryShapes.length ) return canvas.walls.placeables;
    const bounds = this.#defineBoundingBox();
    return Array.from(canvas.walls.quadtree.getObjects(bounds).values());
  }

  /* -------------------------------------------- */

  /**
   * Compute the aggregate bounding box which is the intersection of all boundary shapes.
   * Round and pad the resulting rectangle by 1 pixel to ensure it always contains the origin.
   * @returns {NormalizedRectangle}
   */
  #defineBoundingBox() {
    let b = canvas.dimensions.rect;
    for ( const shape of this.config.boundaryShapes ) {
      b = b.intersection(shape.getBounds());
    }
    return new NormalizedRectangle(Math.floor(b.x)-1, Math.floor(b.y)-1, Math.ceil(b.width)+1, Math.ceil(b.height)+1);
  }

  /* -------------------------------------------- */

  /**
   * Restrict the set of candidate edges to those which appear within the limited angle of emission.
   * @private
   */
  _restrictEdgesByAngle() {
    const {rMin, rMax, angle} = this.config;
    for ( let edge of this.edges ) {

      // If either vertex is inside, keep the edge
      edge.A._inLimitedAngle = this.constructor.pointBetweenRays(edge.A, rMin, rMax, angle);
      edge.B._inLimitedAngle = this.constructor.pointBetweenRays(edge.B, rMin, rMax, angle);
      if ( edge.A._inLimitedAngle || edge.B._inLimitedAngle ) {
        continue;
      }

      // If both vertices are outside, test whether the edge collides with one (either) of the limiting rays
      if ( !(foundry.utils.lineSegmentIntersects(rMin.A, rMin.B, edge.A, edge.B) ||
        foundry.utils.lineSegmentIntersects(rMax.A, rMax.B, edge.A, edge.B)) ) {
        this.edges.delete(edge);
      }
    }
  }

  /* -------------------------------------------- */
  /*  Vertex Identification                       */
  /* -------------------------------------------- */

  /**
   * Consolidate all vertices from identified edges and register them as part of the vertex mapping.
   * @private
   */
  _identifyVertices() {
    const {hasLimitedAngle, rMin, rMax} = this.config;
    const wallEdgeMap = new Map();

    // Register vertices for all edges
    for ( let edge of this.edges ) {

      // Get unique vertices A and B
      const ak = edge.A.key;
      if ( this.vertices.has(ak) ) edge.A = this.vertices.get(ak);
      else this.vertices.set(ak, edge.A);
      const bk = edge.B.key;
      if ( this.vertices.has(bk) ) edge.B = this.vertices.get(bk);
      else this.vertices.set(bk, edge.B);

      // Learn edge orientation with respect to the origin
      const o = foundry.utils.orient2dFast(this.origin, edge.A, edge.B);

      // Ensure B is clockwise of A
      if ( o > 0 ) {
        let a = edge.A;
        edge.A = edge.B;
        edge.B = a;
      }

      // Attach edges to each vertex
      edge.A.attachEdge(edge, -1);
      edge.B.attachEdge(edge, 1);

      // Record the wall->edge mapping
      if ( edge.wall ) wallEdgeMap.set(edge.wall.id, edge);
    }

    // Add edge intersections
    this._identifyIntersections(wallEdgeMap);

    // For limited angle polygons, restrict vertices
    if ( hasLimitedAngle ) {
      for ( let vertex of this.vertices.values() ) {
        if ( !vertex._inLimitedAngle ) this.vertices.delete(vertex.key);
      }

      // Add vertices for the endpoints of bounding rays
      const vMin = PolygonVertex.fromPoint(rMin.B);
      this.vertices.set(vMin.key, vMin);
      const vMax = PolygonVertex.fromPoint(rMax.B);
      this.vertices.set(vMax.key, vMax);
    }
  }

  /* -------------------------------------------- */

  /**
   * Add additional vertices for intersections between edges.
   * @param {Map<string,PolygonEdge>} wallEdgeMap    A mapping of wall IDs to PolygonEdge instances
   * @private
   */
  _identifyIntersections(wallEdgeMap) {
    const processed = new Set();
    const { angle, hasLimitedAngle, rMin, rMax } = this.config;
    for ( let edge of this.edges ) {

      // If the edge has no intersections, skip it
      if ( !edge.wall?.intersectsWith.size ) continue;

      // Check each intersecting wall
      for ( let [wall, i] of edge.wall.intersectsWith.entries() ) {

        // Some other walls may not be included in this polygon
        const other = wallEdgeMap.get(wall.id);
        if ( !other || processed.has(other) ) continue;

        // Register the intersection point as a vertex
        let v = PolygonVertex.fromPoint(i);
        if ( this.vertices.has(v.key) ) v = this.vertices.get(v.key);
        else {
          // Ensure the intersection is still inside our limited angle
          if ( hasLimitedAngle && !this.constructor.pointBetweenRays(v, rMin, rMax, angle) ) continue;
          v._inLimitedAngle = true;
          this.vertices.set(v.key, v);
        }

        // Attach edges to the intersection vertex
        if ( !v.edges.has(edge) ) v.attachEdge(edge, 0);
        if ( !v.edges.has(other) ) v.attachEdge(other, 0);
      }
      processed.add(edge);
    }
  }

  /* -------------------------------------------- */
  /*  Radial Sweep                                */
  /* -------------------------------------------- */

  /**
   * Execute the sweep over wall vertices
   * @private
   */
  _executeSweep() {
    const origin = this.origin;
    const { rayDistance, hasLimitedAngle } = this.config;

    // Initialize the set of active walls
    let activeEdges = this._initializeActiveEdges();

    // Sort vertices from clockwise to counter-clockwise and begin the sweep
    const vertices = this._sortVertices();
    for ( const [i, vertex] of vertices.entries() ) {

      // Construct a ray towards the target vertex
      vertex._index = i+1;
      const ray = Ray.towardsPointSquared(origin, vertex, rayDistance);
      this.rays.push(ray);

      // Determine whether the target vertex is behind some other active edge
      const {isBehind, wasLimited} = this._isVertexBehindActiveEdges(ray, vertex, activeEdges);

      // Construct the CollisionResult object
      const result = ray.result = new CollisionResult({
        target: vertex,
        cwEdges: vertex.cwEdges,
        ccwEdges: vertex.ccwEdges,
        isLimited: vertex.isLimited,
        isRequired: hasLimitedAngle && ((i === 0) || (i === vertices.length-1)),
        isBehind,
        wasLimited
      });

      // Delegate to determine the result of the ray
      this._determineRayResult(ray, vertex, result, activeEdges);

      // Update active edges for the next iteration
      this._updateActiveEdges(result, activeEdges);
    }
  }

  /* -------------------------------------------- */

  /**
   * Determine the initial set of active edges as those which intersect with the initial ray
   * @returns {EdgeSet}             A set of initially active edges
   * @private
   */
  _initializeActiveEdges() {
    const rMin = this.config.rMin;
    const edges = new Set();
    for ( let edge of this.edges ) {
      const x = foundry.utils.lineSegmentIntersects(rMin.A, rMin.B, edge.A, edge.B);
      if ( x ) edges.add(edge);
    }
    return edges;
  }

  /* -------------------------------------------- */

  /**
   * Sort vertices clockwise from the initial ray (due west).
   * @returns {PolygonVertex[]}             The array of sorted vertices
   * @private
   */
  _sortVertices() {
    if ( !this.vertices.size ) return [];
    let vertices = Array.from(this.vertices.values());
    const o = this.origin;

    // Identify a reference point which should appear first in the sort order
    let reference = null;
    let referenceInline = false;
    if ( this.config.hasLimitedAngle ) {
      const rb = PolygonVertex.fromPoint(this.config.rMin.B);
      reference = this.vertices.get(rb.key);
    }

    // Sort vertices
    vertices.sort((a, b) => {

      // Sort by hemisphere
      const ya = a.y > o.y ? 1 : -1;
      const yb = b.y > o.y ? 1 : -1;
      if ( ya !== yb ) return ya;       // Sort N, S

      // Sort by quadrant
      const qa = a.x < o.x ? -1 : 1;
      const qb = b.x < o.x ? -1 : 1;
      if ( qa !== qb ) {                // Sort NW, NE, SE, SW
        if ( ya === -1 ) return qa;
        else return -qa;
      }

      // Sort clockwise within quadrant
      const orientation = foundry.utils.orient2dFast(o, a, b);
      if ( orientation !== 0 ) return orientation;

      // Special case, sort the reference point before other collinear points
      if ( reference ) {
        if ( a === reference ) {
          referenceInline = true;
          return -1;
        }
        if ( b === reference ) {
          referenceInline = true;
          return 1;
        }
      }

      // If points are collinear, first prioritize ones which have no CCW edges over ones that do
      if ( !a.ccwEdges.size && b.ccwEdges.size ) return -1;
      if ( !b.ccwEdges.size && a.ccwEdges.size ) return 1;

      // Otherwise, sort closer points first
      if ( !a._d2 ) a._d2 = Math.pow(a.x - o.x, 2) + Math.pow(a.y - o.y, 2);
      if ( !b._d2 ) b._d2 = Math.pow(b.x - o.x, 2) + Math.pow(b.y - o.y, 2);
      return a._d2 - b._d2;
    });

    // Re-partition the sorted array relative to the reference point
    if ( reference ) {
      const idx = vertices.findIndex(v => v === reference);
      if ( idx !== 0 ) vertices = vertices.slice(idx, vertices.length).concat(vertices.slice(0, idx));
      if ( referenceInline ) vertices.shift(); // The reference is no longer needed
    }
    return vertices;
  }

  /* -------------------------------------------- */

  /**
   * Test whether a target vertex is behind some closer active edge
   * @param {PolygonRay} ray            The ray being evaluated
   * @param {PolygonVertex} vertex      The target vertex
   * @param {EdgeSet} activeEdges       The set of active edges
   * @returns {{isBehind: boolean, wasLimited: boolean}} Is the target vertex behind some closer edge?
   * @private
   */
  _isVertexBehindActiveEdges(ray, vertex, activeEdges) {
    let wasLimited = false;
    for ( let edge of activeEdges ) {
      if ( vertex.edges.has(edge) ) continue;
      const x = foundry.utils.lineSegmentIntersects(this.origin, vertex, edge.A, edge.B);
      if ( x ) {
        if ( ( edge.isLimited ) && !wasLimited ) wasLimited = true;
        else return {isBehind: true, wasLimited};
      }
    }
    return {isBehind: false, wasLimited};
  }

  /* -------------------------------------------- */

  /**
   * Determine the final result of a candidate ray.
   * @param {PolygonRay} ray            The candidate ray being tested
   * @param {PolygonVertex} vertex      The target vertex
   * @param {CollisionResult} result    The result being prepared
   * @param {EdgeSet} activeEdges       The set of active edges
   * @private
   */
  _determineRayResult(ray, vertex, result, activeEdges) {

    // Case 1 - Boundary rays are strictly required
    if ( result.isRequired ) return this._findRequiredCollision(ray, result, activeEdges);

    // Case 2 - Some vertices can be ignored because they are behind other active edges
    if ( result.isBehind ) return;

    // Determine whether this vertex is a binding point
    const nccw = vertex.ccwEdges.size;
    const ncw = vertex.cwEdges.size;
    let isBinding = true;
    if ( result.isLimited ) {
      // Limited points can still be binding if there are two or more connected edges on the same side.
      if ( !result.wasLimited && (ncw < 2) && (nccw < 2) ) isBinding = false;
    }

    // Case 3 - If there are no counter-clockwise edges we must be beginning traversal down a new edge
    // empty -> edge
    // empty -> limited
    if ( !activeEdges.size || !nccw ) {
      return this._beginNewEdge(ray, result, activeEdges, isBinding);
    }

    // Case 4 - Limited edges in both directions
    // limited -> limited
    const ccwLimited = !result.wasLimited && (nccw === 1) && vertex.ccwEdges.first().isLimited;
    const cwLimited = !result.wasLimited && (ncw === 1) && vertex.cwEdges.first().isLimited;
    if ( cwLimited && ccwLimited ) return;

    // Case 5 - Non-limited edges in both directions
    // edge -> edge
    if ( !ccwLimited && !cwLimited && ncw && nccw ) {
      return result.collisions.push(result.target);
    }

    // Case 6 - Complete edges which do not extend in both directions
    // edge -> limited
    // edge -> empty
    // limited -> empty
    if ( !ncw || (nccw && !ccwLimited) ) {
      return this._completeCurrentEdge(ray, result, activeEdges, isBinding);
    }

    // Case 7 - Otherwise we must be jumping to a new closest edge
    // limited -> edge
    else return this._beginNewEdge(ray, result, activeEdges, isBinding);
  }

  /* -------------------------------------------- */

  /**
   * Jump to a new closest active edge.
   * In this case, our target vertex will be the primary collision.
   * We may have a secondary collision if other active edges exist or if the vertex is prior to the ray endpoint.
   * @private
   *
   * @param {PolygonRay} ray            The ray being emitted
   * @param {CollisionResult} result    The pending collision result
   * @param {EdgeSet} activeEdges       The set of currently active edges
   * @param {boolean} isBinding         Is the target vertex a binding collision point?
   * @param {boolean} secondaryBefore   Whether to add secondary collision points before ("unshift") or after ("push")
   */
  _beginNewEdge(ray, result, activeEdges, isBinding, secondaryBefore=true) {

    // We know we will strike this vertex
    if ( isBinding ) result.collisions.push(result.target);

    // Find secondary collisions against known edges
    const xs = this._getSecondaryCollisions(ray, result, activeEdges);
    if ( !xs.length ) return;
    const x0 = xs[0];

    // Toggle the insertion method
    const c = result.collisions;
    const insert = secondaryBefore ? c.unshift : c.push;

    // If there were no active walls, we hit the terminal point
    if ( !activeEdges.size ) return insert.call(c, x0);

    // Is the first collision point necessary?
    const isLimitedEdge = (x0.edges.size === 1) && x0.hasLimitedEdge; // Exactly 1 active edge
    if ( !isBinding && !isLimitedEdge ) return;
    insert.call(c, x0);

    // We don't need a last collision point if the edge is not limited, the result was limited, or the ray result has edges ccw and cw.
    if ( !isLimitedEdge || result.wasLimited || (ray.result.ccwEdges.size && ray.result.cwEdges.size) ) return;

    // Otherwise we have a secondary collision as long as it's not somehow equal to the target vertex
    if ( xs[1] ) insert.call(c, xs[1]);
  }

  /* -------------------------------------------- */

  /**
   * If the target vertex is connected to a currently active edge, we are terminating that edge.
   * We know the target vertex is not behind another edge, so the target is our initial collision.
   * There may be a second collision afterwards if no connected walls continue clockwise.
   * @private
   *
   * @param {PolygonRay} ray            The ray being emitted
   * @param {CollisionResult} result    The pending collision result
   * @param {EdgeSet} activeEdges       The set of currently active edges
   * @param {boolean} isBinding         Is the target vertex a binding collision point?
   */
  _completeCurrentEdge(ray, result, activeEdges, isBinding) {
    for ( let edge of result.target.edges ) {
      activeEdges.delete(edge);
    }
    return this._beginNewEdge(ray, result, activeEdges, isBinding, false);
  }

  /* -------------------------------------------- */

  /**
   * Augment a CollisionResult with an additional secondary collision.
   * Require secondary collisions to be a greater distance than the target vertex.
   * @param {PolygonRay} ray            The ray being evaluated
   * @param {CollisionResult} result    The collision result
   * @param {EdgeSet} edges             The subset of active edges which are candidates for collision
   * @private
   */
  _getSecondaryCollisions(ray, result, edges) {
    const v = result.target;
    const o = this.origin;
    const t = ray.dx ? ((v.x - o.x) / ray.dx) : ((v.y - o.y) / ray.dy);
    v._distance = Math.min(t + this.config.radiusE, 1); // small epsilon
    return this._getRayCollisions(ray, edges, {minimumDistance: v._distance});
  }

  /* -------------------------------------------- */

  /**
   * Identify collision points for a required terminal ray.
   * @private
   *
   * @param {PolygonRay} ray            The ray being emitted
   * @param {CollisionResult} result    The pending collision result
   * @param {EdgeSet} activeEdges       The set of currently active edges
   */
  _findRequiredCollision(ray, result, activeEdges) {
    const xs = this._getRayCollisions(ray, activeEdges);
    const x = xs[xs[0]?.type === CONST.WALL_SENSE_TYPES.LIMITED ? 1 : 0];
    if ( !x ) return;
    result.collisions.push(x);
  }

  /* -------------------------------------------- */

  /**
   * Identify the collision points between an emitted Ray and a set of active edges.
   * @param {PolygonRay} ray            The candidate ray to test
   * @param {EdgeSet} activeEdges       The set of active edges
   * @param {number} [minimumDistance]  Require collisions to exceed some minimum distance
   * @returns {PolygonVertex[]}         A sorted array of collision points
   * @private
   */
  _getRayCollisions(ray, activeEdges, {minimumDistance=0}={}) {
    const collisions = [];
    const points = new Map();

    // Identify unique collision points
    for ( let edge of activeEdges ) {
      const x = foundry.utils.lineLineIntersection(ray.A, ray.B, edge.A, edge.B);
      if ( !x || (x.t0 <= minimumDistance) ) continue; // Require minimum distance

      // Get a unique collision point
      let c = PolygonVertex.fromPoint(x, {distance: x.t0});
      if ( points.has(c.key) ) c = points.get(c.key);
      else {
        points.set(c.key, c);
        collisions.push(c);
      }

      // Determine the orientation of the edge if the collision strikes a vertex
      let o = 0;
      if ( c.equals(edge.A) ) o = foundry.utils.orient2dFast(this.origin, edge.A, edge.B);
      else if ( c.equals(edge.B) ) o = foundry.utils.orient2dFast(this.origin, edge.B, edge.A);

      // Attach the edge to the collision point
      c.attachEdge(edge, o);
    }

    // Sort collisions on proximity to the origin
    collisions.sort((a, b) => a._distance - b._distance);

    // Add the ray termination
    if ( minimumDistance < 1 ) {
      const t = PolygonVertex.fromPoint(ray.B, {distance: 1});
      if ( !points.has(t.key) ) collisions.push(t);
    }
    return collisions;
  }

  /* -------------------------------------------- */

  /**
   * Update the set of active edges given the result of an emitted ray.
   * @param {CollisionResult} result        The collision result
   * @param {EdgeSet} activeEdges           The set of currently active edges
   * @private
   */
  _updateActiveEdges(result, activeEdges) {
    for ( let ccw of result.ccwEdges ) {  // Remove ccw walls which end at B
      if ( result.target.equals(ccw.B) ) activeEdges.delete(ccw);
    }
    for ( let cw of result.cwEdges ) {  // Add any cw walls
      activeEdges.add(cw);
    }
  }

  /* -------------------------------------------- */
  /*  Polygon Construction                        */
  /* -------------------------------------------- */

  /**
   * Construct the polygon from ray collision points
   * @private
   */
  _constructPolygonPoints() {
    const {hasLimitedAngle, hasLimitedRadius} = this.config;
    this.points = [];

    // Open a limited shape
    if ( hasLimitedAngle ) {
      this.points.push(this.origin.x, this.origin.y);
    }

    // We must have at least 2 rays with collision points, otherwise supplementary rays are needed
    if ( hasLimitedRadius ) {

      // Determine whether supplementary rays are required
      let n = 0;
      for ( let r of this.rays ) {
        if ( r.result.collisions.length ) n++;
        if ( n > 1 ) break;
      }

      // Add minimum and maximum rays
      if ( n < 2 ) {
        const rMin = this.config.rMin;
        const vMin = PolygonVertex.fromPoint(rMin.B, {distance: 1});
        rMin.result = new CollisionResult({target: vMin, collisions: [vMin]});
        this.rays.unshift(rMin);

        const rMax = Ray.fromAngle(this.origin.x, this.origin.y, this.config.aMax, this.config.radius);
        const vMax = PolygonVertex.fromPoint(rMax.B, {distance: 1});
        rMax.result = new CollisionResult({target: vMax, collisions: [vMax]});
        this.rays.push(rMax);
      }
    }

    // We need padding points before a ray if the prior ray reached its termination and has no clockwise edges
    const needsPadding = lastRay => {
      if ( !hasLimitedRadius || !lastRay ) return false;
      const r = lastRay.result;
      const c = r.collisions[r.collisions.length-1];
      return c.isTerminal && !c.cwEdges.size;
    };

    // Add points for rays in the sweep
    let lastRay = null;
    for ( let ray of this.rays ) {
      if ( !ray.result.collisions.length ) continue;

      // Add padding points
      if ( needsPadding(lastRay) ) {
        for ( let p of this._getPaddingPoints(lastRay, ray) ) {
          this.points.push(p.x, p.y);
        }
      }

      // Add collision points for the ray
      for ( let c of ray.result.collisions ) {
        this.points.push(c.x, c.y);
      }
      lastRay = ray;
    }

    // Close the limited shape
    if ( hasLimitedAngle ) {
      this.points.push(this.origin.x, this.origin.y);
    }

    // Final padding rays, if necessary
    else if ( needsPadding(lastRay) ) {
      const firstRay = this.rays.find(r => r.result.collisions.length);
      for ( let p of this._getPaddingPoints(lastRay, firstRay) ) {
        this.points.push(p.x, p.y);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Add additional points to limited-radius polygons to approximate the curvature of a circle
   * @param {PolygonRay} r0        The prior ray that collided with some vertex
   * @param {PolygonRay} r1        The next ray that collides with some vertex
   * @private
   */
  _getPaddingPoints(r0, r1) {
    const density = Math.PI / this.config.density;
    const padding = [];

    // Determine padding delta
    let d = r1.angle - r0.angle;
    if ( d < 0 ) d += (2*Math.PI); // Handle cycling past pi
    const nPad = Math.round(d / density);
    if ( nPad === 0 ) return [];

    // Construct padding rays
    const delta = d / nPad;
    for ( let i=1; i<nPad; i++ ) {
      const p = r0.shiftAngle(i * delta);
      padding.push(p.B);
    }
    return padding;
  }

  /* -------------------------------------------- */

  /**
   * Constrain polygon points by applying boundary shapes.
   * @private
   */
  _constrainBoundaryShapes() {
    const constraints = this.config.boundaryShapes;
    if ( (this.points.length < 6) || !constraints.length ) return;
    let constrained = this;
    for ( const constraint of constraints ) {
      if ( constraint instanceof PIXI.Circle ) constrained = constrained.intersectCircle(constraint);
      else if ( constraint instanceof PIXI.Polygon ) constrained = constrained.intersectPolygon(constraint);
      else if ( constraint instanceof PIXI.Rectangle ) constrained = constrained.intersectRectangle(constraint);
    }
    this.points = constrained.points;
  }

  /* -------------------------------------------- */
  /*  Class Helpers                               */
  /* -------------------------------------------- */

  /**
   * Test whether a wall should be included in the computed polygon for a given origin and type
   * @param {Wall} wall         The Wall being considered
   * @param {Point} origin      The origin point for the ray or polygon
   * @param {string} type       The type of perception or movement restriction being imposed
   * @returns {boolean}         Should the wall be included?
   *
   */
  static testWallInclusion(wall, origin, type) {

    // Always include interior walls underneath active roof tiles
    if ( (type === "sight") && wall.hasActiveRoof ) return true;

    // Ignore walls that are not blocking for this polygon type
    if ( !wall.document[type] || wall.isOpen ) return false;

    // Ignore walls which are exactly in-line with the origin, except for movement
    const side = wall.orientPoint(origin);
    if ( (type !== "move") && (side === CONST.WALL_DIRECTIONS.BOTH) ) return false;

    // Ignore one-directional walls which are facing away from the origin
    return !wall.document.dir || (side !== wall.document.dir);
  }

  /* -------------------------------------------- */

  /**
   * Test whether a vertex lies between two boundary rays
   * @param {PolygonVertex} vertex    The target vertex
   * @param {PolygonRay} rMin         The counter-clockwise bounding ray
   * @param {PolygonRay} rMax         The clockwise bounding ray
   * @param {number} angle            The angle being tested, in degrees
   * @returns {boolean}               Is the vertex between the two rays?
   */
  static pointBetweenRays(vertex, rMin, rMax, angle) {
    const ccw = foundry.utils.orient2dFast;

    // If the angle is greater than 180, instead check for vertices between rMax and rMin (inverse)
    if ( angle > 180 ) {
      const outside = (ccw(rMax.A, rMax.B, vertex) <= 0) && (ccw(rMin.A, rMin.B, vertex) >= 0);
      return !outside;
    }

    // Otherwise, keep vertices that are inside
    return (ccw(rMin.A, rMin.B, vertex) <= 0) && (ccw(rMax.A, rMax.B, vertex) >= 0);
  }

  /* -------------------------------------------- */
  /*  Collision Testing                           */
  /* -------------------------------------------- */

  /**
   * Check whether a given ray intersects with walls.
   * @param {PolygonRay} ray            The Ray being tested
   * @param {object} [options={}]       Options which customize how collision is tested
   * @param {string} [options.type=move]        Which collision type to check, a value in CONST.WALL_RESTRICTION_TYPES
   * @param {string} [options.mode=all]         Which type of collisions are returned: any, closest, all
   * @param {boolean} [options.debug=false]     Visualize some debugging data to help understand the collision test
   * @return {boolean|object[]|object}  Whether any collision occurred if mode is "any"
   *                                    An array of collisions, if mode is "all"
   *                                    The closest collision, if mode is "closest"
   */
  static getRayCollisions(ray, {type="move", mode="all", debug=false}={}) {
    const origin = ray.A;

    // Identify Edges
    const edges = [];
    const walls = canvas.walls.quadtree.getObjects(ray.bounds);
    for ( let wall of walls ) {
      if ( !this.testWallInclusion(wall, ray.A, type) ) continue;
      const edge = PolygonEdge.fromWall(wall, type);
      const intersects = foundry.utils.lineSegmentIntersects(edge.A, edge.B, origin, ray.B);
      if ( intersects ) {
        if ( mode === "any" ) {   // We may be done already
          if ( (wall.document[type] === CONST.WALL_SENSE_TYPES.NORMAL) || (edges.length > 1) ) return true;
        }
        edges.push(edge);
      }
    }
    if ( mode === "any" ) return false;

    // Identify Collision Points
    const collisions = [];
    const points = new Map();
    for ( let edge of edges ) {
      const x = foundry.utils.lineSegmentIntersection(origin, ray.B, edge.A, edge.B);
      if ( !x || (x.t0 <= 0) ) continue;

      // Record the collision
      let c = PolygonVertex.fromPoint(x, {distance: x.t0});
      if ( points.has(c.key) ) c = points.get(c.key);
      else {
        points.set(c.key, c);
        collisions.push(c);
      }
      c.attachEdge(edge);
    }

    // Return all collisions
    if ( debug ) this._visualizeCollision(ray, edges, collisions);
    if ( mode === "all" ) return collisions;

    // Return the closest collision
    collisions.sort((a, b) => a._distance - b._distance);
    if ( collisions[0].type === CONST.WALL_SENSE_TYPES.LIMITED ) collisions.shift();
    return collisions[0] || null;
  }

  /* -------------------------------------------- */
  /*  Visualization                               */
  /* -------------------------------------------- */

  /** @override */
  visualize() {
    const {radius, hasLimitedAngle, hasLimitedRadius, rMin, rMax} = this.config;
    let dg = canvas.controls.debug;
    dg.clear();

    // Text debugging
    if ( !canvas.controls.debug.debugText ) {
      canvas.controls.debug.debugText = canvas.controls.addChild(new PIXI.Container());
    }
    const text = canvas.controls.debug.debugText;
    text.removeChildren().forEach(c => c.destroy({children: true}));

    // Define limitation colors
    const limitColors = {
      [CONST.WALL_SENSE_TYPES.NONE]: 0x77E7E8,
      [CONST.WALL_SENSE_TYPES.NORMAL]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.LIMITED]: 0x81B90C
    };

    // Draw boundary shapes
    for ( const constraint of this.config.boundaryShapes ) {
      dg.lineStyle(2, 0xFF4444, 1.0).beginFill(0xFF4444, 0.10).drawShape(constraint).endFill();
    }

    // Draw the final polygon shape
    dg.beginFill(0x00AAFF, 0.25).drawShape(this).endFill();

    // Draw limiting angles
    if ( hasLimitedAngle ) {
      dg.lineStyle(8, 0xAACCFF, 0.5).moveTo(rMin.A.x, rMin.A.y).lineTo(rMin.B.x, rMin.B.y);
      dg.lineStyle(8, 0xAACCFF, 0.5).moveTo(rMax.A.x, rMax.A.y).lineTo(rMax.B.x, rMax.B.y);
    }

    // Draw candidate edges
    for ( let edge of this.edges ) {
      dg.lineStyle(4, limitColors[edge.type]).moveTo(edge.A.x, edge.A.y).lineTo(edge.B.x, edge.B.y);
    }

    // Draw vertices
    for ( let vertex of this.vertices.values() ) {
      dg.lineStyle(1, 0x000000).beginFill(limitColors[vertex.type]).drawCircle(vertex.x, vertex.y, 8).endFill();
      if ( vertex._index ) {
        let t = text.addChild(new PIXI.Text(String(vertex._index), CONFIG.canvasTextStyle));
        t.position.set(vertex.x, vertex.y);
      }
    }

    // Draw emitted rays
    for ( let ray of this.rays ) {
      const r = ray.result;
      if ( !r ) continue;
      dg.lineStyle(2, 0x00FF00, r.collisions.length ? 1.0 : 0.33).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);
      for ( let c of r.collisions ) {
        dg.lineStyle(1, 0x000000).beginFill(0xFF0000).drawCircle(c.x, c.y, 6).endFill();
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Visualize the polygon, displaying its computed area, rays, and collision points
   * @private
   */
  static _visualizeCollision(ray, edges, collisions) {
    let dg = canvas.controls.debug;
    dg.clear();
    const limitColors = {
      [CONST.WALL_SENSE_TYPES.NONE]: 0x77E7E8,
      [CONST.WALL_SENSE_TYPES.NORMAL]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.LIMITED]: 0x81B90C
    };

    // Draw edges
    for ( let edge of edges ) {
      dg.lineStyle(4, limitColors[edge.type]).moveTo(edge.A.x, edge.A.y).lineTo(edge.B.x, edge.B.y);
    }

    // Draw the attempted ray
    dg.lineStyle(4, 0x0066CC).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);

    // Draw collision points
    for ( let x of collisions ) {
      dg.lineStyle(1, 0x000000).beginFill(0xFF0000).drawCircle(x.x, x.y, 6).endFill();
    }
  }
}
