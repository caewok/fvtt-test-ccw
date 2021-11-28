export class MyClockwiseSweepPolygon extends ClockwiseSweepPolygon {

  _restrictEdgesByAngle() {
    console.log(`MyClockwiseSweepPolygon`);
  
    const {rMin, rMax} = this.config;
    const constrained = [];
    for ( let edge of this.edges ) {
      
      // Parallels _constrainEdgesByRadius
      edge.A._inLimitedAngle = this.constructor.pointBetweenRays(edge.A, rMin, rMax);
      edge.B._inLimitedAngle = this.constructor.pointBetweenRays(edge.B, rMin, rMax);
      
      // Fully contained – include this edge directly
      if( edge.A._inLimitedAngle && edge.B._inLimitedAngle ) continue;
      
      // If both vertices are outside, test whether the edge collides with one (either) 
      // of the limiting rays
      const intersectsMin = foundry.utils.lineSegmentIntersects(rMin.A, rMin.B, edge.A, edge.B);
      const intersectsMax = foundry.utils.lineSegmentIntersects(rMax.A, rMax.B, edge.A, edge.B);
      
      if ( !(intersectsMin || intersectsMax) ) {
        // Fully outside – remove this edge
        this.edges.delete(edge);
        continue;
      }
  
      

      // Partially contained -- partition the edge into the constrained segment  
      // TODO: Does this still order the points correctly if we reverse where A and B are on the edge?
      
      const xMin = intersectsMin ? foundry.utils.lineLineIntersection(rMin.A, rMin.B, edge.A, edge.B) : null;
      const xMax = intersectsMax ? foundry.utils.lineLineIntersection(rMax.A, rMax.B, edge.A, edge.B) : null;
         
      const points = [];
      if(xMin) points.push(xMin);
      if(xMax) points.push(xMax);
      
      if(edge.A._inLimitedAngle) points.unshift(edge.A);
      if(edge.B._inLimitedAngle) points.push(edge.B);
      
      // Create a partitioned segment
      this.edges.delete(edge);
      const c = new PolygonEdge(points.shift(), points.pop(), edge.type, edge.wall);
      if ( c.A.equals(c.B) ) continue;  // Skip partitioned edges with length zero
      constrained.push(c);
    }
    
   // Add new edges back to the set
   for ( let e of constrained ) {
      this.edges.add(e);
   } 
  }
  
  _identifyVertices() {
    const {hasLimitedAngle, rMin, rMax} = this.config;
    const wallEdgeMap = new Map();

    // Register vertices for all edges
    for ( let edge of this.edges ) {

      // Get unique vertices A and B
      const ak = edge.A.key;
      if ( this.vertices.has(ak) ) edge.A = this.vertices.get(ak);
      else this.vertices.set(ak, edge.A);
      const bk = edge.B.key;
      if ( this.vertices.has(bk) ) edge.B = this.vertices.get(bk);
      else this.vertices.set(bk, edge.B);

      // Learn edge orientation with respect to the origin
      const o = foundry.utils.orient2dFast(this.origin, edge.A, edge.B);

      // Ensure B is clockwise of A
      if ( o > 0 ) {
        let a = edge.A;
        edge.A = edge.B;
        edge.B = a;
      }

      // Attach edges to each vertex
      edge.A.attachEdge(edge, -1);
      edge.B.attachEdge(edge, 1);

      // Record the wall->edge mapping
      if ( edge.wall ) wallEdgeMap.set(edge.wall.id, edge);
    }

    // Add edge intersections
    this._identifyIntersections(wallEdgeMap);

    // For limited angle polygons, restrict vertices
    if ( hasLimitedAngle ) {
      // now dealt with by _restrictEdgesByAngle 
      // for ( let vertex of this.vertices.values() ) {
//         if ( !vertex._inLimitedAngle ) this.vertices.delete(vertex.key);
//       }

      // Add vertices for the endpoints of bounding rays
      const vMin = PolygonVertex.fromPoint(rMin.B);
      this.vertices.set(vMin.key, vMin);
      const vMax = PolygonVertex.fromPoint(rMax.B);
      this.vertices.set(vMax.key, vMax);
    }
  }

  
  _executeSweep() {
    const origin = this.origin;
    const { radius2, hasLimitedAngle } = this.config;

    // Initialize the set of active walls
    let activeEdges = this._initializeActiveEdges();

    // Sort vertices from clockwise to counter-clockwise and begin the sweep
    const vertices = this._sortVertices();
    for ( const [i, vertex] of vertices.entries() ) {

      // Construct a ray towards the target vertex
      vertex._index = i+1;
      const ray = Ray.towardsPointSquared(origin, vertex, radius2);
      this.rays.push(ray);

      // Determine whether the target vertex is behind some other active edge
      const {isBehind, wasLimited} = this._isVertexBehindActiveEdges(ray, vertex, activeEdges);

      // Construct the CollisionResult object
      const result = ray.result = new CollisionResult({
        target: vertex,
        cwEdges: vertex.cwEdges,
        ccwEdges: vertex.ccwEdges,
        isLimited: vertex.isLimited,
        isRequired: false,//hasLimitedAngle && ((i === 0) || (i === vertices.length-1)),
        isBehind,
        wasLimited
      });

      // Delegate to determine the result of the ray
      this._determineRayResult(ray, vertex, result, activeEdges);

      // Update active edges for the next iteration
      this._updateActiveEdges(result, activeEdges);
    }
  }
  
}