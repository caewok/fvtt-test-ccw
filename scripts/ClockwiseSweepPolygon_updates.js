/* globals ClockwiseSweepPolygon, PolygonVertex, foundry */
import { Bezier } from "./class_Bezier.js";

export class MyClockwiseSweepPolygon extends ClockwiseSweepPolygon {
  
 /**
  * Add additional points to limited-radius polygons to approximate the curvature of a circle
  * @param {Ray} r0        The prior ray that collided with some vertex
  * @param {Ray} r1        The next ray that collides with some vertex
  * @private
  */
//   _getPaddingPoints(r0, r1) {
//     const numQuadrantPoints = this.config.density / 2;
//     const pts = Bezier.bezierPadding(r0, r1, numQuadrantPoints);
//     const padding = pts.map(pt => PolygonVertex.fromPoint(pt));    
//     return padding;     
//   }
  
  _identifyVertices() {
    const {hasLimitedAngle, rMin, rMax} = this.config;

    // Register vertices for all edges
    for ( let edge of this.edges ) {
      const ak = edge.A.key;
      if ( this.vertices.has(ak) ) edge.A = this.vertices.get(ak);
      else this.vertices.set(ak, edge.A);
      edge.A.attachEdge(edge);

      const bk = edge.B.key;
      if ( this.vertices.has(bk) ) edge.B = this.vertices.get(bk);
      else this.vertices.set(bk, edge.B);
      edge.B.attachEdge(edge);
    }

    // For limited angle polygons, restrict vertices
    if ( hasLimitedAngle ) {
      for ( let vertex of this.vertices.values() ) {
        if ( !vertex._inLimitedAngle ) this.vertices.delete(vertex.key);
      }

     //  // Add vertices for the endpoints of bounding rays
     // handled in _executeSweep
//       const vMin = PolygonVertex.fromPoint(rMin.B);
//       this.vertices.set(vMin.key, vMin);
//       const vMax = PolygonVertex.fromPoint(rMax.B);
//       this.vertices.set(vMax.key, vMax);
    }
  }
 
  
  
   /**
   * Execute the sweep over wall vertices
   * @private
   */
  _executeSweep() {
    const origin = this.origin;
    const { radius, hasLimitedAngle, rMin, rMax } = this.config;

    // Initialize the set of active walls
    let activeEdges = this._initializeActiveEdges();
    
    // add collision for limited angle endpoint
    if(hasLimitedAngle) {
      const vertex = PolygonVertex.fromPoint(rMin.B)
      this.rays.push(rMin);
    
      if ( !activeEdges.size ) {
        rMin.result = this._beginNewEdge(rMin, vertex, activeEdges);
      }

      // Case 2 - Identify required collisions for boundary rays
      else {
        rMin.result = this._getRequiredCollision(rMin, vertex, activeEdges);
      }
      
      // don't need to call _updateActiveEdges b/c 
      // we have not moved anywhere in the sweep yet, right?
    }

    // Sort vertices from clockwise to counter-clockwise and begin the sweep
    const vertices = this._sortVertices();
    for ( const [i, vertex] of vertices.entries() ) {

      // Construct a ray towards the target vertex
      vertex._index = i+1;
      const ray = Ray.towardsPoint(origin, vertex, radius);
      this.rays.push(ray);
//       const isRequired = hasLimitedAngle && ((i === 0) || (i === vertices.length-1));

      // Determine whether the target vertex is behind some other active edge
      let isBehind = false;
      for (let edge of activeEdges) {
        if (vertex.edges.has(edge)) continue;
        const x = foundry.utils.lineLineIntersects(this.origin, vertex, edge.A, edge.B);
        if (x) {
          isBehind = true;
          break;
        }
      }

      // Case 1 - If there are no active edges we must be beginning traversal down a new clockwise edge
      if ( !activeEdges.size ) {
        ray.result = this._beginNewEdge(ray, vertex, activeEdges);
      }

      // Case 2 - Identify required collisions for boundary rays
     //  else if ( isRequired ) {
//         ray.result = this._getRequiredCollision(ray, vertex, activeEdges);
//       }

      // Case 3 - Ignore a vertex which is behind some other active edge
      else if ( isBehind ) {
        ray.result = this._skipBlockedVertex(ray, vertex, activeEdges);
      }

      // Case 4 - Complete an active edge
      else if ( vertex.edges.intersects(activeEdges) ) {
        ray.result = this._completeCurrentEdge(ray, vertex, activeEdges);
      }

      // Case 5 - Jumping to a new closer wall
      else {
        ray.result = this._beginNewEdge(ray, vertex, activeEdges);
      }

      // Update active edges for the next iteration
      this._updateActiveEdges(ray, ray.result, activeEdges);
    }
    
    // add collision for limited angle endpoint
    if(hasLimitedAngle) {
      const vertex = PolygonVertex.fromPoint(rMax.B)
      this.rays.push(rMax);
    
      if ( !activeEdges.size ) {
        rMax.result = this._beginNewEdge(rMax, vertex, activeEdges);
      }

      // Case 2 - Identify required collisions for boundary rays
      else {
        rMax.result = this._getRequiredCollision(rMax, vertex, activeEdges);
      }
    }
  }
 

