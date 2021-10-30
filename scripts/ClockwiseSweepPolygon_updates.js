/* globals ClockwiseSweepPolygon, PolygonVertex, foundry */
import { Bezier } from "./class_Bezier.js";

export class MyClockwiseSweepPolygon extends ClockwiseSweepPolygon {
  
 /**
  * Add additional points to limited-radius polygons to approximate the curvature of a circle
  * @param {Ray} r0        The prior ray that collided with some vertex
  * @param {Ray} r1        The next ray that collides with some vertex
  * @private
  */
  _getPaddingPoints(r0, r1) {
    const numQuadrantPoints = this.config.density / 2;
    const pts = Bezier.bezierPadding(r0, r1, numQuadrantPoints);
    const padding = pts.map(pt => PolygonVertex.fromPoint(pt));    
    return padding;     
  }
  
 /**
  * Intersection between this Ray and another assuming both are infinite lengths.
  * @param {Ray}   r1         First ray
  * @param {Ray}   r2         Second ray 
  * @return {LineIntersection|null}  Point of intersection or null.
  */ 
  potentialIntersection(r1, r2) {
    const x1 = r1.A.x;
    const y1 = r1.A.y;
    const x3 = r2.A.x;
    const y3 = r2.A.y;
    
    const dx1 = r1?.dx || (r1.B.x - r1.A.x);
    const dy1 = r1?.dy || (r1.B.y - r1.A.y);
    
    const dx2 = r2?.dx || (r2.B.x - r2.A.x);
    const dy2 = r2?.dx || (r2.dy = r2.B.y - r2.A.y);
      
    // Check denominator - avoid parallel lines where d = 0
    const d = dy2 * dx1 - dx2 * dy1;
    if(d === 0) return null;
    
    // get vector distance for the intersection point
    const t0 = (dx2 * (y1 - y3) - dy2 * (x1 - x3)) / d;
    return { 
      x: x1 + t0 * dx1,
      y: y1 + t0 * dy1,
      t0: t0
    }
  }   
  
 /**
  * Intersection between two rays
  * @param {Ray} r1   First ray
  * @param {Ray} r2   Second ray
  * @return {LineIntersection|null} 
  */
  lineLineIntersection(r1, r2) {
    if(!foundry.utils.lineLineIntersects(r1.A, r1.B, r2.A, r2.B)) { return null; }
        
    const res = MyClockwiseSweepPolygon.potentialIntersection(r1, r2);
    if(res?.t0) res.t0 = Math.clamped(res.t0, 0, 1); // just in case t0 is very near 0 or 1
    return res;
  }
  
  
 /**
  * Identify the collision points between an emitted Ray and a set of active edges.
  * @param {Ray} ray                   The candidate ray to test
  * @param {EdgeSet} activeEdges       The set of active edges
  * @returns {PolygonVertex[]}         A sorted array of collision points
  * @private
  */
  _getRayCollisions(ray, activeEdges) {
    const collisions = [];
    const keys = new Set();

    // Identify unique collision points
    for ( let edge of activeEdges ) {
      const x = MyClockwiseSweepPolygon.lineLineIntersection(ray, edge);
      if ( !x || (x.t0 === 0) ) continue;
      let c = PolygonVertex.fromPoint(x, {distance: x.t0});
      if ( keys.has(c.key) ) {
        c = keys.get(c.key);
        c.attachEdge(edge);
        continue;
      }
      keys.add(c.key);
      c.attachEdge(edge);
      collisions.push(c);
    }

    // Sort collisions on proximity to the origin
    collisions.sort((a, b) => a.distance - b.distance);

    // Add the ray termination
    const t = PolygonVertex.fromPoint(ray.B, {distance: 1.0});
    if ( !keys.has(t.key) ) collisions.push(t);
    return collisions;
  }


}