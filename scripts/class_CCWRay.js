'use strict';
/* globals Ray */

import { CCWPoint } from "./class_CCWPoint.js";
import { orient2dPoints, 
         pointsAlmostEqual, 
         ccwPoints, 
         inCirclePoints,
         almostEqual,
         discriminant,
         rootsReal,
         PRESET_EPSILON } from "./util.js";
import { MODULE_ID } from "./module.js";

/**
 * Subclass of Ray with additional methods to calculate intersections and orientation.
 * Like Foundry method, a "ray" considered to have a starting point A and ending point B.
 * Unlike Foundry method, the CCWRay uses CCWPoint.
 * @extends {Ray}
 */

export class CCWRay extends Ray {
  constructor(A, B) {
    super(A, B);
    
    this.A = CCWPoint.fromPoint(A);
    this.B = CCWPoint.fromPoint(B);
    
    this._distanceSquared = undefined;
  }

  /* -------------------------------------------- */
  /*  Getters/Setters                             */
  /* -------------------------------------------- */

 /**
  * Store the squared distance for use with comparisons
  * More numerically stable than sqrt
  * @param {number}
  */
  get distanceSquared() {
    if( this._distanceSquared === undefined) {
      this._distanceSquared = this.dx * this.dx + this.dy * this.dy;
    }
    return this._distanceSquared;
  }
  
  /* -------------------------------------------- */
  /*  Factory Functions                           */
  /* -------------------------------------------- */
  
 /**
  * Construct a ray of given distance that goes through the reference point.
  * Comparable to Ray.fromAngle 
  * @param {x: number, y: number}  origin    Ray starting point
  * @param {x: number, y: number}  reference Ray must pass through this point
  * @param {Number}                dist      Positive number for ray distance.
  * @return {CCWRay} Constructed ray.
  */
  static fromReference(origin, reference, dist) {
    return (new this(origin, reference)).projectDistance(dist);
  }
  
 /**
  * Same as fromReference but use distance squared
  * @param {x: number, y: number}  origin    Ray starting point
  * @param {x: number, y: number}  reference Ray must pass through this point
  * @param {Number}                distSquared  Positive number for squared ray distance.
  * @return {CCWRay} Constructed ray.
  */
  static fromReferenceSquared(origin, reference, distSquared) {
    return (new this(origin, reference)).projectDistanceSquared(distSquared);
  }  
  
 /**
  * Construct a CCWRay from a Ray or other object with A and B points.
  * @param {Ray} r
  * @return {CCWRay}
  */
  static fromRay(r) { return new this(r.A, r.B); } 
  
  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Reverse the ray
   * @returns {CCWSightRay}
   */
   reverse() {
     const r = new this(this.B, this.A);
     r._distance = this._distance;
     r._angle = Math.PI - this._angle;
     r._distanceSquared = this._distanceSquared;
     return r;
   }

  /**
   * Project a ray by exact distance.
   * Requires calculating current ray distance.
   *
   * @param {number} dist Length of the desired ray
   * @return {Ray} New ray with the projected distance
   */
  projectDistance(dist, { fromEndpoint = "A" } = {}) {
    const t = dist / this.distance;
    const B = fromEndpoint === "A" ? this.project(t) : this.projectB(t); 
    const r = new this(this[fromEndpoint], B);
    
    // unclear whether we should force distance to equal the provided distance
    r._distance = dist;
    
    r._angle = this._angle;
    return r;
  }
  
 /**
  * Same as projectDistance but uses squared distance.
  * May be more numerically stable. 
  * @param {number} squared_distance Squared distance of the desired ray
  * @return {Ray} New ray with the projected distance
  */
  projectDistanceSquared(dist_squared, { fromEndpoint = "A" } = {}) {
    const t = Math.sqrt(dist_squared / this.distanceSquared);
    const B = fromEndpoint === "A" ? this.project(t) : this.projectB(t);
    const r = new this(this[fromEndpoint], B);
  
    // unclear whether we should force distance to equal the provided distance
    r._distanceSquared = dist_squared
  
    r._angle = this._angle;
    return r;
  }
 
