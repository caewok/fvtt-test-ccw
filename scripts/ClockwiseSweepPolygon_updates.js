/* globals ClockwiseSweepPolygon, PolygonVertex */
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

}