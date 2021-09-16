'use strict';

import { MODULE_ID, log } from "./module.js";
import { orient2d } from "./lib/orient2d.min.js";
import { pointsAlmostEqual, ccwPoints, calculateDistance } from "./util.js";
import { PotentialWallList } from "./class_PotentialWallList.js";
import { PotentialWallListBinary } from "./class_PotentialWallListBinary.js";

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
  if(!window[MODULE_ID].use_ccw) { return wrapped(type); }
  
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
  
  this.walls = {};
    this.endpoints.clear();
    const norm = a => a < this.config.aMin ? a + (2*Math.PI) : a;

    // Consider all walls in the Scene
    for ( let wall of this._getCandidateWalls() ) {

      // Test whether a wall should be included in the set considered for this polygon
      if ( !this._includeWall(wall, type) ) continue;

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
      this.walls[wall.id] = {wall, a, b};
    }
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
  if(!window[MODULE_ID].use_ccw) { return wrapped(wall, type); }
  
  // Special case - coerce interior walls to block light and sight
  const isInterior = ( type === "sight" ) && (wall.roof?.occluded === false);
  if ( isInterior ) return true;

  // Ignore non-blocking walls and open doors
  if ( !wall.data[type] || wall.isOpen ) return false;

  // Ignore one-directional walls which are facing away from the origin
  if ( !wall.data.dir ) return true; // wall not one-directional
  
  return wall.whichSide(this.origin) === wall.effectSide();
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

  if(!window[MODULE_ID].use_ccw) {
    wrapped(); 
    log(`${this.endpoints.size} endpoints; ${this.rays.length} rays`, this.endpoints, this.rays);
    //return wrapped();
    return; 

  }
      
  // Configure inputs
  const origin = this.origin;
  const {maxR, isLimited, aMin, aMax} = this.config;
  const radius = this.config.radius ?? maxR;
  const collisions = [];  // array to store collisions in lieu of rays
  //const angles = new Set();
  const padding = Math.PI / Math.max(this.config.density, 6);
  const has_radius = this.config.hasRadius;
  
  const potential_walls = window[MODULE_ID].use_bst ? (new PotentialWallListBinary(origin)) : (new PotentialWallList(origin));
  
  let needs_padding = false;
  let closest_wall = undefined;

  log(`${this.endpoints.length} endpoints at start.`);
  // walls should be an iterable set 
  const walls = new Map(Object.entries(this.walls));
  
  if(has_radius) {
    // determine which walls intersect the circle
    walls.forEach(w => {
      // w.radius_intersect = w.wall.toRay().potentialIntersectionsCircle(origin, radius);
      w.wall.radius_potential_intersect = w.wall.toRay().potentialIntersectionsCircle(origin, radius);
      w.wall.radius_actual_intersect = w.wall.radius_potential_intersect.filter(p => {
         return w.wall.toRay().contains(p);
      });
    });
    
    this.endpoints.forEach(e => {
      e.distance_to_origin = calculateDistance(origin, e);
      if(e.distance_to_origin > radius) {
        // endpoint outside wall
       
        e.walls.forEach(w => {
          // 1. trim the wall set to only those with actual intersections
          if(w.radius_actual_intersect.length === 0) {
            e.walls.delete(w);
          } else {
            // wall intersections exist; make new endpoints
            w.radius_actual_intersect.forEach(pt => {
              const pt = new SweepPoint(pt.x, pt.y);
              pt.radius_edge = true;
              const k = WallEndpoint.getKey(pt.x, pt.y);
              this.endpoints.set(k, pt); // add new endpoint at circle/wall intersect
            }); 
          }
        });
        // 2. drop endpoint if set is empty
        if(e.walls.size === 0) {
          const k = WallEndpoint.getKey(e.x, e.y);
          this.endpoints.delete(k);
        }
      }
    });
  } else {  
    // add 4-corners endpoints if not limited radius
    // used to draw polygon from the edges of the map.
    const pts = [{ x: 0, y: 0 }, 
                 { x: 0, y: canvas.dimensions.height },
                 { x: canvas.dimensions.width, y: 0 },
                 { x: canvas.dimensions.width, y: canvas.dimensions.height }];
           
    pts.forEach(pt => {
      k = WallEndpoint.getKey(pt.x, pt.y);
      this.endpoints.set(k, new WallEndpoint(pt.x, pt.y)); // don't need SweepPoint b/c 4 corners should be integers
    });    
  }
  
  // if limited radius, then segments may start outside and enter the vision area.
  // need to mark that intersection 
  
  // Skip endpoints which are not within our limited angle
  //  if ( isLimited && !endpoint.angle.between(aMin, aMax) ) continue;


  
