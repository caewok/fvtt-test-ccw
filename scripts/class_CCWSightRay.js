'use strict';

/* globals Ray, canvas */

import { ccwPoints, 
         outsideCircle,
         almostEqual, 
         pointsAlmostEqual, 
         rootsReal,
         COLORS,
         PRESET_EPSILON } from "./util.js";
         
import { MODULE_ID } from "./module.js";         

/*
 * Subclass of Ray used specifically for computing in the CCW Sweep algorithm.
 * @extends {Ray}
 */
export class CCWSightRay extends Ray {

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
  /*  Factory Function                            */
  /* -------------------------------------------- */
  
  /*
   * Construct a sight ray of given distance that goes through the reference point.
   * Comparable to Ray.fromAngle 
   * @param {x: number, y: number}  origin    Ray starting point
   * @param {x: number, y: number}  reference Ray must pass through this point
   * @param {Number}                dist      Positive number for ray distance.
   * @return {CCWSightRay} Constructed ray.
   */
  static fromReference(origin, reference, dist) {
    return (new CCWSightRay(origin, reference)).projectDistance(dist);
  }
  
 /**
  * Same as fromReference but use distance squared
  * @param {x: number, y: number}  origin    Ray starting point
  * @param {x: number, y: number}  reference Ray must pass through this point
  * @param {Number}                distSquared  Positive number for squared ray distance.
  * @return {CCWSightRay} Constructed ray.
  */
  static fromReferenceSquared(origin, reference, distSquared) {
    return (new CCWSightRay(origin, reference)).projectDistanceSquared(distSquared);
  }
  
  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

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
  
    const r = this.projectDistanceSquared(dist * dist, { fromEndpoint });
    const r = new CCWSightRay(this[fromEndpoint], B);
    
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
    const r = new CCWSightRay(this[fromEndpoint], B);
  
    // unclear whether we should force distance to equal the provided distance
    r._distanceSquared = dist_squared
  
