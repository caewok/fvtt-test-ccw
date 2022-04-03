/*
Class to represent a limited angle in the ClockwiseSweep.

The angle is essentially two rays shot from a point directly at or behind the origin.
Typically, behind the origin is desired so that the constructed object will include the
origin for the sweep.

Methods provided to return temporary edges for the two angle walls, a polygon, or
a bounding box, as appropriate. Edges and bounding box extend at least to the canvas edge
but likely exceed the canvas edge.
*/
'use strict'


class LimitedAngleSweepObject {

 /**
  * @param { PIXI.Point } origin    Origin coordinate of the sweep
  * @param { number } angle         Desired angle of view, in degrees
  * @param { number } rotation      Center of the limited angle line, in degrees
  */
  constructor(origin, angle, rotation, { contain_origin = true } = {}) {
    this.origin = origin;
    this.angle = angle;
    this.rotation = rotation;

    if(contain_origin) this._offsetOrigin();
    this._calculateLimitedAngles();
    this.aMinIx = this._angleCanvasIntersectionPoint(this.aMin);
    this.aMaxIx = this._angleCanvasIntersectionPoint(this.aMax);
  }


 // --------------- Getters --------------- //

 // Create rays from origin to the four canvas corners
 // Primarily so that we don't repeatedly calculate the angle
 /**
  * Origin --> Northwest corner
  */
  get rayNW() {
    return this._rNW || ( this._rNW = new Ray(origin, { x: 0, y: 0 }) );
  }

 /**
  * Origin --> Northeast corner
  */
  get rayNE() {
    return this._rNE || ( this._rNE = new Ray(origin, { x: canvas.dimensions.width, y: 0 }) );
  }

 /**
  * Origin --> Southeast corner
  */
  get raySE() {
    return this._rSE || ( this._rSE = new Ray(origin, { x: canvas.dimensions.width, y: canvas.dimensions.height }) );
  }

 /**
  * Origin --> Southwest corner
  */
  get raySW() {
    return this._rSW || ( this._rSW = new Ray(origin, { x: 0, y: canvas.dimensions.height }) );
  }

 /**
  * Move the origin back one pixel to define the start point of the limited angle rays.
  * This ensures the actual origin is contained within the limited angle.
  */
  _offsetOrigin() {
    const r = Ray.fromAngle(this.origin.x,
                            this.origin.y,
                            Math.toRadians(this.rotation + 90), -1);
    this.origin = { x: Math.round(r.B.x), y: Math.round(r.B.y) };
  }

 /**
  * Calculate the rays that represent the limited angle
  */
  _calculateLimitedAngles() {
    this.aMin = Math.normalizeRadians(Math.toRadians(this.rotation + 90 - (this.angle / 2)));
    this.aMax = this.aMin + Math.toRadians(this.angle);
  }

 /**
  * Determine where the limited angle rays intersect the canvas edge.
  * (Needed primarily to easily construct a bounding box, but also helpful for
  *  providing edges or a polygon.)
  */
  _angleCanvasIntersectionPoint(rad) {
    // aMin and aMax each intersect at one canvas edge
    // 0 would be due east
    // π is due west
    // π / 2 is due south
    // - π / 2 is due north

    // simple cases
    // due east
    if(rad === 0) return { x: canvas.dimensions.width,  y: this.origin.y };

    // due west
    if(rad === Math.PI) return { x: 0, y: this.origin.y };

    // due south
    if(rad === Math.PI / 2) return { x: this.origin.x, y: canvas.dimensions.height };

    // due north
    if(rad === -Math.PI / 2) return { x: this.origin.x, y: 0 };

    // Two options for how to get intersection:
    // 1. use canvas.dimensions.rect and test _intersectsTop, etc., against rMin/rMax
    // 2. compare angle of rad to rays from each of the four corners

    // compare to rays from origin to the four corners to determine which
    // border is intersected
    let rNW = this.rayNW;
    if(rad === rNW.angle) return { rNW.B; }

    let rNE = this.rayNE;
    if(rad === rNE.angle) return { rNE.B; }

    if(rad > rNW.angle && rad < rNE.angle) {
      // intersects the top
      let adj = 0 - origin.y;
      let r_rad = Ray.fromAngle(origin.x, origin.y, rad, adj / Math.cos(rad));
      return r_rad.B;
    }

    let rSE = this.raySE;
    if(rad === rSE.angle) return { rSE.B; }

    if(rad > rNE.angle && rad < rSE.angle) {
      // intersects the right
      let adj = canvas.dimensions.width - origin.x;
      let r_rad = Ray.fromAngle(origin.x, origin.y, rad, adj / Math.cos(rad));
      return r_rad.B;
    }

    let rSW = this.raySW;
    if(rad === rSW.angle) return { rSW.B; }

    if(rad > rSE.angle && rad < rSW.angle) {
      // intersects the bottom
      // Math.PI / 2 is angle straight down
      // adjacent / cosine = hypotenuse
      let adj = canvas.dimensions.height - origin.y;
      let r_rad = Ray.fromAngle(origin.x, origin.y, rad, adj / Math.cos(rad));
      return r_rad.B;
    }

    // tricky one is when the radians circle from Math.PI to -Math.PI
    if(rad > rSW.angle && rad < Math.PI ||
       rad > -Math.PI && rad < rNW.angle) {
      // intersects the left
      let adj = 0 - origin.x;
      let r_rad = Ray.fromAngle(origin.x, origin.y, rad, adj / Math.cos(rad));
      return r_rad.B;
    }
    console.warn("Cannot determine canvas intersection point.")
    return Ray.fromAngle(this.origin.x, this.origin.y, rad, canvas.dimensions.maxR).B;
  }

 /**
  * Calculate a bounding box for the limited angle.
  * @return { PIXI.Rectangle }
  */
  getBounds() {
    const minX = Math.min(this.origin.x, this.aMinIX.x, this.aMaxIX.x)
  }

}