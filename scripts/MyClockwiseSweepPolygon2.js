/* globals 


*/

'use strict';

/* globals 

PolygonVertex, 
ClockwiseSweepPolygon,
CONST,
foundry,
PIXI,
canvas,
game,

*/

'use strict';

import { LinkedPolygon } from "./LinkedPolygon.js";
import { log, MODULE_ID } from "./module.js";


/*
Basic concept: 
Create limited radius or limited angle by intersecting a shape with the basic
ClockwiseSweep computed polygon.

Changes to ClockwiseSweep:
- Walls are trimmed only by an encompassing rectangle. Radius is converted to rectangle.
- All limited radius or limited angle calculations are removed.
- After points are computed, use LinkedPolygon.intersect to trim the fov to the desired  shape.
- User can specify a boundaryPolygon in config. If not specified, one will be calculated as needed for limited radius or limited angle.
- Optional: user can specify custom edges to add to the sweep. Used to cache walls for unique shapes (e.g., river boundary or road boundary) that affect only certain light or sound objects. Could also be used to limit token vision in unique, custom ways.

Changes to PolygonEdge:
- Need to handle edges that are not associated with a wall
- Need to be able to quickly identify intersections for a given edge
  (Use the left/right endpoint sort algorithm comparable to walls intersection)
  

*/

class MyClockwiseSweepPolygon2 extends PointSourcePolygon {

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
   * @type {Ray[]}
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

