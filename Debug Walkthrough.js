// Create RadialSweepPolygon
// (use let b/c we are pasting into console a lot)

t = canvas.tokens.controlled[0];
Poly = new RadialSweepPolygon(t.center, {debug: true})
Poly.initialize(t)

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
if ( !wall.data.dir ) return true;
const mp = wall.midpoint;
const wa = Math.atan2(mp[1] - Poly.origin.y, mp[0] - Poly.origin.x);
const d = Math.normalizeRadians(wa - wall.direction);
return d.between(-Math.PI/2, Math.PI/2);
  
// END this._includeWall; -------------------------

  // Register both endpoints for included walls
  let [x0, y0, x1, y1] = wall.data.c;
  let ak = WallEndpoint.getKey(x0, y0);
  let a = this.endpoints.get(ak);
  if ( !a ) {
    a = new WallEndpoint(x0, y0);
    a.angle = norm(Math.atan2(y0 - this.origin.y, x0 - this.origin.x));
    a.isEndpoint = true;
    this.endpoints.set(ak, a);
  }
  a.attachWall(wall);

  let bk = WallEndpoint.getKey(x1, y1);
  let b = this.endpoints.get(bk);
  if ( !b ) {
    b = new WallEndpoint(x1, y1);
    b.angle = norm(Math.atan2(y1 - this.origin.y, x1 - this.origin.x));
    b.isEndpoint = true;
    this.endpoints.set(bk, b);
  }
  b.attachWall(wall);

  // Record the wall
  this.walls[wall.id] = {wall, a, b};
}





// Iterate over endpoints
// ----- this._sweepEndpoints();-------------------- 


// Create the Polygon geometry
// ----- this._constructPoints(); -------------------- 


// Debug the sight visualization
if ( debug ) {
  let t1 = performance.now();
  console.log(`Created polygon in ${Math.round(t1 - t0)}ms`);
  Poly.visualize();
}