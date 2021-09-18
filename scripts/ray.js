'use strict';

// Ray Class additions

import { ccwPoints, 
         almostEqual, 
         pointsAlmostEqual, 
         rootsReal } from "./util.js";

/**
 * Project a ray by exact distance.
 * Requires calculating current ray distance.
 *
 * @param {Number} dist Length of the desired ray
 * @return {Ray} New ray with the projected distance
 */
export function rayProjectDistance(dist) {
  const t = dist / this.distance;
  const B = this.project(t);
  const r = new Ray(this.A, B);
  r._distance = dist;
  r._angle = this._angle;
  return r;
}

/**
 * Quick function to determine if this ray intersects another
 *
 * @param {Ray} r Other ray to test for intersection
 * @return {Boolean} true if the segments intersect
 */
export function rayIntersects(r) {
  return ccwPoints(this.A, this.B, r.A) != ccwPoints(this.A, this.B, r.B) &&
         ccwPoints(r.A, r.B, this.A) != ccwPoints(r.A, r.B, this.B);
}

 /**
  * Test if point is on the segment.
  * @param {PIXI.Point} p   Point to test
  * @return{boolean} true if segment includes point
  */
export function rayContains(p) {
  // ensure the point is collinear with this ray
  if(ccwPoints(this.A, this.B, p) !== 0) return false;

  // test if is an endpoint
  if(pointsAlmostEqual(this.A, p) || 
     pointsAlmostEqual(this.B, p)) return true;  
 
    
  // test if between the endpoints
  // recall that we already established the point is collinear above.
  const within_x = (p.x < Math.max(this.A.x, this.B.x) &&
                    p.x > Math.min(this.A.x, this.B.x)) ||
                    almostEqual(p.x, this.A.x) ||
                    almostEqual(p.x, this.B.x);

  const within_y = (p.y < Math.max(this.A.y, this.B.y) &&
                    p.y > Math.min(this.A.y, this.B.y)) ||
                    almostEqual(p.y, this.A.y) ||
                    almostEqual(p.y, this.B.y);
 
  return within_x && within_y;
}


/**
 * Does this ray intersect a circle? Return intersection points if any.
 *   
 * Equation for circle: x^2 + y^2 = r^2
 * Equation for line: y = mx + b
 *
 * Solves the quadratic equation for x or y: gets the roots if any non-imaginary. 
 *
 * @param {x, y} center   Center of the cirle
 * @param {Number} r      Radius of circle. Should be > 0.
 * @return {[{x,y}]|undefined} One or two intersection points or undefined.
 */
export function rayPotentialIntersectionsCircle(center, radius) {
  // Line: y = mx + c
  //   m is slope; c is intercept
  // Circle: (x - p)^2 + (y - q)^2 = r^2
  //   p is center.x, q is center.y, r is radius
  // Must flip the y-axis
  const p = center.x;
  const q = -center.y;  
  const m = - this.slope;
  const c = -this.y0 - m * this.x0;
  const r = radius;
  let roots_x = [];
  let roots_y = [];
  
  if(isFinite(this.slope)) {
    // Quadratic in terms of x: 
    // (m^2 + 1)x^2 + 2(mc - mq -p)x + (q^2 - r^2 + p^2 - 2cq + c^2)
    
    // could pass this to discriminant to get number of roots
    // 2 if positive, 1 if 0, 0 (imaginary) if negative.
  
    roots_x = rootsReal(m * m + 1,
                              2 * (m*c - m*q - p),
                              q*q - r*r + p*p - 2*c*q + c*c);
    if(roots_x.length === 0) return [];      
    
    // y = mx + c
    roots_y = roots_x.map(x => m * x + c);                
  
  } else {
    // x is constant b/c line is vertical
    // need to get roots in terms of y  
    const k = this.x0; 
    // Quadratic in terms of y:
    // y^2 - 2qy + (p^2 + q^2 - r^2 - 2kp + k^2)
    roots_y = rootsReal(1,
                              -2*q,
                              p*p + q*q - r*r - 2*k*p + k*k);
    if(roots_y.length === 0) return [];    
    
    // x is constant
    roots_x = roots_y.map(y => k);                     
  }
   
  // flip the y-values
  roots_y = roots_y.map(y => -y);
  
  if(roots_x.length === 1) return [{x: roots_x[0], y: roots_y[0]}];
  if(roots_x.length > 1) return [{x: roots_x[0], y: roots_y[0]},
                                 {x: roots_x[1], y: roots_y[1]}];
  return undefined;
} 

