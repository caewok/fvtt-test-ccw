// Ray Class additions

import { ccwPoints, pointsAlmostEqual } from "./util.js";

/*
 * Project a ray by exact distance.
 * Requires calculating current ray distance.
 *
 * @param {Number} dist Length of the desired ray
 * @return {Ray} New ray with the projected distance
 */
export function rayProjectDistance(dist) {
  const t = dist / this.distance;
  const B = this.project(t);
  const r = new Ray(this.A, this.B);
  r._distance = dist;
  r._angle = this._angle;
  return r;
}

/*
 * Quick function to determine if this ray intersects another
 *
 * @param {Ray} r Other ray to test for intersection
 * @return {Boolean} true if the segments intersect
 */
export function rayIntersects(r) {
  return ccwPoints(this.A, this.B, r.A) != ccwPoints(this.A, this.B, r.B) &&
         ccwPoints(r.A, r.B, this.A) != ccwPoints(r.A, r.B, this.B);
}

/*
 * Return true if the point is in front of the ray, based on a vision point
 *
 * @param {PIXI.Point} point              Point to test
 * @param {PIXI.Point} relativePoint      Vision/observer point
 * @return {boolean} true if this point is in front. False if behind or on the segment line
 */
export function rayInFrontOfPoint(point, visionPoint) {
  if(pointsAlmostEqual(this.A, point) || pointsAlmostEqual(this.B, point)) return false;
  if(pointsAlmostEqual(point, visionPoint)) return false;
  
  const ABP = ccwPoints(this.A, this.B, point);
  const ABV = ccwPoints(this.A, this.B, visionPoint);
  const VAP = ccwPoints(visionPoint, this.A, point);
  
  if(ABP !== AVP && ABP !== VAP) return true;
  return false;
} 

 */
/*
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
  if(pointsAlmostEqual(thisA, segmentA) {
    shared_endpoint = true;
    thisA = this.project(0.01); 
    segmentA = segment.project(0.01);
  }
  
  if(pointsAlmostEqual(thisA, segmentB)) {
    shared_endpoint = true;
    thisA = this.project(0.01); 
    segmentB = segment.projectB(-0.01);
  }
  
  if(pointsAlmostEqual(thisB, segmentB) {
    shared_endpoint = true;
    thisB = this.projectB(-0.01); 
    segmentB = segment.projectB(-0.01);
  }
  
  if(pointsAlmostEqual(thisB, segmentA) {
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
  if (A1 === A2 && A2 !== A3) return false;
  if (B1 === B2 && B2 === B3) return false;

  return false;
}

/**
 * Project the Ray from B by some proportion of its initial distance.
 * Return the coordinates of that point B along the path.
 * @param {number} t    The distance along the Ray
 * @return {Object}     The coordinates of the projected point
 */
export function rayProjectB(t) {
  return {
    x: this.B.x + (t * this.dx),
    y: this.B.y + (t * this.dy)
  }
}