 /**
  * Project the ray by some proportion of its initial distance.
  * Overrides Ray version to return a CCWPoint.
  * @override
  * @param {number} t   The distance along the ray.
  * @return {CCWPoint} The coordinates of the projected point
  */
  project(t) {
    const res = Ray.constructor.project(t);
    return CCWPoint.fromPoint(res.x, res.y);
  }

 /**
  * Project the Ray from B by some proportion of its initial distance.
  * Return the coordinates of that point B along the path.
  * @param {number} t    The distance along the Ray
  * @return {CCWPoint} The coordinates of the projected point
  */
  projectB(t) {
    return new this(this.B.x + (t * this.dx), this.B.y + (t * this.dy));
  }
  
 /**
  * Orientation of a point in relation to this ray.
  * A --> B --> p is counterclockwise (positive), clockwise (negative), or 0 (colinear)
  * @param {PIXI.Point} p
  * @return {number} Approximately equal to twice the signed area of the triangle 
  *                  formed by the 3 points.
  */
  orient2d(p) { return orient2dPoints(this.A, this.B, p); }
  
 /**
  * Is the point counterclockwise, clockwise, or colinear w/r/t this ray?
  * A --> B --> p
  * @param {PIXI.Point} p
  * @param {number} [options.EPSILON]  How exact do we want to be? 
  * @return {1|0|-1}   1 if CCW, -1 if CW, 0 if colinear
  */
  ccw(p, { EPSILON = PRESET_EPSILON } = {}) { 
    return ccwPoints(this.A, this.B, p, { EPSILON }); 
  }
  
 /**
  * Quick function to determine if this ray could intersect another
  *
  * @param {Ray}    r         Other ray to test for intersection
  * @param {number} EPSILON   How exact do we want to be? 
  * @return {boolean} Could the segments intersect?
  */
  intersects(r, { EPSILON = PRESET_EPSILON }) {  
    if(!(r instanceof CCWRay)) { r = CCWRay.fromRay(r); }
  
    return this.ccw(r.A, { EPSILON }) !== this.ccw(r.B, { EPSILON }) &&
           r.ccw(this.A, { EPSILON }) !== r.ccw(this.B, { EPSILON });
  }  
  
 /**
  * Test if point is on/very near the segment.
  * 
  * @param {x: number, y: number}  p     Point to test
  * @param {boolean}  assume_collinear   Option to skip the collinearity test.
  * @param {number}   EPSILON            How exact do we want to be? 
  * @return {boolean} Does segment include point?
  */
  contains(p, { assume_collinear = false, EPSILON = PRESET_EPSILON } = {}) {

    // ensure the point is collinear with this ray
    if(!assume_collinear && this.ccw(p, EPSILON) !== 0) return false;
    
    // test if is an endpoint or between the endpoints
    // recall that we already established the point is collinear above.
    const max_x = Math.max(this.A.x, this.B.x);
    const min_x = Math.min(this.A.x, this.B.x);
    const max_y = Math.max(this.A.y, this.B.y);
    const min_y = Math.min(this.A.y, this.B.y);

    const within_x = ((p.x < max_x || almostEqual(p.x, max_x, { EPSILON })) &&
                (p.x > min_x || almostEqual(p.x, min_x, { EPSILON })));

    const within_y = ((p.y < max_y || almostEqual(p.y, max_y, { EPSILON })) &&
                (p.y > min_y || almostEqual(p.y, min_y, { EPSILON })));
 
    return within_x && within_y;
  } 
  
  /* -------------------------------------------- */
  /*  In Front Of Methods                         */
  /* -------------------------------------------- */
  
