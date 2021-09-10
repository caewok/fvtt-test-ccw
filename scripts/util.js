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