    // Configure limited radius
    cfg.hasLimitedRadius = cfg.radius > 0;
    cfg.radius = cfg.radius ?? canvas.dimensions.maxR;
    cfg.radius2 = Math.pow(cfg.radius, 2);
    cfg.radiusE = 0.5 / cfg.radius;

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
      cfg.rMax = Ray.fromAngle(origin.x, origin.y, cfg.aMax, cfg.radius);
    }
    cfg.rMin = Ray.fromAngle(origin.x, origin.y, cfg.aMin, cfg.radius);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _compute() {

    
    
    // Step 1 - Identify candidate edges
    let t0 = performance.now();
    this._identifyEdges();
    let t1 = performance.now();
    
    if(this.config.debug) {
      console.log(`Clockwise _identifyEdges in ${(t1 - t0).toPrecision(2)}ms`);
    }
     
    // Step 2 - Construct vertex mapping
    t0 = performance.now();
    this._identifyVertices();
    t1 = performance.now();
    
    if(this.config.debug) {
      console.log(`Clockwise _identifyVertices in ${(t1 - t0).toPrecision(2)}ms`);
    }

    // Step 3 - Radial sweep over endpoints
    t0 = performance.now();
    this._executeSweep();
    t1 = performance.now();
    
    if(this.config.debug) {
      console.log(`Clockwise _executeSweep in ${(t1 - t0).toPrecision(2)}ms`);
    }

   
    // Step 4 - Build polygon points
    t0 = performance.now();
    this._constructPolygonPoints();
    t1 = performance.now();
    
    if(this.config.debug) {
      console.log(`Clockwise _constructPolygonPoints in ${(t1 - t0).toPrecision(2)}ms`);
    }
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
      const edge = MyPolygonEdge.fromWall(wall, type);
      this.edges.add(edge);
    }

    // Add edges for the canvas boundary
    for ( let boundary of canvas.walls.boundaries ) {
      this.edges.add(MyPolygonEdge.fromWall(boundary, type));
    }

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
    if ( !this.config.hasLimitedRadius ) return canvas.walls.placeables;
    const o = this.origin;
    const r = this.config.radius;
    const rect = new NormalizedRectangle(o.x - r, o.y - r, 2*r, 2*r);
    return Array.from(canvas.walls.quadtree.getObjects(rect).values());
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

  /**
   * Process the candidate edges to further constrain them using a circular radius of effect.
   * @private
   */
  _constrainEdgesByRadius() {
    const {angle, hasLimitedAngle, radius, rMin, rMax} = this.config;
    const constrained = [];
    for ( let edge of this.edges ) {
      const x = foundry.utils.lineCircleIntersection(edge.A, edge.B, this.origin, radius);

      // Fully outside - remove this edge
      if ( x.outside ) {
        this.edges.delete(edge);
        continue
      }

      // Fully contained - include this edge directly
      if ( x.contained ) continue;

      // Partially contained - partition the edge into the constrained segment
      const points = x.intersections;
      if ( x.aInside ) points.unshift(edge.A);
      if ( x.bInside ) points.push(edge.B);

      // Create a partitioned segment
      this.edges.delete(edge);
      const c = new MyPolygonEdge(points.shift(), points.pop(), edge.type, edge.wall);
      if ( c.A.equals(c.B) ) continue;  // Skip partitioned edges with length zero
      constrained.push(c);

      // Flag partitioned points which reached the maximum radius
      if ( !x.aInside ) c.A._distance = 1;
      if ( !x.bInside ) c.B._distance = 1;
    }

    // Add new edges back to the set
    for ( let e of constrained ) {
      this.edges.add(e);

      // If we have a limited angle, we need to re-check whether the constrained points are inside
      if ( hasLimitedAngle ) {
        e.A._inLimitedAngle = this.constructor.pointBetweenRays(e.A, rMin, rMax, angle);
        e.B._inLimitedAngle = this.constructor.pointBetweenRays(e.B, rMin, rMax, angle);
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
   * @param {Map<string,MyPolygonEdge>} wallEdgeMap    A mapping of wall IDs to MyPolygonEdge instances
   * @private
   */
  _identifyIntersections(wallEdgeMap) {
    const processed = new Set();
    const o = this.origin;
    const { angle, hasLimitedAngle, radius2, rMin, rMax } = this.config;
    for ( let edge of this.edges ) {

      // If the edge has no intersections, skip it
      if ( !edge.wall?.intersectsWith.size ) continue;

      // Check each intersecting wall
      for ( let [wall, i] of edge.wall.intersectsWith.entries() ) {

        // Some other walls may not be included in this polygon
        const other = wallEdgeMap.get(wall.id);
        if ( !other || processed.has(other) ) continue;

        // Verify that the intersection point is still contained within the radius
        const r2 = Math.pow(i.x - o.x, 2) + Math.pow(i.y - o.y, 2);
        if ( r2 > radius2 ) continue;

        // Register the intersection point as a vertex
        let v = PolygonVertex.fromPoint(i);
        if ( this.vertices.has(v.key) ) v = this.vertices.get(v.key);
        else {
          // Ensure the intersection is still inside our limited angle
          if ( hasLimitedAngle && !this.constructor.pointBetweenRays(v, rMin, rMax, angle) ) continue;
          this.vertices.set(v.key, v);
        }

        // Attach edges to the intersection vertex
        if ( !v.edges.has(edge) ) v.attachEdge(edge, 0);
        if ( !v.edges.has(other) ) v.attachEdge(other, 0);
      }
      processed.add(edge);
    }
  }
  

/* MyPolygonEdge
Needs:
- fromWall method (wall, type)
- A, B
- ._nw, ._se
- intersectsWith map 
- id



/**
 * Compare function to sort point by x, then y coordinates
 * @param {Point} a
 * @param {Point} b
 * @return {-1|0|1} 
 */
function compareXY(a, b) {
  if ( a.x === b.x ) return a.y - b.y;
  else return a.x - b.x;
}

class MyPolygonEdge {
  constructor(a, b, type=CONST.WALL_SENSE_TYPES.NORMAL, wall) {
    this.A = new PolygonVertex(a.x, a.y);
    this.B = new PolygonVertex(b.x, b.y);
    this.type = type;
    this.wall = wall;
  }

  /**
   * Is this edge limited in type?
   * @returns {boolean}
   */
  get isLimited() {
    return this.type === CONST.WALL_SENSE_TYPES.LIMITED;
  }

  /**
   * Construct a PolygonEdge instance from a Wall placeable object.
   * @param {Wall|WallDocument} wall  The Wall from which to construct an edge
   * @param {string} type             The type of polygon being constructed
   * @returns {PolygonEdge}
   */
  static fromWall(wall, type) {
    const c = wall.data.c;
    return new this({x: c[0], y: c[1]}, {x: c[2], y: c[3]}, wall.data[type], wall);
  }
}

