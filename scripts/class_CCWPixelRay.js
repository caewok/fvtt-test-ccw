'use strict';

import { CCWRay } from "./class_CCWRay.js";
import { CCWPoint } from "./class_CCWPoint.js";
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
  constructor(A, B, { update_endpoints = true } = {}) {
    super(A, B, { update_endpoints: false });
    
    if(update_endpoints) {
      this.A = new CCWPixelPoint(A.x, A.y);
      this.A = new CCWPixelPoint(B.x, B.y);
    } 
  }
  
 /**
  * Is the point counterclockwise, clockwise, or colinear w/r/t this ray?
  * Consider ± √2 / 2 coordinates from the line as colinear
  * @param {number} [options.EPSILON]  How exact should the equality test be?
  * @override
  */
  ccw(p) { 
    // if both pixels, normal ccw will work fine.
    // need not be robust or check for near 0
    
    if(p instanceof CCWPixelPoint) { 
      const orientation = CCWPoint.orient2d(this.A, this.B, p, { robust: false });
      return Math.sign(orientation); 
    }
    
    // p may be close enough to the line to be colinear
    // orient2d returns ~ double the area of the triangle formed by the three points.
    // in the base case, a line 1,1 --> 1,0 and a point 1 - √2 / 2, 0 returns
    // area of √2 / 2. 
    // a line 1,2 --> 1,0 with point 1 - √2 / 2, 0 returns √2 / 2 * 2
    // I.e., a given point would be nearly colinear if orient2d <= √2 /2 * line distance
    // Can square both sides, to compare orient2d ^ 2 <= 0.5 * line distance ^2    
    const orientation = CCWPoint.orient2d(this.A, this.B, p);
    const orientation2 = orientation * orientation;
    const cutoff = 0.5 * this.distanceSquared;
    
    if(orientation2 < cutoff) return 0; 
    return orientation < 0 ? -1 : 1;    
  }
}