 /**
   * Return true if the point is in front of the ray, based on a relative origin point.
   * If the point is colinear with this ray or equals the origin, returns false.
   *
   * @param {PIXI.Point}  point     Point to test
   * @param {PIXI.Point}  origin    Vision/observer point
   * @param {number}      EPSILON   Tolerated error for almostEqual and ccw tests
   * @return {boolean} true if this point is in front. 
   *                   False if behind or on the segment line
   */
  inFrontOfPoint(p, origin, { EPSILON = PRESET_EPSILON } = {}) {
    if(!(p instanceof CCWPoint)) p = CCWPoint.fromPoint(p);
  
    if(pointsAlmostEqual(p, this.A, { EPSILON }) || 
       pointsAlmostEqual(this.B, { EPSILON })) { return false; }
    if(p.almostEqual(origin, { EPSILON })) { return false; }
  
    const ABP = this.ccw(p, { EPSILON });
    const ABO = this.ccw(origin, { EPSILON });
    const OAP = ccwPoints(origin, this.A, p, { EPSILON });
  
    // don't need almostEqual here; covered by ccw above.
    if(ABP !== ABO && ABP !== OAP) return true;
    return false;
  }
  
 /**
  * Return true if this segment is in front of another segment.
  *
  * "In front of" defined as whether one segment partially blocks vision of the other
  * from an origin point.
  * @param {Ray} segment        Segment to test
  * @param {PIXI.Point} origin  Vision/observer point
  * @param {number}     EPSILON   Tolerated error for almostEqual and ccw tests
  * @param {boolean}    check_overlap  If true, test if the segments overlap other
  *                                    than at an endpoint. If false, this is assumed
  *                                    not to happen.
  * @return {boolean} true if this segment is in front of the other.
  */   
  inFrontOfSegment(segment, origin, { EPSILON = PRESET_EPSILON, 
                                      check_overlap = false } = {}) {
    if(!(segment instanceof CCWRay)) segment = CCWRay.fromRay(segment);
    
    if(check_overlap) {    
      // if the rays share an endpoint, no intersection
      if(this.A.almostEqual(segment.A, { EPSILON }) ||
         this.A.almostEqual(segment.B, { EPSILON }) ||
         this.B.almostEqual(segment.A, { EPSILON }) ||
         this.B.almostEqual(segment.B, { EPSILON })) {
         
         // do nothing
         
      } else if(this.contains(segment.A)) {
        // if an endpoint is otherwise contained by the other line, 
        // the two rays form a T, with this ray at the top of the T
        // segment.A is the intersection point
        // This ray blocks if origin is above the T
        return this.ccw(origin, { EPSILON }) !== this.ccw(segment.B);
       
      } else if(this.contains(segment.B)) {
        // the two rays form a T, with this ray at the top of the T
        // segment.B is the intersection point
        // This ray blocks if origin is above the T
        return this.ccw(origin, { EPSILON }) !== this.ccw(segment.A);
        
      } else if(segment.contains(this.A)) {
        // two rays for a T, with the segment at the top of the T
        // this.A is the intersection point
        // this ray blocks if origin is in the bottom half of the T 
        // (it blocks half of the top of the T)
        // If the origin is in line with the bottom of the T, this ray blocks an 
        // infinitesimally small portion of the top of the T
        
        return segment.ccw(origin, { EPSILON }) === segment.ccw(this.B);
      
      } else if(segment.contains(this.B)) {
        // two rays for a T, with the segment at the top of the T
        // same as for this.A above
        return segment.ccw(origin, { EPSILON }) === segment.ccw(this.A);
        
      } else if(this.ccw(segment.A) !== this.ccw(segment.B) &&
                this.segment(this.A) !== this.segment(this.B)) {
        // segments form an X, crossing one another. 
        // A --> B --> segment endpoints should not match, and vice-versa
        // No matter where the origin, one segment obscures part of the other
        return true;        
      }
    }
    
    // if the origin is on opposite side of this versus other segment, cannot block
    // i.e., segments sandwich the origin
    if(this.ccw(origin, { EPSILON }) !== segment.ccw(origin, { EPSILON })) return false;
    
    // if either endpoint is blocked, the line must block
    if(this.inFrontOfPoint(segment.A, origin, { EPSILON }) || 
       this.inFrontOfPoint(segment.B, origin, { EPSILON })) return true;
    
    // going from each endpoint of the segment to this ray, does this ray cast a shadow
    // on the origin? 
    // imagine drawing lines through the endpoints of the respective two segments.
    // this test identifies the quadrants "in shadow" of this ray
    // comparable to checking for whether this ray is in front of the segment endpoints
    if(ccwPoints(segment.A, this.A, origin, { EPSILON }) !== 
       ccwPoints(segment.A, this.B, origin, { EPSILON })) return true;
       
    if(ccwPoints(segment.B, this.A, origin, { EPSILON }) !== 
       ccwPoints(segment.B, this.B, origin, { EPSILON })) return true;
    
    return false;
  }
  
  
  /* -------------------------------------------- */
  /*  Circle/Line Intersection Methods            */
  /* -------------------------------------------- */
  
