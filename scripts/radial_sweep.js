'use strict';

import { MODULE_ID, log } from "./module.js";
import { pointsAlmostEqual, ccwPoints, orient2dPoints, calculateDistance } from "./util.js";
import { PotentialWallList } from "./class_PotentialWallList.js";
import { Bezier } from "./class_Bezier.js";

/*
RadialSweep class mostly works through the compute method. 
This does some initial setup, then the following:

// Construct endpoints for each Wall
    this._initializeEndpoints(type);

    // Iterate over endpoints
    this._sweepEndpoints();

    // Create the Polygon geometry
    this._constructPoints();

    // Debug the sight visualization
    if ( debug ) {
      let t1 = performance.now();
      console.log(`Created polygon in ${Math.round(t1 - t0)}ms`);
      this.visualize();
    }
    
// Clean up
    delete this.endpoints;
    delete this.rays;
    delete this.walls;
    return this;
    
So wrap the main methods used here and replace angle sorting with CCW.
For debugging/testing, call the original version when config setting set.
*/


/**
 * Wrap _initializeEndpoints
 *
 * Initialize the endpoints present for walls within this Scene.
 * @param {string} type       The type of polygon being constructed in WALL_RESTRICTION_TYPES
 * @private
 */
export function testCCWInitializeEndpoints(wrapped, type) {
  if(!game.modules.get(MODULE_ID).api.use_ccw) { return wrapped(type); }
  
  // To handle walls that cross one another:
  // Sweep from west to east.
  // When you hit a new endpoint, compare walls to the east to stored walls
  //   for intersections
  // Store the walls
  // When you hit an endpoint for the end of a wall, remove from stored walls
  // 
  // Ultimately, this should be handled either by:
  // 1. Converting wall overlaps to proper wall intersections on user creation; or
  // 2. Storing this wall set in the scene and re-running when walls are modified.
  
  // TO-DO: Compare with a version that stores the endpoint set and
  //        moves the ._includeWall test to the sweep algorithm.
  //        Advantage: 
  //          - not re-building endpoints every time.
  //          - only need test the closest walls instead of all walls
  //        Dis-advantage: 
  //          - storage; 
  //          - speed of candidate wall test?
  //          - complexity (caching the wall set and invalidating the cache)
  
  this.walls = new Map(); 
  this.endpoints.clear();
  const norm = a => a < this.config.aMin ? a + (2*Math.PI) : a;
  // Consider all walls in the Scene
  // candidate walls sometimes a Set (lights), sometimes an Array (token)
  const candidate_walls = this._getCandidateWalls();
  candidate_walls.forEach(wall => { 
    // Test whether a wall should be included in the set considered for this polygon
    if(!this._includeWall(wall, type)) return;
    
    // Register both endpoints for included walls
    let [x0, y0, x1, y1] = wall.data.c;
    let ak = WallEndpoint.getKey(x0, y0);
    let a = this.endpoints.get(ak);
    if ( !a ) {
      a = new WallEndpoint(x0, y0);
      //a.angle = norm(Math.atan2(y0 - this.origin.y, x0 - this.origin.x));
      a.isEndpoint = true;
      this.endpoints.set(ak, a);
    }
    a.attachWall(wall);

    let bk = WallEndpoint.getKey(x1, y1);
    let b = this.endpoints.get(bk);
    if ( !b ) {
      b = new WallEndpoint(x1, y1);
      //b.angle = norm(Math.atan2(y1 - this.origin.y, x1 - this.origin.x));
      b.isEndpoint = true;
      this.endpoints.set(bk, b);
    }
    b.attachWall(wall);

    // Record the wall
    //this.walls[wall.id] = {wall, a, b};
    this.walls.set(wall.id, {wall, a, b});
  }); // end forEach loop
}

/**
 * Wrap _includeWall
 *
 * Test whether a Wall object should be included as a candidate for collision from the polygon origin
 * @param {Wall} wall         The Wall being considered
 * @param {string} type       The type of polygon being computed
 * @returns {boolean}         Should the wall be included?
 * @private
 */
