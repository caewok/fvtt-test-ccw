'use strict';

import { round, ccwPoints } from "./util.js";


export var BezierCache = new Map();

// Bezier approximation of Circle
// Used for padding limited-radius polygons.
// Main method: Bezier.bezierPadding

// quadrants clockwise from northwest
const Q1 = 1;
const Q2 = 2;
const Q3 = 3;
const Q4 = 4;

/**
 * Utility class to create a bezier approximation of a circle.
 * Currently just holds static methods, but that may change.
 * Could be used to cache the calculation, given that Foundry 
 * uses predictable padding.
 */
export class Bezier {
  constructor() {
  }
  
  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Bezier approximation of a circle arc in the northeast quadrant.
   * See https://spencermortensen.com/articles/bezier-circle/
   * Points returned will be for arc in southwest quadrant (Q4): (0, 1) to (1, 0)
   * @param {Number} t  Value between 0 and 1
   * @return {PIXI.point} {x, y} Point corresponding to that t
   */
  static bezierCircle(t) {
    //if(BezierCache.has(t)) { return BezierCache.get(t); }
  
    const paren = 1 - t;
    const paren2 = paren * paren;
    const paren3 = paren2 * paren;
    const t2 = t * t;
    const t3 = t * t * t;
    const c_times_3 = 3 * 0.551915024494;
  
    const x = c_times_3 * paren2 * t + 3 * paren * t2 + t3;
    const y = c_times_3 * t2 * paren + 3 * t * paren2 + paren3;  
    
    BezierCache.set(t, {x: x, y: y});
    
    return { x: x, y: y };
  }

  /*
   * Approximate bezier circle for each quadrant.
   * @param {Number} t          Value between 0 and 1
   * @param {1|2|3|4} quadrant  Which quadrant the arc is in (northwest to southwest clockwise)
   * @return {PIXI.point} {x, y} Point corresponding to t, adjusted for quadrant.
   *   t = 0 to t = 1 moves points clockwise through quadrants
   */
  static bezierCircleForQuadrant(t, quadrant) {  
    // recall that y is reversed: -y is at the top, +y is at the bottom
    // bezierCircle: for t 0 -> 1, returns {0,1} to {1, 0}
    let pt;
    switch(quadrant) {
      case Q1:
        pt = Bezier.bezierCircle(1 - t);
        pt.x = -pt.x;
        pt.y = -pt.y;
        return pt;
      case Q2:
        pt = Bezier.bezierCircle(t);
        pt.y = -pt.y;
        return pt;
      case Q3:
        return Bezier.bezierCircle(1 - t);
      case Q4: 
        pt = Bezier.bezierCircle(t)
        pt.x = -pt.x;
        return pt;
    } 
  }
  
  /**
   * Get padding using a bezier approximation to a circle
   * @param {SightRay} r0       SightRay where A is the origin of the circle, B is start point for arc.
   * @param {SightRay} r1       SightRay where A is the origin of the circle, B is end point for arc.
   * @param {Number} padding    The size of padding in radians to fill between r0.B and r1.B.
   * @param {Array} pts         Array to which to add points. Optional.
   * @return [{PIXI.point}] Array of {x, y} points, inclusive of start and end
   */
  static bezierPadding(r0, r1, padding, pts = []) {  
    const radius = r0.distance;
    const origin = r0.A;
    const PRECISION = 10; // number of digits to round
    
    // center and scale 
    // round to avoid errors near 1, 0, -1       
    const start_scaled = { x: round((r0.B.x - origin.x) / radius, PRECISION),
                           y: round((r0.B.y - origin.y) / radius, PRECISION) };
    const end_scaled = { x: round((r1.B.x - origin.x) / radius, PRECISION),
                         y: round((r1.B.y - origin.y) / radius, PRECISION) };
    
    const start_quadrant = Bezier.getQuadrant(start_scaled);
    const end_quadrant = Bezier.getQuadrant(end_scaled);
  
    const numQuadrantPoints = Math.floor(Math.PI / (2 * padding)); 
  
    let quadrant = start_quadrant;
    let done = false;
    
    
    // if the start quadrant equals the end, we need to know if we are:
    // 1. making a short arc (end is "after" start)
    // 2. making a big arc (end is "before" start, so we travel every quadrant)
    let small_arc = true;
    if(end_quadrant === start_quadrant && 
       ccwPoints(origin, r0.B, r1.B)) { small_arc = false; }
    
    while(!done) {      
      if(small_arc && quadrant === end_quadrant) done = true;
  
      for(let t = 0; t <= 1; t += (1 / numQuadrantPoints)) {
        const pt = Bezier.bezierCircleForQuadrant(t, quadrant);
        pt.x = round(pt.x, PRECISION);
        pt.y = round(pt.y, PRECISION);
        let add_pt = true
      
        // compare to start and end. if within, then keep
        if(quadrant === start_quadrant) {
          switch(quadrant) {
            case Q1:
              // x goes from -1 to 0
              if(pt.x <= start_scaled.x) { add_pt = false; }
              break;
            case Q2:
              // x goes from 0 to 1
              if(pt.x <= start_scaled.x) { add_pt = false; }
              break;
            case Q3:
              // x goes from 1 to 0
              if(pt.x >= start_scaled.x) { add_pt = false; }
              break;
            case Q4:
              // x goes from 0 to -1
              if(pt.x >= start_scaled.x) { add_pt = false; }
              break;
          }
        } 
      
        if(add_pt && small_arc && quadrant === end_quadrant) {
          switch(quadrant) {
            case Q1:
              // x goes from -1 to 0
              if(pt.x >= end_scaled.x) { add_pt = false; }
              break;
            case Q2:
              // x goes from 0 to 1
              if(pt.x >= end_scaled.x) { add_pt = false; }
              break;
            case Q3:
              // x goes from 1 to 0
              if(pt.x <= end_scaled.x) { add_pt = false; }
              break;
            case Q4:
              // x goes from 0 to -1
              if(pt.x <= end_scaled.x) { add_pt = false; }
              break;
          }
        } 
      
        // re-scale point
        if(add_pt) {
          pt.x = (pt.x * radius) + origin.x;
          pt.y = (pt.y * radius) + origin.y;
      
          pts.push(pt.x, pt.y);
        }
        
        small_arc = true;
      
      } // end for loop
      quadrant = (quadrant % 4) + 1;
    } // end while loop
  
    return pts;
  }
  
  static getQuadrant(pt, origin = {x: 0, y: 0}) {
    if(pt.y <= origin.y) {
      // top hemisphere
      if(pt.x <= origin.x) {
        // left
        return Q1;
      } else {
        return Q2;
      }
    } else {
      // bottom hemisphere
      if(pt.x <= origin.x) {
        return Q4; 
      } else {
        return Q3;
      }
    }
  }


}