 /**
  * Could this ray, if extended indefinitely, intersect a circle?
  * Does not check for whether the ray contains the points.  
  * @param {PIXI.Point} center    Center of the cirle
  * @param {number}     radius    Radius of circle. Should be > 0.
  * @param {"geometry"|"quadratic"} method  Type of algorithm to use.
  * @return {boolean} True if an intersection exists (in real space).
  */
  potentiallyIntersectsCircle(center, radius, { method = "geometry" } = {}) {
    switch(method) {
      case "geometry":
        return this.potentiallyIntersectsCircleGeometry(center, radius);
      case "algebra":
        return this.potentiallyIntersectsCircleQuadratic(center, radius);  
    }
  }
  
 /**
  * Intersection points with a circle if this ray extended indefinitely. 
  * Does not check for whether the ray contains the points.  
  * @param {PIXI.Point} center    Center of the cirle
  * @param {number}     radius    Radius of circle. Should be > 0.
  * @param {"geometry"|"quadratic"} method  Type of algorithm to use.
  * @return {[{CCWPoint}]|undefined} One or two intersection points or undefined.
  */
  potentialIntersectionsWithCircle(center, radius, { method = "geometry" } = {}) {
    switch(method) {
      case "geometry":
        return this.potentiallyIntersectsCircleGeometry(center, radius);
      case "algebra":
        return this.potentiallyIntersectsCircleQuadratic(center, radius);  
    }    
  }
  
 /**
  * Intersection points with a circle for this ray. 
  * Checks for whether the ray contains the points.  
  * @param {PIXI.Point}   center    Center of the cirle
  * @param {number}       r         Radius of circle. Should be > 0.
  * @param {"geometry"|
            "quadratic"}  method    Type of algorithm to use.
  * @param {number}       EPSILON   How exact is the contains test?
  * @param {number}       robust    Adjust the points to be w/in or on the circle.         
  * @return {[{CCWPoint}]|undefined} One or two intersection points or undefined.
  */  
  intersectionsWithCircle(center, radius, { method = "geometry", 
                                            EPSILON = PRESET_EPSILON,
                                            robust = false } = {}) {
    const potential_pts = this.potentialIntersectionsWithCircle(center, 
                                                                radius, 
                                                                { method });
                                                                
    // filter by points contained within the line first b/c robust is more expensive
    // robust moves points up/down line but not away from line
    let pts = potential_pts.filter(p => 
      this.contains(p, { assume_colinearity: true, EPSILON }))
    
    if(robust) {
      pts = pts.map(p => this.makeCircleIntersectionRobust(p, center, radius));
    }
    
    return pts;
  }
  
