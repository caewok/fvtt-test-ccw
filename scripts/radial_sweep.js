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
  let endpoints = Array.from(this.endpoints.values());
  
  const potential_walls = window[MODULE_ID].use_bst ? (new PotentialWallListBinary(origin)) : (new PotentialWallList(origin));
  
  let needs_padding = false;
  let closest_wall = undefined;

  log(`${endpoints.length} endpoints at start.`);
  // walls should be an iterable set 
  const walls = new Map(Object.entries(this.walls));
  
  // add 4-corners endpoints if not limited radius
  // used to draw polygon from the edges of the map.
  if(!has_radius) {
    endpoints.push(new WallEndpoint(0, 0));
    endpoints.push(new WallEndpoint(0, canvas.dimensions.sceneHeight));
    endpoints.push(new WallEndpoint(canvas.dimensions.sceneWidth, 0));
    endpoints.push(new WallEndpoint(canvas.dimensions.sceneWidth, canvas.dimensions.sceneHeight));
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
  const minRay = constructRayFromAngle(origin, aMin, radius);
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
      endpoints = endpoints.filter(e => {
        return !(ccwPoints(origin, minRay.B, e) > 0 || ccwPoints(origin, maxRay.B, e) < 0);
      });
      
    } else {
      // if aMin to aMax is less than 180º, easier to determine what is in
      // endpoint is CW to minRay and CCW to maxRay, it is inside
      endpoints = endpoints.filter(e => {
        return ccwPoints(origin, minRay.B, e) <= 0 && ccwPoints(origin, maxRay.B, e) >= 0;
      });
    }

    log(`Sweep: isLimited ${endpoints.length} endpoints after filtering.`, endpoints);
    
    // Add a collision for the minRay -----
    let minRay_intersection = undefined;
    if(closest_wall) {
      minRay_intersection = minRay.intersectSegment(closest_wall.coords);
    }
    const minRay_endpoint = minRay_intersection ? 
            new WallEndpoint(minRay_intersection.x, minRay_intersection.y) : 
            new WallEndpoint(minRay.B.x, minRay.B.y);
    
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
    
    const maxRay_endpoint = maxRay_intersection ? 
            new WallEndpoint(maxRay_intersection.x, maxRay_intersection.y) : 
            new WallEndpoint(maxRay.B.x, maxRay.B.y);
    
    if(!endpoints.some(e => pointsAlmostEqual(e, maxRay_endpoint))) {
      endpoints.push(maxRay_endpoint);
    }
  }
 
  // Sort endpoints from west to north to east to south
  endpoints = sortEndpoints(this.origin, endpoints);
  
  log(`Sweep: ${endpoints.length} endpoints; ${collisions.length} collisions before for loop`, endpoints, collisions);

  // Sweep each endpoint
  for ( let endpoint of endpoints ) {
    potential_walls.addFromEndpoint(endpoint);
    
    // if no walls between the last endpoint and this endpoint and 
    // dealing with limited radius, need to pad by drawing an arc 
    if(has_radius && needs_padding) {
      const prior_ray = needs_padding;
      needs_padding = false;
      
      // draw an arc from where the prior ray ended to the ray for the new endpoint
      const ray = constructRay(origin, endpoint, radius);
      
      // TO-DO: Override _padRays to return a simple array of points to concat
      const padding_rays = this._padRays(prior_ray, ray, padding, [], false);
      padding_rays.forEach(r => {
        collisions.push(r.collisions[0]);
      });  
    } 
     
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
      collisions.push({x: endpoint.x, y: endpoint.y});      
      continue;
    }  
    
    // is this endpoint at the end of the closest_wall?
    if(pointsAlmostEqual(endpoint, closest_wall.A) || 
       pointsAlmostEqual(endpoint, closest_wall.B)) {
       // add all other endpoint walls than closest to potential list, if any
       closest_wall = potential_walls.closest();
       // drawRay(closest_wall)
       
       // then add the endpoint
       collisions.push({x: endpoint.x, y: endpoint.y});
       
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
         
         collisions.push({x: ray.B.x, y: ray.B.y});
         
         // padding  
         needs_padding = ray;
       
       } else if(intersection) {
           // intersection is our new endpoint unless we are at the join of prior closest
          //  with new closest.
          // (already set closest wall above)
          // drawEndpoint(intersection);
          if(!pointsAlmostEqual(endpoint, intersection)) { collisions.push({ x: intersection.x, y: intersection.y }); }
       } 
         
       continue;  
    } 
    
    // is this endpoint within the closest_wall? [Can this happen? limited angle of vision?]
    
    // is this endpoint behind the closest wall?
    
    if(closest_wall.toRay().inFrontOfPoint(endpoint, origin)) { 
      // update the potential walls for this endpoint
     
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
  if(has_radius && needs_padding) {
    
  
    const prior_ray = needs_padding;
    needs_padding = false;
    
    // draw an arc from where the prior ray ended to the ray for the new endpoint
    const ray = constructRay(origin, collisions[0], radius);
    
    // TO-DO: Override _padRays to return a simple array of points to concat
    const padding_rays = this._padRays(prior_ray, ray, padding, [], false);
    padding_rays.forEach(r => {
      collisions.push(r.collisions[0]);
    });  
  } /*else if(needs_padding) {
    console.warn("Need padding to complete non-radius sweep?")
    
    ray = constructRay(origin, endpoints[0], radius);
    //drawRay(ray, COLORS.blue)
    collisions.push(ray.B);
    needs_padding = false;
  }*/ // should already happen
    
    
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


function sortEndpoints(origin, endpoints) {
  return endpoints.sort((a, b) => {
    // arbitrarily declare upper hemisphere to be first
    // so x < vision_point (above) is before x > vision_point (below)
    // walk quadrants, so Q1 is upper left, Q3 is lower right
    // return > 0 to sort b before a
    if(a.y >= origin.y && b.y < origin.y) return 1;
    if(a.y < origin.y && b.y >= origin.y) return -1;
      
    // in same hemisphere      
    return orient2d(origin.x, origin.y, 
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







