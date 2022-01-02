/* globals
PIXI,
foundry,
*/

'use strict';

/* Utility functions 
Three functions build on one another to test whether a point is within a pixel of being
on a line. Used in MyClockwiseSweep to test if a point is on a limited angle ray.
- equivalentPixel: Could two coordinates be the same pixel?
- orient2dPixelLine: Orientation but collinear if within a pixel of the line.
- pixelLineContainsPoint: Does a coordinate lie nearly (within a pixel) of a line?

Sort two points for locating line-line intersections:
- compareXY: Sort points nw to se. 
*/

/**
 * Measure whether two coordinates could be the same pixel.
 * Points within √2 / 2 distance of one another will be considered equal.
 * Consider coordinates on a square grid: √2 / 2 is the distance from any 
 * corner of the square to the center. Thus, any coordinate within the square that 
 * is within √2 / 2 of a corner can be "claimed" by the pixel at that corner.
 * @param {Point} p1
 * @param {Point} p2
 * @return {boolean}  True if the points are within √2 / 2 of one another.
 */
function equivalentPixel(p1, p2) {
  // to try to improve speed, don't just call almostEqual.
  // Ultimately need the distance between the two points but first check the easy case
  // if points exactly vertical or horizontal, the x/y would need to be within √2 / 2
  const dx = Math.abs(p2.x - p1.x);
  if(dx > Math.SQRT1_2) return false; // Math.SQRT1_2 === √2 / 2
  
  const dy = Math.abs(p2.y - p1.y);
  if(dy > Math.SQRT1_2) return false;
  
  // within the √2 / 2 bounding box
  // compare distance squared.
  const dist2 = Math.pow(dx, 2) + Math.pow(dy, 2);
  return dist2 < 0.5;
}

/**
 * Is point c counterclockwise, clockwise, or colinear w/r/t ray with endpoints A|B?
 * If the point is within ± √2 / 2 of the line, it will be considered collinear.
 * See equivalentPixel function for further discussion on the choice of √2 / 2.
 * @param {Ray} ray
 * @param {Point} c
 * @return {number}   Same as foundry.utils.orient2dFast 
 *                    except 0 if within √2 /2 of the ray. 
 *                    Positive: c counterclockwise/left of A|B
 *                    Negative: c clockwise/right of A|B
 *                    Zero: A|B|C collinear.
 */
function orient2dPixelLine(ray, c) {
  const orientation = foundry.utils.orient2dFast(ray.A, ray.B, c);  
  const orientation2 = orientation * orientation;
  const cutoff = 0.5 * Math.pow(ray.distance, 2); // 0.5 is (√2 / 2)^2. 
  
  return (orientation2 < cutoff) ? 0 : orientation;
}


/**
 * Is the point c within a pixel of the ray and thereby "contained" by the ray?
 * @param {Ray} ray
 * @param {Point} c
 * @return {boolean}  True if the ray contains the point c. 
 */
export function pixelLineContainsPoint(ray, c) {
  if(equivalentPixel(ray.A, c) ||
     equivalentPixel(ray.B, c)) return true;
     
  if(orient2dPixelLine(ray, c) !== 0) return false;   

  // test if point is between the endpoints, given we already established collinearity
  const dot = function(r1, r2) {
     return r1.dx * r2.dx + r1.dy * r2.dy;
  }
  
  const AC = new Ray(ray.A, c);
  const k_ab = dot(ray, ray);
  const k_ac = dot(ray, AC);
  
  // if k_ac === 0, point p coincides with A (handled by prior check)    
  // if k_ac === k_ab, point p coincides with B (handled by prior check)
  // k_ac is between 0 and k_ab, point is on the segment
  return k_ac >= 0 && k_ac <= k_ab;   
}

/**
 * Compare function to sort point by x, then y coordinates
 * @param {Point} a
 * @param {Point} b
 * @return {-1|0|1} 
 */
export function compareXY(a, b) {
  if ( a.x === b.x ) return a.y - b.y;
  else return a.x - b.x;
}
