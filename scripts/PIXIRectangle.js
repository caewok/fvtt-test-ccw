/* globals
PIXI,
foundry
*/

"use strict";


/**
 * From PIXI.js mathextras
 * https://pixijs.download/dev/docs/packages_math-extras_src_rectangleExtras.ts.html
 * If the area of the intersection between the Rectangles `other` and `this` is not zero,
 * returns the area of intersection as a Rectangle object. Otherwise, return an empty Rectangle
 * with its properties set to zero.
 * Rectangles without area (width or height equal to zero) can't intersect or be intersected
 * and will always return an empty rectangle with its properties set to zero.
 *
 * _Note: Only available with **@pixi/math-extras**._
 *
 * @method intersects
 * @memberof PIXI.Rectangle#
 * @param {Rectangle} other - The Rectangle to intersect with `this`.
 * @param {Rectangle} [outRect] - A Rectangle object in which to store the value,
 * optional (otherwise will create a new Rectangle).
 * @returns {Rectangle} The intersection of `this` and `other`.
 */
function rectangleIntersection(other, outRect) {
  const x0 = this.x < other.x ? other.x : this.x;
  const x1 = this.right > other.right ? other.right : this.right;

  if (!outRect) { outRect = new PIXI.Rectangle(); }

  if (x1 <= x0) {
    outRect.x = outRect.y = outRect.width = outRect.height = 0;
    return outRect;
  }

  const y0 = this.y < other.y ? other.y : this.y;
  const y1 = this.bottom > other.bottom ? other.bottom : this.bottom;
  if (y1 <= y0) {
    outRect.x = outRect.y = outRect.width = outRect.height = 0;
    return outRect;
  }

  outRect.x = x0;
  outRect.y = y0;
  outRect.width = x1 - x0;
  outRect.height = y1 - y0;

  return outRect;
}



// ----------------  ADD METHODS TO THE PIXI.RECTANGLE PROTOTYPE ------------------------
export function registerPIXIRectangleMethods() {
  Object.defineProperty(PIXI.Rectangle.prototype, "intersection", {
    value: rectangleIntersection,
    writable: true,
    configurable: true
  });
}
