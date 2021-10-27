/* globals PointSourcePolygon, WallEndpoint, canvas, NormalizedRectangle, game, CONST */
'use strict';


import { CCWPoint }           from "./class_CCWPoint.js";
import { CCWPixelPoint }      from "./class_CCWPixelPoint.js";
import { CCWSweepWall }       from "./class_CCWSweepWall.js";
import { CCWSweepPoint }      from "./class_CCWSweepPoint.js";
import { CCWRay }             from "./class_CCWRay.js";
import { CCWPixelRay }        from "./class_CCWPixelRay.js";
import { PotentialWallList }  from "./class_PotentialWallList.js";
import { Bezier }             from "./class_Bezier.js";
import { MODULE_ID }	        from "./module.js";
import { IdentifyIntersections } from "./class_IntersectionSweep.js";    
import { COLORS }             from "./util.js";     

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
  constructor(...args) {
    super(...args);

    //console.log(`testccw|Constructing polygon`); 

    //console.log(`${MODULE_ID}|CCWSweepPolygon created.`);
  
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
    this.config = {};
  
    /**
     * Mapping of CCWSweepPoints objects used to compute this polygon
     */
    this.endpoints = new Map();  
  
    /**
     * Mapping of CCWSweepWall objects that can affect this polygon.
     */
    this.walls = new Map(); 
    
    this.start_walls = []; // Array of walls that intersect the starting ray
    this.endpoints_sorted = [];
    this.ray_history = [];
    
    
  }
  
  /** @inheritdoc */
  compute() {
    //console.log(`testccw|Computing polygon`); 
  
    this._preprocessWalls();
  
    // Same as RadialSweepPolygon up to this._initializeEndpoints
    let t0 = performance.now();
           
    // Construct endpoints for each wall
    this._initializeEndpoints();
    
    // If limited angle of vision, trim endpoints
    if(this.config.isLimited) { 
      this._trimEndpointsByLimitedAngle(this.config.rMin, this.config.rMax); 
    }
    
    // Iterate over endpoints and construct the Polygon geometry
    this._sweepEndpoints();
    
    // Debug sight visualization
    if(this.config.debug) {
      let t1 = performance.now();
      console.log(`Created polygon in ${Math.round(t1 - t0)}ms`);
      this.visualize();
    }  

    //console.log(`testccw|${this.points.length} points`, this.points);
    
    // Clean up
//    delete this.endpoints;
//    delete this.walls;
//    delete this.ray_history;
//    delete this.endpoints_sorted;
    return this;
  }
  
  /** @inheritdoc */
  initialize(origin, {type="sight", angle=360, density=6, radius, rotation=0, debug=false} = {}) {  
    //console.log(`testccw|Initializing polygon`); 
    super.initialize(origin, {type, angle, density, radius, rotation, debug});
    const cfg = this.config;

    if(game.modules.get('testccw').api.debug) cfg.debug = true;
    
    this.origin = CCWPixelPoint.fromPoint(origin);
    
    // configure limited radius
    cfg.maxR = canvas.scene.dimensions.maxR;
    cfg.hasRadius = cfg.radius > 0;
    cfg.radius = cfg.radius ?? cfg.maxR;
    cfg.radius2 = Math.pow(cfg.radius, 2);
    
    // configure limited angle
    cfg.aMin = -Math.PI;
    cfg.aMax = Math.PI;
    cfg.isLimited = cfg.angle < 360;
    if(cfg.isLimited) {
      cfg.aMin = Math.normalizeRadians(Math.toRadians(cfg.rotation + 90 - (cfg.angle / 2)));
      cfg.aMax = cfg.aMin + Math.toRadians(cfg.angle);
      cfg.rMax = CCWPixelRay.fromAngle(origin.x, origin.y, cfg.aMax, cfg.radius || cfg.maxR);
    } 
    cfg.rMin = CCWPixelRay.fromAngle(origin.x, origin.y, cfg.aMin, cfg.radius || cfg.maxR);
    
    if(cfg.debug) {
      this.ray_history = [cfg.rMin];  // for debugging with visualize
      if(cfg.rMax) { this.ray_history.push(cfg.rMax) }
    }
  }
  
  /** @override */
  visualize() {
    canvas.controls.debug.clear();
        
    // Text debugging
    if ( canvas.controls.debug.polygonText ) { 
       canvas.controls.debug.polygonText.removeChildren();
    }
    
    // draw endpoints in neutral gray (will color collisions later)
    this.endpoints.forEach(e => e.draw(COLORS.gray))
    
    // label endpoints in order
    this.endpoints_sorted.forEach((e, idx) => e.label(idx));
    
    // Define limitation colors & draw candidate edges
    const limitColors = {
      [CONST.WALL_SENSE_TYPES.NONE]: 0x77E7E8,
      [CONST.WALL_SENSE_TYPES.NORMAL]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.LIMITED]: 0x81B90C
    }
    
    this.walls.forEach(w => w.draw(limitColors[w.data[w.type]]));
    
    // draw rays
    this.ray_history.forEach(r => r.draw(COLORS.blue, .7));
    
    // draw collisions
    const ln = this.points.length;
    for(let i = 0; i < ln; i += 2) {
      const c = new CCWPoint(this.points[i], this.points[i+1]);
      c.draw(COLORS.red);
    }
    
    
  }

  /* -------------------------------------------- */
  /*  Endpoint Management                         */
  /* -------------------------------------------- */
  
  
  /**
   * Preprocess walls. Needed when walls change in the scene.
   * TO-DO: Should pull all walls, and later trim by quad tree rectangle.
   * Could do by filter the wall ids returned by _getCandidateWalls
   * @private
   */
   _preprocessWalls() {
     let candidate_walls = this._getCandidateWalls();
     if(!(candidate_walls instanceof Array)) candidate_walls = [...candidate_walls.values()]; 
     
     candidate_walls.push(...this._getCanvasEdges());
     
     if(game.modules.get(MODULE_ID).api.detect_intersections) { 
       candidate_walls = IdentifyIntersections.processWallIntersectionsSimpleSweep(candidate_walls); 
     } else {
       candidate_walls = candidate_walls.map(w => CCWSweepWall.create(w))
     }
     
     this.walls = candidate_walls;
   }

  /**
   * Comparable to RadialSweepPolygon version. Differences:
   * - loops using forEach
   * - converts walls to CCWSweepWall
   * - converts endpoints to CCWSweepPoint
   * - trim walls if using limited radius
   *
   * Initialize the endpoints present for walls within this Scene.
   * @private
   */
   _initializeEndpoints() {
     let candidate_walls = this.walls;
     this.endpoints.clear()
     
     const origin = this.origin;
     const { type, hasRadius, radius, radius2, rMin } = this.config;
          
     if(type === "light" && game.modules.get(MODULE_ID).api.light_shape !== "circle") {
       // construct a specialized light shape
       // radius informs the shape but otherwise is turned off; rely on border walls
       // add these border walls and identify intersections
       // TO-DO: Permit arbitrary polygons, possibly taken from user drawing on map
       let points;
       switch(game.modules.get(MODULE_ID).api.light_shape) {
         case "triangle": 
           points = [0, 120, 240];
           break;
         case "square":
           points = [0, 90, 180, 270];
           break;
       }
       
       const poly_walls = this.constructGeometricShapeWalls(points);
       candidate_walls.push(...poly_walls);
       
       candidate_walls = IdentifyIntersections.processWallIntersectionsSimpleSweep(candidate_walls); 
     }
     
//      if(isLimited) {
//        // add limited angle walls
//        wMin = new CCWSweepWall(rMin.A, rMin.B);
//        wMax = new CCWSweepWall(rMax.A, rMax.B);
//        candidate_walls.push(wMin, wMax);
//        candidate_walls = IdentifyIntersections.processWallIntersectionsSimpleSweep(candidate_walls); 
//      }
     
     
     candidate_walls.forEach(wall => {       
       // update origin and type for this particular sweep
       wall.origin = origin;
       wall.type = type;
       
       // If the wall is colinear with the origin, ignore it
       //if(wall.ccwOrigin === 0) return;
     
       // Test whether a wall should be included in the set considered for this polygon
       if(!wall.include()) return;
       
       // test for inclusion in the FOV radius
       if(hasRadius) {
         wall = this.splitWallAtRadius(wall, origin, radius, radius2);
         if(!wall) return; // can skip the wall as it is outside the radius
       } 
          
       const ak = wall.A.key;
       const bk = wall.B.key;
     
       // if the two wall endpoints are nearly identical, skip the wall
       // causes problems b/c the endpoints list is by key, and so with 
       // identical keys the two endpoints only show up once, when they should be distinct
       // treat as a point, which is not a wall and does not block
       if(ak === bk) return;  
     
       // all tests concluded; add wall and endpoints to respective tracking lists.
       // link wall(s) to endpoints 
       if(this.endpoints.has(ak)) {
         const a = this.endpoints.get(ak);
         a.walls.set(wall.id, wall);
         wall.A = a;
       } else {
         this.endpoints.set(ak, wall.A);
       }
       
       if(this.endpoints.has(bk)) {
         const b = this.endpoints.get(bk);
         b.walls.set(wall.id, wall);
         wall.B = b;
       } else {
         this.endpoints.set(bk, wall.B);
       } 
       
       // add wall to starting walls if it intersects the starting ray
       if(rMin.intersects(wall)) this.start_walls.push(wall);
           
     });
     
    
   }
   
  /**
   * Test if a wall should be within a given radius and split the wall if necessary
   * to include only the portion within the radius.
   * @param {CCWSweepWall} wall  
   * @return {false|CCWSweepWall}
   */
   splitWallAtRadius(wall) {
     const origin = wall.origin;
     const type = wall.type;
     const { radius, radius2 } = this.config;
   
     const LEC2 = wall.potentiallyIntersectsCircle(origin, radius, { returnLEC2: true });
     const intersects_radius = LEC2 < radius2; // if equal, would be a tangent
     const A_inside_radius = wall.distanceSquaredOrigin.A < radius2;
     const B_inside_radius = wall.distanceSquaredOrigin.B < radius2;
     const both_inside = A_inside_radius && B_inside_radius;
           
     // if no intersection, drop if the wall is outside; use entire wall if inside      
     if(!intersects_radius) { return both_inside ? wall : false; }
     
     // if the wall intersects the radius, split wall into portion within
     const intersections = wall.intersectionsWithCircle(origin, radius, { LEC2 });
     const i0 = intersections[0];
     const i1 = intersections[1];
     
     // may have had an intersection but it was not within the segment
     // can skip if the points are outside
     if(intersections.length === 0) { return both_inside ? wall : false; }     
     
     // If two intersections found, break the wall at the intersections
     if(intersections.length === 2) return CCWSweepWall.createFromPoints(i0, i1, wall, { origin, type });
     
     // if only 1 intersection, then need to determine which wall is outside.
     // trim from outside point to intersection, leaving only the inside wall portion.
     if(A_inside_radius && (!B_inside_radius || wall.B.almostEqual(i0))) {
       return CCWSweepWall.createFromPoints(wall.A, i0, wall, { origin, type }); 
     }
     
     if(B_inside_radius && (!A_inside_radius || wall.A.almostEqual(i0))) {
       return CCWSweepWall.createFromPoints(i0, wall.B, wall, { origin, type });
     }
     
     // otherwise, if both are inside but not yet caught, return the wall.
     // remainder, if any, should be walls that barely pierce the circle and 
     // so we can ignore
     return both_inside ? wall : false;
   }
   
  /* -------------------------------------------- */
  // Geometries for artificially constraining lights
  
  /**
   * Build geometric shape from set of angles
   * Angles describe where the points should lie relative to origin.
   * Potentially rotated by rotation angle
   * Center/origin to point === radius
   * If a1 === 0, point would lie due east
   * Example:
   * constructGeometricShapeWalls([0, 120, 240]); // equilateral triangle
   * constructGeometricShapeWalls([45, 135, 225, 315]); // square
   * @return [CCWSweepWall, CCWSweepWall, CCWSweepWall]
   */
   constructGeometricShapeWalls(angles) {
     const origin = this.origin; 
     const rotation = this.config.rotation ?? 0;
     const radius = this.config.radius;
     
     // Use fromAngle to get the points relative to the origin
     const a_translated = angles.map(a => Math.normalizeRadians(Math.toRadians(a + rotation)));
     const r = a_translated.map(a => CCWRay.fromAngle(origin.x, origin.y, a, radius));
               
     // construct walls between the points
     const ln = angles.length;
     return r.map((p, idx)  => {
       const dest = (idx + 1) % ln;
       return new CCWSweepWall(p.B, r[dest].B, { origin });
     });
   }
   
   
  /* -------------------------------------------- */
  
  /**
   * Construct four walls and four endpoints representing the canvas edge.
   * Add to the walls and endpoints sets, respectively.
   */
   _getCanvasEdges() {
     // organize clockwise from 0,0
     const d = canvas.dimensions;
     const c0 = {x: 0, y: 0};
     const c1 = {x: d.width, y: 0};
     const c2 = {x: d.width, y: d.height};
     const c3 = {x: 0, y: d.height};
     
     return [
       new CCWSweepWall(c0, c1),
       new CCWSweepWall(c1, c2),
       new CCWSweepWall(c2, c3),
       new CCWSweepWall(c3, c0),
     ];
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
  
  
  
  /* -------------------------------------------- */
  /*  CCW Radial Sweep                            */
  /* -------------------------------------------- */
  
  /**
   * Sweep clockwise around known all endpoints, constructing the polygon as we go.
   * @private
   */
  _sweepEndpoints() {
    const origin = this.origin;
    const { isLimited, hasRadius, rMin, rMax } = this.config;
    const potential_walls = new PotentialWallList(origin); // BST ordered by closeness
    
    // reset the ray history
    this.ray_history = [rMin]; 
    if(rMax) this.ray_history.push(rMax);

    // ----- SORT ENDPOINTS ----- //
    // Sort endpoints from the rMin to rMax rays.
    // For non-limited vision, this will be from due west, moving clockwise.
    const endpoints = isLimited ?
      CCWSweepPolygon.sortEndpointsCWFrom(origin, [...this.endpoints.values()], rMin.B) :
      CCWSweepPolygon.sortEndpointsCW(origin, [...this.endpoints.values()]);

    
    // ----- ADD LIMITED ANGLE ENDPOINTS ----- //
   //  if(isLimited) {
//       // add endpoints at the end of the respective start/end rays
//       endpoints.unshift(CCWSweepPoint.fromPoint(rMin.B, { origin }));
//       endpoints.push(CCWSweepPoint.fromPoint(rMax.B, { origin }));
//     }

    // ----- STARTING STATE ------ //
    if(isLimited || endpoints.length > 0) {
      const start_endpoint = isLimited ? rMin.B : endpoints[0];
      const start_walls = this.start_walls.filter(w => {
        // if the starting endpoint is at the start of the wall, don't include it
        if(start_endpoint.almostEqual(w.A) || 
           start_endpoint.almostEqual(w.B)) {
          const ccw = PotentialWallList.endpointWallCCW(origin, start_endpoint, w) === 1;  
          if(!ccw) return false;
        }
        return true;    
      });

      potential_walls.addWalls(start_walls);
    }

    // ----- SWEEP CLOCKWISE ----- //
    // initialize the points
    this.points = [];
    this.endpoints_sorted = endpoints; // for debugging with visualize
    
    // open the limited shape            
    if(isLimited) { this.points.push(origin.x, origin.y) }    
    
    hasRadius ? this._sweepEndpointsRadius(potential_walls, endpoints) :
                this._sweepEndpointsNoRadius(potential_walls, endpoints);
    
    // close the limited shape            
    if(isLimited) { this.points.push(origin.x, origin.y) }           
  }
  
  
  
/* Terrain wall rules

1. Endpoint has at least one non-terrain wall: Endpoint counts as collision.
2. Endpoint has 2+ terrain walls: Endpoint counts as collision.
3. Endpoint has 2 terrain walls: 
   -- If one is in front of the other, the endpoint counts as collision. 
   (terrain walls here form a V; with one in front the one behind will become the 
   new "closest" wall, so you need the point of the V for the vision polygon). 
   -- If you can see both walls equally (you are looking directly at the point 
   of the V or you are inside the V), then the endpoint doesn't count; 
   fall back to next closest wall.
4. Default otherwise is that the endpoint does not count as a collision; fall back to the next closest wall.

Walls:
If terrain wall is the closest wall, get the second-closest.


*/ 
  
  
  /**
   * Loop over each endpoint and add collision points.
   * Non-radius version: Assumes the FOV extends to the canvas edge 
   *   and canvas edges/vertices are included in walls/endpoints.
   * Assumes endpoints have already been sorted.
   * Assumes starting walls have been placed in the BST
   * Assumes walls in line with the origin have been removed.
   * @param {PotentialWallList} potential_walls   Binary search tree ordering walls by closeness
   * @param {[CCWSweepPoint]} endpoints           Sorted (CW --> CCW) array of endpoints
   * @private
   */
  _sweepEndpointsNoRadius(potential_walls, endpoints) {

    const { type, isLimited, rMin, rMax } = this.config;
    const origin = this.origin;
    let closest_wall = potential_walls.closest({type});
    // let actual_closest_wall = potential_walls.closest({skip_terrain: false});
    
    if(isLimited) {
      // deal with the minimum limited angle ray
      // Mark either the endpoint or (more likely) the intersection with closest wall.
      if(closest_wall.blocksPoint(rMin.B, origin)) {
        // closest wall is in front of the limited endpoint; 
        // mark that point on the wall
        this._markWallIntersection(rMin.B, potential_walls);
      } else {
        // limited endpoint is in front; mark it
        this.points.push(rMin.B.x, rMin.B.y);
      }
    }
    
    const endpoints_ln = endpoints.length;
    for(let i = 0; i < endpoints_ln; i += 1) {
      const endpoint = endpoints[i];   
      closest_wall = potential_walls.closest({ type })
      
      if(endpoint.almostEqual(closest_wall.rightEndpoint)) {
        this._processEndOfWall(endpoint, potential_walls);

      } else if(!closest_wall.blocksPoint(endpoint, origin)) {
        this._processEndpointInFrontOfWall(endpoint, potential_walls);

      } else if(closest_wall.isTerrain) {
        // closest wall is terrain
        // check second closest for right of or in front of second-closest wall
        const second_closest = potential_walls.secondClosest();
        if(endpoint.almostEqual(second_closest.rightEndpoint)) {
          this._processEndOfSecondWall(endpoint, potential_walls);

        } else if(!second_closest.blocksPoint(endpoint, origin)) {
          this._processEndpointInFrontOfSecondWall(endpoint, potential_walls);

        } else {
          // endpoint behind second-closest wall; nothing more to do
          potential_walls.updateWallsFromEndpoint(endpoint);
        }
        
      } else {
        // endpoint is behind the closest wall; nothing more to do.
        potential_walls.updateWallsFromEndpoint(endpoint);
      }
    }
    
    if(isLimited) {
      // deal with the maximum limited angle ray
      // need to first update the closest wall
      closest_wall = potential_walls.closest({type});
      if(closest_wall.blocksPoint(rMax.B, origin)) {
        // closest wall is in front of the limited endpoint; 
        // mark that point on the wall
        this._markWallIntersection(rMax.B, potential_walls);
      } else {
        // limited endpoint is in front; mark it
        this.points.push(rMax.B.x, rMax.B.y);
      }
    }
  }
  
  _sweepEndpointsRadius(potential_walls, endpoints) {
    //console.log(`testccw|_sweepEndpointsRadius`);
    const { type, isLimited, rMin, rMax } = this.config;
    const origin = this.origin;
    let closest_wall = potential_walls.closest({type});
    //let actual_closest_wall = potential_walls.closest({skip_terrain: false});
    
    let needs_padding = false;
    
    if(isLimited) {
      // deal with the minimum limited angle ray
      if(!closest_wall) {
        this.points.push(rMin.B.x, rMin.B.y);
        needs_padding = true;
      } else if(closest_wall.blocksPoint(rMin.B, origin)) {
        // closest wall is in front of the limited endpoint; 
        // mark that point on the wall
        const res = this._markWallIntersection(rMin.B, potential_walls);
        needs_padding = res?.padding;
      } else {
        // limited endpoint is in front; mark it
        this.points.push(rMin.B.x, rMin.B.y);
      }
    }
    
    const endpoints_ln = endpoints.length;
    for(let i = 0; i < endpoints_ln; i += 1) {
      const endpoint = endpoints[i];   
      closest_wall = potential_walls.closest({type});
      
      if(needs_padding) {
        this._addPaddingForEndpoint(endpoint);
        needs_padding = false;
      }
      
      if(!closest_wall) {
        this._processEndpointInFrontOfWall(endpoint, potential_walls);
      
      } else if(endpoint.almostEqual(closest_wall.rightEndpoint)) {
        const res = this._processEndOfWall(endpoint, potential_walls);
        needs_padding = res?.padding;
         
      } else if(!closest_wall.blocksPoint(endpoint, origin)) {
        this._processEndpointInFrontOfWall(endpoint, potential_walls);
        //needs_padding = res?.padding
        
      } else if(closest_wall.isTerrain) {
        // closest wall is terrain
        // check second closest for right of or in front of second-closest wall
        const second_closest = potential_walls.secondClosest();
        if(!second_closest) {
          this._processEndpointInFrontOfSecondWall(endpoint, potential_walls);
        } else if(endpoint.almostEqual(second_closest.rightEndpoint)) {
          const res = this._processEndOfSecondWall(endpoint, potential_walls);
          needs_padding = res?.padding;

        } else if(!second_closest.blocksPoint(endpoint, origin)) {
          this._processEndpointInFrontOfSecondWall(endpoint, potential_walls);

        } else {
          potential_walls.updateWallsFromEndpoint(endpoint);
        }
        
      } else {
        // endpoint is behind the closest wall; nothing more to do.
        potential_walls.updateWallsFromEndpoint(endpoint);
      }
    }
    
    if(isLimited) {
      // deal with the maximum limited angle ray
      // need to first update the closest wall
      closest_wall = potential_walls.closest({type});
      if(needs_padding) {
        this._addPaddingForEndpoint(rMax.B);
        needs_padding = false;
      }
      
      if(!closest_wall) {
        this.points.push(rMax.B.x, rMax.B.y);
      } else if(closest_wall.blocksPoint(rMax.B, origin)) {
        // closest wall is in front of the limited endpoint; 
        // mark that point on the wall
        this._markWallIntersection(rMax.B, potential_walls);
      } else {
        // limited endpoint is in front; mark it
        this.points.push(rMax.B.x, rMax.B.y);
      }
      needs_padding = false;
    }
    
    // catch when the last collision point needs padding to the first point
    // the above algorithm will flag when that happens, but there are also special cases.
    
    const coll_ln = this.points.length;
    if(coll_ln < 3) needs_padding = true; // no way to have 2 points encompass vision
    
    if(needs_padding) { 
     //console.log(`testccw|adding padding`);
     this._addPaddingAtRadiusSweepEnd(closest_wall); }
  }
    
    
  
  /**
   * Add padding for given endpoint
   */
   _addPaddingForEndpoint(endpoint) {
     // draw an arc from where the collisions ended to the ray for the new endpoint
     // Note: not necessarily the new endpoint but the ray going through the new endpoint
     const origin = this.origin;
     const { radius2 } = this.config;
     const collisions = this.points;
     const l = collisions.length;
     const last_collision = { x: collisions[l - 2], y: collisions[l - 1] };
     
     // hypothesis: prior_ray is always in the ray_history.
     const prior_ray = CCWPixelRay.fromReferenceSquared(origin, last_collision, radius2);
     const last_ray = this.ray_history[this.ray_history.length - 1];
     if(!prior_ray.A.equals(last_ray.A) ||
        !prior_ray.B.equals(last_ray.B)) {
        console.warn(`testccw|Padding prior_ray ≠ last ray`);
     } 
     
     const ray = CCWPixelRay.fromReferenceSquared(origin, endpoint, radius2);
     this.ray_history.push(prior_ray, ray);
     
     this._addPadding(prior_ray, ray, collisions);
   }

 /**
  * Add padding at end of radius sweep
  */
  _addPaddingAtRadiusSweepEnd(closest_wall) {
    const collisions = this.points;
    const coll_ln = collisions.length;
    const origin = this.origin;
    const { radius, radius2 } = this.config;
  
    // next two might have undefined, depending on number of collisions
    // will be fixed below
    let prior = { x: collisions[coll_ln - 2], y: collisions[coll_ln - 1] };
    let next = { x: collisions[0], y: collisions[1] };

    // if the last collision and the first collision are on the same (closest) wall,
    // don't need to pad---polygon will fill in along the wall
    if(coll_ln >= 4 && 
       closest_wall && 
       closest_wall.contains(prior) && 
       closest_wall.contains(next)) { 
       return;
    } 

    //console.log(`testccw|_addPaddingAtRadiusSweepEnd adding padding to ${collisions.length} collisions.`);

    if(coll_ln === 0) {
      // pick an appropriate point
      prior = { x: origin.x - radius, y: origin.y };
      collisions.push(prior.x, prior.y);  
    }

    if(coll_ln < 2) {
      // add antipodal point to facilitate padding 360º
      // don't add to collisions yet (will do after padding first half)
      next = { x: origin.x - (collisions[0] - origin.x),
               y: origin.y - (collisions[1] - origin.y) };
    }

    // draw an arc from where the collisions ended to the ray for the first collision
    // basically same as padding in the algorithm for loop above
    const prior_ray = CCWPixelRay.fromReferenceSquared(origin, prior, radius2);
    const ray = CCWPixelRay.fromReferenceSquared(origin, next, radius2);
    //console.log(`testccw|_addPaddingAtRadiusSweepEnd now have ${collisions.length} collisions.`, prior_ray, ray);
    this._addPadding(prior_ray, ray, collisions);

    this.ray_history.push(prior_ray, ray);

    if(coll_ln < 2) {
      // we added collision point #2, so we need to also connect #1 to #2
      collisions.push(next.x, next.y);
      this._addPadding(ray, prior_ray, collisions); 
      //console.log(`testccw|_addPaddingAtRadiusSweepEnd now have ${collisions.length} collisions.`, prior_ray, ray);
    }
    //console.log(`testccw|_addPaddingAtRadiusSweepEnd now have ${collisions.length} collisions.`);

    this.points = collisions;
  }      
      
      
   
  
  // ----------- SWEEP SUB-METHODS -------------- // 
  
/*
Sweep options:

Endpoint is in front of closest wall:

Endpoint is behind closest wall: do nothing

Endpoint is at end of closest wall:
- mark endpoint
- "fall back" to the next closest wall. Mark intersection.
*/

 /**
  * Mark the intersection for a wall.
  * Basically, draw a line from the origin to the endpoint.
  * Assume the line continues on. 
  * Does the line intersect the closest wall? If yes, mark that intersection as a 
  * point (collision) in the vision polygon.
  * @param {CCWSweepPoint} endpoint
  * @param {CCWSweepWall}  wall
  * @return {undefined|{ padding: true }} Indicate if padding may be required for radius
  *   vision, based on having hit the end of the radius. 
  */
  _markWallIntersection(endpoint, closest_wall) {
    const { hasRadius, radius2 } = this.config;
        
    // if no closest wall, needs padding. Find the radius point for the ray
    if(!closest_wall) {
      // for debugging
      if(!hasRadius) { console.error(`testccw|_markWallIntersection unexpectedly found no closest wall`); }

      const ray = CCWPixelRay.fromReferenceSquared(this.origin, endpoint, radius2); 
      this.ray_history.push(ray);
      this.points.push(ray.B.x, ray.B.y);
      return { padding: true };
    }
    
    // does the next closest wall left endpoint share this endpoint?
    // then we are just walking from old closest wall to new closest.
    if(closest_wall.leftEndpoint.almostEqual(endpoint)) { return; }
     
    // Find the intersection point for the next-closest wall
    // if we need to consider the radius, draw the ray to the radius
    let intersection;
    if(hasRadius) {
      const ray = CCWPixelRay.fromReferenceSquared(this.origin, endpoint, radius2);
      this.ray_history.push(ray); 
      intersection = closest_wall.intersection(ray);
     
      // if no intersection, then we need padding
      if(!intersection) {
        this.points.push(ray.B.x, ray.B.y);
        return { padding: true };
      }
    } else {
      // use potentialIntersection b/c we know the next closest wall must intersect.
      // that is b/c if it is in the wall queue, the sweep line must be between 
      // the two endpoints for the wall (otherwise it either would not yet be added or
      // would already be removed.)
      const ray = new CCWPixelRay(this.origin, endpoint);
      this.ray_history.push(ray);
      intersection = closest_wall.potentialIntersection(ray);
    }
    
    if(!endpoint.almostEqual(intersection)) {
      this.points.push(intersection.x, intersection.y)
    }
  }

 /**
  * Process when the sweep reaches the end of a wall.
  * Endpoint is at the right of the closest wall (end of wall):
  * - push endpoint unless terrain exempt
  * - update wall list
  * - mark position at now-closest wall.
  * - if the now-closest wall is terrain, also mark position at now-second-closest wall
  * Padding should be only for radius version of the sweep
  * @param {CCWSweepPoint} endpoint
  * @param {PotentialWallList} potential_walls
  * @return { undefined|{ padding: true }}
  */
  _processEndOfWall(endpoint, potential_walls) {    
    if(!endpoint.isTerrainExcluded()) { 
      this.points.push(endpoint.x, endpoint.y); 
    }
  
    potential_walls.updateWallsFromEndpoint(endpoint);
    const closest_wall = potential_walls.closest();
    let res = this._markWallIntersection(endpoint, closest_wall);
    
    if(closest_wall && closest_wall.isTerrain) {
      const second_closest_wall = potential_walls.secondClosest();
      res = this._markWallIntersection(endpoint, second_closest_wall);
    }
    return res;
  }
  
 /**
  * Process when sweep reaches the end of a wall behind a terrain wall.
  * Closest wall is terrain. Endpoint is at right of second-closest wall (end of wall)
  * - push endpoint
  * - update wall list
  * - mark position on now-second-closest wall (closest is still terrain)
  * Padding should be only for radius version of the sweep.
  * @param {CCWSweepPoint} endpoint
  * @param {PotentialWallList} potential_walls
  * @return { undefined|{ padding: true }}
  */
  _processEndOfSecondWall(endpoint, potential_walls) {
    this.points.push(endpoint.x, endpoint.y); 
    potential_walls.updateWallsFromEndpoint(endpoint);
    const second_closest_wall = potential_walls.secondClosest();
    return this._markWallIntersection(endpoint, second_closest_wall);
  }
  
 /**
  * Process when sweep reaches an endpoint in front of the closest wall.
  * Endpoint is in front of closest wall:
  * - if closest wall is terrain, mark position at second-closest wall
  * - mark position at closest wall.
  * - push endpoint unless terrain exempt
  * - update wall list 
  * @param {CCWSweepPoint} endpoint
  * @param {PotentialWallList} potential_walls
  */
  _processEndpointInFrontOfWall(endpoint, potential_walls) {    
    // endpoint in front, so the current closest wall needs to be marked
    const closest_wall = potential_walls.closest();
    
    if(closest_wall && closest_wall.isTerrain) {
      const second_closest_wall = potential_walls.secondClosest();
      this._markWallIntersection(endpoint, second_closest_wall);
    }
    
    this._markWallIntersection(endpoint, closest_wall);
    
    if(!endpoint.isTerrainExcluded()) { 
      this.points.push(endpoint.x, endpoint.y); 
    }
    
    potential_walls.updateWallsFromEndpoint(endpoint);
  }
  
 /**
  * Process when sweep reaches an endpoint between the closest wall, which is a 
  * terrain wall, and the second closest wall.
  * Closest wall is terrain. Endpoint is in front of second-closest wall.
  * - mark position at second-closest wall (closest is still terrain).
  * - push endpoint (behind terrain, so always mark)
  * - update wall list 
  * @param {CCWSweepPoint} endpoint
  * @param {PotentialWallList} potential_walls
  */
  _processEndpointInFrontOfSecondWall(endpoint, potential_walls) {
    const second_closest_wall = potential_walls.secondClosest();
    this._markWallIntersection(endpoint, second_closest_wall);
    this.points.push(endpoint.x, endpoint.y); 
    potential_walls.updateWallsFromEndpoint(endpoint);
  }
  
  
  
  
  
  /*
   * Construct a CCWSweepPoint from a ray, testing if it hits a wall.
   * Assume wall may be undefined
   * @param {CCWSweepWall} wall   Wall to test for intersection.
   * @param {CCWRay}  ray    Ray to test for intersection.
   * @param {CCWSweepPoint} Either the wall intersection or end of the ray
   * @private
   */
  _getRayIntersection(wall, ray) {
    let intersection = undefined;
    if(wall) { intersection = ray.intersection(wall); }
    return intersection ? intersection : ray.B;
  }
   
  
  /*
   * Trim endpoints to only those between starting and ending rays.
   * @param {CCWRay} r0    Starting ray
   * @param {CCWRay} r1    Ending ray
   * @private
   */
  _trimEndpointsByLimitedAngle(r0, r1) {
    const origin = this.origin;
    const {aMin, aMax} = this.config;
  
    if(Math.abs(aMax - aMin) > Math.PI) {
       // if aMin to aMax is greater than 180º, easier to determine what is out
      // if endpoint is CCW to minRay and CW to maxRay, it is outside
      this.endpoints.forEach(e => {
        if(CCWPoint.ccw(origin, r0.B, e) > 0 || 
           CCWPoint.ccw(origin, r1.B, e) < 0) {
          const k = CCWSweepPoint.getKey(e.x, e.y);
          this.endpoints.delete(k);
          }
      });
      
    } else {
      // if aMin to aMax is less than 180º, easier to determine what is in
      // endpoint is CW to minRay and CCW to maxRay, it is inside
      this.endpoints.forEach(e => {
        if(!(CCWPoint.ccw(origin, r0.B, e) <= 0 && 
             CCWPoint.ccw(origin, r1.B, e) >= 0)) {
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
    if(endpoints.length === 0) return endpoints;
    // to sort CCW to CW, change the signs of the four constants and the orient2dPoints return.
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
        
      return CCWPoint.orient2d(origin, a, b);
   
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
    if(endpoints.length === 0) return endpoints;
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
   * @param {CCWRay} r0        The prior CCWRay that was tested
   * @param {CCWRay} r1        The next CCWRay that will be tested
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
    if ( nPad === 0 ) return collisions;

    // Construct padding rays
    const delta = d / (nPad + 1);
    for (let i = 1; i < (nPad + 1); i += 1) {
      let r = r0.shiftAngle(i * delta);
      collisions.push(r.B.x, r.B.y);
    }
    return collisions;
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
   
  static getRayCollisions(ray, {type="move", mode="all"}={}) {
     const candidate_walls = [...canvas.walls.quadtree.getObjects(ray.bounds)];
     
     // add artificial borders for light, if any
     if(type === "light" && game.modules.get(MODULE_ID).api.light_shape !== "circle") {
       if(game.modules.get(MODULE_ID).api.light_shape === "triangle") {
         const triangle_walls = this.constructGeometricShapeWalls([0, 120, 240]);
         candidate_walls.push(...triangle_walls);
       
       } else if(game.modules.get(MODULE_ID).api.light_shape === "square") {
         const square_walls = this.constructGeometricShapeWalls([0, 90, 180, 270]);
         candidate_walls.push(...square_walls);
       }
     }
     
     
     const ln = candidate_walls.length;
     
     // return early if no walls found.
     if(ln === 0) {
       switch(mode) {
         case "all": 
           return [];
         case "closest":
           return null;
         case "any":
           return false;
       }
     }
     
     // for each wall, test if valid for the type and if it intersects with the ray
     const intersecting_walls = [];
     ray = CCWRay.fromRay(ray);
     for(let i = 0; i < ln; i += 1) {
       const wall = CCWSweepWall.create(candidate_walls[i], { origin: ray.A, type: type });
       if(!wall.include) continue;
       if(wall.intersects(ray)) { // wall.intersects is a faster version that does not get the actual intersection
         if(mode === "any") return true;
         intersecting_walls.push(wall);
       }
     }
     
     if(mode === "any") return false; // we would have returned true by now otherwise
     
     if(mode === "all") {
       // Find the actual intersection for each wall and return.
       const intersections = intersecting_walls.map(w => {
         const i = ray.intersectSegment(w.coords);
         return new WallEndpoint(i.x, i.y);
       });
       return intersections;
     } else {
      // mode "closest"
      // Use the BST to find the closest wall, get the intersection, and return
      const potential_walls = new PotentialWallList(ray.A);
      potential_walls.add(intersecting_walls);
      const closest = potential_walls.closest();
      const i = ray.intersectSegment(closest.coords);
      return new WallEndpoint(i.x, i.y);
     }
  }
}