 /**
  * Intersection between this Ray and another assuming both are infinite lengths.
  * @param {Ray}   r1         First ray
  * @param {Ray}   r2         Second ray 
  * @return {LineIntersection|null}  Point of intersection or null.
  */ 
//   static potentialIntersection(a, b, c, d) {
//     const x1 = a.x;
//     const y1 = a.y;
//     const x3 = c.x;
//     const y3 = c.y;
//     
//     const dx1 = b.x - a.x;
//     const dy1 = b.y - a.y;
//     
//     const dx2 = d.x - c.x;
//     const dy2 = d.y - c.y;
//       
//     // Check denominator - avoid parallel lines where denom = 0
//     const denom = dy2 * dx1 - dx2 * dy1;
//     if(denom === 0) return null;
//     
//     // get vector distance for the intersection point
//     const t0 = (dx2 * (y1 - y3) - dy2 * (x1 - x3)) / denom;
//     return { 
//       x: x1 + t0 * dx1,
//       y: y1 + t0 * dy1,
//       t0: t0
//     }
//   }   
  
 /**
  * Intersection between two rays
  * @param {Ray} r1   First ray
  * @param {Ray} r2   Second ray
  * @return {LineIntersection|null} 
  */
//   static lineLineIntersection(r1, r2) {
//     if(!foundry.utils.intersects(r1.A, r1.B, r2.A, r2.B)) { return null; }
//         
//     const res = MyClockwiseSweepPolygon.potentialIntersection(r1.A, r1.B, r2.A, r2.B);
//     if(!res) return null;
//     res.t0 = Math.clamped(res.t0, 0, 1); // just in case t0 is very near 0 or 1    
//     return res;
//   }
  
  
 /**
  * Identify the collision points between an emitted Ray and a set of active edges.
  * @param {Ray} ray                   The candidate ray to test
  * @param {EdgeSet} activeEdges       The set of active edges
  * @returns {PolygonVertex[]}         A sorted array of collision points
  * @private
  */
//   _getRayCollisions(ray, activeEdges) {
//     const collisions = [];
//     const keys = new Set();
// 
//     // Identify unique collision points
//     for ( let edge of activeEdges ) {
//       const x = MyClockwiseSweepPolygon.lineLineIntersection(ray, edge);
//       if ( !x || (x.t0 === 0) ) continue;
//       let c = PolygonVertex.fromPoint(x, {distance: x.t0});
//       if ( keys.has(c.key) ) {
//         c = keys.get(c.key);
//         c.attachEdge(edge);
//         continue;
//       }
//       keys.add(c.key);
//       c.attachEdge(edge);
//       collisions.push(c);
//     }
// 
//     // Sort collisions on proximity to the origin
//     collisions.sort((a, b) => a.distance - b.distance);
// 
//     // Add the ray termination
//     const t = PolygonVertex.fromPoint(ray.B, {distance: 1.0});
//     if ( !keys.has(t.key) ) collisions.push(t);
//     return collisions;
//   }


}