    r._angle = this._angle;
    return r;
  }

  /**
   * Project the Ray from B by some proportion of its initial distance.
   * Return the coordinates of that point B along the path.
   * @param {number} t    The distance along the Ray
   * @return {x: number, y: number} The coordinates of the projected point
   */
  projectB(t) {
    return {
      x: this.B.x + (t * this.dx),
      y: this.B.y + (t * this.dy)
    }
  }

  /**
   * Quick function to determine if this ray could intersect another
   *
   * @param {Ray} r Other ray to test for intersection
   * @return {boolean} Could the segments intersect?
   */
  intersects(r) {  
    return ccwPoints(this.A, this.B, r.A) != ccwPoints(this.A, this.B, r.B) &&
           ccwPoints(r.A, r.B, this.A) != ccwPoints(r.A, r.B, this.B);
  }
  
  /**
   * Test if point is on the segment.
   * @param {x: number, y: number} p   Point to test
   * @param {object} [options] 
   * @param {boolean} [options.assume_collinear] Option to skip the collinearity test.
   * @param {number} [options.EPSILON]  How exact do we want to be? 
   * @return{boolean} Does segment include point?
   */
  contains(p, { assume_collinear = false, EPSILON = PRESET_EPSILON } = {}) {
    // ensure the point is collinear with this ray
    if(!assume_collinear && ccwPoints(this.A, this.B, p) !== 0) return false;

    // test if is an endpoint
    // covered by revised test below
    //if(pointsAlmostEqual(this.A, p) || 
    //   pointsAlmostEqual(this.B, p)) return true;  
 
    // test if between the endpoints
    // recall that we already established the point is collinear above.
    const max_x = Math.max(this.A.x, this.B.x);
    const min_x = Math.min(this.A.x, this.B.x);
    const max_y = Math.max(this.A.y, this.B.y);
    const min_y = Math.min(this.A.y, this.B.y);

    const within_x = ((p.x < max_x || almostEqual(p.x, max_x, EPSILON)) &&
                (p.x > min_x || almostEqual(p.x, min_x, EPSILON)));

    const within_y = ((p.y < max_y || almostEqual(p.y, max_y, EPSILON)) &&
                (p.y > min_y || almostEqual(p.y, min_y, EPSILON)));
 
    return within_x && within_y;
  }
  
   /**
    * Does this ray intersect a circle? Return intersection points if any.
    *   This assumes an infinite ray and does not check for whether the ray 
    *   contains the points. 
    *   
    * Equation for circle: x^2 + y^2 = r^2
    * Equation for line: y = mx + b
    *
    * Solves the quadratic equation for x or y.
    *   If two real roots, the ray intersects twice
    *   If one real root, the ray intersects once
    *   If only imaginary roots, the ray does not intersect the circle.
    * Note: the intersections returned will only be approximately contained 
    *   in the line. Looks like it is accurate to about 1e-10. Important if
    *   checking for collinearity of the intersect point and the line. 
    *
    * @param {x: number, y: number} center   Center of the cirle
    * @param {number} r      Radius of circle. Should be > 0.
    * @return {[{x,y}]|undefined} One or two intersection points or undefined.
    */
   potentialIntersectionsWithCircle(center, radius) {
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
    return [];
  } 
  
  /*
   * See potentialIntersectionsCircle, above.
   * This method builds on that by only returning intersections within the line
   * defined by this.A and this.B
   * @param {x: number, y: number} center   Center of the cirle
   * @param {number} radius      Radius of circle. Should be > 0.
   * @return {[{x,y}]|undefined} One or two intersection points or undefined.
   */
  intersectionsWithCircle(center, radius, { robust = false, iterations = 10 } = {}) {
    const intersections = this.potentialIntersectionsWithCircle(center, radius);
    if(intersections.length === 0) return intersections;
    
    // if we are within a pixel of the circle, it counts.
    // the potentialIntersectionsWithCircle calculation is not robust, and 
    // so it is possible to have a line endpoint nearly on the circle, with 
    // unpredictable results as to whether the line endpoint meets the intersection. 
    // Thus, we need to back off the precision.
    if(robust) {
      return intersections.map(p => this.robustIntersectionsWithCircle(p, center, radius, iterations))
    } else {
      return intersections.filter(i => this.contains(i, {assume_collinear: true, EPSILON: 1e0}));
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
  * @param {number}     iterations  Number of loops to attempt to adjust the intersection
  * @return {PIXI.point} Adjusted intersection
  */
  robustIntersectionWithCircle(p, center, radius, iterations = 10) {
    // First, adjust the approximate intersection so it is on the line
    for(let i = 0; i < iterations; i += 1) {
      if(ccwPoints(this.A, this.B, p) === 0) break;
    
      // alternate A or B as origin
      const origin = i % 2 === 0 ? this.A : this.B;
      
      const d2 = origin.x * p.x + origin.y * p.y;
      const r = this.projectDistanceSquared(d2);
      p = r.B;
    }
    
    // Second, move up and down the line until we are also on the circle
    // points of the circle, ccw:
    const c1 = { x: center.x + radius, y: center.y };
    const c2 = { x: center.x, y: center.y - radius };
    const c3 = { x: center.x - radius, y: center.y };
    
    const p_loc = outsideCircle(c1, c2, c3, p);
    if(p_loc === 0) return p;
    
    // tricky part: how to know which way to move on the line?
    // Want to extend the line in relation to a vertex 
    // such that moving in one direction goes outside, moving the other goes inside
    // Just use the furthest vertex b/c otherwise this gets very complicated
    const A_distSquared = this.A.x * p.x + this.A.y * p.y;
    const B_distSquared = this.B.x * p.x + this.B.y * p.y;
    const V = A_distSquared > B_distSquared ? "A" : "B";
    
    let previous_loc;      
    let increment = 1; 
    for(let i = 0; i < iterations; i += 1) {
      const d2 = this[V].x * p.x + this[V].y * p.y;
    
      const high_p = this.projectDistanceSquared(d2 + increment, { fromEndpoint: V }) 
      const low_p = this.projectDistanceSquared(d2 - increment, { fromEndpoint: V })
    
      const high_p_loc = outsideCircle(c1, c2, c3, high_p);
      const low_p_loc = outsideCircle(c1, c2, c3, low_p);
      
      if(high_p_loc === 0) {
        p = high_p;
        break;
      }
      
      if(low_p_loc === 0) {
        p = low_p;
        break;
      }
      
      if(high_p_loc !== low_p_loc) {
        // Passed the intersection. Decrease increment
        // Pick the point estimate that caused the switch
        increment = increment / 2;
        p = high_p_loc === previous_loc ? low_p : high_p;
      } else {
        if(high_p_loc === previous_loc) {
          // have not passed the intersection. Increase increment
          increment = increment * 2;
          
        } else {
          // should not happen
          // suggests moving in opposite directions both pass the intersection
          // just return
          console.warn(`${MODULE_ID}|robustIntersectionWithCircle could not locate intersection.`)
          break;
        }
      }
    
      previous_loc = p_loc;
    }
    
    return p;
  }
  
  /**
   * Return true if the point is in front of the ray, based on a relative origin point.
   *
   * @param {x: number, y: number} point    Point to test
   * @param {x: number, y: number} origin   Vision/observer point
   * @return {boolean} true if this point is in front. 
   *                   False if behind or on the segment line
   */
  inFrontOfPoint(point, origin) {
    if(pointsAlmostEqual(this.A, point) || pointsAlmostEqual(this.B, point)) return false;
    if(pointsAlmostEqual(point, origin)) return false;
  
    const ABP = ccwPoints(this.A, this.B, point);
    const ABO = ccwPoints(this.A, this.B, origin);
    const OAP = ccwPoints(origin, this.A, point);
  
    if(ABP !== ABO && ABP !== OAP) return true;
    return false;
  } 
  
  /**
   * Return true if this segment is in front of another segment
   *
   * "In front of" defined as whether one segment partially blocks vision of the other.
   * @param {Segment} segment                Segment to test
   * @param {x: number, y: number} origin    Vision/observer point
   * @return {boolean} true if this segment is in front of the other.
   */
  inFrontOfSegment(segment, origin) {
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
    const B3 = ccwPoints(thisA, thisB, origin);
  
    const A1 = ccwPoints(segmentA, segmentB, thisA);
    const A2 = ccwPoints(segmentA, segmentB, thisB);
    const A3 = ccwPoints(segmentA, segmentB, origin);
  
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
    //if (A1 === A2 && A2 !== A3) return false; // these do nothing, as we just return false anyway
    //if (B1 === B2 && B2 === B3) return false;

    return false;
  }
  
 /**
  * Draw the sight ray (for debugging)
  * @param {number} color
  * @param {number} alpha
  * @param {number} width
  */
  draw(color = COLORS.blue, alpha = 1, width = 1) {
    canvas.controls.debug.lineStyle(width, color, alpha).
      moveTo(this.A.x, this.A.y).
      lineTo(this.B.x, this.B.y);
  }
  

}