export function testCCWIncludeWall(wrapped, wall, type) {
  if(!game.modules.get(MODULE_ID).api.use_ccw) { return wrapped(wall, type); }
  
  // Special case - coerce interior walls to block light and sight
  const isInterior = ( type === "sight" ) && (wall.roof?.occluded === false);
  if ( isInterior ) return true;

  // Ignore non-blocking walls and open doors
  if ( !wall.data[type] || wall.isOpen ) return false;

  // Ignore one-directional walls which are facing away from the origin
  if ( !wall.data.dir ) return true; // wall not one-directional
  
  return wall.whichSide(this.origin) === wall.data.dir;
}

/**
 * Wrap _sweepEndpoints
 *
 * Sweep clockwise around known wall endpoints, constructing the polygon as we go.
 * Goal here is to create a set of rays that have collision points. The collision points
 *   are used by _constructPoints() to build the polygon. 
 *   walls, endpoints, rays are then deleted by compute().
 *   Collision points are just x,y: ray.collisions[0, 1, etc.] is {x, y}
 *
 * Sweep works by getting each counterclockwise-most endpoint in turn.
 *   Keep a list of "collision" points---endpoints that are closest to the origin
 *   Keep a sort list of potential walls from furthest to nearest.
 *   Keep track of the closest wall
 *   The origin --> endpoint --> end of vision is the sight line. 
 *   Sight line sweeps clockwise. 
 *   1. If a new endpoint, add it as a collision point. 
 *      Add all endpoint walls to potential wall list and track the closest. 
 *   2. If the end of a wall, add it as a collision point. 
 *      Get the next closest wall in the potential wall list. 
 *      Add the next closest wall intersect point to the sight line. 
 *      If no other potential walls, add the endpoint of the sight line 
 *      as a collision point.
 *   3. If some other endpoint than the closest wall:
 *      - If closer, add endpoint as collision point. Add endpoint walls to potential wall
 *        list and track closest. Move previous closest wall to potential wall list.
 *      - If further, add endpoint walls to potential wall list.      
 *   4. If limited vision radius and you hit the end of the sight line, pad to the next
 *      endpoint sight line. 
 *
 * @private
 */