  // --------------- Intersections using Quadratic Equation
 /**
  * Does this ray intersect with a circle if this ray extended indefinitely? 
  * Does not check for whether the ray contains the points. 
  * Equation for circle: x^2 + y^2 = r^2
  * Equation for line: y = mx + b
  *
  * Gets the roots for the quadratic equation for x or y.
  *   If two real roots, the ray intersects twice
  *   If one real root, the ray intersects once
  *   If only imaginary roots, the ray does not intersect the circle.
  *
  * @param {PIXI.Point} center    Center of the cirle
  * @param {number}     radius    Radius of circle. Should be > 0.
  * @return {boolean} True if an intersection exists (in real space).
  */  
  potentiallyIntersectsCircleQuadratic(center, radius) {
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
    
    let a1, a2, a3
    if(isFinite(this.slope)) {
      // Quadratic in terms of x: 
      // (m^2 + 1)x^2 + 2(mc - mq -p)x + (q^2 - r^2 + p^2 - 2cq + c^2)
      a1 = m * m + 1;
      a2 = 2 * (m*c - m*q - p);
      a3 = q*q - r*r + p*p - 2*c*q + c*c;
    } else {
      // x is constant b/c line is vertical
      // need to get roots in terms of y  
      // Quadratic in terms of y:
      // y^2 - 2qy + (p^2 + q^2 - r^2 - 2kp + k^2)
      const k = this.x0; 
      a1 = 1;
      a2 = -2*q;
      a3 = p*p + q*q - r*r - 2*k*p + k*k;
    }
    
    return discriminant(a1, a2, a3) >= 0;
  }
  
 /**
  * Intersections if this ray, extended indefinitely.
  * Does not check for whether the ray contains the points.  
  * Equation for circle: x^2 + y^2 = r^2
  * Equation for line: y = mx + b
  *
  * Gets the roots for the quadratic equation for x or y.
  *   If two real roots, the ray intersects twice
  *   If one real root, the ray intersects once
  *   If only imaginary roots, the ray does not intersect the circle.
  * Solves the quadratic equation for x or y.
  * Note: The intersections returned will only be approximately contained in the line and
  *       only approximately on the circle. For the line, about 1e-10 error. 
  *       On the circle can be much higher. See makeRobustCircleIntersections.
  * @param {PIXI.Point} center    Center of the cirle
  * @param {number}     radius    Radius of circle. Should be > 0.
  * @return {boolean} True if an intersection exists (in real space).
  */
  potentialIntersectionsWithCircleQuadratic(center, radius) {
    const p = center.x;
    const q = -center.y;  
    const m = - this.slope;
    const c = -this.y0 - m * this.x0;
    const r = radius;
    let roots_x = [];
    let roots_y = [];
    
    let a1, a2, a3;
    const use_x = isFinite(this.slope);
    
    if(use_x) {
      // Quadratic in terms of x: 
      // (m^2 + 1)x^2 + 2(mc - mq -p)x + (q^2 - r^2 + p^2 - 2cq + c^2)
      a1 = m * m + 1;
      a2 = 2 * (m*c - m*q - p);
      a3 = q*q - r*r + p*p - 2*c*q + c*c;
    } else {
      // x is constant b/c line is vertical
      // need to get roots in terms of y  
      // Quadratic in terms of y:
      // y^2 - 2qy + (p^2 + q^2 - r^2 - 2kp + k^2)
      const k = this.x0; 
      a1 = 1;
      a2 = -2*q;
      a3 = p*p + q*q - r*r - 2*k*p + k*k;
    }
    
    // 2 roots if positive, 1 if 0, 0 (imaginary) if negative
    const roots = rootsReal(a1, a2, a3);
    if(roots.length === 0) return []; // no intersections found
    
    // split into x and y 
    if(use_x) {
      roots_x = roots;
      roots_y = roots.map(x => m * x + c);  
    } else {
      const k = this.x0; 
      roots_y = roots;      
      roots_x = roots.map(y => k); // make x constant
    }
    roots_y = roots_y.map(y => -y) // flip y values
  
    if(roots_x.length === 1) return [ new CCWPoint(roots_x[0], roots_y[0]) ];    
    if(roots_x.length > 1) return [ new CCWPoint(roots_x[0], roots_y[0]),
                                    new CCWPoint(roots_x[1], roots_y[1]) ];
    return []; // should not happen
  }
  
 // --------------- Intersections using Geometry 
 
