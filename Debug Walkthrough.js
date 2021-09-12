// Useful commands
w = canvas.walls.controlled[0]; // get selected wall

// benchmark
t = canvas.tokens.controlled[0];
await window.testccw.benchmark(1000, t.center)

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

Poly._initializeEndpoints(type)

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