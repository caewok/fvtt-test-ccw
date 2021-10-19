'use strict';

import { CCWRay } from "./class_CCWRay.js";
import { CCWPixelPoint } from "./class_CCWPixelPoint.js";

/**
 * Represent a ray, or segment that starts and ends at 
 * CCWPixelPoints. Assume the ray should take up 1 pixel in width.
 * Like with PixelPoints, any coordinate within 1/2 of the length of a pixel of this ray
 * should be considered part of this ray. 
 * I.e., take a coordinate A near this line. Define point B on the line as that point 
 * which is closest to A. 
 * If the distance between A and B is less than 1/2 a diagonal pixel, the coordinate A
 * is part of the line. 
 * Per Pythagorean's theorem, the diagonal is a^2 + b^2 = c^2 -> √2
 * Thus, if a random CCWPoint is within ± √2 / 2 of a PixelRay, that CCWPoint can be
 * considered part of or equivalent to the PixelRay.
 *
 * This assumption along with the integer endpoints requires modifying 
 * certain CCWRay methods to use a much larger EPSILON. 
 * This is done in the method override, and not by changing the default EPSILON, 
 * so that the PixelRay always uses a consistent definition.
 */

export class CCWPixelRay extends CCWRay {
  constructor(A, B) {
    super(A, B);
    
    this.A = CCWPixelPoint.fromPoint(A);
    this.B = CCWPixelPoint.fromPoint(B);
  }
  
 /**
  * Is the point counterclockwise, clockwise, or colinear w/r/t this ray?
  * Override EPSILON to consider ± √2 / 2 coordinates as colinear
  * @override
  */
  ccw(p) { return CCWRay.prototype.ccw.call(this, p, { EPSILON: Math.SQRT1_2 }); }

 /**
  * Quick function to determine if this ray could intersect another
  * Override EPSILON to consider ± √2 / 2 as equal
  * @override
  */
  intersects(r) { 
    return CCWRay.prototype.intersects.call(this, r, { EPSILON: Math.SQRT1_2 }); 
  }
  
 /**
  * Test if point is on/very near the segment.
  * Override EPSILON to consider ± √2 / 2 coordinates as on the line
  */
  contains(p, { assume_collinear = false } = {}) {
    return CCWRay.prototype.contains.call(this, p, 
             { assume_collinear, EPSILON: Math.SQRT1_2 })
  } 
  
 /**
  * Test if the point is in front of the ray.
  * Override EPSILON to consider ± √2 / 2 as equal
  * @override
  */
  inFrontOfPoint(p, origin) { 
    return CCWRay.prototype.call(this, p, origin, { EPSILON: Math.SQRT1_2 }); 
  }
  
 /**
  * Return true if this segment is in front of another segment.
  * Override EPSILON to consider ± √2 / 2 as equal
  * @override
  */
  inFrontOfSegment(segment, origin, { check_overlap = false} = {}) {
    return CCWRay.prototype.inFrontOfSegment.call(this, segment, origin, 
      { check_overlap, EPSILON: Math.SQRT1_2});
  }   
  
 /**
  * Intersection points with a circle for this ray.
  * Override EPSILON to consider ± √2 / 2 as equal
  * Do not use robust check b/c will be coercing to nearest pixel point
  * @override
  * @return {CCWPixelPoint}
  */
  intersectionsWithCircle(center, radius, { method = "geometry" } = {}) {
     const potential_pts = method === "geometry" ?
       CCWRay.prototype.potentialIntersectionsWithCircleQuadratic.call(this, 
         center, radius) : 
       CCWRay.prototype.potentialIntersectionsWithCircleGeometry.call(this, 
         center, radius); 
                               
     const intersections = potential_pts.filter(pt => 
      this.contains(pt, { assume_colinearity: true }))  
     
     // convert to PixelPoints
     return intersections.map(i => new CCWPixelPoint(i))                                               
  }
}