 /**
  * Does this ray intersect with a circle if this ray extended indefinitely? 
  * Does not check for whether the ray contains the points. 
  * Project line between center and this.A onto this line.
  * Test whether the new point D (projected A --> center on line) is less than radius.
  * See  https://stackoverflow.com/questions/1073336/circle-line-segment-collision-detection-algorithm
  * @param {PIXI.Point} center    Center of the cirle
  * @param {number}     radius    Radius of circle. Should be > 0.
  * @return {boolean|number} True if an intersection exists (in real space).
  *                          Number if the LEC2 value is wanted (length of line squared)
  */    
  potentiallyIntersectsCircleGeometry(center, radius, { returnLEC2 = false } = {}) {
    const LAB = this.distance;
    const Dx = this.dx / LAB;
    const Dy = this.dy / LAB;
    const t = Dx * (center.x - this.A.x) + Dy * (center.y - this.A.y);
    const Ex = t * Dx + this.A.x;
    const Ey = t * Dy + this.A.y;
    const Edx = Ex - center.x;
    const Edy = Ey - center.y;
    const LEC2 = Edx * Edx + Edy * Edy;
    const R2 = radius * radius;

    if(returnLEC2) return LEC2; // allow this calculation to be stored

    return (LEC2 < R2 || almostEqual(LEC2, R2)); // if equal, it is a tangent
  }
  
 /**
  * Does this ray intersect with a circle if this ray extended indefinitely? 
  * Does not check for whether the ray contains the points. 
  * Project line between center and this.A onto this line.
  * Test whether the new point D (projected A --> center on line) is less than radius.
  * (up to here done in potentiallyIntersectsCircleGeometry)
  * If intersections found, use equation of a line to get points.
  * See  https://stackoverflow.com/questions/1073336/circle-line-segment-collision-detection-algorithm
  * @param {PIXI.Point} center    Center of the cirle
  * @param {number}     radius    Radius of circle. Should be > 0.
  * @param {number}     LEC2      Provide a cached value from 
  *                               potentiallyIntersectsCircleGeometry, if any.
  * @param {number}     EPSILON   How exact to consider a tangent?
  * @return {boolean|number} True if an intersection exists (in real space).
  *                          Number if the LEC2 value is wanted (length of line squared)
  */  
  potentialIntersectionsWithCircleGeometry(center, radius, 
                                           { LEC2 = undefined, 
                                             EPSILON = PRESET_EPSILON } = {}) {
    const LAB = this.distance;
    const Dx = this.dx / LAB;
    const Dy = this.dy / LAB;
    const t = Dx * (center.x - this.A.x) + Dy * (center.y - this.A.y);
  
    if(LEC2 === undefined) {
      LEC2 = this.potentiallyIntersectsCircleGeometry(center, 
                                                      radius, 
                                                      { returnLEC2: true });
    } 
  
    const R2 = radius * radius;
    
    if(almostEqual(LEC2, R2, { EPSILON })) {
      // tangent point to circle is E
      const Ex = t * Dx + this.A.x;
      const Ey = t * Dy + this.A.y;
      return [ new CCWPoint(Ex, Ey) ];
      
    } else if(LEC2 > R2) {
      return []; // no intersections
    
    } else {
      // two intersections; compute points using equation of a line
      const dt = Math.sqrt(R2 - LEC2);
      const Fx = (t - dt) * Dx + this.A.x;
      const Fy = (t - dt) * Dy + this.A.y;
    
      const Gx = (t + dt) * Dx + this.A.x;
      const Gy = (t + dt) * Dy + this.A.y
      
      return [ new CCWPoint(Fx, Fy), new CCWPoint(Gx, Gy) ];
    }
  }
  