/**
 * Return true if the point is in front of the ray, based on a vision point
 *
 * @param {PIXI.Point} point              Point to test
 * @param {PIXI.Point} relativePoint      Vision/observer point
 * @return {boolean} true if this point is in front. 
 *                   False if behind or on the segment line
 */
export function rayInFrontOfPoint(point, visionPoint) {
  if(pointsAlmostEqual(this.A, point) || pointsAlmostEqual(this.B, point)) return false;
  if(pointsAlmostEqual(point, visionPoint)) return false;
  
  const ABP = ccwPoints(this.A, this.B, point);
  const ABV = ccwPoints(this.A, this.B, visionPoint);
  const VAP = ccwPoints(visionPoint, this.A, point);
  
  if(ABP !== ABV && ABP !== VAP) return true;
  return false;
} 

/**
 * Return true if this segment is in front of another segment
 *
 * "In front of" defined as whether one segment partially blocks vision of the other.
 * @param {Segment} segment               Segment to test
 * @param {PIXI.Point} relativePoint      Vision/observer point
 * @return {boolean} true if this segment is in front of the other.
 */
export function rayInFrontOfSegment(segment, visionPoint) {
  // √: Handle intersecting walls (like a cross) (Returns false now?)
  // √: Handle visionPoint being in line with one of the walls
  
  let thisA = this.A;
  let thisB = this.B;
  let segmentA = segment.A;
  let segmentB = segment.B;
  let shared_endpoint = false;
  
  // if the segments share an endpoint, must interpolate away from that endpoint for each.
  if(pointsAlmostEqual(thisA, segmentA)) {
    shared_endpoint = true;
    thisA = this.project(0.01); 
    segmentA = segment.project(0.01);
  }
  
  if(pointsAlmostEqual(thisA, segmentB)) {
    shared_endpoint = true;
    thisA = this.project(0.01); 
    segmentB = segment.projectB(-0.01);
  }
  
  if(pointsAlmostEqual(thisB, segmentB)) {
    shared_endpoint = true;
    thisB = this.projectB(-0.01); 
    segmentB = segment.projectB(-0.01);
  }
  
  if(pointsAlmostEqual(thisB, segmentA)) {
    shared_endpoint = true;
    thisB = this.projectB(-0.01); 
    segmentA = segment.project(0.01);
  }
  
  if(!shared_endpoint && this.intersects(segment)) return undefined;
  
  const B1 = ccwPoints(thisA, thisB, segmentA);
  const B2 = ccwPoints(thisA, thisB, segmentB);
  const B3 = ccwPoints(thisA, thisB, visionPoint);
  
  const A1 = ccwPoints(segmentA, segmentB, thisA);
  const A2 = ccwPoints(segmentA, segmentB, thisB);
  const A3 = ccwPoints(segmentA, segmentB, visionPoint);
  
  // Special case: shared endpoint and the relativePoint is in a zone near the point
  // Then neither segment blocks the other
/*
         this.B
        /
       /
 ____ /_____ segment.B
 rP  /  
    /
*/
  
  if(shared_endpoint && 
       B1 !== A1 && B2 !== A2 && B3 !== A3 &&
       B1 === B2 && A1 === A2 && 
       B1 !== B3 && A1 !== A3) { return false; }

  if (B1 === B2 && B2 !== B3) return true;
  if (A1 === A2 && A2 === A3) return true;
  //if (A1 === A2 && A2 !== A3) return false;
  //if (B1 === B2 && B2 === B3) return false;

  return false;
}

/**
 * Project the Ray from B by some proportion of its initial distance.
 * Return the coordinates of that point B along the path.
 * @param {number} t    The distance along the Ray
 * @return {x, y} The coordinates of the projected point
 */
export function rayProjectB(t) {
  return {
    x: this.B.x + (t * this.dx),
    y: this.B.y + (t * this.dy)
  }
}
