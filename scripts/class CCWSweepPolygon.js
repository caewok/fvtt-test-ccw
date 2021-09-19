'use strict';

import { CCWSweepWall } from "./class_CCWSweepWall.js";

/**
 * Compute a PointSourcePolygon using the "CCW Radial Sweep" algorithm.
 * This algorithm computes collisions by rotating clockwise about the origin,
 * testing against every unique endpoint. 
 * Similar to RadialSweepPolygon but checks whether endpoints are clockwise or counter-
 * clockwise compared to an origin point.
 * 
 * @extends {PointSourcePolygon}
 */
class CCWSweepPolygon extends PointSourcePolygon {

  /**
   * The limiting radius of the polygon, if applicable
   * @type {object}
   * @property {string} type          The type of polygon being computed
   * @property {number} [angle=360]   The angle of emission, if limited
   * @property {number} [density=6]   The desired density of padding rays, a number per PI
   * @property {number} [radius]      A limited radius of the resulting polygon
   * @property {number} [rotation]    The direction of facing, required if the angle is limited
   * @property {boolean} [debug]      Display debugging visualization and logging for the polygon
   */
  config = {};
  
  /**
   * Mapping of CCWSweepPoints objects used to compute this polygon
   */
  endpoints = new Map();  
  
  /**
   * Mapping of CCWSweepWall objects that can affect this polygon.
   */
  walls = new Map(); 
  
  /** @inheritdoc */
  compute() {
  
    // Same as RadialSweepPolygon up to this._initializeEndpoints
    let t0 = performance.now();
    const {angle, debug, rotation, type} = this.config;
    if ( this.config.radius === 0 ) return this;
    this.config.hasRadius = this.config.radius > 0;

    // Record configuration parameters
    this.config.maxR = canvas.dimensions.maxR;
    const isLimited = this.config.isLimited = angle < 360;
    this.config.aMin = isLimited ? Math.normalizeRadians(Math.toRadians(rotation + 90 - (angle / 2))) : -Math.PI;
    this.config.aMax = isLimited ? this.config.aMin + Math.toRadians(angle) : Math.PI;
    
    // Construct endpoints for each wall
    this._initializeEndpoints(type);
    
    // Iterate over endpoints and construct the Polygon geometry
    this._sweepEndpoints();
    
    // Debug sight visualization
    if(debug) {
      let t1 = performance.now();
      console.log(`Created polygon in ${Math.round(t1 - t0)}ms`);
      this.visualize();
    }  
    
    // Clean up
    delete this.endpoints;
    delete this.walls;
    return this;
  }
  
  /** @inheritdoc */
  initialize(origin, {type="sight", angle=360, density=6, radius, rotation, debug=false}={}) {
    this.origin = origin;
    this.config = {type, angle, density, radius, rotation, debug};
  }
  
  /* -------------------------------------------- */
  /*  Endpoint Management                         */
  /* -------------------------------------------- */

