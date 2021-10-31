/* globals ClockwiseSweepPolygon, PolygonVertex, PolygonEdge, canvas, foundry */

class MyPolygonEdge {
  constructor(a, b, type=CONST.WALL_SENSE_TYPES.NORMAL) {
    this.A = new PolygonVertex(a.x, a.y);
    this.B = new PolygonVertex(b.x, b.y);
    this.type = type;
    
    this._origin = undefined;
    this._endpointOrientation = undefined;
  }
  
  
  
 /**
  * When setting origin, un-cache measurements that depend on it.
  * @param { x: number, y: number } value
  */
  set origin(value) {
    this._origin = value;
    this._endpointOrientation = undefined;
  } 
  
 /**
  * Get the point counterclockwise (left/start) in relation to the origin.
  * If in line with the origin, the closer point is the left/start point
  * Will be the starting point for the sweep.
  * Named 'left' and 'right' to avoid confusion with ccw/cw or start/end endpoint.
  * @return {PolygonVertex}
  */
  get leftEndpoint() {
    if(this._endpointOrientation === undefined && this._origin) {
      const ccw = foundry.utils.orient2dFast(this.A, this.B, this._origin) > 0;
      this._endpointOrientation.left = ccw ? this.B : this.A;
      this._endpointOrientation.right = ccw ? this.A : this.B;
    }
  
    return this._endpointOrientation.left;
  }
  
 /**
  * Get the point clockwise (right/end) in relation to the origin.
  * If in line with the origin, the further point is the right/end point
  * Will be the end point for the sweep.
  * Named 'left' and 'right' to avoid confusion with ccw/cw or start/end endpoint.
  * @return {PolygonVertex}
  */ 
  get rightEndpoint() {
    if(this._endpointOrientation === undefined && this._origin) {
      const ccw = foundry.utils.orient2dFast(this.A, this.B, this._origin) > 0;
      this._endpointOrientation.left = ccw ? this.B : this.A;
      this._endpointOrientation.right = ccw ? this.A : this.B;
    }
  
    return this._endpointOrientation.right;
  }
}


export class MyClockwiseSweepPolygon extends PointSourcePolygon {
  /**
   * The configuration of this polygon.
   * @type {object}
   * @property {string} type          The type of polygon being computed
   * @property {number} [angle=360]   The angle of emission, if limited
   * @property {number} [density=6]   The desired density of padding rays, a number per PI
   * @property {number} [radius]      A limited radius of the resulting polygon
   * @property {number} [rotation]    The direction of facing, required if the angle is limited
   * @property {number} [aMin]        The minimum angle of emission
   * @property {number} [aMax]        The maximum angle of emission
   * @property {Ray} [rMin]           The minimum ray of emission
   * @property {Ray} [rMax]           The maximum ray of emission
   * @property {boolean} [debug]      Display debugging visualization and logging for the polygon
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
   * @type {Ray[]}
   */
  rays = [];

  /**
   * A performance debugging object
   * @type {{
   *   t0: number,
   *   t1: number,
   *   nTests: number
   * }}
   */
  debug = {
    t0: 0,
    t1: 0,
    nTests: 0,
  };

  /* -------------------------------------------- */

  /** @inheritdoc */
  initialize(origin, config) {
    super.initialize(origin, config);
    const cfg = this.config;

    // Configure limited radius
    cfg.hasLimitedRadius = cfg.radius > 0;
    cfg.radius = cfg.radius ?? canvas.dimensions.maxR;
    cfg.radius2 = Math.pow(cfg.radius, 2);

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
      cfg.rMax = Ray.fromAngle(origin.x, origin.y, cfg.aMax, cfg.radius || cfg.maxR);
    }
    cfg.rMin = Ray.fromAngle(origin.x, origin.y, cfg.aMin, cfg.radius || cfg.maxR);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _compute() {

    // Step 1 - Identify candidate walls
    this._identifyEdges();

    // Step 2 - Construct endpoint mapping
    this._identifyVertices();

    // Step 3 - Radial sweep over endpoints
    this._executeSweep();

    // Step 4 - Build polygon points
    this._constructPolygonPoints();
    
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
      if (!this.constructor.testWallInclusion(wall, this.origin, type)) continue;
      const edge = new MyPolygonEdge(wall.A, wall.B, wall.data[type]);
      this.edges.add(edge);
    }