export function testCCWSweepEndpoints(wrapped) {
  log(`Padding: ${Math.PI / Math.max(this.config.density, 6)}, density ${this.config.density}`);
  log(`Radius: ${this.config.radius}; Rotation: ${this.config.rotation}; Angle: ${this.config.angle}; aMin: ${this.config.aMin}; aMax: ${this.config.aMax}`);

  if(!game.modules.get(MODULE_ID).api.use_ccw) { return wrapped(); }
      
  // Configure inputs
  const origin = this.origin;
  const {maxR, isLimited, aMin, aMax} = this.config;
  const radius = this.config.radius ?? maxR;
  const collisions = [];  // array to store collisions in lieu of rays
  const padding = Math.PI / Math.max(this.config.density, 6);
  const has_radius = this.config.hasRadius;
  
  const potential_walls = new PotentialWallList(origin); // BST ordered by closeness
  
  let needs_padding = false;
  let closest_wall = undefined;


  // ----- LIMITED RADIUS SETUP ---- //
  
  // If radius is limited, trim the walls to only those that intersect the radius circle
  // Then drop endpoints if they do not contain relevant walls.
  if(has_radius) {
    // determine which walls intersect the circle
    this.walls.forEach(w => {
      // w.radius_intersect = w.wall.toRay().potentialIntersectionsWithCircle(origin, radius);
      w.wall.radius_potential_intersect = w.wall.toRay().potentialintersectionsWithCircle(origin, radius);
      w.wall.radius_actual_intersect = w.wall.radius_potential_intersect.filter(p => {
         return w.wall.contains(p);
      });
    });
    
    // track outside the forEach loop to avoid removing new additions
    const endpoints_to_add = [];
    const endpoints_to_delete = [];
    
    // 1. trim the wall set of each endpoint to only those with actual intersections
    this.endpoints.forEach(e => {
      e.distance_to_origin = calculateDistance(origin, e);
      if(e.distance_to_origin > radius) {
        const walls_to_delete = [];
        e.walls.forEach(w => {
          if(w.radius_actual_intersect.length === 0) {
            walls_to_delete.push(w.id);
          } else {
            // wall intersections exist; make new endpoints
            // add new endpoint at circle/wall intersect
            w.radius_actual_intersect.forEach(pt => {             
              pt = new SweepPoint(pt.x, pt.y);
              pt.radius_edge = true;
              endpoints_to_add.push(pt);
            });
          }
        });
        walls_to_delete.forEach(k =>  e.walls.delete(k)); 
      }
    });
    
    // 2. drop endpoint if set is empty
    this.endpoints.forEach(e => {
      if(e.walls.size === 0 && e.distance_to_origin > radius) {
        const k = WallEndpoint.getKey(e.x, e.y);
        endpoints_to_delete.push(k);
      }
    });
    
    endpoints_to_delete.forEach(k => this.endpoints.delete(k));
    endpoints_to_add.forEach(pt => {
      const k = WallEndpoint.getKey(pt.x, pt.y);
      this.endpoints.set(k, pt);
    });
    
  } else {  
    // add 4-corners endpoints if not limited radius
    // used to draw polygon from the edges of the map.
    const pts = [{ x: 0, y: 0 }, 
                 { x: 0, y: canvas.dimensions.height },
                 { x: canvas.dimensions.width, y: 0 },
                 { x: canvas.dimensions.width, y: canvas.dimensions.height }];
           
    pts.forEach(pt => {
      const k = WallEndpoint.getKey(pt.x, pt.y);
      this.endpoints.set(k, new WallEndpoint(pt.x, pt.y)); // don't need SweepPoint b/c 4 corners should be integers
    });    
  }
  
  // ----- INITIAL RAY INTERSECTION ---- //
  
  // Begin with a ray at the lowest angle to establish initial conditions
  // Can avoid using FromAngle if aMin is -π, which means it goes due west
  const minRay = (aMin === -Math.PI) ? 
                 constructRay(origin, {x: origin.x - 100, y: origin.y}, radius) :
                 constructRayFromAngle(origin, aMin, radius);  
  const maxRay = isLimited ? 
                 constructRayFromAngle(origin, aMax, radius) : 
                 undefined;
  
  // Start by checking if the initial ray intersects any segments.
  // If yes, then get the closest segment 
  // If no, the starting endpoint is the first in the sort list
  let minRay_intersecting_walls = [...this.walls.values()].filter(w => minRay.intersects(w.wall));
  if(minRay_intersecting_walls.length > 0) {
    // these walls are actually walls[0].wall
    minRay_intersecting_walls = minRay_intersecting_walls.map(w => w.wall);
  
    potential_walls.addWalls(minRay_intersecting_walls);
    closest_wall = potential_walls.closest();
    //drawRay(closest_wall)
  }
  
  // ----- LIMITED ANGLE SETUP ---- //
  // if the angle is limited, trim the endpoints and add endpoints for starting/ending ray 
  if(isLimited) {
    if(Math.abs(aMax - aMin) > Math.PI) {
       // if aMin to aMax is greater than 180º, easier to determine what is out
      // if endpoint is CCW to minRay and CW to maxRay, it is outside
      this.endpoints.forEach(e => {
        if(ccwPoints(origin, minRay.B, e) > 0 || 
           ccwPoints(origin, maxRay.B, e) < 0) {
          const k = WallEndpoint.getKey(e.x, e.y);
          this.endpoints.delete(k);
          }
      });
      
    } else {
      // if aMin to aMax is less than 180º, easier to determine what is in
      // endpoint is CW to minRay and CCW to maxRay, it is inside
      this.endpoints.forEach(e => {
        if(!(ccwPoints(origin, minRay.B, e) <= 0 && 
             ccwPoints(origin, maxRay.B, e) >= 0)) {
          const k = WallEndpoint.getKey(e.x, e.y);
          this.endpoints.delete(k);
        }
      });
    }
  }
  
  // ----- SORT ENDPOINTS CW ---- //

  // Sort endpoints from CW (0) to CCW (last), in relation to a line due west from origin.
  // (For this sort, a for loop would count down from last to 0)
  // For limited angle, sort from the minRay instead of from due west
  // sorting from due west is a bit faster 
  // TO-DO: is minRay.B an acceptable target? What happens if another endpoint equals minRay.B?
  const endpoints = isLimited ? sortEndpointsCWFrom(origin, [...this.endpoints.values()], minRay.B) : sortEndpointsCW(origin, [...this.endpoints.values()]);


  // ----- LIMITED ANGLE MIN/MAX RAYS ---- //

  // for limited angle, add starting and ending endpoints after the sort, to ensure they are in correct position
  if(isLimited) {
    // Add an endpoint for the minRay -----
    let minRay_intersection = undefined;
    if(closest_wall) {
      minRay_intersection = minRay.intersectSegment(closest_wall.coords);
    }
    const minRay_endpoint = minRay_intersection ? new SweepPoint(minRay_intersection.x, minRay_intersection.y) : 
                                                  new SweepPoint(minRay.B.x, minRay.B.y);
    minRay_endpoint.minLimit = true;
    //this.endpoints.set(minRay_endpoint.key, minRay_endpoint);
    endpoints.push(minRay_endpoint); // first endpoint encountered should be this one

    // Add an endpoint for the maxRay -----
    // Same basic structure as for minRay but for the need to create a tmp wall list
    // Add as endpoint so algorithm can handle the details
    let maxRay_intersecting_walls = [...this.walls.values()].filter(w => maxRay.intersects(w.wall));
    const maxRay_potential_walls = new PotentialWallList(origin);
    let maxRay_closest_wall = undefined;
  
    if(maxRay_intersecting_walls.length > 0) {
      // these walls are actually walls[0].wall
      maxRay_intersecting_walls = maxRay_intersecting_walls.map(w => w.wall);  
      maxRay_potential_walls.addWalls(maxRay_intersecting_walls);
      maxRay_closest_wall = maxRay_potential_walls.closest();
    }
    
    let maxRay_intersection = undefined;
    if(maxRay_closest_wall) {
      maxRay_intersection = maxRay.intersectSegment(maxRay_closest_wall.coords);
      //drawEndpoint(intersection)
      //endpoints.some(e => pointsAlmostEqual(e, intersection))
    }
    
    const maxRay_endpoint = maxRay_intersection ? new SweepPoint(maxRay_intersection.x, maxRay_intersection.y) : 
                                                  new SweepPoint(maxRay.B.x, maxRay.B.y);
    maxRay_endpoint.maxLimit = true;
    //this.endpoints.set(maxRay_endpoint.key, maxRay_endpoint);  
    endpoints.unshift(maxRay_endpoint);  // last endpoint encountered should be this one
  }
  
  // ----- SWEEP CLOCKWISE (LOOP) ---- //
      
  // flag if there are no endpoints
  // needed for padding with radius
  const has_endpoints = endpoints.length > 0;
  const ln = endpoints.length;
  for(let i = (ln - 1); i >= 0; i -= 1) {
    const endpoint = endpoints[i];   
    
    // Add any walls from the endpoint
    potential_walls.addFromEndpoint(endpoint);

    // if no walls between the last endpoint and this endpoint and 
    // dealing with limited radius, need to pad by drawing an arc 
    if(has_radius && needs_padding) {
      if(collisions.length < 1) { 
        console.warn(`testccw|Sweep: Collisions length 0`); 
      }
      needs_padding = false;
      
      // draw an arc from where the collisions ended to the ray for the new endpoint
      const prior_ray = constructRay(origin, collisions[collisions.length - 1], radius); 
      const ray = constructRay(origin, endpoint, radius);
      
      this._padRays(prior_ray, ray, padding, collisions, false); // adds to collisions automatically
    } 
     
    // At the beginning or at a corner of the canvas, or at the edge of the radius. 
    // No wall in sight. Try to get a new closer wall (from this endpoint)
    // Mark endpoint as collisions or mark end of vision ray as collision.
    // If we are at the radius edge, padding is required on next loop.
    if(!closest_wall) {
      // see where the vision point to the new endpoint intersects the canvas edge
      const ray = constructRay(origin, endpoint, radius);
      //drawRay(ray, COLORS.blue)
      
      collisions.push({x: ray.B.x, y: ray.B.y});    
    
      // endpoint can be for one or more walls. Get the closest
      closest_wall = potential_walls.closest();
      
      // mark endpoint
      // mark endpoint
      if(has_radius && (!ray.contains(endpoint) || Boolean(endpoint?.minLimit))) {
        // endpoint is outside the radius so don't add it to collisions. 
        // need to pad b/c no wall in front of the endpoint, so empty space to next point
        needs_padding = true;
      } else if(!pointsAlmostEqual(endpoint, ray.B)) {
          // likely equal points if at one of the corner endpoints
          collisions.push({x: endpoint.x, y: endpoint.y}); 
      }

      continue;
    }  
    
    // is this endpoint at the end of the closest_wall?
    // (if it were the beginning of a wall, that wall would not yet be the closest)
    if(pointsAlmostEqual(endpoint, closest_wall.A) || 
       pointsAlmostEqual(endpoint, closest_wall.B)) {
       // add all other endpoint walls than closest to potential list, if any
       closest_wall = potential_walls.closest();
       // drawRay(closest_wall)
       
       // then add the endpoint unless it is out of radius
       const inside_radius = !has_radius || Boolean(endpoint?.distance_to_origin <= radius);
       if(inside_radius) { collisions.push({x: endpoint.x, y: endpoint.y}); }
       
       const ray = constructRay(origin, endpoint, radius);
       //drawRay(ray, COLORS.blue)
       
       let intersection = undefined
       if(closest_wall) {
         // get the new intersection point: where the ray hits the next-closest wall
         intersection = ray.intersectSegment(closest_wall.coords);
         //drawEndpoint(intersection)
       }  
       if(!closest_wall || !intersection) {
         // no next-closest wall
         // hitting the radius or canvas edge. If radius, need to pad to next endpoint
         
         // if radius-limited, it is possible for next-closest to be outside the radius
         // endpoint is the intersection with the radius circle (endpoint of the ray)
         // all other potentially blocking segments are outside radius at this point 
         //   (otherwise, we would have hit their endpoints by now)
         
         if(inside_radius) { collisions.push({x: ray.B.x, y: ray.B.y}); }
         
         // padding  
         needs_padding = true;
       
       } else if(intersection) {
           // intersection is our new endpoint unless we are at the join of prior closest
          //  with new closest.
          // (already set closest wall above)
          // drawEndpoint(intersection);
          if(!pointsAlmostEqual(endpoint, intersection)) { collisions.push({ x: intersection.x, y: intersection.y }); }
       } 
         
       continue;  
    } 
    
  
    // is this endpoint within the closest_wall? (Limited radius will do this)
    if((has_radius || 
        (isLimited && (Boolean(endpoint?.minLimit) || Boolean(endpoint?.maxLimit)))) && 
        closest_wall.contains(endpoint)) {
      collisions.push({x: endpoint.x, y: endpoint.y});
      // continue;
      
    } else if(!closest_wall.inFrontOfPoint(endpoint, origin)) {
      // endpoint is in front of the current closest wall.
      // Find and mark intersection of sightline --> endpoint --> current closest wall
      
      // see where the vision point to the new endpoint intersects the prior wall
      // if it does, this is a collision point.
      const ray = constructRay(origin, endpoint, radius);
      //drawRay(ray, COLORS.blue)
      
      if(ray.intersects(closest_wall)) {
        const intersection = ray.intersectSegment([closest_wall.A.x, closest_wall.A.y, closest_wall.B.x, closest_wall.B.y]);
        collisions.push({ x: intersection.x, y: intersection.y });
      } else if(has_radius && Boolean(endpoint?.distance_to_origin > radius)) {
        // (endpoint > radius test may not be necessary; should always be true if has_radius)
        // ray did not reach the wall
        // add the end of the ray point instead
        collisions.push({x: ray.B.x, y: ray.B.y});
        needs_padding = true;
      
      } 
      // mark this closer endpoint and retrieve the closest wall
      // endpoint is definitely seen, b/c of the CW sweep.
      // endpoint may or may not be part of closest wall, but probably an endpoint for
      // that wall.
      collisions.push({x: endpoint.x, y: endpoint.y});
      closest_wall = potential_walls.closest();      
      //continue; 
    }
    
 
  } // end of endpoints loop
  
    
  // close between last / first endpoint
  // deal with unique case where there are no endpoints
  // (no blocking walls for radius vision)
  if(has_radius && (needs_padding || !has_endpoints)) {
    const collisions_ln = collisions.length;
  
    let p_last = collisions[collisions_ln - 1];
    let p_current = collisions[0]
  
    // if 0 or 1 collisions, then just pick an appropriate point
    // padding is best done in two hemispheres in that case
    if(collisions_ln === 0) {
      p_last = { x: origin.x - radius, y: origin.y }; 
      p_current = { x: origin.x + radius, y: origin.y }
    
      collisions.push(p_last);
    
    } else if(collisions_ln === 1) {
      // get antipodal point
      p_last = { x: origin.x - (p_current.x - origin.x),
                 y: origin.y - (p_current.y - origin.y) }
    }
    
    // draw an arc from where the collisions ended to the ray for the new endpoint
    const prior_ray = constructRay(origin, p_last, radius); 
    const ray = constructRay(origin, p_current, radius);
    
    // drawRay(prior_ray, COLORS.blue)
    // drawRay(ray, COLORS.blue)
          
    // TO-DO: Override _padRays to return a simple array of points to concat
    this._padRays(prior_ray, ray, padding, collisions, false); // adds to collisions automatically
    //collisions.push(...pts);
  
    if(collisions_ln < 2) {
      // get the second half
      collisions.push(p_current);
      this._padRays(ray, prior_ray, padding, collisions, false); 
    }
  
   } 
    
  this.collisions = collisions;
}