  /**
   * Comparable to RadialSweepPolygon version. Differences:
   * - loops using forEach
   * - converts walls to CCWSweepWall
   * - converts endpoints to CCWSweepPoint
   * - trim walls if using limited radius
   *
   * Initialize the endpoints present for walls within this Scene.
   * @param {string} type       The type of polygon being constructed in WALL_RESTRICTION_TYPES
   * @private
   */
   _initializeEndpoints(type) {
     this.walls.clear();
     this.endpoints.clear();
     
     // Consider all walls in the Scene
     // candidate walls sometimes a Set (lights), sometimes an Array (token)
     const candidate_walls = this._getCandidateWalls();
     candidate_walls.forEach(wall => {
       wall = CCWSweepWall.createCCWSweepWall(wall);
       
       // Test whether a wall should be included in the set considered for this polygon
       if(!this._includeWall(wall, type)) return;
       
       // construct endpoints if not already
       const ak = WallEndpoint.getKey(wall.A.x, wall.A.y);
       const bk = WallEndpoint.getKey(wall.B.x, wall.B.y);
       
       let a = this.endpoints.get(ak);
       let b = this.endpoints.get(bk);
       
       if(!a) { a = new CCWSweepPoint(wall.A.x, wall.A.y, 
                                      {origin: this.origin, radius: this.radius}) }
       if(!b) { b = new CCWSweepPoint(wall.B.x, wall.B.y,
                                      {origin: this.origin, radius: this.radius}) }
     
       // test for inclusion in the FOV radius
       if(this.config.hasRadius && !(a.insideRadius || b.insideRadius)) {
         // if both of these are false, then the wall can be excluded:
         // 1. no endpoint is within the FOV radius circle
         // 2. wall does not intersect the FOV radius circle
       
         // easier test is the endpoints (1), accomplished above
         // harder test is the circle intersection (2)
         // this is the first time we have 
         
         if(!(wall.radiusIntersections?.length > 0)) {
           // if no intersections found, then (2) is fals
           return;
         }
       }
       
       a.walls.add(wall);
       b.walls.add(wall);
       this.walls.set(wall.id, wall) // probably don't need {wall, a, b} 
       this.endpoints.set(ak, a); // could use a logical switch to add only if newly created
       this.endpoints.set(bk, b); // could use a logical switch to add only if newly created         
     });
     
     // add the canvas 4-corners endpoints and walls 
     // probably don't need this for radius-limited FOV?
     if(!this.config.hasRadius) { _addCanvasEdges() }
   }
   
  /* -------------------------------------------- */
  
  /**
   * Construct four walls and four endpoints representing the canvas edge.
   * Add to the walls and endpoints sets, respectively.
   */
   _addCanvasEdges() {
     let canvas_pts = [{ x: 0, y: 0 }, 
                 { x: 0, y: canvas.dimensions.height },
                 { x: canvas.dimensions.width, y: 0 },
                 { x: canvas.dimensions.width, y: canvas.dimensions.height }];
     canvas_pts.map(pt => new CCWSweepPoint(pt.x, pt.y));
     
     const canvas_walls = [
         new CCWSweepWall(canvas_pts[0], canvas_pts[1]),
         new CCWSweepWall(canvas_pts[1], canvas_pts[2]),
         new CCWSweepWall(canvas_pts[2], canvas_pts[3]),
         new CCWSweepWall(canvas_pts[3], canvas_pts[0]),
       ];
     
     
     for(let i = 0; i < 4; i += 1) {
       this.walls.set(canvas_walls[i].id, canvas_walls[i]);
       this.endpoints.set(canvas_pts[i].key, canvas_pts[i]);
     }
   } 
   
  /* -------------------------------------------- */
    
  /**
   * Same as RadialSweepPolygon version.
   *
   * Get the super-set of walls which could potentially apply to this polygon.
   * @returns {Wall[]|Set<Wall>}
   * @private
   */
  _getCandidateWalls() {
    const r = this.config.radius;
    if ( !r ) return canvas.walls.placeables;
    const o = this.origin;
    const rect = new NormalizedRectangle(o.x - r, o.y - r, 2*r, 2*r);
    return canvas.walls.quadtree.getObjects(rect);
  }
  
  /* -------------------------------------------- */
  
  /**
   * Comparable to RadialSweepPolygon version. Differences:
   * - Uses CCWSweepWall method whichSide for one-directional walls.
   *
   * Test whether a Wall object should be included as a candidate for collision from the polygon origin
   * @param {Wall} wall         The Wall being considered
   * @param {string} type       The type of polygon being computed
   * @returns {boolean}         Should the wall be included?
   * @private
   */
  _includeWall(wall, type) { 
    // Special case - coerce interior walls to block light and sight
    const type = this.config.type;
    const isInterior = ( type === "sight" ) && wall.isInterior;
    if(isInterior) return true;

    // Ignore non-blocking walls and open doors
    if(!wall.data[type] || wall.isOpen) return false;

    // Ignore one-directional walls which are facing away from the origin
    if(!wall.data.dir) return true; // wall not one-directional 
    
    return wall.whichSide(this.origin) === wall.data.dir;
  }
  
  /* -------------------------------------------- */
  /*  CCW Radial Sweep                            */
  /* -------------------------------------------- */
  
  
  
  
  
}