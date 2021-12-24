/* globals 

PolygonVertex, 
ClockwiseSweepPolygon

*/

'use strict';

const QUADRANTS = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

export class FastBezier {
  constructor() {
    this.cachedPointSets = new Map();
  }
  
  /* -------------------------------------------- */
  /*  Static Methods                              */
  /* -------------------------------------------- */  
  
  /**
   * Bezier approximation of a circle arc in the northeast quadrant.
   * See https://spencermortensen.com/articles/bezier-circle/
   * Points returned will be for arc in southwest quadrant (Q4): (0, 1) to (1, 0)
   * @param {Number} t  Value between 0 and 1
   * @return {PIXI.point} {x, y} Point corresponding to that t
   */
  static bezierPoint(t) {
    const paren = 1 - t;
    const paren2 = Math.pow(paren, 2);
    const paren3 = Math.pow(paren, 3);
    const t2 = Math.pow(t, 2);
    const t3 = Math.pow(t, 3);
    const c_times_3 = 3 * 0.551915024494;
  
    const x = c_times_3 * paren2 * t + 3 * paren * t2 + t3;
    const y = c_times_3 * t2 * paren + 3 * t * paren2 + paren3;  
        
    return { x: x, y: y };
  }
  
  /*
   * Approximate bezier circle for each quadrant.
   * @param {Number} t          Value between 0 and 1
   * @param {1|2|3|4} quadrant  Which quadrant the arc is in (northwest to southwest clockwise)
   * @return {PIXI.point} {x, y} Point corresponding to t, adjusted for quadrant.
   *   t = 0 to t = 1 moves points clockwise through quadrants
   */
  static bezierPointForQuadrant(t, quadrant) {  
    // recall that y is reversed: -y is at the top, +y is at the bottom
    // bezierCircle: for t 0 -> 1, returns {0,1} to {1, 0}
    let pt;
    switch(quadrant) {
      case QUADRANTS.Q1:
        pt = FastBezier.bezierPoint(1 - t);
        pt.x = -pt.x;
        pt.y = -pt.y;
        return pt;
      case QUADRANTS.Q2:
        pt = FastBezier.bezierPoint(t);
        pt.y = -pt.y;
        return pt;
      case QUADRANTS.Q3:
        return FastBezier.bezierPoint(1 - t);
      case QUADRANTS.Q4: 
        pt = FastBezier.bezierPoint(t)
        pt.x = -pt.x;
        return pt;
    } 
  }
  
 /**
  * Create an array of bezier points for each of the 4 quadrants given a specified
  * density in number of points per quadrant.
  * These are unscaled points, so origin 0,0 and radius 1.
  * @param {Number} numQuadrantPoints    Number of points to create in a given quadrant.
  * @return {Object} Object containing the point set for each quadrant and, for 
  *   convenience, the entire 360º point set.
  */
  static bezierPointSet(numQuadrantPoints) {
    const BezierQ1 = [];
    const BezierQ2 = [];
    const BezierQ3 = [];
    const BezierQ4 = [];
    const t_increment = 1 / numQuadrantPoints;
    for(let t = 0; t < .9999; t += t_increment) {
      BezierQ1.push(FastBezier.bezierPointForQuadrant(t, QUADRANTS.Q1));
      BezierQ2.push(FastBezier.bezierPointForQuadrant(t, QUADRANTS.Q2));
      BezierQ3.push(FastBezier.bezierPointForQuadrant(t, QUADRANTS.Q3));
      BezierQ4.push(FastBezier.bezierPointForQuadrant(t, QUADRANTS.Q4));
    }
    const Bezier360 = []
    Bezier360.push(...BezierQ1);
    Bezier360.push(...BezierQ2);
    Bezier360.push(...BezierQ3);
    Bezier360.push(...BezierQ4);
    
    return {
      Q1: BezierQ1,
      Q2: BezierQ2,
      Q3: BezierQ3,
      Q4: BezierQ4,
      Full: Bezier360,
      numQuadrantPoints: numQuadrantPoints
    }
  }
  
 /**
  * Relative to an origin point, in what quadrant does a point lie?
  * Q1 would be top left, Q2 top right, etc.
  * @param {PIXI.Point} pt
  * @param {PIXI.Point} origin
  * @return {1|2|3|4} Quadrant
  */
  static getQuadrant(pt, origin = {x: 0, y: 0}) {
    if(pt.y > origin.y) {
      // bottom hemisphere
      return pt.x < origin.x ? QUADRANTS.Q4 : QUADRANTS.Q3;
    } else {
      // top hemisphere
      return pt.x < origin.x ? QUADRANTS.Q1 : QUADRANTS.Q2;
    }
  }
  
  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Store a point set for repeated use.
   * @param {Number} numQuadrantPoints    Number of points to create in a given quadrant.
   */
  cachePointSet(numQuadrantPoints) {
    this.cachedPointSets.set(numQuadrantPoints, 
      FastBezier.bezierPointSet(numQuadrantPoints));
  }
  
