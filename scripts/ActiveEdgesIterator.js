/* globals
foundry
*/
'use strict';

// Proposed rules:
// √ a_start_index stays the same or increases.
// √ b_start_index either stays the same or increase.
// √ a_start_index begins at 0. 
// √ b_start_index begins at 0.
// - a_end_index stays the same or increase, circling back to 0+.
// - b_end_index stays the same or increase, circling back to 0+.

// union of active edge sets doesn't work, where:
//   aEdges: From the current vertex or nearest prior A vertex, move backward.
//           Stop when an edge's B vertex is CCW. All intervening in active edge set.
//   bEdges: From the current vertex or nearest next B vertex, move forward.
//           Stop when an edge's A vertex is CW. All intervening in active edge set.
// Issue is that when scanning from the current vertex, 
// a short edge will have a CCW B vertex, while a longer edge (say, the canvas edge) 
// will still be active.

// Instead, must get the intersection of edges

export class ActiveEdges {
  constructor(sorted_vertices, origin, starting_idx = 0) {
    this.vertices = sorted_vertices;
    this.origin = origin;
    this.starting_idx = starting_idx;    
    this.end_indices = { A: undefined, B: undefined };
    this.edges = this._constructEdgeArrays();
  }
  
 /**
  * Iterate over the vertices, providing the active edge for each.
  * Optionally start at a given vertex.
  */
  [Symbol.iterator]() {
    const end = this.vertices.length;
    let vertex_idx = this.starting_idx;
    let counter = 0;
    const obj = this;
    return { 
      next: function() {
        if(vertex_idx < end) {
          const result = { value: obj.activeEdgeSet(vertex_idx), done: false }
          vertex_idx += 1;
          counter += 1;
          return result;
        }
        return { value: counter, done: true };
      },
      return: () => {
        obj.reset();
        return { value: undefined, done: true };
      }
    };    
  }
  
 /**
  * Get the iterator object containing the values for each activeEdge set
  * from starting_idx to the length of the vertices.
  */
  values() { return this[Symbol.iterator](); } 
  
 /**
  * Create aEdges and bEdges arrays. 
  * aEdges: edges sorted cw from first A vertex
  * bEdges: edges sorted cw from first B vertex
  * @private
  */ 
  _constructEdgeArrays() {
    const vertices = this.vertices;
    const ln = vertices.length;
    const aEdges = [];
    const bEdges = [];
    
    for(let i = 0; i < ln; i += 1) {
      if(vertices[i].cwEdges.size) { aEdges.push(...vertices[i].cwEdges); }
      if(vertices[i].ccwEdges.size) { bEdges.push(...vertices[i].ccwEdges); }
    }
    
    if(aEdges.length !== bEdges.length) { 
      console.warn(`ActiveEdges.Iterator._constructEdgeArrays|aEdges length (${aEdges.length}) ≠ bEdges length (${bEdges.length})`);
    }
    
    return { A: aEdges, B: bEdges };
  }  
 
 /**
  * Reset the stored indices for the class object.
  */
  reset() { this.end_indices = { A: undefined, B: undefined }; } 
  
/**
 * Helper functions to count from a start number in sequence 0 to n, 
 * circling back to 0 after n. 
 * When i === 0, this will return start.
 * @param {number} i
 * @param {number} start
 * @param {number} n
 * @return {number}
 */
 circleForward(i, start, n) { return (start + i) % n; }
 circleBackward(i, start, n) { return (start + (n - i)) % n; }

 /**
  * For aEdges, look for matching A vertex. 
  * If none found, look for previous sequential A vertex. 
  * For bEdges, look for matching B vertex. 
  * If none found, look for next sequential B vertex. 
  * Seems fastest to use findIndex without storing the past start index to check.
  * See https://jsbench.me/q2ky5argjw
  */
  startIndex(vertex_idx, type = "A") {
    const edges = this.edges[type];
    const vertices = this.vertices;
    const countfn = type === "A" ? this.circleBackward : this.circleForward;
    
    const ln = vertices.length;
    for(let i = 0; i < ln; i += 1) {
      const idx = countfn(i, vertex_idx, ln);
      const key = vertices[idx].key;
      const start_idx = edges.findIndex(edge => edge[type].key === key);
      if(start_idx !== -1) return start_idx;
    }
    return -1;
  }
    
 /**
  * Given a vertex index, get the set of active edges from the 
  * aEdges or bEdges queue. Search the aEdge queue in reverse; bEdge queue forward 
  * aEdges: From the current vertex or nearest prior A vertex, move backward.
  *         Stop when an edge's B vertex is CCW. All intervening in active edge set.
  * bEdges: From the current vertex or nearest next B vertex, move forward.
  *         Stop when an edge's A vertex is CW. All intervening in active edge set.
  *
  * As we progress forward in the vertex queue, the aEdge end index and bEdge end index
  * will both move forward. Thus, we can simply search forward from the last end index
  * if we have one available. Need to be careful about wrap-around, however.
  */
  activeEdges(vertex_idx, start_idx, type = "A") {
    const end_idx = this.end_indices[type];
    
    //if(typeof end_idx === "undefined") 
      return this._activeEdgesNewSearch(vertex_idx, start_idx, type);
  
    // with an end index, 
    // we can move forward until we pass the test, 
    // then add all edges between start index and end index.
    const test     = type === "A" ? this.aEdgeTest : this.bEdgeTest;
    const count_fn = this.circleForward;
    const edges = this.edges[type];
    const vertex = this.vertices[vertex_idx];
        
    const ln = edges.length;
    for(let i = 0; i < ln; i += 1) {
      const idx = count_fn(i, end_idx, ln);
      const edge = edges[idx];
      
      if(test.call(this, vertex, edge)) {
        this.end_indices[type] = idx;
        break;
      }
    }
    
    if(type === "A") {
      // get between end and start
      // inclusive of end index and start index
      return new Set(this.wrappedSlice(edges, this.end_indices[type], start_idx + 1));
    } else {
      // get between start and end
      // inclusive of end index and start index
      return new Set(this.wrappedSlice(edges, start_idx, this.end_indices[type] + 1));
    }  
  }    
    
