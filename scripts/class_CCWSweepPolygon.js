'use strict';

import { CCWSweepWall }       from "./class_CCWSweepWall.js";
import { CCWSweepPoint }      from "./class_CCWSweepPoint.js";
import { CCWSightRay }        from "./class_CCWSightRay.js";
import { PotentialWallList }  from "./class_PotentialWallList.js";
import { Bezier }             from "./class_Bezier.js";

/**
 * Compute a PointSourcePolygon using the "CCW Radial Sweep" algorithm.
 * This algorithm computes collisions by rotating clockwise about the origin,
 * testing against every unique endpoint. 
 * Similar to RadialSweepPolygon but checks whether endpoints are clockwise or counter-
 * clockwise compared to an origin point.
 * 
 * @extends {PointSourcePolygon}
 */
export class CCWSweepPolygon extends PointSourcePolygon {

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
     
     const opts = {origin: this.origin, radius: this.config.radius};
     
     // Consider all walls in the Scene
     // candidate walls sometimes a Set (lights), sometimes an Array (token)
     const candidate_walls = this._getCandidateWalls();
     candidate_walls.forEach(wall => {
       wall = CCWSweepWall.createCCWSweepWall(wall, opts);
       
       // Test whether a wall should be included in the set considered for this polygon
       if(!this._includeWall(wall, type)) return;
       
       // construct endpoints if not already
       const ak = WallEndpoint.getKey(wall.A.x, wall.A.y);
       const bk = WallEndpoint.getKey(wall.B.x, wall.B.y);
       
       let a = this.endpoints.get(ak);
       let b = this.endpoints.get(bk);
       
       if(!a) { a = new CCWSweepPoint(wall.A.x, wall.A.y, opts); }
       if(!b) { b = new CCWSweepPoint(wall.B.x, wall.B.y, opts); }
     
       // test for inclusion in the FOV radius
       if(this.config.hasRadius && !(a.insideRadius || b.insideRadius)) {
         // if both of these are false, then the wall can be excluded:
         // 1. no endpoint is within the FOV radius circle
         // 2. wall does not intersect the FOV radius circle
       
         // easier test is the endpoints (1), accomplished above
         // harder test is the circle intersection (2)
         
         // if no intersections found, then (2) is false
         if(!(wall.radiusIntersections.length > 0)) return;
         
         // add the intersection points to the set of endpoints to sweep
         wall.radiusIntersections.forEach(i => {
             const pt = new CCWSweepPoint(i.x, i.y, opts);
             pt.walls.add(wall);
             this.endpoints.set(pt.key, pt);
         });   
       }
       
       // all tests concluded; add wall and endpoints to respective tracking lists.
       a.walls.add(wall);
       b.walls.add(wall);
       this.walls.set(wall.id, wall);
       if(!this.endpoints.has(ak)) { this.endpoints.set(ak, a); } 
       if(!this.endpoints.has(bk)) { this.endpoints.set(bk, b); }
     });
     