 /**
  * Retrieve index corresponding to where a given scaled x falls on the 
  * bezierPointSet.
  * @param {number}  x          Number between -1 and 1.
  * @param {1|2|3|4} quadrant   Which set of quadrant points to search.
  * @param {Object}  pointSet   Output from bezierPointSet method.
  * @return {number} Index
  */
  bezierPointIndex(x, quadrant, pointSet) {
    let idx;
    switch(quadrant) {
      case QUADRANTS.Q1: 
        // x goes from -1 to 0
        idx = pointSet.Q1.findIndex(pt => pt.x >= x);
        break;
      case QUADRANTS.Q2:
        // x goes from 0 to 1
        idx = pointSet.Q2.findIndex(pt => pt.x >= x);
        idx += pointSet.numQuadrantPoints;
        break;
      case QUADRANTS.Q3:
        // x goes from 1 to 0
        idx = pointSet.Q3.findIndex(pt => pt.x <= x); 
        idx += pointSet.numQuadrantPoints * 2;
        break;
      case QUADRANTS.Q4:
        // x goes from 0 to -1
        idx = pointSet.Q4.findIndex(pt => pt.x <= x);
        idx += pointSet.numQuadrantPoints * 3; 
        break;    
    }
    return idx;
  }
  
 /**
  * Scale a number to be between -1 and 1, based on a given "center" and "radius",
  * where (x - center) / radius = scaled_x.
  * @param {number} x
  * @param {number} center
  * @param {number} radius
  * @return {number} Scaled x
  */
  scale(x, center = 0, radius = 1) {
    const scaled_x = (x - center) / radius;
    return Math.clamped(scaled_x, -1, 1);
  } 
  
 /**
  * Reverse scale method for a given value.
  * @param {number} scaled_x
  * @param {number} center
  * @param {number} radius
  * @return {number} Unscaled x
  */
  unscale(scaled_x, center = 0, radius = 1) { return (scaled_x * radius) + center; }
  
 /**
  * Get padding using a bezier approximation to a circle
  * @param {Ray} r0                     Ray where A is the origin of the circle, 
  *                                     B is start point for arc.
  * @param {Ray} r1                     Ray where A is the origin of the circle, 
  *                                     B is end point for arc.
  * @param {Number} numQuadrantPoints   Number of points to create in a given quadrant,
  *                                     assuming the entire quadrant was used.
  * @return [{PIXI.point}] Array of {x, y} points, inclusive of start and end
  */ 
  bezierPadding(r0, r1, numQuadrantPoints, radius = r0.distance) {
    const origin = r0.A;
    const start_scaled_x = this.scale(r0.B.x, origin.x, radius);
    const end_scaled_x   = this.scale(r1.B.x, origin.x, radius);
    
    // could catch this every time a new numQuadrantPoints
    // is encountered, if preferred
    const bezierPoints = this.cachedPointSets.has(numQuadrantPoints) ? 
                         this.cachedPointSets.get(numQuadrantPoints) :
                         FastBezier.bezierPointSet(numQuadrantPoints);
    
    let scaled_pts = undefined;
    if(r0.B.x === r1.B.x && r0.B.y === r1.B.y) { 
      // we are being asked to return a full circle set of points, which is easy
      scaled_pts = bezierPoints.Full;
      
    } else {
      const start_quadrant = FastBezier.getQuadrant(r0.B, origin);
      const end_quadrant = FastBezier.getQuadrant(r1.B, origin);
      
      // for end index, don't include the last point
      const start_idx = this.bezierPointIndex(start_scaled_x, start_quadrant, 
                          bezierPoints);
      const end_idx  = this.bezierPointIndex(end_scaled_x, end_quadrant, 
                          bezierPoints) - 1;
      
      // Construct the point set for the arc from start index to end index
      // Currently assumes that the user always wants an arc moving 
      // clockwise from r0.B to r1.B
      if(start_idx < end_idx) {
        scaled_pts = bezierPoints.Full.slice(start_idx, end_idx)
      } else {
        // end is smaller, indicating we should loop back around.
        // start_idx --> end of array + start of array --> end_idx
        scaled_pts = bezierPoints.Full.slice(start_idx, bezierPoints.Full.length);
        scaled_pts.push(...bezierPoints.Full.slice(0, end_idx));
      }
    }
    
    // Unscale the points to match the size of the requested radius and origin.
    return scaled_pts.map(pt => {
      return {
        x: this.unscale(pt.x, origin.x, radius),
        y: this.unscale(pt.y, origin.y, radius)
      }
    });
  }

}  


// Create a Bezier object to cache point sets.
export const BEZIER = new FastBezier();
BEZIER.cachePointSet(30); // density / 2 to get numQuadrantPoints to cache


export class MyClockwiseSweepPolygon extends ClockwiseSweepPolygon {
   /**
  * Add additional points to limited-radius polygons to approximate the curvature of a circle
  * @param {Ray} r0        The prior ray that collided with some vertex
  * @param {Ray} r1        The next ray that collides with some vertex
  * @private
  */
  _getPaddingPoints(r0, r1) {
    const numQuadrantPoints = Math.floor(this.config.density / 2);
    const pts = BEZIER.bezierPadding(r0, r1, 
                  numQuadrantPoints, this.config.radius);
    const padding = pts.map(pt => PolygonVertex.fromPoint(pt));    
    return padding;     
  }
}