  /**
   * Return a wrapped slice of array items.
   * If end is less than start, return start:ln and then 0:end.
   */
   wrappedSlice(arr, start, end) {
     const ln = arr.length;
     
     if(start === end) return [];
     
     // these checks may not be necessary for this class...
     if(end >= ln) end = end % ln;
     if(start >= ln) start = start % ln;
     
     if((typeof start === "undefined") || (typeof end === "undefined")) { 
       return arr.slice(start, end);
     }
     
     // no wrap necessary, so return a regular slice
     if(start < end) {
       return arr.slice(start, end);
     }
     
     // end is less than start, so we need to wrap
     return arr.slice(start, ln).concat(arr.slice(0, end));
   }
  
  /**
   * Test for whether an aEdge should be in active set.
   * We want to stop (return false) when we hit a ccw B vertex
   */
   aEdgeTest(vertex, edge) {
     const origin = this.origin;
     // orient2d returns positive for ccw
     return foundry.utils.orient2dFast(origin, vertex, edge.B) < 0;
   }

  /**
   * Test for whether an bEdge should be in active set.
   * We want to stop (return false) when we hit a cw A vertex
   */
   bEdgeTest(vertex, edge) {
     const origin = this.origin;
     return foundry.utils.orient2dFast(origin, vertex, edge.A) > 0;
   }
  
  /**
   * No end index available, so search from start either forward or back, adding to 
   * active set as we go.
   */
  _activeEdgesNewSearch(vertex_idx, start_idx, type = "A") {
    const countfn = type === "A" ? this.circleBackward : this.circleForward; 
    const test = type === "A" ? this.aEdgeTest : this.bEdgeTest;
    const edges = this.edges[type];
    const vertex = this.vertices[vertex_idx];
    const active_edges = new Set();
        
    const ln = edges.length;
    for(let i = 0; i < ln; i += 1) {
      const idx = countfn(i, start_idx, ln);
      const edge = edges[idx];
      
      if(!test.call(this, vertex, edge)) {
        // we have reached the end of active edges in this direction
        // mark the immediately prior edge as the last true
//         this.end_indices[type] = type === "A" ? (idx + 1) % ln : idx - 1;
//         if(this.end_indices[type] < 0) { this.end_indices[type] += ln; }
        this.end_indices[type] = idx;
        return active_edges;
      }
      
      // add to set of possible active edges
      active_edges.add(edge);
    }
    return active_edges; // should probably never hit this
  }
    
 /**
  * Get the active edges given the index of the current vertex in the vertex queue. 
  */
  activeEdgeSet(vertex_idx) {
    const a_start_idx = this.startIndex(vertex_idx, "A");
    const b_start_idx = this.startIndex(vertex_idx, "B");
    
    const activeEdgesA = this.activeEdges(vertex_idx, a_start_idx, "A");
    const activeEdgesB = this.activeEdges(vertex_idx, b_start_idx, "B");
    
    // active edges are the union of the A and B sets.
    // but subtract out the cwEdges of the vertex, which are technically not yet
    // part of the active edge set
    
    const activeEdges = activeEdgesA.union(activeEdgesB);
    return activeEdges.diff(this.vertices[vertex_idx].cwEdges);
  }
  
  // -------------- DEBUGGING ----------------------------- //
  
 /**
  * Provide a label for the edge corresponding to ClockwiseSweep visualization,
  * whereby the first vertex is labeled 1. Edge with vertex 0 for A and vertex 1 
  * for B would therefore be labeled 1|2. 
  * @param {PolygonEdge} edge   Edge to label.
  * @return {string} Label in form of A|B.
  */ 
  edgeLabel(edge) {
    if(!edge) return ``;
    const a = this.vertices.findIndex(v => v.key === edge.A.key) + 1;
    const b = this.vertices.findIndex(v => v.key === edge.B.key) + 1;
    return `${a}|${b}`;
  }

 /**
  * Provide labels for an array of edges, using the edgeLabel method for each.
  * Print the array labels to console with provided label, if any.
  * @param {PolygonEdge[]}  edgeArray   Array of edges to label.
  * @param {string}         label       Prefix label to use in the console output.
  */
  listEdges(edgeArray, label = "") {
    const edge_str = [];
    for(const edge of edgeArray) {
      edge_str.push(this.edgeLabel(edge));
    }  
    console.log(`${label}${edge_str.join(', ')}`);
  }
}

Set.prototype.diff = function(other) {
  return new Set([...this].filter(x => !other.has(x)));
}

Set.prototype.union = function(other) {
  return new Set([...this, ...other]);
}