     // add the canvas 4-corners endpoints and walls 
     this._addCanvasEdges();
   }
   
  /* -------------------------------------------- */
  
  /**
   * Construct four walls and four endpoints representing the canvas edge.
   * Add to the walls and endpoints sets, respectively.
   */
   _addCanvasEdges() {
     const opts = {origin: this.origin, radius: this.config.radius};

     // organize clockwise from 0,0
     let canvas_pts = [{ x: 0, y: 0 }, 
                 { x: canvas.dimensions.width, y: 0 },
                 { x: canvas.dimensions.width, y: canvas.dimensions.height },
                 { x: 0, y: canvas.dimensions.height }];
     canvas_pts = canvas_pts.map(pt => new CCWSweepPoint(pt.x, pt.y, opts));
     
     const canvas_walls = [
         new CCWSweepWall(canvas_pts[0], canvas_pts[1], opts),
         new CCWSweepWall(canvas_pts[1], canvas_pts[2], opts),
         new CCWSweepWall(canvas_pts[2], canvas_pts[3], opts),
         new CCWSweepWall(canvas_pts[3], canvas_pts[0], opts),
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
  
  /**
   * Sweep clockwise around known all endpoints, constructing the polygon as we go.
   * @private
   */
  _sweepEndpoints() {
    const origin = this.origin;
    const { isLimited, aMin, aMax, hasRadius } = this.config;
    this.points = []; // collision points that make up the polygon
    
    // ----- INITIAL RAY INTERSECTION ---- //
    // Begin with a ray at the lowest angle to establish initial conditions
    // If the FOV has a limited angle, then get the max as well.
    // Can avoid using FromAngle if aMin is -π, which means it goes due west
    const minRay = (aMin === -Math.PI) ? 
                 CCWSightRay.fromReference(origin, 
                                           {x: origin.x - 100, y: origin.y}, 
                                           radius) :
                 CCWSightRay.fromAngle(origin, aMin, radius);  
    const maxRay = isLimited ? 
                 CCWSightRay.fromAngle(origin, aMax, radius) : 
                 undefined;
                 
    // ----- LIMITED ANGLE FILTER ----- //
    if(isLimited) { this._trimEndpointsByLimitedAngle(minRay, maxRay); }
    
    // ----- SORT ENDPOINTS CW ----- //
    // Sort endpoints from CW (0) to CCW (last)
    // No radius: Sort in relation to a line due west from origin.
    // Radius: Sort from the minRay instead of from due west
    this.endpoints = isLimited ? 
                     sortEndpointsCWFrom(origin, [...this.endpoints.values()], minRay.B) :
                     sortEndpointsCW(origin, [...this.endpoints.values()]);
                     
    // ----- ADD LIMITED ANGLE ENDPOINTS ----- //
    if(isLimited) {
      endpoints.unshift(new SweepPoint(minRay.B.x, minRay.B.y)); // first endpoint
      endpoints.push(new SweepPoint(maxRay.B.x, maxRay.B.y)); // last endpoint
    }                 
    
    // ----- SWEEP CLOCKWISE ----- //
    // initialize the points
    this.points = [];
    
    hasRadius ? this._sweepEndpointsRadius(potential_walls) :
                this._sweepEndpointsNoRadius(potential_walls);
    
    // close the limited shape            
    if(isLimited) { this.points.push(origin.x, origin.y) }           
  }
  
  
  /**
   * Loop over each endpoint and add collision points.
   * Non-radius version: Assumes the FOV extends to the canvas edge 
   *   and canvas edges/vertices are included in walls/endpoints.
   * Assumes endpoints have already been sorted.
   * Assumes starting walls have been placed in the BST
   * @private
   */
  _sweepEndpointsNoRadius() {
    const endpoints = this.endpoints;
    const endpoints_ln = endpoints.length;
    const radius = this.config.maxR;
    const collisions = this.points;   
    
    const potential_walls = new PotentialWallList(this.origin); // BST ordered by closeness
    let closest_wall = undefined;
    
    for(let i = 0; i < endpoints_ln; i += 1) {
      const endpoint = endpoints[i];   
      potential_walls.addFromEndpoint(endpoint);
      
      // is this endpoint at the end of the closest_wall?
      // (if it were the beginning of a wall, that wall would not yet be the closest)
      // TO-DO: Would it be faster/better to compare the point keys?
      if(endpoint.almostEqual(closest_wall.A) || 
         endpoint.almostEqual(closest_wall.B)) {

        collisions.push(endpoint.x, endpoint.y);
        
        // get the next-closest wall (the one behind the current endpoint)
        // find its intersection point and add the collision
        // sightline --> endpoint at closest wall --> next closest wall
        
        closest_wall = potential_walls.closest();
        const ray = CCWSightRay.fromReference(origin, endpoint, radius); 
        const intersection = this._getRayIntersection(closest_wall, ray);
        
        // add the intersection point unless we already did
        // (occurs at join points of two walls)
        if(!endpoint.keyEquals(intersection)) { collisions.push(intersection.x, intersection.y) }
        
        continue;
      }
      
      // is this endpoint within the closest_wall?
      if(isLimited && 
         (Boolean(endpoint?.minLimit) || Boolean(endpoint?.maxLimit)) && 
         closest_wall.contains(endpoint)) {
        
        collisions.push(endpoint.x, endpoint.y);   
        continue; 
      }
      
      // is the endpoint in front of the closest wall? 
      if(!closest_wall.inFrontOfPoint(endpoint, origin)) {
        // Find and mark intersection of sightline --> endpoint --> current closest wall
        const ray = CCWSightRay.fromReference(origin, endpoint, radius);
        const intersection = this._getRayIntersection(closest_wall, ray);
        collisions.push(intersection.x, intersection.y);
        
        // mark this closer endpoint and retrieve the closest wall.
        collisions.push(endpoint.x, endpoint.y);
        closest_wall = potential_walls.closest();
        
        // continue;
      }
      
    }
  
    this.points = collisions;
  }
  
  /**
   * Loop over each endpoint and add collision points.
   * Radius version: Assumes the FOV extends to a defined circle 
   *   and circle intersections are included in endpoints.
   * Same basic loop as _sweepEndpointsNoRadius but with additional checks and padding.
   * Assumes endpoints have already been sorted.
   * Assumes starting walls have been placed in the BST
   * @private
   */
  _sweepEndpointsRadius() {
    const endpoints = this.endpoints;
    const endpoints_ln = endpoints.length;
    const radius = this.config.radius;
    const collisions = this.points;
    let needs_padding = false;
    
    const potential_walls = new PotentialWallList(this.origin); // BST ordered by closeness
    let closest_wall = undefined;
    
    for(let i = 0; i < endpoints_ln; i += 1) {
      const endpoint = endpoints[i];   
      potential_walls.addFromEndpoint(endpoint);
      
      // if we reach the edge of the limited FOV radius, need to pad by drawing an arc
      if(needs_padding) {
        needs_padding = false;
        
        // draw an arc from where the collisions ended to the ray for the new endpoint
        const l = collisions.length;
        const last_collision = { x: collisions[l - 2], y: collisions[l - 1] };
        const prior_ray = CCWSightRay.fromReference(origin, last_collision, radius);
        const ray = CCWSightRay.fromReference(origin, endpoint, radius);
        
        this._padRays(prior_ray, ray, collisions);
      }
      
      // is this endpoint at the end of the closest_wall?
      // (if it were the beginning of a wall, that wall would not yet be the closest)
      // TO-DO: Would it be faster/better to compare the point keys?
      if(endpoint.almostEqual(closest_wall.A) || 
         endpoint.almostEqual(closest_wall.B)) {

        if(endpoint.insideRadius) { collisions.push(endpoint.x, endpoint.y); }
        
        // get the next-closest wall (the one behind the current endpoint)
        // find its intersection point and add the collision
        // sightline --> endpoint at closest wall --> next closest wall
        
        closest_wall = potential_walls.closest();
        const ray = CCWSightRay.fromReference(origin, endpoint, radius); 
        const intersection = this._getRayIntersection(closest_wall, ray);
        
        // add the intersection point unless we already did
        // (occurs at join points of two walls)
        if(!endpoint.keyEquals(intersection)) { collisions.push(intersection.x, intersection.y) }
        
        // if the ray does not actually intersect the closest wall, we need to add padding
        if(!ray.intersects(closest_wall)) { needs_padding = true; }
        
        continue;
      }
      
      // is this endpoint within the closest_wall?
      if(closest_wall.contains(endpoint)) {
        collisions.push(endpoint.x, endpoint.y);   
        continue; 
      }
      
      // is the endpoint in front of the closest wall? 
      if(!closest_wall.inFrontOfPoint(endpoint, origin)) {
        // Find and mark intersection of sightline --> endpoint --> current closest wall
        const ray = CCWSightRay.fromReference(origin, endpoint, radius);
        const intersection = this._getRayIntersection(closest_wall, ray);
        collisions.push(intersection.x, intersection.y);

        // if the ray does not actually intersect the closest wall, we need to add padding
        if(!ray.intersects(closest_wall)) { needs_padding = true; }
        
        // mark this closer endpoint and retrieve the closest wall.
        collisions.push(endpoint.x, endpoint.y);
        closest_wall = potential_walls.closest();
                
        // continue;
      }
      
    }
    
    // close between last / first endpoint
    // deal with unique case where there are no endpoints
    // (no blocking walls for radius vision)
    if(needs_padding || endpoints_ln === 0) {
      const collisions_ln = collisions.length;
      let p_last = collisions[collisions_ln - 1];
      let p_current = collisions[0];
      
      // if 0 or 1 collisions, then just pick an appropriate point
      // padding is best done by hemisphere in that case
      if(collisions_ln === 0) {
        p_last = { x: origin.x - radius, y: origin.y }; 
        p_current = { x: origin.x + radius, y: origin.y }
    
        collisions.push(p_last.x, p_last.y);
    
      } else if(collisions_ln === 1) {
        // get antipodal point
        p_last = { x: origin.x - (p_current.x - origin.x),
                   y: origin.y - (p_current.y - origin.y) }
      }
      
      // draw an arc from where the collisions ended to the ray for the new endpoint
      const prior_ray = CCWSightRay.fromReference(origin, p_last, radius);
      const ray = CCWSightRay.fromReference(origin, p_current, radius);
        
      this._padRays(prior_ray, ray, collisions);

      if(collisions_ln < 2) {
        // get the second half by swapping the two rays
        collisions.push(p_current.x, p_current.y);
        this._padRays(ray, prior_ray, collisions); 
      }
    }
    
    this.points = collisions;
  }
  
  /*
   * Construct a CCWSweepPoint from a ray, testing if it hits a wall.
   * Assume wall may be undefined
   * @param {CCWSweepWall} wall   Wall to test for intersection.
   * @param {CCWSightRay}  ray    Ray to test for intersection.
   * @param {CCWSweepPoint} Either the wall intersection or end of the ray
   * @private
   */
  _getRayIntersection(wall, ray) {
    let intersection = undefined;
    if(wall) { intersection = ray.intersectSegment(wall.coords); }
    return intersection ? new SweepPoint(intersection.x, intersection.y) : 
                          new SweepPoint(ray.B.x, ray.B.y);
  }
   
  
  /*
   * Trim endpoints to only those between starting and ending rays.
   * @param {CCWSightRay} r0    Starting ray
   * @param {CCWSightRay} r1    Ending ray
   * @private
   */
  _trimEndpointsByLimitedAngle(r0, r1) {
    const origin = this.origin;
    const {aMin, aMax} = this.config;
  
    if(Math.abs(aMax - aMin) > Math.PI) {
       // if aMin to aMax is greater than 180º, easier to determine what is out
      // if endpoint is CCW to minRay and CW to maxRay, it is outside
      this.endpoints.forEach(e => {
        if(ccwPoints(origin, r0.B, e) > 0 || 
           ccwPoints(origin, r1.B, e) < 0) {
          const k = CCWSweepPoint.getKey(e.x, e.y);
          this.endpoints.delete(k);
          }
      });
      
    } else {
      // if aMin to aMax is less than 180º, easier to determine what is in
      // endpoint is CW to minRay and CCW to maxRay, it is inside
      this.endpoints.forEach(e => {
        if(!(ccwPoints(origin, r0.B, e) <= 0 && 
             ccwPoints(origin, r1.B, e) >= 0)) {
          const k = CCWSweepPoint.getKey(e.x, e.y);
          this.endpoints.delete(k);
        }
      });
    }
  
  }
  
  /*
   * Sort an array of points from CW to CCW, in relation to line due west from origin.
   * so array[0] would be the first point encountered if moving clockwise from the line.
   *    array[last] would be the last point encountered.
   * (to sort the other direction, reverse the signs of the constants)
   * @param {{x: number, y: number}}    origin      Point to sort against
   * @param {[{x: number, y: number}]}  endpoints   Array of points to sort
   * @return {[{x: number, y: number}]} Sorted array of points from CW to CCW
   */ 
  static sortEndpointsCW(origin, endpoints) {
    const TOP = -1;
    const BOTTOM = 1;
    const LEFT = -1;
    const RIGHT = 1;
          
    return endpoints.sort((a, b) => {
      // arbitrarily declare upper hemisphere to be first
      // so x < vision_point (above) is before x > vision_point (below)
      // walk quadrants, so Q1 is upper left, Q3 is lower right
      // return > 0 to sort b before a
    
    
      // most of this is just to speed up the sort, by checking quadrant location first 
      const a_hemisphere = a.y < origin.y ? TOP : BOTTOM;
      const b_hemisphere = b.y < origin.y ? TOP : BOTTOM;
    
      // if not in same hemisphere, sort accordingly
      if(a_hemisphere !== b_hemisphere) return a_hemisphere; 
      // TOP:  b before a (1)
      // BOTTOM: a before b (-1)
    
      const a_quadrant = a.x < origin.x ? LEFT : RIGHT;
      const b_quadrant = b.x < origin.x ? LEFT : RIGHT;
    
      if(a_quadrant !== b_quadrant) {
        // already know that a and b share hemispheres
        if(a_hemisphere === TOP) {
          return a_quadrant;
          // TOP, LEFT: b before a (1)
          // TOP, RIGHT: a before b (-1)
        } else {
          return -a_quadrant;
          // BOTTOM, LEFT: a before b (-1)
          // BOTTOM, RIGHT: b before a (1)
        }
      }
        
      return -orient2dPoints(origin, a, b);
   
    });
  }
  
  /*
   * Same as sortEndpointsCW but sort from a baseline other than due west.
   * Accomplish by adding in a reference point to the endpoints list, then sorting.
   * Then shift the array based on reference point
   * sortEndpointsCWFrom(origin, endpoints, {x: origin.x - 100, y: origin.y}) should equal
   * sortEndpointsCW(origin, endpoints)
   * @param {{x: number, y: number}}    origin      Point to sort against
   * @param {[{x: number, y: number}]}  endpoints   Array of points to sort
   * @param {x: number, y: number}  reference point to be the 0th point
   * @return {[{x: number, y: number}]} Sorted array of points from CW to CCW
   */
  static sortEndpointsCWFrom(origin, endpoints, reference) {
    reference.sort_baseline = true;
    endpoints.push(reference);
  
    const sorted = CCWSweepPolygon.sortEndpointsCW(origin, endpoints);
    const idx = sorted.findIndex(e => Boolean(e?.sort_baseline));
    const ln = sorted.length
  
    // easy cases
    if(idx === 0) {
      sorted.shift();
      return sorted;
    } else if(idx === ln) {
      sorted.pop();
      return sorted;
    } else {
       //sorted.slice(idx+1, ln).push([...sorted.slice(0, idx)])
       //return sorted;
       return sorted.slice(idx+1, ln).concat(sorted.slice(0, idx));
    }
  }  
  
  /*
   * Draw a circular arc between two points.
   * Add to collisions each point on the arc, given a defined padding radian distance.
   * https://www.measurethat.net/Benchmarks/Show/4223/0/array-concat-vs-spread-operator-vs-push
   * @param {CCWSightRay} r0        The prior CCWSightRay that was tested
   * @param {CCWSightRay} r1        The next CCWSightRay that will be tested
   * @param {[number]} collisions   Array of collision points to which to add
   * @return {[number]} The updated collisions array
   */
  _addPadding(r0, r1, collisions) {
    const padding = Math.PI / Math.max(this.config.density, 6);
    
    if(game.modules.get(MODULE_ID).api.use_bezier) return Bezier.bezierPadding(r0, r1, padding, collisions);
    
    // Determine padding delta
    // This part is from RadialSweepPolygon._addPadding
    let d = r1.angle - r0.angle;
    if ( d < 0 ) d += (2 * Math.PI); // Handle cycling past pi
    const nPad = Math.floor(d / padding);
    if ( nPad === 0 ) return [];

    // Construct padding rays
    const delta = d / nPad;
    let lr = r0;
    for (let i = 1; i < nPad; i += 1) {
      let r = r0.shiftAngle(i * delta);
      collisions.push(r.B.x, r.B.y);
    }
    return collisions;
  }  
  
  
}