/*  
  if(window[MODULE_ID].debug) {
    // confirm that the sort matches the old sort method
    const angles = endpoints.map(e => e.angle);
    endpoints.sort((a, b) => a.angle - b.angle);
    const new_angles = endpoints.map(e => e.angle);
    if(!arraysEqual(angles, new_angles)) {
      console.warn(`testccw|Sorted CCW angles not equivalent`, endpoints);
    }
  }
*/
  // Begin with a ray at the lowest angle to establish initial conditions
  // Can avoid using FromAngle if aMin is -π, which means it goes due west
  const minRay = (aMin === -Math.PI) ? constructRay(origin, {x: origin.x - 100, y: origin.y}, radius) :
                                       constructRayFromAngle(origin, aMin, radius);  
  const maxRay = isLimited ? constructRayFromAngle(origin, aMax, radius)  : undefined;
  
  // Start by checking if the initial ray intersects any segments.
  // If yes, then get the closest segment 
  // If no, the starting endpoint is the first in the sort list
  let minRay_intersecting_walls = [...walls.values()].filter(w => minRay.intersects(w.wall.toRay()));
  if(minRay_intersecting_walls.length > 0) {
    // these walls are actually walls[0].wall
    minRay_intersecting_walls = minRay_intersecting_walls.map(w => w.wall);
  
    potential_walls.addWalls(minRay_intersecting_walls);
    closest_wall = potential_walls.closest();
    //drawRay(closest_wall)
  }
  
  // if the angle is limited, trim the endpoints nd add endpoints for starting/ending ray 
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
        if(!(ccwPoints(origin, minRay.B, e) <= 0 && ccwPoints(origin, maxRay.B, e) >= 0)) {
          const k = WallEndpoint.getKey(e.x, e.y);
          this.endpoints.delete(k);
        }
      });
    }

    log(`Sweep: isLimited ${this.endpoints.length} endpoints after filtering.`, this.endpoints);
    
    // Add a collision for the minRay -----
    let minRay_intersection = undefined;
    if(closest_wall) {
      minRay_intersection = minRay.intersectSegment(closest_wall.coords);
    }
    const minRay_endpoint = minRay_intersection ? new SweepPoint(minRay_intersection.x, minRay_intersection.y) : 
                                                  new SweepPoint(minRay.B.x, minRay.B.y);
    
    // conceivable, but unlikely, that the intersection is an existing endpoint
    // probably best not to duplicate endpoints—--unclear how the algorithm would handle
    // it would first remove the closest wall and then need to re-do the ray & collision
