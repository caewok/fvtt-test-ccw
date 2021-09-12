// Utility functions

 /*
  * Test if two numbers are almost equal, given a small error window.
  * From https://www.toptal.com/python/computational-geometry-in-python-from-theory-to-implementation
  * @param {Number} x         First number
  * @param {Number} y         Second number for comparison
  * @param {Number} EPSILON   Small number representing error within which the numbers 
  *                           will be considered equal
  * See Number.EPSILON for smallest possible error number.
  * Given the use in light measurements over long distances, probably make this 
  * relatively small in case comparing small angles.
  * @return {Boolean} True if x and y are within the error of each other.
  */
export function almostEqual(x, y, EPSILON = 1e-10) {
  return Math.abs(x - y) < EPSILON;
}

export function pointsAlmostEqual(p1, p2, EPSILON = 1e-10) {
  return almostEqual(p1.x, p2.x, EPSILON) && almostEqual(p1.y, p2.y, EPSILON);
}

export function orient2dPoints(p1, p2, p3) {
  return orient2d(p1.x, p1.y,
                  p2.x, p2.y,
                  p3.x, p3.y);
}

export function ccwPoints(p1, p2, p3) {
  const res = orient2dPoints(p1, p2, p3);
                         
  return res < 0 ? -1 : 
         res > 0 ?  1 : 0;
}
