// imported functions
function almostEqual(x, y, EPSILON = 1e-10) {
  return Math.abs(x - y) < EPSILON;
}

function pointsAlmostEqual(p1, p2, EPSILON = 1e-10) {
  return almostEqual(p1.x, p2.x, EPSILON) && almostEqual(p1.y, p2.y, EPSILON);
}

function orient2dPoints(p1, p2, p3) {
  return orient2d(p1.x, p1.y,
                  p2.x, p2.y,
                  p3.x, p3.y);
}

function ccwPoints(p1, p2, p3) {
  const res = orient2dPoints(p1, p2, p3);
                         
  return res < 0 ? -1 : 
         res > 0 ?  1 : 0;
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

function closestWall(walls_arr, origin) {
  if(walls_arr.length === 0) return undefined;
  if(walls_arr.length === 1) return walls_arr[0];
  return walls_arr.reduce((closest, w) => {
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
            { x: canvas.dimensions.width, y: 0 }),
    new Ray({ x: 0, y: 0 }, 
            { x: 0, y: canvas.dimensions.height }),
    new Ray({ x: canvas.dimensions.width, y: 0}, 
            { x: canvas.dimensions.width, y: canvas.dimensions.height }),
    new Ray({ x: canvas.dimensions.width, y: canvas.dimensions.height }, 
            { x: 0, y: canvas.dimensions.height })
  ];
  
  const canvas_ray = canvas_rays.filter(r => ray.intersects(r));
  if(canvas_ray) {
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
    // greater than 0: a in front of b
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

/*
 * Check if endpoint wall is CCW from given origin and endpoint
 */
function endpointWallCCW(origin, endpoint, wall) {
  const non_anchor = pointsAlmostEqual(wall.A, endpoint) ? wall.B : wall.A;
  return ccwPoints(origin, endpoint, non_anchor);
}




// Useful commands
w = canvas.walls.controlled[0]; // get selected wall

// benchmark
t = canvas.tokens.controlled[0];
await window.testccw.benchmark(1000, t.center)

const COLORS = {
  orange: 0xFFA500,
  yellow: 0xFFFF00,
  greenyellow: 0xADFF2F,
  blue: 0x0000FF,
  lightblue: 0xADD8E6,
  red: 0xFF0000,
  gray: 0x808080,
  black: 0x000000,
  white: 0xFFFFFF
}

// Create RadialSweepPolygon
// (use let b/c we are pasting into console a lot)

t = canvas.tokens.controlled[0];
Poly = new RadialSweepPolygon(t.center, {debug: true})
Poly.initialize(t.center)

let {angle, debug, rotation, type} = Poly.config;


//if ( Poly.config.radius === 0 ) return this;
    
    
Poly.config.hasRadius = Poly.config.radius > 0;

// Record configuration parameters
Poly.config.maxR = canvas.dimensions.maxR;
isLimited = Poly.config.isLimited = angle < 360;
Poly.config.aMin = isLimited ? Math.normalizeRadians(Math.toRadians(rotation + 90 - (angle / 2))) : -Math.PI;
Poly.config.aMax = isLimited ? Poly.config.aMin + Math.toRadians(angle) : Math.PI;

// Construct endpoints for each Wall



Poly._initializeEndpoints(type)


// ----- this._initializeEndpoints(type); -------------------- 
Poly.walls = {};
Poly.endpoints.clear();
const norm = a => a < Poly.config.aMin ? a + (2*Math.PI) : a;

// Consider all walls in the Scene
for ( let wall of this._getCandidateWalls() ) {
  // walls = Poly._getCandidateWalls()
  // wall = walls[0]

  // Test whether a wall should be included in the set considered for this polygon
  if ( !Poly._includeWall(wall, type) ) continue;
  

// ----- this._includeWall; -------------------- 

// Special case - coerce interior walls to block light and sight
const isInterior = ( type === "sight" ) && (wall.roof?.occluded === false);
if ( isInterior ) return true;

// Ignore non-blocking walls and open doors
if ( !wall.data[type] || wall.isOpen ) return false;

// Ignore one-directional walls which are facing away from the origin
if ( !wall.data.dir ) return true;  // wall.data.dir is BOTH: 0, LEFT: 1, RIGHT: 2  CONST.WALL_DIRECTIONS
const mp = wall.midpoint;
const wa = Math.atan2(mp[1] - Poly.origin.y, mp[0] - Poly.origin.x);
const d = Math.normalizeRadians(wa - wall.direction);
return d.between(-Math.PI/2, Math.PI/2);
  
// END this._includeWall; -------------------------

  // Register both endpoints for included walls
  let [x0, y0, x1, y1] = wall.data.c;
  ak = WallEndpoint.getKey(x0, y0);
  a = Poly.endpoints.get(ak);
  if ( !a ) {
    a = new WallEndpoint(x0, y0);
    a.angle = norm(Math.atan2(y0 - Poly.origin.y, x0 - Poly.origin.x));
    a.isEndpoint = true;
    Poly.endpoints.set(ak, a);
  }
  a.attachWall(wall);

  bk = WallEndpoint.getKey(x1, y1);
  b = Poly.endpoints.get(bk);
  if ( !b ) {
    b = new WallEndpoint(x1, y1);
    b.angle = norm(Math.atan2(y1 - Poly.origin.y, x1 - Poly.origin.x));
    b.isEndpoint = true;
    Poly.endpoints.set(bk, b);
  }
  b.attachWall(wall);

  // Record the wall
  Poly.walls[wall.id] = {wall, a, b};
}


// END this._initializeEndpoints(type); -------------------- 



// Iterate over endpoints
// ----- this._sweepEndpoints();-------------------- 
  // Configure inputs
origin = Poly.origin;
let {maxR, isLimited, aMin, aMax} = Poly.config;
radius = Poly.config.radius ?? maxR;
rays = [];
angles = new Set();
padding = Math.PI / Math.max(Poly.config.density, 6);

// Sort endpoints by angle
// -π appears to be left (upper)
// π / 2: straight south
// - π / 2: straight north
// -0 or 0: straight east
// negative angles: upper hemisphere
// positive angles: lower hemisphere

endpoints = Array.from(Poly.endpoints.values());
endpoints.sort((a, b) => a.angle - b.angle);

// Begin with a ray at the lowest angle to establish initial conditions
lastRay = SightRay.fromAngle(origin.x, origin.y, aMin, radius);

// We may need to explicitly include a first ray
if ( isLimited || (endpoints.length === 0) ) {
  const pFirst = new WallEndpoint(lastRay.B.x, lastRay.B.y);
  pFirst.angle = aMin;
  endpoints.unshift(pFirst);
}

// We may need to explicitly include a final ray
if ( isLimited || (endpoints.length === 1) ) {
  aFinal = isLimited ? aMax : endpoints[0].angle + Math.PI;
  rFinal = SightRay.fromAngle(origin.x, origin.y, aFinal, radius);
  pFinal = new WallEndpoint(rFinal.B.x, rFinal.B.y);
  pFinal.angle = aFinal;
  endpoints.push(pFinal);
}



// Sweep each endpoint
for ( let endpoint of endpoints ) {
// endpoint = endpoints[0]

  // De-dupe repeated angles
  if ( angles.has(endpoint.angle) ) continue;
  angles.add(endpoint.angle);

  // Skip endpoints which are not within our limited angle
  if ( isLimited && !endpoint.angle.between(aMin, aMax) ) continue;

  // Create a Ray targeting this endpoint
  const ray = SightRay.fromAngle(origin.x, origin.y, endpoint.angle, radius);
  ray.endpoint = endpoint;
  endpoint._r = ray.dx !== 0 ? (endpoint.x - origin.x) / ray.dx : (endpoint.y - origin.y) / ray.dy;
  if ( (ray.dx === 0) && (ray.dy === 0) ) endpoint._r = 0;

  // Test the ray
  this._testRay(ray, lastRay);
  if ( ray.result.superfluous ) continue;

  // Pad supplementary rays if an adjacent ray reached a terminal point
  if ( lastRay.result.terminal || (Poly.config.hasRadius && ray.result.terminal) ) {
    this._padRays(lastRay, ray, padding, rays, Poly.config.hasRadius);
  }

  // Push the ray
  rays.push(ray);
  lastRay = ray;
}

// For complete circles, pad gaps between the final ray and the initial one
if ( !isLimited && lastRay.result.terminal ) {
  Poly._padRays(lastRay, rays[0], padding, rays, Poly.config.hasRadius);
}
Poly.rays = rays;



// Create the Polygon geometry
// ----- this._constructPoints(); -------------------- 


// Debug the sight visualization
if ( debug ) {
  let t1 = performance.now();
  console.log(`Created polygon in ${Math.round(t1 - t0)}ms`);
  Poly.visualize();
}




// NEW VERSION ----- this._sweepEndpoints();-------------------- 
orient2d = window.testccw.orient2d;
MODULE_ID = "testccw"

function drawEndpoint(pt, color = 0xFF0000, radius = 5) {
  canvas.controls.debug.beginFill(color).drawCircle(pt.x, pt.y, radius).endFill();
}

function drawRay(ray, color = 0xFF0000, width = 1) {
   canvas.controls.debug.lineStyle(width, color, 1).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);
}


Poly._initializeEndpoints(type)
canvas.controls.debug.clear();


  // Configure inputs
origin = Poly.origin;
let {maxR, isLimited, aMin, aMax} = Poly.config;
radius = Poly.config.radius ?? maxR;
collisions = [];  // array to store collisions in lieu of rays
  //const angles = new Set();
padding = Math.PI / Math.max(Poly.config.density, 6);
has_radius = Poly.config.hasRadius;

// walls should to be an iterable set 

walls = new Map(Object.entries(Poly.walls));
  
endpoints = Array.from(Poly.endpoints.values());


/*
Test that endpoints are structured correctly
canvas.controls.debug.clear();
iter = endpoints.values();

endpoint = iter.next().value;
canvas.controls.debug.clear();
drawEndpoint(endpoint);
endpoint.walls.forEach(w => drawRay(w));
*/

  
  // add 4-corners endpoints if not limited radius
  // used to draw polygon from the edges of the canvas (including padding).
  
  if(!has_radius) {
    endpoints.push(new WallEndpoint(0, 0));
    endpoints.push(new WallEndpoint(0, canvas.dimensions.height));
    endpoints.push(new WallEndpoint(canvas.dimensions.width, 0));
    endpoints.push(new WallEndpoint(canvas.dimensions.width, canvas.dimensions.height));
  }
  
  // if limited radius, then segments may start outside and enter the vision area.
  // need to mark that intersection 
  
  // Skip endpoints which are not within our limited angle
  //  if ( isLimited && !endpoint.angle.between(aMin, aMax) ) continue;

  // Sort endpoints by angle
  
  endpoints = sortEndpoints(Poly.origin, endpoints);
  
// drawEndpoint(endpoints[0])

  
  // Begin with a ray at the lowest angle to establish initial conditions
  // radius extends far beyond canvas edge in most instances
lastRay = SightRay.fromAngle(origin.x, origin.y, aMin, radius);

drawRay(lastRay)

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
      endpoints[0].angle = norm(Math.atan2(endpoint[0].y - origin.y, endpoint[0].x - origin.x))
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
closest_wall = undefined;
potentially_blocking_walls = new Map(); // set of walls that could block given current sweep. Ordered furthest to closest.
    
intersecting_walls = [...walls.values()].filter(w => lastRay.intersects(w.wall.toRay()));
if(intersecting_walls.length > 0) {
  // these walls are actually walls[0].wall
  intersecting_walls = intersecting_walls.map(w => w.wall);
  
  potentially_blocking_walls = addToPotentialList(intersecting_walls, potentially_blocking_walls, origin);
  closest_wall = popMap(potentially_blocking_walls);
}
  
  
  // TO-DO: remove endpoints that are not within our limited angle
  
needs_padding = false;
  // Sweep each endpoint
  for ( let endpoint of endpoints ) {
  // for( let endpoint of endpoints.slice(0, 8)) {
  // endpoint = endpoints[0]
  // drawEndpoint(endpoint)
  // drawRay(closest_wall)
  // testray = constructRay(origin, endpoint, radius);
  // drawRay(testray, COLORS.blue)
  
  
    // TO-DO: Catch crossed walls, create new endpoint at the cross
    // Probably sort endpoints other direction so can pop from array.
    // Then add back in an endpoint at the cross
    // Create new sub-walls from the cross. 
    // Can identify by checking for intersections between closest wall and potential walls
    // Need inFrontOfSegment to return undefined for a cross
    // Sort will then need to take the left endpoint as the closest. 
  
    // if no walls between the last endpoint and this endpoint and 
    // dealing with limited radius, need to pad by drawing an arc 
    if(has_radius && needs_padding) {
      const prior_ray = needs_padding;
      
      // draw an arc from where the prior ray ended to the ray for the new endpoint
      const ray = constructRay(origin, endpoint, radius);
      
      // TO-DO: Override _padRays to return a simple array of points to concat
      const padding_rays = this._padRays(prior_ray, ray, padding, [], false);
      padding_rays.forEach(r => {
        collisions.push(r.collisions[0]);
      });  
      needs_padding = false;
      
    } 
  
     
    // If at the beginning or at a corner of the canvas, add this endpoint and go to next.
    if(!closest_wall) {
      // see where the vision point to the new endpoint intersects the canvas edge
      ray = constructRay(origin, endpoint, radius);
      //drawRay(ray, COLORS.blue)
      collisions.push(ray.B);    
    
      // endpoint can be for one or more walls. Get the closest
      potentially_blocking_walls = addToPotentialList(endpoint.walls, potentially_blocking_walls, origin); 
      closest_wall = popMap(potentially_blocking_walls);
      //drawRay(closest_wall.toRay())
      
      // mark endpoint
      collisions.push(endpoint);      
      continue;
    }  
    
    // is this endpoint at the end of the closest_wall?
    if(pointsAlmostEqual(endpoint, closest_wall.A) || pointsAlmostEqual(endpoint, closest_wall.B)) {
       // add all other endpoint walls than closest to potential list, if any
       walls_to_add = endpoint.walls; // this is a Set
       walls_to_add.delete(closest_wall);
       potentially_blocking_walls = addToPotentialList(endpoint.walls, potentially_blocking_walls, origin);
       
       // need to ensure closest_wall is no longer in the potential list
       // shouldn't be necessary, but just in case...
       potentially_blocking_walls.delete(closest_wall.id);
       
       // then add the endpoint
       collisions.push(endpoint);
       
       ray = constructRay(origin, endpoint, radius);
       //drawRay(ray, COLORS.blue)
              
       // what is the next-closest wall? 
       closest_wall = popMap(potentially_blocking_walls);
       // drawRay(closest_wall)
       
       intersection = undefined
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
         
         collisions.push(ray.B);
         potentially_blocking_walls = new Map(); //shouldn't be necessary but just in case
         closest_wall = undefined; // shouldn't be necessary but just in case 
         
         // padding  
         needs_padding = ray;
       
       } else if(intersection) {
          // intersection is our new endpoint unless we are at the join of prior closest
          //  with new closest.
          // (already set closest wall above)
          // drawEndpoint(intersection);
          if(!pointsAlmostEqual(endpoint, intersection)) { collisions.push(intersection); }
          
          
       } 
         
       continue;  
    } 
    
    // is this endpoint within the closest_wall? [Can this happen? limited angle of vision?]
    
    // is this endpoint behind the closest wall?
    
    if(closest_wall.toRay().inFrontOfPoint(endpoint, origin)) { 
      // endpoint walls CW from origin --> endpoint should be added to list
      // if in line with origin? add? 
      endpoint_walls = [...endpoint.walls];
      to_add = endpoint_walls.filter(w => {
        return endpointWallCCW(origin, endpoint, w) >= 0;
      });
      
      // endpoint walls CCW from origin --> endpoint can be removed
      to_remove = endpoint_walls.filter(w => {
        return endpointWallCCW(origin, endpoint, w) < 0;
      });
      
      potentially_blocking_walls = addToPotentialList(to_add, potentially_blocking_walls, origin);     
       
       to_remove.forEach(w => potentially_blocking_walls.delete(w.id));
       
       //continue;
      
    } else {
      // endpoint is in front. Make this the closest. 
      // add current closest and all the endpoint walls to potential list; get the new closest
      
      // see where the vision point to the new endpoint intersects the prior wall
      // if it does, this is a collision point.
      ray = constructRay(origin, endpoint, radius);
      //drawRay(ray, COLORS.blue)
      
      if(ray.intersects(closest_wall)) {
        intersection = ray.intersectSegment([closest_wall.A.x, closest_wall.A.y, closest_wall.B.x, closest_wall.B.y]);
        collisions.push(intersection);
      }
      
      walls_to_add = endpoint.walls; // this is a Set
      walls_to_add.add(closest_wall);
      
      potentially_blocking_walls = addToPotentialList(walls_to_add, potentially_blocking_walls, origin); 
      closest_wall = popMap(potentially_blocking_walls);
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
  } /*else if(needs_padding) {
    console.warn("Need padding to complete non-radius sweep?")
    
    ray = constructRay(origin, endpoints[0], radius);
    //drawRay(ray, COLORS.blue)
    collisions.push(ray.B);
    needs_padding = false;
  } */ // should already happen
    
  Poly.collisions = collisions;
  

// draw collisions

canvas.controls.debug.clear();
collisions.forEach(c => drawEndpoint(c));


// ----------------- constructPoints -------------
  // Poly.collisions = collisions;  
  
  
  points = [];
  isLimited = Poly.config.isLimited;

  // Open a limited shape
  if ( isLimited ) points.push(Poly.origin.x, Poly.origin.y);

  // Add collision points from every ray
  Poly.collisions.forEach(c => { points.push(c.x, c.y) });
  
  // Close a limited polygon
  if ( isLimited ) points.push(Poly.origin.x, Poly.origin.y);
  Poly.points = points;



// draw polygon
//canvas.controls.debug.clear();

p = new PIXI.Polygon(points);
canvas.controls.debug.lineStyle(1, COLORS.red).drawShape(p);