//     if(!endpoints.some(e => pointsAlmostEqual(e, minRay_endpoint))) {
//       endpoints.push(minRay_endpoint);
//     }
    collisions.push({ x: minRay_endpoint.x, y: minRay_endpoint.y });
    
    // Add an endpoint for the maxRay -----
    // Same basic structure as for minRay but for the need to create a tmp wall list
    // Add as endpoint so algorithm can handle the details
    let maxRay_intersecting_walls = [...walls.values()].filter(w => maxRay.intersects(w.wall.toRay()));
    const maxRay_potential_walls = window[MODULE_ID].use_bst ? (new PotentialWallListBinary(origin)) : (new PotentialWallList(origin));
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
    const k = WallEndpoint.getKey(e.x, e.y);
    this.endpoints.set(k, maxRay_endpoint);  
  }
 
  // Sort endpoints from CW (0) to CCW (last), in relation to a line due west from origin.
  // (For this sort, a for loop would count down from last to 0)
  const endpoints = sortEndpointsCW(origin, [...Poly.endpoints.values()]);
  
  log(`Sweep: ${endpoints.length} endpoints; ${collisions.length} collisions before for loop`, endpoints, collisions);

  // Sweep each endpoint
  // accessing array by index, pop, and push should be O(1) in time. 
  // use while loop and pop so that padding can re-insert an endpoint
  
  // flag if there are no endpoints
  // needed for padding with radius
  has_endpoints = endpoints.length > 0;
  
  // safety for debugging
  const MAX_ITER = endpoints.length * 2; // every time we hit an endpoint, could in theory pad and create another. So doubling number of endpoints should be a safe upper-bound.
  let iter = 0; 
  
  while(endpoints.length > 0 && iter < MAX_ITER) {
    iter += 1;
    const endpoint = endpoints.pop()
   
    // if no walls between the last endpoint and this endpoint and 
    // dealing with limited radius, need to pad by drawing an arc 
    if(has_radius && needs_padding) {
      if(collisions.length < 2) { console.warn(`testccw|Sweep: Collisions length ${collisions.length}`, collisions, endpoints); }
      needs_padding = false;
      
      // draw an arc from where the collisions ended to the ray for the new endpoint
      const prior_ray = constructRay(origin, collisions[collisions.length - 1], radius); 
      const ray = constructRay(origin, endpoint, radius);
      
      // TO-DO: Override _padRays to return a simple array of points to concat
      this._padRays(prior_ray, ray, padding, collisions, false); // adds to collisions automatically
      
      // the endpoint is now the end of the ray, which may or may not be in front of the 
      // next endpoint
      endpoints.push(endpoint);
      
      continue;
    } 
    
    potential_walls.addFromEndpoint(endpoint);
     
    // If at the beginning or at a corner of the canvas, add this endpoint and go to next.
    if(!closest_wall) {
      // see where the vision point to the new endpoint intersects the canvas edge
      const ray = constructRay(origin, endpoint, radius);
      //drawRay(ray, COLORS.blue)
      
      if(!pointsAlmostEqual(endpoint, ray.B)) {
        // likely equal points if at one of the corner endpoints
        collisions.push({x: ray.B.x, y: ray.B.y});    
      }
    
      // endpoint can be for one or more walls. Get the closest
      closest_wall = potential_walls.closest();
      
      // mark endpoint
      // mark endpoint
      if(has_radius && !ray.contains(endpoint)) {
        // endpoint is outside the radius so don't add it to collisions. 
        // need to pad b/c no wall in front of the endpoint, so empty space to next point
        needs_padding = true;
      } else {
        collisions.push({x: endpoint.x, y: endpoint.y}); 
      }     
       
      continue;
    }  
    
    // is this endpoint at the end of the closest_wall?
    if(pointsAlmostEqual(endpoint, closest_wall.A) || 
       pointsAlmostEqual(endpoint, closest_wall.B)) {
       // add all other endpoint walls than closest to potential list, if any
       closest_wall = potential_walls.closest();
       // drawRay(closest_wall)
       
       // then add the endpoint unless it is out of radius
       const inside_radius = !radius || endpoint?.distance_to_origin <= radius;
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
    
    // TO-DO: which of these tests is faster? 
    // is this endpoint within the closest_wall? (Limited radius will do this)
    if(has_radius && closest_wall.toRay().contains(endpoint)) {
      collisions.push({x: endpoint.x, y: endpoint.y});
      // continue;
      
    } else if(closest_wall.toRay().inFrontOfPoint(endpoint, origin)) { 
      //continue;
      
    } else {
      // endpoint is in front. Make this the closest. 
      // add current closest and all the endpoint walls to potential list; get the new closest
      
      // see where the vision point to the new endpoint intersects the prior wall
      // if it does, this is a collision point.
      const ray = constructRay(origin, endpoint, radius);
      //drawRay(ray, COLORS.blue)
      
      if(ray.intersects(closest_wall)) {
        const intersection = ray.intersectSegment([closest_wall.A.x, closest_wall.A.y, closest_wall.B.x, closest_wall.B.y]);
        collisions.push({ x: intersection.x, y: intersection.y });
      }
      
      closest_wall = potential_walls.closest();
      collisions.push({x: endpoint.x, y: endpoint.y});      
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
    
  log(`${collisions.length} collisions`, collisions);  
  this.collisions = collisions;
}

/**
 * Convert the set of rays into the polygon points
 * @returns {number[]}        The polygon points
 * @private
 */
export function testCCWConstructPoints(wrapped) {
   if(!window[MODULE_ID].use_ccw) { 
     if(window[MODULE_ID].debug) { log(`${this.points.length} points`, this.points); }

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
 */ 
function sortEndpointsCW(origin, endpoints) {
  return endpoints.sort((a, b) => {
    // arbitrarily declare upper hemisphere to be first
    // so x < vision_point (above) is before x > vision_point (below)
    // walk quadrants, so Q1 is upper left, Q3 is lower right
    // return > 0 to sort b before a
    if(a.y >= origin.y && b.y < origin.y) return -1;
    if(a.y < origin.y && b.y >= origin.y) return 1;
      
    // in same hemisphere      
    return -orient2d(origin.x, origin.y, 
                    a.x, a.y,
                    b.x, b.y);
  });
}

function arraysEqual(a1,a2) {
    /* WARNING: arrays must not contain {objects} or behavior may be undefined */
    return JSON.stringify(a1)==JSON.stringify(a2);
}

function closestWall(walls, origin) {
  if(walls.length === 0) return undefined;
  if(walls.length === 1) return walls[0];
  return walls.reduce((closest, w) => {
      if(w.toRay().inFrontOfPoint(closest.toRay(), origin)) return w;
      return closest;
    });
}


/*
 * Construct a sight ray given an endpoint and radius
 */
function constructRay(origin, endpoint, radius) {
  
  let ray = (new SightRay(origin, endpoint)).projectDistance(radius);
  
  // don't extend past the canvas  
  // canvas.dimensions.sceneHeight and sceneWidth give the inner scene dimensions
  // canvas.dimensions.height and width give dimensions with padding (what we want)
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
/*
 * Same as constructRay but when you have an angle instead of an endpoint
 */
function constructRayFromAngle(origin, angle, radius) {
  let ray = SightRay.fromAngle(origin.x, origin.y, angle, radius);
  
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
  if(canvas_ray.lenght > 0) {
    const intersect_pt = canvas_ray[0].intersectSegment([ray.A.x, ray.A.y, ray.B.x, ray.B.y]);
    ray = new SightRay(ray.A, intersect_pt);
  }
  
  return ray;
}



/*
 * Add array of walls to the potential list and sort
 */
function addToPotentialList(walls, potentially_blocking_walls, origin) {
  walls = [...walls]; // so walls can be Sets or arrays

  if(walls.length === 0) return potentially_blocking_walls;
  
  const no_sort_required = (walls.length === 1 && potentially_blocking_walls.size === 0);

  walls.forEach(w => {
    potentially_blocking_walls.set(w.id, w);
  });
  
  if(no_sort_required) { return potentially_blocking_walls; }
  
  // entries() provides [key, value] for each
  return new Map([...potentially_blocking_walls.entries()].sort((a, b) => {
    // greater than 0: sort b before a (a is in front of b)
    // less than 0: sort a before b (b is in front of a)
    return a[1].toRay().inFrontOfSegment(b[1].toRay(), origin) ? 1 : -1;
  }));    
}

/*
 * Pop a wall from the potential wall Map
 */
function popMap(potentially_blocking_walls) {
  if(potentially_blocking_walls.size === 0) return undefined;

  const keys = [...potentially_blocking_walls.keys()];
  const popkey = keys[keys.length - 1];
  const obj = potentially_blocking_walls.get(popkey);
  potentially_blocking_walls.delete(popkey);
  return obj;
}

// 1 if CCW, -1 if CW, 0 if in line
function endpointWallCCW(origin, endpoint, wall) {
  const non_anchor = pointsAlmostEqual(wall.A, endpoint) ? wall.B : wall.A;
  return ccwPoints(origin, endpoint, non_anchor);
}


/**
 * Wrap _padRays.
 * This version adds the collision points but avoids the r.result.terminal issue.
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
  if(!window[MODULE_ID].use_ccw) { return wrapped(r0, r1, padding, rays, requireTest); }

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





