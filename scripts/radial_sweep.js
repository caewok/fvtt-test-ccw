import { MODULE_ID } from "./module.js";
import { orient2d } from "./lib/orient2d.min.js";
import { pointsAlmostEqual } from "./util.js";

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
  if(!window[MODULE_ID].use_ccw) { return wrapped(); }
  
    
  // Configure inputs
  const origin = this.origin;
  const {maxR, isLimited, aMin, aMax} = this.config;
  const radius = this.config.radius ?? maxR;
  const collisions = [];  // array to store collisions in lieu of rays
  //const angles = new Set();
  const padding = Math.PI / Math.max(this.config.density, 6);
  const has_radius = this.config.hasRadius;
  let endpoints = Array.from(this.endpoints.values());
  
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

  // Sort endpoints by angle
  endpoints = sortEndpoints(this.origin, endpoints);
  
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
  let lastRay = SightRay.fromAngle(origin.x, origin.y, aMin, radius);

  // We may need to explicitly include a first ray
  if ( isLimited || (endpoints.length === 0) ) {
    const pFirst = new WallEndpoint(lastRay.B.x, lastRay.B.y);
    pFirst.angle = aMin;
    endpoints.unshift(pFirst);
  }

  // We may need to explicitly include a final ray
  if ( isLimited || (endpoints.length === 1) ) {
    let aFinal = aMax;
    if(!isLimited) {
      endpoints[0].angle = norm(Math.atan2(endpoint[0].y - this.origin.y, endpoint[0].x - this.origin.x))
      aFinal = endpoints[0].angle + Math.PI;
    }
    const rFinal = SightRay.fromAngle(origin.x, origin.y, aFinal, radius);
    const pFinal = new WallEndpoint(rFinal.B.x, rFinal.B.y);
    pFinal.angle = aFinal;
    endpoints.push(pFinal);
  }
  
  // Start by checking if the initial ray intersects any segments.
  // If yes, then get the closest segment 
  // If no, the starting endpoint is the first in the sort list
  // Query: How slow is wall.toRay? Should wall incorporate more Ray methods to avoid this?
  let closest_wall = undefined;
  let potentially_blocking_walls = []; // set of walls that could block given current sweep. Ordered furthest to closest.
  
  const intersecting_walls = [...this.walls].filter(w => lastRay.intersects(w));
  if(intersecting_walls.length > 0) {
    closest_wall = closestWall(intersecting_walls, origin);
    potentially_blocking_walls.push(closest_wall);
  }
  
  
  // TO-DO: remove endpoints that are not within our limited angle
  
  let needs_padding = false;
  // Sweep each endpoint
  for ( let endpoint of endpoints ) {
  
    // TO-DO: Catch crossed walls, create new endpoint at the cross
    // Probably sort endpoints other direction so can pop from array.
    // Then add back in an endpoint at the cross
    // Create new sub-walls from the cross. 
    // Can identify by checking for intersections between closest wall and potential walls
    // Need inFrontOfSegment to return undefined for a cross
    // Sort will then need to take the left endpoint as the closest. 
  
    // if no walls between the last endpoint and this endpoint and 
    // dealing with limited radius, need to pad by drawing an arc 
    if(hasRadius && needs_padding) {
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
      // endpoint can be for one or more walls. Get the closest
      closest_wall = closestWall([...endpoint.walls], origin); 
      
      if(closest_wall) potentially_blocking_walls.push(closest_wall);
  
      // mark endpoint
      collisions.push(endpoint);      
      continue;
    }  
    
    // is this endpoint at the end of the closest_wall?
    if(almostEqual(endpoint, closest_wall.A) || almostEqual(endpoint, closest_wall.B)) {
       // then add the endpoint, remove the wall from potential list.
       collisions.push(endpoint);
       
       const ray = constructRay(origin, endpoint, radius);
              
       // what is the next-closest wall? 
       closest_wall = potentially_blocking_walls.pop();
       let intersection = undefined
       if(closest_wall) {
         // get the new intersection point: where the ray hits the next-closest wall
         intersection = ray.intersectSegment(closest_wall.coords);
       }  
       if(!closest_wall || !intersection) {
         // no next-closest wall
         // hitting the radius or canvas edge. If radius, need to pad to next endpoint
         
         // if radius-limited, it is possible for next-closest to be outside the radius
         // endpoint is the intersection with the radius circle (endpoint of the ray)
         // all other potentially blocking segments are outside radius at this point 
         //   (otherwise, we would have hit their endpoints by now)
         
         collisions.push(ray.B);
         potentially_blocking_walls = [];
         closest_wall = undefined;
         
         // padding  
         needs_padding = ray;
       
       } else if(intersection) {
          // intersection is our new endpoint
          collisions.push(intersection);
       } 
         
       continue;  
    } 
    
    // is this endpoint within the closest_wall? [Can this happen? limited angle of vision?]
    
    // is this endpoint behind the closest wall?
    
    if(closest_wall.inFrontOfPoint(endpoint)) { 
      // then this endpoint wall should be added to potential list; move to next endpoint
      potentially_blocking_walls = addToPotentialList(endpoint, potentially_blocking_walls);     
       //continue;
      
    } else {
      // endpoint is in front. Make this the closest. 
      // add current closest and all the endpoint walls to potential list; get the new closest
      potentially_blocking_walls.push(closest_wall);
      potentially_blocking_walls = addToPotentialList(endpoint, potentially_blocking_walls);
      closest_wall = potentially_blocking_walls.pop();
      collisions.push(endpoint);
            
       //continue; 
    }
    
 
  }
    
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
  }
    
  this.collisions = collisions;
}

/**
 * Convert the set of rays into the polygon points
 * @returns {number[]}        The polygon points
 * @private
 */
export function testCCWConstructPoints(wrapped) {
   if(!window[MODULE_ID].use_ccw) { return wrapped(); }

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
      if(w.toRay().inFrontOf(closest.toRay(), origin)) return w;
      return closest;
    });
}


/*
 * Construct a sight ray given an endpoint and radius
 */
function constructRay(origin, endpoint, radius) {
  return (new SightRay(origin, endpoint)).projectDistance(radius);
}

/*
 * Add array of walls to the potential list and sort
 */
function addToPotentialList(endpoint, potentially_blocking_walls) {
  [...endpoint.walls].forEach(w => {
    potentially_blocking_walls.push(w);
  });
  potentially_blocking_walls.sort((a, b) => {
    // greater than 0: a in front of b
    return a.toRay().inFrontOfSegment(b.toRay()) ? 1 : -1;
  });
  
  return potentially_blocking_walls;
}


// expensive
/*
function _padRays(r0, r1, padding, rays, requireTest) {

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

      // If may be required to test the padded ray
      if ( requireTest ) {
        this._testRay(r, lr);
        lr = r;
        if ( r.result.superfluous ) continue;
      }

      // Otherwise we can assume it reaches the endpoint
      else {
        const pt = new WallEndpoint(r.B.x, r.B.y);
        pt.isTerminal = r.result.terminal = true;
        r.collisions = [pt];
      }
      rays.push(r);
    }
  }
*/