/**
 * Wrap _constructPoints method
 *
 * Convert the set of collisions into the polygon points
 * @returns {number[]}        The polygon points
 * @private
 */
export function testCCWConstructPoints(wrapped) {
   if(!game.modules.get(MODULE_ID).api.use_ccw) { 
     if(game.modules.get(MODULE_ID).api.debug) { log(`${this.points.length} points`, this.points); }

     return wrapped(); }

  const points = [];
  const isLimited = this.config.isLimited;

  // Open a limited shape
  if ( isLimited ) points.push(this.origin.x, this.origin.y);

  // Add collision points from every ray
  this.collisions.forEach(c => { points.push(c.x, c.y) });
  
  // Close a limited polygon
  if ( isLimited ) points.push(this.origin.x, this.origin.y);
  this.points = points;
}

/*
 * Sort an array of points from CW to CCW, in relation to line due west from origin.
 * so array[0] would be the last point encountered if moving clockwise from the line.
 *    array[last] would be the first point encountered.
 * (to sort the other direction, reverse the signs)
 * @param {PIXI.Point}  origin    {x, y} point to sort against
 * @param {[{x, y}]}    endpoints Array of {x, y} points to sort
 * @return {[x, y]} Sorted array of points from CW to CCW
 */ 
function sortEndpointsCW(origin, endpoints) {
  const TOP = 1;
  const BOTTOM = -1;
  const LEFT = 1;
  const RIGHT = -1;
  
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
 * @param {PIXI.Point}  origin    {x, y} point to sort against
 * @param {[{x, y}]}    endpoints Array of {x, y} points to sort
 * @param {PIXI.Point}  reference {x,y} reference point to be the 0th point
 * @return {[x, y]} Sorted array of points from CW to CCW
 */
function sortEndpointsCWFrom(origin, endpoints, reference) {
  reference.sort_baseline = true;
  endpoints.push(reference);
  
  const sorted = sortEndpointsCW(origin, endpoints);
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
 * Basic test of array equality for debugging only.
 * @param {[]} a1   Array
 * @param {[]} a2   Array
 * @return {Boolean} True if arrays are equal
 */
function arraysEqual(a1,a2) {
    /* WARNING: arrays must not contain {objects} or behavior may be undefined */
    return JSON.stringify(a1)==JSON.stringify(a2);
}


/*
 * Construct a sight ray given an endpoint and radius.
 * Cut off the ray at the edge of the canvas. 
 * @param {PIXI.Point} origin   {x, y} point for ray to start
 * @param {Endpoint} endpoint   {x, y} endpoint for ray to end
 * @param {Number} radius       Positive number for ray distance.
 * @return {Ray} Constructed ray, trimmed to canvas size if necessary.
 */
function constructRay(origin, endpoint, radius) {
  const ray = (new SightRay(origin, endpoint)).projectDistance(radius);
  return trimRayToCanvas(ray); 
}

/**
 * Same as constructRay but when you have an angle instead of an endpoint
 * The angle construction means this is likely the more expensive of the two.
 * @param {PIXI.Point} origin   {x, y} point for ray to start
 * @param {Number} angle        Angle in radians
 * @param {Number} radius       Positive number for ray distance.
 * @return {Ray} Constructed ray, trimmed to canvas size if necessary.
 */
function constructRayFromAngle(origin, angle, radius) {
  const ray = SightRay.fromAngle(origin.x, origin.y, angle, radius);
  return trimRayToCanvas(ray);
}

/**
 * Internal function to handle trimming a ray by the canvas border intersections
 * Used by constructRay and constructRayFromAngle
 * @param {Ray} ray   Ray to trim.
 * @return {Ray} Constructed ray, trimmed to canvas size if necessary.
 */
function trimRayToCanvas(ray) {
  const canvas_rays = [
    new Ray({ x: 0, y: 0 }, 
            { x: canvas.dimensions.width, y: 0 }), // north canvas
    new Ray({ x: 0, y: 0 }, 
            { x: 0, y: canvas.dimensions.height }), // west canvas
    new Ray({ x: canvas.dimensions.width, y: 0}, 
            { x: canvas.dimensions.width, y: canvas.dimensions.height }), // east canvas
    new Ray({ x: canvas.dimensions.width, y: canvas.dimensions.height }, 
            { x: 0, y: canvas.dimensions.height }) // south canvas
  ];
  
  const canvas_ray = canvas_rays.filter(r => ray.intersects(r));
  if(canvas_ray.length > 0) {
    const intersect_pt = canvas_ray[0].intersectSegment([ray.A.x, ray.A.y, ray.B.x, ray.B.y]);
    ray = new SightRay(ray.A, intersect_pt);
  }
  
  return ray;
}


/**
 * Wrap _padRays.
 * This version adds the collision points but avoids the r.result.terminal issue.
 * Also hands off to Bezier if that option is enabled, for a faster approximate circle.
 * 
 * Create additional rays to fill gaps with a desired padding size
 * @param {SightRay} r0       The prior SightRay that was tested
 * @param {SightRay} r1       The next SightRay that will be tested
 * @param {number} padding    The size of padding in radians to fill between r0 and r1
 * @param {SightRay[]} rays   The accumulating array of Ray objects
 * @param {boolean} requireTest   Require padding rays to be tested, instead of assuming their reach their endpoint
 * @private
 */
export function testCCWPadRays(wrapped, r0, r1, padding, rays, requireTest) {
  if(!game.modules.get(MODULE_ID).api.use_ccw) { return wrapped(r0, r1, padding, rays, requireTest); }
  
  if(game.modules.get(MODULE_ID).api.use_bezier) { return Bezier.bezierPadding(r0, r1, padding, rays); } 

  // Determine padding delta
  let d = r1.angle - r0.angle;
  if ( d < 0 ) d += (2*Math.PI); // Handle cycling past pi
  const nPad = Math.floor(d / padding);
  if ( nPad === 0 ) return [];

  // Construct padding rays
  const delta = d / nPad;
  let lr = r0;
  for ( let i=1; i<nPad; i++ ) {
    let r = r0.shiftAngle(i*delta);
    rays.push(r.B);
  }
  return rays;
}


/* 
 * Subclass that operates comparably to WallEndpoint but does not round x, y
 * Used for marking points on a line where integer points would not be sufficiently exact.
 * E.g., cannot tell if a point is actually on a line if rounded. 
 * Luckily, WallEndpoint.getKey already rounds x, y, so need not override here.
 * @parameter {Number} x  X coordinate, not rounded
 * @parameter {Number} y  Y coordinate, not rounded
 */
class SweepPoint extends WallEndpoint {
  constructor(x, y) {
    super(x, y)
    
    // switch x, y back to non-integer
    this.x = x;
    this.y = y;
  }
  
  /**
   * Does this endpoint equal some other endpoint?
   * This version treats points equivalent if rounded values are equal
   * @param {Point} other     Some other point with x and y coordinates
   * @returns {boolean}       Are the points equal?
   */
  equals(other) {
    return (Math.round(other.x) === Math.round(this.x)) && 
           (Math.round(other.y) === Math.round(this.y));
  }
}