 /**
  * Attempt to find a robust circle-line intersection. For our purposes, this means:
  * 1. The intersection is colinear with the line. Measured by orient2d.
  * 2. The intersection is on the circle. Measured by incircle. 
  * Here, the line is assumed to extend indefinitely, so the returned point 
  * may or may not be within this line segment.
  * @param {PIXI.point} p approximate_intersection
  * @param {number}     center  Circle center
  * @param {number}     radius  Circle radius
  * @param {number}     EPSILON   Tolerance for ccw colinear tests
  * @return {PIXI.point} Adjusted intersection
  */
  robustIntersectionWithCircle(p, center, radius, { EPSILON = PRESET_EPSILON } = {}) {
    
    if(this.ccw(p, { EPSILON }) !== 0) {
      // Just confirming. Could happen due to programmer error or 
      // possibly if the intersection point algorithm is not robust enough to 
      // find a point that is actually on the line   
      // Appears not to happen in practice without some other error. 
    
      console.warn(`${MODULE_ID}|intersection is not on line: ${orient2dPoints(this.A, this.B, p)}`);
    }
    
    // Move up and down the line until we are also on the circle
    // points of the circle, ccw:
    const c1 = new CCWPoint(center.x + radius, center.y);    
    const c2 = new CCWPoint(center.x, center.y - radius);
    const c3 = new CCWPoint(center.x - radius, center.y);
    
    let curr_ccw = inCirclePoints(c1, c2, c3, p)    
    if(almostEqual(curr_ccw, 0, { EPSILON })) return p;
    
    // if p is closer to endpoint A, reverse the line
    // (Don't want A and p to be near equivalent for these measurements)
    let r = this; // will later test to reverse
    const A_dist = Math.hypot(p.x - r.A.x, p.y - r.A.y);
    const B_dist = Math.hypot(p.x - r.B.x, p.y - r.B.y);

    if(A_dist < B_dist) { r = r.reverse(); } 
  
    // find t from the equation of the line
    let t = r.dx ? 
       (p.x - r.A.x) / r.dx :
       (p.y - r.A.y) / r.dy; 
     
    // Determine the smallest increment of t that still affects the point
    // Need to increment tiny amounts to avoid moving the point all the way to the
    // second intersection
    let increment = 1e-06;
    let curr_p = p;
    for(let i = 0; i < 20; i += 1) {
      const new_p = r.project(t + increment)
       
      // need to stop if either fails to change, otherwise r.project likely to fail later
      if(new_p.x === curr_p.x || new_p.y === curr_p.y) { 
        // back off to known change to avoid risk that high/low test will fail
        increment *= 10;
        break; 
      }

      // need to set curr_p each time b/c otherwise 
      // random changes between original and curr can make this fail. 
      curr_p = new_p;
      increment *= .1;
    }   
       
    const high_p = r.project(t + (increment * 10)); // *10 to ensure the points differ
    const low_p =  r.project(t - (increment * 10)); // *10 to ensure the points differ
    const high_ccw = inCirclePoints(c1, c2, c3, high_p);
    const low_ccw  = inCirclePoints(c1, c2, c3, low_p);

    // determine which way lowers ccw
    const move_inside = high_ccw < low_ccw ? 1 : -1; 

    // subtract enough to get to negative ccw (inside circle)
    // add enough to get w/in outsideCircle returning 0 or stop
    // use for loop just in case this fails
    const MAX_ITER = 100;
    let total_increment = 0;
    for(let i = 0; i < MAX_ITER; i += 1) {
      if(almostEqual(curr_ccw, 0)) break;
    
      if(curr_ccw < 0) {
        // we are inside the circle.
        // test if we can move toward the outside without going past
        const test_increment = total_increment - (increment * move_inside);
        const new_p = r.project(t + test_increment);
        const new_ccw = inCirclePoints(c1, c2, c3, new_p);
        if(almostEqual(new_ccw, 0, { EPSILON }) || new_ccw < 0) {
          curr_ccw = new_ccw;
          total_increment = test_increment;
        } else {
          break; // nothing left we can do without greater precision
        }
    
      } else {
        // we are outside the circle
        // must make a move inside
        total_increment += (increment * move_inside);
        const new_p = r.project(t + total_increment);
        curr_ccw = inCirclePoints(c1, c2, c3, new_p)
      }
    }
  
    return r.project(t + total_increment);
  }
}
