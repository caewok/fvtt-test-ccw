/* globals ClockwiseSweepPolygon, PolygonVertex, PolygonEdge, canvas, foundry */


class MyPolygonEdge extends PolygonEdge {
  constructor(...args) {
    super(...args);
    
  /**
   * Cache origin for the sweep.
   * Required for _endpointOrientation
   * @type {x, y}
   * @private
   */
   this._origin = undefined;
    
   /**
    * Cache the left and right endpoints in relation to origin.
    * @type {Object {left: CCWSweepPoint, right: CCWSweepPoint }}
    * @private
    */
    this._endpointOrientation = undefined;
  }
  
 /**
  * @param { x: number, y: number }
  */ 
  get origin() { return this._origin; } 
  
 /**
  * When setting origin, un-cache measurements that depend on it.
  * @param { x: number, y: number } value
  */
  set origin(value) {
    this._origin = value;
    this._endpointOrientation = foundry.utils.orient2dFast(this.A, this.B, value) > 0 ? 
          { left: this.B, right: this.A } : { left: this.A, right: this.B }
  } 
  
 /**
  * Get the point counterclockwise (left/start) in relation to the origin.
  * If in line with the origin, the closer point is the left/start point
  * Will be the starting point for the sweep.
  * Named 'left' and 'right' to avoid confusion with ccw/cw or start/end endpoint.
  * @return {PolygonVertex}
  */
  get leftEndpoint() {
    return this._endpointOrientation?.left;
  }
  
 /**
  * Get the point clockwise (right/end) in relation to the origin.
  * If in line with the origin, the further point is the right/end point
  * Will be the end point for the sweep.
  * Named 'left' and 'right' to avoid confusion with ccw/cw or start/end endpoint.
  * @return {PolygonVertex}
  */ 
  get rightEndpoint() {
    return this._endpointOrientation?.right;
  }
}

export class MyClockwiseSweepPolygon extends ClockwiseSweepPolygon {
  
  // use re-defined PolygonEdge class 
 _identifyEdges() {
    const {type, hasLimitedAngle, hasLimitedRadius} = this.config;

    // Add edges for placed Wall objects
    const walls = this._getWalls();
    for ( let wall of walls ) {
      if (!this.constructor.testWallInclusion(wall, this.origin, type)) continue;
      const edge = new MyPolygonEdge(wall.A, wall.B, wall.data[type]);
      this.edges.add(edge);
    }

    // Add edges for the canvas boundary
    this._addCanvasBoundaryEdges();

    // Restrict edges to a limited angle
    if ( hasLimitedAngle ) {
      this._restrictEdgesByAngle();
    }

    // Constrain edges to a limited radius
    if ( hasLimitedRadius ) {
      this._constrainEdgesByRadius();
    }
  }
  
  // use re-defined PolygonEdge class  
  _addCanvasBoundaryEdges() {

    // Define canvas endpoints
    const d = canvas.dimensions;
    const c0 = {x: 0, y: 0};
    const c1 = {x: d.width, y: 0};
    const c2 = {x: d.width, y: d.height};
    const c3 = {x: 0, y: d.height};

    // Add canvas edges
    this.edges.add(new MyPolygonEdge(c0, c1));
    this.edges.add(new MyPolygonEdge(c1, c2));
    this.edges.add(new MyPolygonEdge(c2, c3));
    this.edges.add(new MyPolygonEdge(c3, c0));
  }
  
  // use re-defined PolygonEdge class 
  _constrainEdgesByRadius() {
    const constrained = [];
    for ( let edge of this.edges ) {
      const x = foundry.utils.lineCircleIntersection(edge.A, edge.B, this.origin, this.config.radius);

      // Fully outside - remove this edge
      if ( x.outside ) {
        this.edges.delete(edge);
        continue
      }

      // Fully contained - include this edge directly
      if ( x.contained ) {
        continue;
      }

      // Partially contained - partition the edge into multiple edges
      const points = x.intersections;
      if ( x.aInside ) points.unshift(edge.A);
      if ( x.bInside ) points.push(edge.B);

      // Verify that we are only ever be creating a single segment
      if ( points.length > 2 ) {
        console.warn(`Degenerate polygon edge constraint detected!`);
        debugger;
      }
      this.edges.delete(edge);
      const c = new MyPolygonEdge(points[0], points[1], edge.type);
      if ( c.A.equals(c.B) ) continue;  // Skip partitioned edges with length zero
      constrained.push(c);
    }

    // Add new edges back to the set
    for ( let e of constrained ) {
      this.edges.add(e);
    }
  }
 
 // register the origin for each edge
 _identifyVertices() {
    const {hasLimitedAngle, rMin, rMax} = this.config;

    // Register vertices for all edges
    for ( let edge of this.edges ) {
      edge.origin = this.origin;
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

      // Add vertices for the endpoints of bounding rays
      const vMin = PolygonVertex.fromPoint(rMin.B);
      this.vertices.set(vMin.key, vMin);
      const vMax = PolygonVertex.fromPoint(rMax.B);
      this.vertices.set(vMax.key, vMax);
    }
  }
  
  /**
   * Partition the edges connected to a vertex into clockwise and counter-clockwise sets.
   * @param {Ray} ray                     The emitted ray being tested
   * @param {PolygonVertex} vertex        The targeted vertex
   * @returns {EdgeSet[]}                 Clockwise and counter-clockwise edges
   * @private
   */
  _partitionVertexEdges(ray, vertex) {
    const cwEdges = new Set();
    const ccwEdges = new Set();
    for ( let edge of vertex.edges ) {
      if(vertex.equals(edge.leftEndpoint)) cwEdges.add(edge);
      else ccwEdges.add(edge);
    }
    return [cwEdges, ccwEdges];
  }
 
}