    // Add edges for the canvas boundary
    this._addCanvasBoundaryEdges();

    // Restrict edges to a limited angle
    if ( hasLimitedAngle ) {
      this._restrictEdgesByAngle();
    }

    // Constrain edges to a limited radius
    if ( hasLimitedRadius ) {
      this._constrainEdgesByRadius();
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the super-set of walls which could potentially apply to this polygon.
   * @returns {Wall[]}
   * @private
   */
  _getWalls() {
    const r = this.config.radius;
    if ( !r ) return canvas.walls.placeables;
    const o = this.origin;
    const rect = new NormalizedRectangle(o.x - r, o.y - r, 2*r, 2*r);
    return Array.from(canvas.walls.quadtree.getObjects(rect).values());
  }

  /* -------------------------------------------- */

  /**
   * Include additional edges for the bounds of the rectangular canvas.
   * In the future this can be expanded to support arbitrary polygon bounds.
   * @private
   */
  _addCanvasBoundaryEdges() {

    // Define canvas endpoints
    const d = canvas.dimensions;
    const c0 = {x: 0, y: 0};
    const c1 = {x: d.width, y: 0};
    const c2 = {x: d.width, y: d.height};
    const c3 = {x: 0, y: d.height};

    // Add canvas edges
    this.edges.add(new MyPolygonEdge(c0, c1));
    this.edges.add(new MyPolygonEdge(c1, c2));
    this.edges.add(new MyPolygonEdge(c2, c3));
    this.edges.add(new MyPolygonEdge(c3, c0));
  }

  /* -------------------------------------------- */

  /**
   * Restrict the set of considered edges to those which appear within the limited angle of emission
   * @private
   */
  _restrictEdgesByAngle() {
    const {rMin, rMax} = this.config;
    for ( let edge of this.edges ) {
      edge.A._inLimitedAngle = this.constructor.pointBetweenRays(edge.A, rMin, rMax);
      edge.B._inLimitedAngle = this.constructor.pointBetweenRays(edge.B, rMin, rMax);

      // If either vertex is inside, keep the edge
      if ( edge.A._inLimitedAngle || edge.B._inLimitedAngle ) {
        continue;
      }

      // Otherwise, if both vertices are outside, we need to test whether the edge collides with a limiting ray
      if ( !foundry.utils.lineLineIntersects(rMin.A, rMin.B, edge.A, edge.B) ) {
        this.edges.delete(edge);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Process the candidate edges to further constrain them using a circular radius of effect.
   * @private
   */
  _constrainEdgesByRadius() {
    const constrained = [];
    for ( let edge of this.edges ) {
      const x = foundry.utils.lineCircleIntersection(edge.A, edge.B, this.origin, this.config.radius);

      // Fully outside - remove this edge
      if ( x.outside ) {
        this.edges.delete(edge);
        continue
      }

      // Fully contained - include this edge directly
      if ( x.contained ) {
        continue;
      }

      // Partially contained - partition the edge into multiple edges
      const points = x.intersections;
      if ( x.aInside ) points.unshift(edge.A);
      if ( x.bInside ) points.push(edge.B);

      // Verify that we are only ever be creating a single segment
      if ( points.length > 2 ) {
        console.warn(`Degenerate polygon edge constraint detected!`);
        debugger;
      }
      this.edges.delete(edge);
      const c = new MyPolygonEdge(points[0], points[1], edge.type);
      if ( c.A.equals(c.B) ) continue;  // Skip partitioned edges with length zero
      constrained.push(c);
    }

    // Add new edges back to the set
    for ( let e of constrained ) {
      this.edges.add(e);
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

    // Register vertices for all edges
    for ( let edge of this.edges ) {
      edge.origin = this.origin;
      const ak = edge.A.key;
      if ( this.vertices.has(ak) ) edge.A = this.vertices.get(ak);
      else this.vertices.set(ak, edge.A);
      edge.A.attachEdge(edge);

      const bk = edge.B.key;
      if ( this.vertices.has(bk) ) edge.B = this.vertices.get(bk);
      else this.vertices.set(bk, edge.B);
      edge.B.attachEdge(edge);
    }

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
  /*  Radial Sweep                                */
  /* -------------------------------------------- */

  /**
   * Execute the sweep over wall vertices
   * @private
   */
  _executeSweep() {
    const origin = this.origin;
    const { radius, hasLimitedAngle } = this.config;

    // Initialize the set of active walls
    let activeEdges = this._initializeActiveEdges();

    // Sort vertices from clockwise to counter-clockwise and begin the sweep
    const vertices = this._sortVertices();
    for ( const [i, vertex] of vertices.entries() ) {

      // Construct a ray towards the target vertex
      vertex._index = i+1;
      const ray = Ray.towardsPoint(origin, vertex, radius);
      this.rays.push(ray);
      const isRequired = hasLimitedAngle && ((i === 0) || (i === vertices.length-1));

      // Determine whether the target vertex is behind some other active edge
      let isBehind = false;
      for (let edge of activeEdges) {
        if (vertex.edges.has(edge)) continue;
        const x = foundry.utils.lineLineIntersects(this.origin, vertex, edge.A, edge.B);
        if (x) {
          isBehind = true;
          break;
        }
      }

      // Case 1 - If there are no active edges we must be beginning traversal down a new clockwise edge
      if ( !activeEdges.size ) {
        ray.result = this._beginNewEdge(ray, vertex, activeEdges);
      }

      // Case 2 - Identify required collisions for boundary rays
      else if ( isRequired ) {
        ray.result = this._getRequiredCollision(ray, vertex, activeEdges);
      }

      // Case 3 - Ignore a vertex which is behind some other active edge
      else if ( isBehind ) {
        ray.result = this._skipBlockedVertex(ray, vertex, activeEdges);
      }

      // Case 4 - Complete an active edge
      else if ( vertex.edges.intersects(activeEdges) ) {
        ray.result = this._completeCurrentEdge(ray, vertex, activeEdges);
      }

      // Case 5 - Jumping to a new closer wall
      else {
        ray.result = this._beginNewEdge(ray, vertex, activeEdges);
      }

      // Update active edges for the next iteration
      this._updateActiveEdges(ray, ray.result, activeEdges);
    }
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
    if ( this.config.hasLimitedAngle ) {
      const rb = PolygonVertex.fromPoint(this.config.rMin.B);
      reference = this.vertices.get(rb.key);
    }

    // Sort vertices
    vertices.sort((a, b) => {

      // Sort by hemisphere
      const ya = a.y < o.y ? -1 : 1;
      const yb = b.y < o.y ? -1 : 1;
      if ( ya !== yb ) return ya;       // Sort N, S

      // Sort by quadrant
      const qa = a.x < o.x ? -1 : 1;
      const qb = b.x < o.x ? -1 : 1;
      if ( qa !== qb ) {                // Sort NW, NE, SE, SW
        if ( ya === -1 ) return qa;
        else return -qa;
      }

      // Sort clockwise within quadrant
      return foundry.utils.orient2dFast(o, a, b);
    });

    // Re-partition the sorted array relative to the reference point
    if ( reference ) {
      const idx = vertices.findIndex(v => v === reference);
      if ( idx !== 0 ) vertices = vertices.slice(idx, vertices.length).concat(vertices.slice(0, idx));
    }
    return vertices;
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
      const x = foundry.utils.lineLineIntersects(rMin.A, rMin.B, edge.A, edge.B);
      if ( x ) edges.add(edge);
    }
    return edges;
  }

  /* -------------------------------------------- */

  /**
   * Jump to a new closest active edge.
   * In this case, our target vertex will be the primary collision.
   * We may have a secondary collision if other active edges exist or if the vertex is prior to the ray endpoint.
   * @private
   *
   * @param {Ray} ray                   The ray being emitted
   * @param {PolygonVertex} vertex      The vertex being targeted
   * @param {EdgeSet} activeEdges       The set of currently active edges
   *
   * @returns {CollisionResult}         The collision result
   */
  _beginNewEdge(ray, vertex, activeEdges) {

    // We know that we will collide with the target vertex first
    const collisions = [vertex];

    // There may be a secondary collision with existing active edges
    if ( activeEdges.size ) {
      const xs = this._getRayCollisions(ray, activeEdges);
      if ( xs.length ) collisions.unshift(xs[0]);
    }

    // Otherwise we may reach the ray endpoint
    else {
      const rb = PolygonVertex.fromPoint(ray.B);
      if ( !vertex.equals(rb) ) collisions.unshift(rb);
    }

    // Construct the ray result
    return new CollisionResult({
      target: vertex,
      collisions: collisions,
      cwEdges: vertex.edges   // we know all connected edges must be clockwise
    });
  }

  /* -------------------------------------------- */

  /**
   * If the target vertex is connected to a currently active edge, we are terminating that edge.
   * We know the target vertex is not behind another edge, so the target is our initial collision.
   * There may be a second collision afterwards if no connected walls continue clockwise.
   * @private
   *
   * @param {Ray} ray                   The ray being emitted
   * @param {PolygonVertex} vertex      The vertex being targeted
   * @param {EdgeSet} activeEdges       The set of currently active edges
   *
   * @returns {CollisionResult}         The collision result
   */
  _completeCurrentEdge(ray, vertex, activeEdges) {

    // Identify edges which continue clockwise
    const [cwEdges, ccwEdges] = this._partitionVertexEdges(ray, vertex);
    const continues = cwEdges.size > 0;
    const collisions = [vertex];

    // If there are no continuing edges, find the secondary collision against other active edges
    if ( !continues ) {
      for ( let edge of vertex.edges ) {
        activeEdges.delete(edge);
      }
      const xs = this._getRayCollisions(ray, activeEdges);
      const [xcw, xccw] = this._partitionVertexEdges(ray, xs[0]);
      xcw.forEach(e => cwEdges.add(e));
      xccw.forEach(e => ccwEdges.add(e));
      collisions.push(xs[0]);
    }

    // Compose the result
    return new CollisionResult({
      target: vertex,
      collisions: collisions,
      cwEdges: cwEdges,
      ccwEdges: ccwEdges
    });
  }

  /* -------------------------------------------- */

  /**
   * Skip over vertices which are blocked by a closer wall.
   * @private
   *
   * @param {Ray} ray                   The ray being emitted
   * @param {PolygonVertex} vertex      The vertex being targeted
   * @param {EdgeSet} activeEdges       The set of currently active edges
   *
   * @returns {CollisionResult}         The collision result
   */
  _skipBlockedVertex(ray, vertex, activeEdges) {
    const [cwEdges, ccwEdges] = this._partitionVertexEdges(ray, vertex);
    return new CollisionResult({
      target: vertex,
      collisions: [],
      cwEdges,
      ccwEdges
    });
  }

  /* -------------------------------------------- */

  /**
   * Identify collision points for a required terminal ray.
   * @private
   *
   * @param {Ray} ray                   The ray being emitted
   * @param {PolygonVertex} vertex      The vertex being targeted
   * @param {EdgeSet} activeEdges       The set of currently active edges
   *
   * @returns {CollisionResult}         The collision result
   */
  _getRequiredCollision(ray, vertex, activeEdges) {
    const xs = this._getRayCollisions(ray, activeEdges);
    const [cwEdges, ccwEdges] = this._partitionVertexEdges(ray, xs[0]);
    return new CollisionResult({
      target: vertex,
      collisions: [xs[0]],
      cwEdges: cwEdges,
      ccwEdges: ccwEdges
    });
  }

  /* -------------------------------------------- */

  /**
   * Identify the collision points between an emitted Ray and a set of active edges.
   * @param {Ray} ray                   The candidate ray to test
   * @param {EdgeSet} activeEdges       The set of active edges
   * @returns {PolygonVertex[]}         A sorted array of collision points
   * @private
   */
  _getRayCollisions(ray, activeEdges) {
    const collisions = [];
    const keys = new Set();

    // Identify unique collision points
    for ( let edge of activeEdges ) {
      const x = foundry.utils.lineLineIntersection(ray.A, ray.B, edge.A, edge.B);
      if ( !x || (x.t0 <= 0) ) continue;
      let c = PolygonVertex.fromPoint(x, {distance: x.t0});
      if ( keys.has(c.key) ) {
        c = keys.get(c.key);
        c.attachEdge(edge);
        continue;
      }
      keys.add(c.key);
      c.attachEdge(edge);
      collisions.push(c);
    }

    // Sort collisions on proximity to the origin
    collisions.sort((a, b) => a.distance - b.distance);

    // Add the ray termination
    const t = PolygonVertex.fromPoint(ray.B, {distance: 1.0});
    if ( !keys.has(t.key) ) collisions.push(t);
    return collisions;
  }

  /* -------------------------------------------- */

  /**
   * Partition the edges connected to a vertex into clockwise and counter-clockwise sets.
   * @param {Ray} ray                     The emitted ray being tested
   * @param {PolygonVertex} vertex        The targeted vertex
   * @returns {EdgeSet[]}                 Clockwise and counter-clockwise edges
   * @private
   */
  _partitionVertexEdges(ray, vertex) {
    const cwEdges = new Set();
    const ccwEdges = new Set();
    for ( let edge of vertex.edges ) {
      if(vertex.equals(edge.leftEndpoint)) cwEdges.add(edge);
      else ccwEdges.add(edge);
    }
    return [cwEdges, ccwEdges];
  }

  /* -------------------------------------------- */

  /**
   * Update the set of active edges given the result of an emitted ray.
   * @param {Ray} ray                       The emitted ray
   * @param {CollisionResult} result        The collision result
   * @param {EdgeSet} activeEdges           The set of currently active edges
   * @private
   */
  _updateActiveEdges(ray, result, activeEdges) {

    // Remove walls which are counter-clockwise from the target vertex
    for ( let ccw of result.ccwEdges ) {
      activeEdges.delete(ccw);
    }

    // Add walls which are clockwise from the target vertex
    for ( let cw of result.cwEdges ) {
      activeEdges.add(cw);
    }
  }

  /* -------------------------------------------- */

  /**
   * Test whether an edge continues clockwise relative to an emitted ray.
   * @param {Ray} ray                         The emitted ray
   * @param {PolygonEdge} edge                The edge to test
   * @param {number} epsilon                  A permitted tolerance of error
   * @private
   */
  _testEdgeContinuation(ray, edge, epsilon=1e-8) {
    const oa = foundry.utils.orient2dFast(ray.A, ray.B, edge.A);
    if ( oa < 0-epsilon ) return true;
    const ob = foundry.utils.orient2dFast(ray.A, ray.B, edge.B);
    return ob < 0-epsilon;
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

    // Add points for rays in the sweep
    let lastRay;
    for ( let ray of this.rays ) {
      if ( !ray.result.collisions.length ) continue;

      // Add padding points for limited radius polygons where the prior ray has no clockwise edges
      if ( hasLimitedRadius && lastRay && !lastRay.result.cwEdges.size ) {
        const padding = this._getPaddingPoints(lastRay, ray);
        for ( let p of padding ) {
          this.points.push(p.x, p.y);
        }
      }

      // Add collision points for the ray
      for ( let c of ray.result.collisions ) {
        this.points.push(c.x, c.y);
      }
      lastRay = ray;
    }

    // Final padding rays, if necessary
    if ( hasLimitedRadius && !lastRay.result.cwEdges.size ) {
      const padding = this._getPaddingPoints(lastRay, this.rays[0]);
      for ( let p of padding ) {
        this.points.push(p.x, p.y);
      }
    }

    // Close the limited shape
    if ( hasLimitedAngle ) {
      this.points.push(this.origin.x, this.origin.y);
    }
  }

  /* -------------------------------------------- */

  /**
   * Add additional points to limited-radius polygons to approximate the curvature of a circle
   * @param {Ray} r0        The prior ray that collided with some vertex
   * @param {Ray} r1        The next ray that collides with some vertex
   * @private
   */
  _getPaddingPoints(r0, r1) {
    const density = Math.PI / this.config.density;
    const padding = [];

    // Determine padding delta
    let d = r1.angle - r0.angle;
    if ( d < 0 ) d += (2*Math.PI); // Handle cycling past pi
    const nPad = Math.floor(d / density);
    if ( nPad === 0 ) return [];

    // Construct padding rays
    const delta = d / nPad;
    for ( let i=1; i<nPad; i++ ) {
      const p = r0.shiftAngle(i * delta);
      padding.push(PolygonVertex.fromPoint(p.B));
    }
    return padding;
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
    if ( !wall.data[type] || wall.isOpen ) return false;

    // Ignore walls which are exactly in-line with the origin, except for movement
    const side = wall.orientPoint(origin);
    if ( (type !== "move") && (side === CONST.WALL_DIRECTIONS.BOTH) ) return false;

    // Ignore one-directional walls which are facing away from the origin
    return !wall.data.dir || (side === wall.data.dir);
  }

  /* -------------------------------------------- */

  /**
   * Test whether a vertex lies between two boundary rays
   * @param {PolygonVertex} vertex    The target vertex
   * @param {Ray} rMin                The counter-clockwise bounding ray
   * @param {Ray} rMax                The clockwise bounding ray
   * @returns {boolean}               Is the vertex between the two rays?
   */
   static pointBetweenRays(vertex, rMin, rMax) {
     const ccw = foundry.utils.orient2dFast;
     const a = Math.abs(rMax.angle - rMin.angle);

     // If the angle is greater than 180, eliminate vertices that are outside
     if (a > Math.PI) {
       const outside = (ccw(rMin.A, rMin.B, vertex) > 0) || (ccw(rMin.A, rMax.B, vertex) < 0);
       return !outside;
     }

     // Otherwise keep vertices that are inside
     else {
       return (ccw(rMin.A, rMin.B, vertex) <= 0) && (ccw(rMin.A, rMax.B, vertex) >= 0);
     }
   }

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
    text.removeChildren();

    // Define limitation colors
    const limitColors = {
      [CONST.WALL_SENSE_TYPES.NONE]: 0x77E7E8,
      [CONST.WALL_SENSE_TYPES.NORMAL]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.LIMITED]: 0x81B90C
    }

    // Draw the final polygon shape
    dg.beginFill(0x00AAFF, 0.25).drawShape(this).endFill();

    // Draw limiting radius
    if ( hasLimitedRadius ) {
      dg.lineStyle(8, 0xAACCFF, 0.5).drawCircle(this.origin.x, this.origin.y, radius);
    }

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
      if ( !ray.result ) continue;
      const {c0,c1} = ray.result;
      dg.lineStyle(2, 0x00FF00, c1 ? 1.0 : 0.33).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);
      if ( c0 ) dg.lineStyle(1, 0x000000).beginFill(0xFF0000).drawCircle(c0.x, c0.y, 6).endFill();
      if ( c1 ) dg.lineStyle(1, 0x000000).beginFill(0xFF0000).drawCircle(c1.x, c1.y, 6).endFill();
    }
  }

  /* -------------------------------------------- */
  /*  Collision Testing                           */
  /* -------------------------------------------- */

  /**
   * Check whether a given ray intersects with walls.
   * @param {Ray} ray                   The Ray being tested
   * @param {object} [options={}]       Options which customize how collision is tested
   * @param {string} [options.type=movement]        Which collision type to check: movement, sight, sound
   * @param {string} [options.mode=any]             Which type of collisions are returned: any, closest, all
   * @return {object[]|object|boolean}  An array of collisions, if mode is "all"
   *                                    The closest collision, if mode is "closest"
   *                                    Whether any collision occurred if mode is "any"
   */
  static getRayCollisions(ray, {type="move", mode="all", debug=false}={}) {
    const origin = ray.A;

    // Identify Edges
    const edges = [];
    const walls = canvas.walls.quadtree.getObjects(ray.bounds);
    for ( let wall of walls ) {
      if ( !this.testWallInclusion(wall, ray.A, type) ) continue;
      const edge = new PolygonEdge(wall.A, wall.B, wall.data[type]);
      const intersects = foundry.utils.lineLineIntersects(edge.A, edge.B, origin, ray.B);
      if ( intersects ) {
        if ( mode === "any" ) {   // We may be done already
          if ( (wall.data[type] === CONST.WALL_SENSE_TYPES.NORMAL) || (walls.length > 1) ) return true;
        }
        edges.push(edge);
      }
    }
    if ( mode === "any" ) return false;

    // Identify Collision Points
    const collisions = [];
    const keys = new Set();
    for ( let edge of edges ) {
      const x = foundry.utils.lineLineIntersection(origin, ray.B, edge.A, edge.B);
      if ( !x || (x.t0 <= 0) ) continue;

      // If all we care about is "any" collision, we are done
      if ( mode === "any" ) return true;

      // Record the collision
      let c = PolygonVertex.fromPoint(x, {distance: x.t0});
      if ( keys.has(c.key) ) c = keys.get(c.key);
      c.attachEdge(edge);
      keys.add(c.key);
      collisions.push(c);
    }
    if ( mode === "all" ) return collisions;

    // Find Closest Collision
    collisions.sort((a, b) => a.distance - b.distance);
    if ( collisions[0].type === CONST.WALL_SENSE_TYPES.LIMITED ) collisions.shift();

    // Visualize
    if ( debug ) this._visualizeCollision(ray, edges, collisions);
    return collisions[0] || null;
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
    }

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
