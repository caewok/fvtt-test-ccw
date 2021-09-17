// Useful commands
w = canvas.walls.controlled[0]; // get selected wall

// benchmark
t = canvas.tokens.controlled[0];
await game.modules.get(MODULE_ID).api.benchmark(10000, t.center)

// benchmark light
// lights appear to be hardcoding to density 60. See Light Source Initialization      
l = [...canvas.lighting.sources][0];
await game.modules.get(MODULE_ID).api.benchmark(10000, {x: l.x, y: l.y}, {angle: l.data.angle, debug: false, density: 60, radius: l.radius, rotation: l.rotation, type: "light"})

// imported functions
function almostEqual(x, y, EPSILON = 1e-10) {
  return Math.abs(x - y) < EPSILON;
}

function pointsAlmostEqual(p1, p2, EPSILON = 1e-10) {
  return almostEqual(p1.x, p2.x, EPSILON) && almostEqual(p1.y, p2.y, EPSILON);
}

function calculateDistance(A, B, EPSILON = 1e-10) {
  // could use pointsAlmostEqual function but this avoids double-calculating
  const dx = Math.abs(B.x - A.x); 
  const dy = Math.abs(B.y - A.y);
  if(dy < EPSILON && dx < EPSILON) { return 0; }
  if(dy < EPSILON) { return dx; }
  if(dx < EPSILON) { return dy; }

  return Math.hypot(dy, dx);
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

function sortEndpointsCWOriginal(origin, endpoints) {
  return endpoints.sort((a, b) => {
    if(a.y >= origin.y && b.y < origin.y) return -1;
    if(a.y < origin.y && b.y >= origin.y) return 1; // a is TOP, b is BOTTOM
    return -orient2dPoints(origin, a, b);
  });
}

/*
 * Sort an array of points CW in relation to line due west from origin.
 * so array[0] would be the last point encountered if moving clockwise from the line.
 *    array[last] would be the first point encountered.
 * (to sort the other direction, reverse the signs)
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
    
    a_quadrant = a.x < origin.x ? LEFT : RIGHT;
    b_quadrant = b.x < origin.x ? LEFT : RIGHT;
    
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
 Currently fails to work
function sortEndpointsCWStorageVersion(origin, endpoints) {
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
    a.hemisphere = Boolean(a?.hemisphere) ? a.hemisphere : (a.y < origin.y) ? TOP : BOTTOM;
    b.hemisphere = Boolean(b?.hemisphere) ? b.hemisphere : (b.y < origin.y) ? TOP : BOTTOM;
    
    // if not in same hemisphere, sort accordingly
    if(a.hemisphere !== b.hemisphere) return a.hemisphere; 
    // TOP:  b before a (1)
    // BOTTOM: a before b (-1)
    
    a.quadrant = Boolean(a?.quadrant) ? a.quadrant : (a.x < origin.x) ? LEFT : RIGHT;
    b.quadrant = Boolean(b?.quadrant) ? b.quadrant : (b.x < origin.x) ? LEFT : RIGHT;
    
    if(a.quadrant !== b.quadrant) {
      // already know that a and b share hemispheres
      if(a.hemisphere === TOP) {
        return a.quadrant;
        // TOP, LEFT: b before a (1)
        // TOP, RIGHT: a before b (-1)
      } else {
        return -a.quadrant;
        // BOTTOM, LEFT: a before b (-1)
        // BOTTOM, RIGHT: b before a (1)
      }
    }
        
    return -orient2dPoints(origin, a, b);
   
  });
}
*/

/*
 * Same as sortEndpointsCW but sort from a baseline other than due west.
 * Probably slower than sortEndpointsCW b/c it cannot segregate by hemisphere.
 * Also has to do additional tests to compare orientations.
 * sortEndpointsCWFrom(origin, endpoints, {x: origin.x - 100, y: origin.y}) should equal
 * sortEndpointsCW(origin, endpoints)
 */
function sortEndpointsCWFromOriginal(origin, endpoints, reference) {
  return endpoints.sort((a, b) => {
    const a_value = ccwPoints(origin, reference, a);
    const b_value = ccwPoints(origin, reference, b);
    if(a_value === b_value) {
      return -orient2dPoints(origin, a, b);
    
    } else {
      // a_value is -1, then a is CCW to the reference; b is CW
      return -a_value;
    }
  });
}

/*
 * Same as sortEndpointsCW but sort from a baseline other than due west.
 * accomplish by adding in a reference point to the endpoints list, then sorting.
 * Then shift the array based on reference point
 * Also has to do additional tests to compare orientations.
 * sortEndpointsCWFrom(origin, endpoints, {x: origin.x - 100, y: origin.y}) should equal
 * sortEndpointsCW(origin, endpoints)
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
  if(canvas_ray.length > 0) {
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


function drawEndpoint(pt, color = 0xFF0000, radius = 5) {
  canvas.controls.debug.beginFill(color).drawCircle(pt.x, pt.y, radius).endFill();
}

function drawRay(ray, color = 0xFF0000, width = 1) {
   canvas.controls.debug.lineStyle(width, color, 1).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);
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


// Token version

t = canvas.tokens.controlled[0];
Poly = new RadialSweepPolygon(t.center, {debug: true});
Poly.initialize(t.center, {type: "sight", angle: t.data.sightAngle, rotation: t.data.rotation});


// calc_radius =  canvas.scene.data.globalLight ? undefined : 
//                t.data.dimSight * canvas.scene.data.grid;


//Lights version
/*
l = [...canvas.lighting.sources][0];
Poly = new RadialSweepPolygon({ x:l.x, y: l.y }, {debug: true})
Poly.initialize({ x:l.x, y: l.y }, {angle: l.data.angle, debug: false, density: 60, radius: l.radius, rotation: l.data.rotation, type: "light"})
*/




let {angle, debug, rotation, type} = Poly.config;


//if ( Poly.config.radius === 0 ) return this;
    
    
Poly.config.hasRadius = Poly.config.radius > 0;

// Record configuration parameters
Poly.config.maxR = canvas.dimensions.maxR;
isLimited = Poly.config.isLimited = angle < 360;
Poly.config.aMin = isLimited ? Math.normalizeRadians(Math.toRadians(rotation + 90 - (angle / 2))) : -Math.PI;
Poly.config.aMax = isLimited ? Poly.config.aMin + Math.toRadians(angle) : Math.PI;

// Construct endpoints for each Wall
game.modules.get(MODULE_ID).api.use_ccw = false;
game.modules.get(MODULE_ID).api.use_ccw = true;

Poly._initializeEndpoints(type)
test1 = [...Poly.endpoints.values()].some(e => e.angle !== undefined);
test2 = [...Poly.rays.values()].some(r => r._angle !== undefined);

Poly._sweepEndpoints();
test3 = [...Poly.endpoints.values()].some(e => e.angle !== undefined);
test4 = [...Poly.rays.values()].some(r => r._angle !== undefined);


Poly._constructPoints();
test5 = [...Poly.endpoints.values()].some(e => e.angle !== undefined);
test6 = [...Poly.rays.values()].some(r => r._angle !== undefined);


// timing test
t0 = performance.now();
Poly._initializeEndpoints(type)
Poly._sweepEndpoints();
Poly._constructPoints();
t1 = performance.now();
console.log(`Created polygon in ${Math.round(t1 - t0)}ms`);
canvas.controls.debug.clear();
Poly.visualize();

// drawings
for(i = 0; i < Poly.points.length; i += 2) {
  drawEndpoint({x: Poly.points[i], y: Poly.points[i+1]})
}



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
orient2d = game.modules.get(MODULE_ID).api.orient2d;
MODULE_ID = "testccw"
PotentialWallList = game.modules.get(MODULE_ID).api.PotentialWallList;
game.modules.get(MODULE_ID).api.use_ccw = true; // for _padRays, initializeEndpoints test


performance.clearMarks();
performance.clearMeasures();

performance.mark("_initializeEndpoints start")
Poly._initializeEndpoints(type)
performance.mark("_initializeEndpoints end")
canvas.controls.debug.clear();



performance.mark("_sweepEndpoints start");
  // Configure inputs
origin = Poly.origin;
let {maxR, isLimited, aMin, aMax} = Poly.config;
radius = Poly.config.radius ?? maxR;
collisions = [];  // array to store collisions in lieu of rays
  //const angles = new Set();
padding = Math.PI / Math.max(Poly.config.density, 6);
has_radius = Poly.config.hasRadius;

potential_walls = new PotentialWallList(origin);

needs_padding = false;
closest_wall = undefined;


// walls should to be an iterable set 
//performance.mark("create walls map start");
//walls = new Map(Object.entries(Poly.walls));
//performance.mark("create walls map end");

/*
canvas.controls.debug.clear();
endpoints.forEach(e => drawEndpoint(e));

*/


  

/*
Test that endpoints are structured correctly
canvas.controls.debug.clear();
iter = endpoints.values();

endpoint = iter.next().value;
canvas.controls.debug.clear();
drawEndpoint(endpoint);
endpoint.walls.forEach(w => drawRay(w));
*/

  if(has_radius) {
    performance.mark("has radius filter start");
    // if limited radius, then segments may start outside and enter the vision area.
    // need to mark that intersection 
    // if endpoint is outside the circle, and has no walls that intersect the circle, drop
    // determine which walls intersect the circle
    
    performance.mark("radius walls forEach")
    Poly.walls.forEach(w => {
      // w.radius_intersect = w.wall.toRay().potentialIntersectionsCircle(origin, radius);
      w.wall.radius_potential_intersect = w.wall.toRay().potentialIntersectionsCircle(origin, radius);
      w.wall.radius_actual_intersect = w.wall.radius_potential_intersect.filter(p => {
         return w.wall.contains(p);
      });
    
    });
    
    performance.mark("radius endpoints forEach")
    // track outside the forEach loop to avoid removing new additions
    const endpoints_to_add = [];
    const endpoints_to_delete = [];
    
    // 1. trim the wall set of each endpoint to only those with actual intersections
    Poly.endpoints.forEach(e => {
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
    performance.mark("radius endpoints drop forEach")
    Poly.endpoints.forEach(e => {
      if(e.walls.size === 0 && e.distance_to_origin > radius) {
        k = WallEndpoint.getKey(e.x, e.y);
        endpoints_to_delete.push(k);
      }
    });
    
    performance.mark("radius endpoints drop forEach")
    endpoints_to_delete.forEach(k => Poly.endpoints.delete(k));
    
    performance.mark("radius walls add forEach")
    endpoints_to_add.forEach(pt => {
      k = WallEndpoint.getKey(pt.x, pt.y);
      Poly.endpoints.set(k, pt);
    });
        
    performance.mark("has radius filter end");    
  } else {
    // add 4-corners endpoints if not limited radius
    // used to draw polygon from the edges of the canvas (including padding).
    performance.mark("4-corners start");
    pts = [{ x: 0, y: 0 }, 
           { x: 0, y: canvas.dimensions.height },
           { x: canvas.dimensions.width, y: 0 },
           { x: canvas.dimensions.width, y: canvas.dimensions.height }];
           
    pts.forEach(pt => {
      k = WallEndpoint.getKey(pt.x, pt.y);
      Poly.endpoints.set(k, new WallEndpoint(pt.x, pt.y)); // don't need SweepPoint b/c 4 corners should be integers
    });   
    performance.mark("4-corners end"); 
  }
    
    

  


// 3350, 1912

 

performance.mark("minRay intersect");  
  // Begin with a ray at the lowest angle to establish initial conditions
  // Can avoid using FromAngle if aMin is -π, which means it goes due west
  minRay = aMin === -Math.PI ? constructRay(origin, {x: origin.x - 100, y: origin.y}, radius) :
     constructRayFromAngle(origin, aMin, radius);  
  maxRay = isLimited ? constructRayFromAngle(origin, aMax, radius) : undefined;
   //drawRay(minRay, COLORS.blue)
  //drawRay(maxRay, COLORS.blue)
  
minRay_intersecting_walls = [...Poly.walls.values()].filter(w => minRay.intersects(w.wall));

if(minRay_intersecting_walls.length > 0) {
  // these walls are actually walls[0].wall
  minRay_intersecting_walls = minRay_intersecting_walls.map(w => w.wall);
  
  potential_walls.addWalls(minRay_intersecting_walls);
  closest_wall = potential_walls.closest();
  //drawRay(closest_wall)
}
  
  // if the angle is limited, trim the endpoints and add endpoints for starting/ending ray 
  if(isLimited) {
    performance.mark("limited filter");
    // Trim the endpoints -----
    //drawRay(maxRay)
    if(Math.abs(aMax - aMin) > Math.PI) {
       // if aMin to aMax is greater than 180º, easier to determine what is out
      // if endpoint is CCW to minRay or CW to maxRay, it is outside
      Poly.endpoints.forEach(e => {
        if(ccwPoints(origin, minRay.B, e) > 0 || 
           ccwPoints(origin, maxRay.B, e) < 0) {
          k = WallEndpoint.getKey(e.x, e.y);
          Poly.endpoints.delete(k);
          }
      });
      
     
      
    } else {
      // if aMin to aMax is less than 180º, easier to determine what is in
      // endpoint is CW to minRay and CCW to maxRay, it is inside
      Poly.endpoints.forEach(e => {
        if(!(ccwPoints(origin, minRay.B, e) <= 0 && ccwPoints(origin, maxRay.B, e) >= 0)) {
          k = WallEndpoint.getKey(e.x, e.y);
          Poly.endpoints.delete(k);
        }
      
      });
    }
    
    // canvas.controls.debug.clear();
    // endpoints.forEach(e => drawEndpoint(e))
  }
  
  // Sort endpoints from CW (0) to CCW (last), in relation to a line due west from origin.
  // (For this sort, a for loop would count down from last to 0)
  // For limited angle, sort from the minRay instead of from due west
  // sorting from due west is a bit faster 
  // TO-DO: is minRay.B an acceptable target? What happens if another endpoint equals minRay.B?
  performance.mark("endpoints sort start");
  endpoints = isLimited ? sortEndpointsCWFrom(origin, [...Poly.endpoints.values()], minRay.B) : sortEndpointsCW(origin, [...Poly.endpoints.values()]);

   
   
  if(isLimited) {
    performance.mark("limited angle add minRay endpoint");
    // for limited angle, add starting and ending endpoints after the sort, to ensure they are in correct position
    // Add endpoint for the minRay -----
    minRay_intersection = undefined;
    if(closest_wall) {
      minRay_intersection = minRay.intersectSegment(closest_wall.coords);
    }
    minRay_endpoint = minRay_intersection ? new SweepPoint(minRay_intersection.x, minRay_intersection.y) : new SweepPoint(minRay.B.x, minRay.B.y);
    //drawEndpoint(minRay_endpoint)
    minRay_endpoint.minLimit = true;
    
    endpoints.push(minRay_endpoint); // first endpoint encountered should be this one
    
    //k = minRay_endpoint.key;
    //Poly.endpoints.set(k, minRay_endpoint);
    
    //collisions.push({ x: minRay_endpoint.x, y: minRay_endpoint.y });
    
    // Add an endpoint for the maxRay -----
    // Same basic structure as for minRay but for the need to create a tmp wall list
    // Add as endpoint so algorithm can handle the details
    performance.mark("limited angle add maxRay endpoint");
    
    maxRay_intersecting_walls = [...walls.values()].filter(w => maxRay.intersects(w.wall));
   maxRay_potential_walls = new PotentialWallList(origin);
   maxRay_closest_wall = undefined;
  
  if(maxRay_intersecting_walls.length > 0) {
    // these walls are actually walls[0].wall
    maxRay_intersecting_walls = maxRay_intersecting_walls.map(w => w.wall);
  
    maxRay_potential_walls.addWalls(maxRay_intersecting_walls);
    maxRay_closest_wall = maxRay_potential_walls.closest();
  }
    
    maxRay_intersection = undefined;
    if(maxRay_closest_wall) {
      maxRay_intersection = maxRay.intersectSegment(maxRay_closest_wall.coords);
      //drawEndpoint(intersection)
      //endpoints.some(e => pointsAlmostEqual(e, intersection))
    }
    
    maxRay_endpoint = maxRay_intersection ? new SweepPoint(maxRay_intersection.x, maxRay_intersection.y) : new SweepPoint(maxRay.B.x, maxRay.B.y);
    maxRay_endpoint.maxLimit = true;
    
    //k = maxRay_endpoint.key;
    //Poly.endpoints.set(k, maxRay_endpoint);  
    endpoints.unshift(maxRay_endpoint);  
  }


  // We may need to explicitly include a first ray
//   if ( isLimited || (endpoints.length === 0) ) {
//     const pFirst = new WallEndpoint(lastRay.B.x, lastRay.B.y);
//     pFirst.angle = aMin;
//     endpoints.unshift(pFirst);
//   }

  // We may need to explicitly include a final ray
 //  if ( isLimited || (endpoints.length === 1) ) {
//     let aFinal = aMax;
//     if(!isLimited) {
//       endpoints[0].angle = norm(Math.atan2(endpoint[0].y - origin.y, endpoint[0].x - origin.x))
//       aFinal = endpoints[0].angle + Math.PI;
//     }
//     const rFinal = SightRay.fromAngle(origin.x, origin.y, aFinal, radius);
//     const pFinal = new WallEndpoint(rFinal.B.x, rFinal.B.y);
//     pFinal.angle = aFinal;
//     endpoints.push(pFinal);
//   }
  
  // Start by checking if the initial ray intersects any segments.
  // If yes, then get the closest segment 
  // If no, the starting endpoint is the first in the sort list
  // Query: How slow is wall.toRay? Should wall incorporate more Ray methods to avoid this?

    
  
  
/*
Speed and accuracy testing for different sorts


  
  t0 = performance.now()
  for(i = 0; i < 1000; i++) {
    endpoints0 = sortEndpointsCWOriginal(origin, [...Poly.endpoints.values()]);
  }
  t0 = performance.now() - t0; // ~ 7.4
  
  t1 = performance.now()
  for(i = 0; i < 1000; i++) {
    endpoints1 = sortEndpointsCW(origin, [...Poly.endpoints.values()]);
  }
  t1 = performance.now() - t1; // ~ 4.7
  
  t2 = performance.now()
  for(i = 0; i < 1000; i++) {
    endpoints2 = sortEndpointsCWFromOriginal(origin, [...Poly.endpoints.values()], {x: origin.x - 100, y: origin.y});
    
    //endpoints2 = sortEndpointsCWFromOriginal(origin, [...Poly.endpoints.values()], {x: origin.x - 100, y: origin.y - 100});
  }
  t2 = performance.now() - t2; // ~ 31.2
  
  t3 = performance.now()
  for(i = 0; i < 1000; i++) {
    endpoints3 = sortEndpointsCWFrom(origin, [...Poly.endpoints.values()], {x: origin.x - 100, y: origin.y});
    
    //endpoints3 = sortEndpointsCWFrom(origin, [...Poly.endpoints.values()], {x: origin.x - 100, y: origin.y - 100});
  }
  t3 = performance.now() - t3; // ~ 6.7
  
  t4 = performance.now()
  for(i = 0; i < 1000; i++) {
    endpoints4 = sortEndpointsCWStorageVersion(origin, [...Poly.endpoints.values()]);
  }
  t4 = performance.now() - t4; // ~ 4.7
  
  arraysEqual(endpoints0, endpoints1)
  arraysEqual(endpoints0, endpoints2)
  arraysEqual(endpoints2, endpoints3)
  arraysEqual(endpoints0, endpoints4)
  
  reference = {x: origin.x - 100, y: origin.y - 100}
  ray = new Ray(origin, reference)
  ray = ray.projectDistance(radius)
  
  drawRay(ray, COLORS.blue)
*/

  
  
  //endpoints.forEach(e => drawEndpoint(e))
  
  
  
  // Sweep each endpoint
  // accessing array by index, pop, and push should be O(1) in time. 
  // use while loop and pop so that padding can re-insert an endpoint
  
  
  // flag if there are no endpoints
  has_endpoints = endpoints.length > 0;
  
  // safety for debugging
  //MAX_ITER = endpoints.length * 2; // every time we hit an endpoint, could in theory pad and create another. So doubling number of endpoints should be a safe upper-bound.
  //iter = 0; // MAX_ITER = 7
  
  performance.mark("sweep start");
  
  const ln = endpoints.length;
  for(let i = (ln - 1); i > 0; i -= 1) {
  //while(endpoints.length > 0 && iter < MAX_ITER) {
    //performance.mark(`sweep ${iter}`);
    //iter += 1;
    //endpoint = endpoints.pop()
    endpoint = endpoints[i];
    performance.mark(`sweep ${i}`);
  
  // canvas.controls.debug.clear();
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
      performance.mark(`${i} sweep padding`);
      if(collisions.length < 1) console.warn(`testccw|Sweep: zero collisions`);
      needs_padding = false;
      
      // draw an arc from where the collisions ended to the ray for the new endpoint
      prior_ray = constructRay(origin, collisions[collisions.length - 1], radius); 

      
      ray = constructRay(origin, endpoint, radius);
      
      // drawRay(prior_ray, COLORS.blue)
      // drawRay(ray, COLORS.blue)
            
      // TO-DO: Override _padRays to return a simple array of points to concat
      Poly._padRays(prior_ray, ray, padding, collisions, false); // adds to collisions automatically
      //collisions.push(...pts);
            
      // the endpoint is now the end of the ray, which may or may not be in front of the 
      // next endpoint
      //endpoints.push(endpoint);
      
      
      //canvas.controls.debug.clear();
      //collisions.forEach(c => drawEndpoint(c));
      
      //continue; // don't need continue if not pushing the endpoint. 
      // has_radius set to false here, so if pushed, the next endpoint would be this one
      // and we would be right back where we started.
      
    } 
  
    performance.mark(`${i} add walls`);
    potential_walls.addFromEndpoint(endpoint);
     
    // If at the beginning or at a corner of the canvas, add this endpoint and go to next.
    if(!closest_wall) {
      performance.mark(`${i} not closest wall`);
      // see where the vision point to the new endpoint intersects the canvas edge
      ray = constructRay(origin, endpoint, radius);
      //drawRay(ray, COLORS.blue)
      collisions.push({x: ray.B.x, y: ray.B.y});    
      
      // endpoint can be for one or more walls. Get the closest
      closest_wall = potential_walls.closest();
      //drawRay(closest_wall.toRay())
      
      // mark endpoint
      if(has_radius && (!ray.contains(endpoint) || Boolean(endpoint?.minLimit))) {
        // endpoint is outside the radius so don't add it to collisions. 
        // need to pad b/c no wall in front of the endpoint, so empty space to next point
        needs_padding = true;
      } else if(!pointsAlmostEqual(endpoint, ray.B)) {
        collisions.push({x: endpoint.x, y: endpoint.y}); 
      }         
      continue;
    }  
    
    // is this endpoint at the end of the closest_wall?
    
    if(pointsAlmostEqual(endpoint, closest_wall.A) || pointsAlmostEqual(endpoint, closest_wall.B)){
       performance.mark(`${i} pointsAlmostEqual`);
       // find the next-closet wall b/c we are at the end of the current one
       closest_wall = potential_walls.closest();
       // drawRay(closest_wall)
       
       // then add the endpoint unless it is out of radius
       inside_radius = !has_radius || Boolean(endpoint?.distance_to_origin <= radius);
       
       if(inside_radius) { collisions.push({x: endpoint.x, y: endpoint.y}); }
       
       
       
       ray = constructRay(origin, endpoint, radius);
       //drawRay(ray, COLORS.blue)
              
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
    
    // if we hit the radius circle intersect, similar to hitting the end of the wall
//     if(has_radius && closest_wall.radius_actual_intersect.length > 0) {
//       const hit_intersect = closest_wall.radius_actual_intersect.some(i => {
//         return pointsAlmostEqual(endpoint, i);
//       });
//       
//       closest_wall = potential_walls.closest();
//       collisions.push({x: endpoint.x, y: endpoint.y});
//       
//       needs_padding = 
//     
//     }
     
     
    // TO-DO: which of these tests is faster? 
    // is this endpoint within the closest_wall? (Limited radius will do this)
    if((has_radius || 
        (isLimited && (Boolean(endpoint?.minLimit) || Boolean(endpoint?.maxLimit)))) && 
        closest_wall.contains(endpoint)) {
      performance.mark(`${i} radius add collision`);  
      collisions.push({x: endpoint.x, y: endpoint.y});
    
    } else if(!closest_wall.inFrontOfPoint(endpoint, origin)) {
      performance.mark(`${i} default`);
      // endpoint is in front. Make this the closest. 
      // add current closest and all the endpoint walls to potential list; get the new closest
      
      // see where the vision point to the new endpoint intersects the prior wall
      // if it does, this is a collision point.
      ray = constructRay(origin, endpoint, radius);
      //drawRay(ray, COLORS.blue)
      
      if(ray.intersects(closest_wall)) {
        intersection = ray.intersectSegment([closest_wall.A.x, closest_wall.A.y, closest_wall.B.x, closest_wall.B.y]);
        collisions.push({ x: intersection.x, y: intersection.y });
      } else if(has_radius && Boolean(endpoint?.distance_to_origin > radius)) {
        // (endpoint > radius test may not be necessary; should always be true if has_radius)
        // ray did not reach the wall
        // add the end of the ray point instead
        collisions.push({x: ray.B.x, y: ray.B.y});
        needs_padding = true;
      
      } else {
        collisions.push({x: endpoint.x, y: endpoint.y});
      }
      
      closest_wall = potential_walls.closest();
      
            
       //continue; 
    } 
    // if closest_wall.inFrontOfPoint(endpoint, origin) then 
    // already added the closest wall; nothing else to do. 
    
 
  }
  performance.mark("sweep end");
 


    
// close between last / first endpoint
// deal with unique case where there are no endpoints
// (no blocking walls for radius vision)
if(has_radius && (needs_padding || !has_endpoints)) {
  performance.mark("end padding");
  collisions_ln = collisions.length;
  
  p_last = collisions[collisions_ln - 1];
  p_current = collisions[0]
  
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
  prior_ray = constructRay(origin, p_last, radius); 
  ray = constructRay(origin, p_current, radius);
    
  // drawRay(prior_ray, COLORS.blue)
  // drawRay(ray, COLORS.blue)
          
  // TO-DO: Override _padRays to return a simple array of points to concat
  Poly._padRays(prior_ray, ray, padding, collisions, false); // adds to collisions automatically
  //collisions.push(...pts);
  
  if(collisions_ln < 2) {
    // get the second half
    collisions.push(p_current);
    Poly._padRays(ray, prior_ray, padding, collisions, false); 
  }
  
 } 
    
Poly.collisions = collisions;
  
performance.mark("_sweepEndpoints end")


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

// report on marks
/*
marks = performance.getEntriesByType('mark');
for(i = 1; i < marks.length; i++) {
  t = (marks[i].startTime - marks[i - 1].startTime) / 1000;
  console.log(`${marks[i].name}: \t\t${t.toPrecision(2)} secs`);
}
*/

// totals

mark_initialize_start = performance.getEntriesByName("_initializeEndpoints start")[0].startTime;
mark_initialize_end = performance.getEntriesByName("_initializeEndpoints end")[0].startTime;
mark_sweep_start = performance.getEntriesByName("_sweepEndpoints start")[0].startTime;
mark_sweep_sort_start = performance.getEntriesByName("endpoints sort start")[0].startTime;
mark_sweep_loop_start = performance.getEntriesByName("endpoints sort start")[0].startTime;
mark_sweep_loop_end = performance.getEntriesByName("sweep end")[0].startTime;
mark_sweep_end = performance.getEntriesByName("_sweepEndpoints end")[0].startTime;


console.log(`Initialize:\t\t${((mark_initialize_end - mark_initialize_start) / 1000).toPrecision(2)}`);
console.log(`Sweep prep:\t\t${((mark_sweep_sort_start - mark_sweep_start) / 1000).toPrecision(2)}`);
console.log(`Sweep sort:\t\t${((mark_sweep_loop_start - mark_sweep_sort_start) / 1000).toPrecision(2)}`);
console.log(`Sweep loop:\t\t${((mark_sweep_loop_end - mark_sweep_loop_start) / 1000).toPrecision(2)}`);
console.log(`Sweep total:\t${((mark_sweep_end - mark_sweep_start) / 1000).toPrecision(2)}`);
