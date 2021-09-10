import { MODULE_ID } from "./module.js";

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
 * @private
 */
export function testCCWSweepEndpoints(wrapped) {
  if(!window[MODULE_ID].use_ccw) { return wrapped(); }
  
  // Configure inputs
  const origin = this.origin;
  const {maxR, isLimited, aMin, aMax} = this.config;
  const radius = this.config.radius ?? maxR;
  const rays = [];
  const angles = new Set();
  const padding = Math.PI / Math.max(this.config.density, 6);

  // Sort endpoints by angle
  const endpoints = Array.from(this.endpoints.values());
  endpoints.sort((a, b) => a.angle - b.angle);

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
    const aFinal = isLimited ? aMax : endpoints[0].angle + Math.PI;
    const rFinal = SightRay.fromAngle(origin.x, origin.y, aFinal, radius);
    const pFinal = new WallEndpoint(rFinal.B.x, rFinal.B.y);
    pFinal.angle = aFinal;
    endpoints.push(pFinal);
  }

  // Sweep each endpoint
  for ( let endpoint of endpoints ) {

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
    if ( lastRay.result.terminal || (this.config.hasRadius && ray.result.terminal) ) {
      this._padRays(lastRay, ray, padding, rays, this.config.hasRadius);
    }

    // Push the ray
    rays.push(ray);
    lastRay = ray;
  }

  // For complete circles, pad gaps between the final ray and the initial one
  if ( !isLimited && lastRay.result.terminal ) {
    this._padRays(lastRay, rays[0], padding, rays, this.config.hasRadius);
  }
  this.rays = rays;
}



