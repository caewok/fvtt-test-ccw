/* globals
foundry
*/
'use strict';

// Proposed rules:
// - a_start_index stays the same or increases.
// - b_start_index either stays the same or increase.
// - a_start_index begins at 0. 
// - b_start_index begins at 0.
// - a_end_index stays the same or increase, circling back to 0+.
// - b_end_index stays the same or increase, circling back to 0+.

export class ActiveEdges {
  constructor(sorted_vertices, origin, starting_idx = 0) {
    this.vertices = sorted_vertices;
    this.origin = origin;
    this.starting_idx = starting_idx;    
    this.start_indices = { A: undefined, B: undefined };
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
  values() {
    return this[Symbol.iterator]();
  } 
  
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
  reset() { 
    this.end_indices = { A: undefined, B: undefined }; 
    this.start_indices = { A: undefined, B: undefined };
  } 
  
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
  * Given a vertex index, get the set of possible active edges from the 
  * aEdges or bEdges queue. Search the aEdge queue in reverse; bEdge queue forward 
  * Any values between start index and the stored end index are automatically added.
  */
  activeEdges(vertex_idx, start_idx, type = "A") {
    const vertex = this.vertices[vertex_idx];
    const end_idx = this.end_indices[type];
    const origin = this.origin;
    const edges = this.edges[type];
    
    // add edges from start_idx to the past end index, not including the end index
    const active_edges = this._startingActiveEdgeSet(start_idx, end_idx, edges);
    start_idx = end_idx ?? start_idx;
    
    const countfn = type === "A" ? this.circleBackward : this.circleForward; 
    const test = type === "A" ? (orient => orient < 0) : (orient => orient > 0);
    
    this.start_indices[type] = start_idx;
    const ln = edges.length;
    for(let i = 0; i < ln; i += 1) {
      const idx = countfn(i, start_idx, ln);
    
      // orient2d returns positive for ccw
      // if A is ccw to o|v, A might be in the set of activeEdges
      // if B is cw to o|v, B might be in the set of activeEdges
      if(test(foundry.utils.orient2dFast(origin, vertex, edges[idx][type]))) {
        this.end_indices[type] = idx;
        return active_edges;
      }
  
      // add to set of possible active edges
      //console.log(`Adding ${edgeLabel(aEdges[idx])} to activeEdgesA`);
      active_edges.add(edges[idx]);
    }
    return active_edges;
  }
  
 /**
  * Construct the start set of active edges. 
  * Set includes edges between start index and end index, including the start but not the
  * end. Circles around if end is less than start. 
  * @param {number}           start_idx   Starting edge to use.
  * @param {number|undefined} end_idx     End edge to use or undefined for the blank set.
  * @param {PolygonEdges[]}   edges       Array of edges to use in constructing the set.
  * @return {Set<PolygonEdges>} Set of polygon edges, possible a null set.
  */
  _startingActiveEdgeSet(new_start_idx, edges, type = "A") {  
    let prior_end_idx = this.end_indices[type];
    const prior_start_idx = this.start_indices[type];
    const ln = this.vertices.length;
    
    if( (typeof end_idx === "undefined") ||  
        (typeof start_idx === "undefined")) {
      return { active_edges: new Set(), start_idx: new_start_idx };
    }
    
    if(type === "B") {
      // B vertices: circling forward.
      // For B type, the end index could wrap; revert to linear by adding ln if 
      // the end is less than the prior start
      if(prior_end_idx < prior_start_idx) { prior_end_idx += ln; }
    
      // assume for now it is possible for the start index to wrap as well
      if(new_start_idx < prior_start_idx) { new_start_idx += ln; }
      
    
      // now that everything is linear, if new start has passed the prior end, 
      // we want a null set
      if(new_start_idx >= prior_end_idx) {
        return { active_edges: new Set(), start_idx: new_start_idx % ln };
      }
       
      // otherwise, we want to add the intervening elements, which is a bit tricky 
      // b/c we might go past the end of the edge array
      if(prior_end_idx >= ln) {
        // we are past the end of the edge array
        const s = new Set(edges.slice(new_start_idx % ln));
        edges.slice(0, prior_end_idx % ln).forEach(e => s.add(e));
        return { active_edges: s, start_idx: new_start_idx % ln };
      } 
    }
    
    // type "A" vertices: circling backward
    if(prior_end_idx > prior_start_idx) { prior_end_idx += ln; }
    if(new_start_idx > prior_start_idx) { new_start_idx += ln; }
    
    // now that everything is linear, if new start is less than prior end,
    // we want a null set
    if(new_start_idx)
    
  }

   
  
 /**
  * Get the active edges given the index of the current vertex in the vertex queue. 
  */
  activeEdgeSet(vertex_idx) {
    const a_start_idx = this.startIndex(vertex_idx, "A");
    const b_start_idx = this.startIndex(vertex_idx, "B");
    
    const activeEdgesA = this.activeEdges(vertex_idx, a_start_idx, "A");
    const activeEdgesB = this.activeEdges(vertex_idx, b_start_idx, "B");
    
    // active edges are the intersection of the A and B sets.
    // but subtract out the cwEdges of the vertex, which are technically not yet
    // part of the active edge set
    
    const activeEdges = activeEdgesA.intersection(activeEdgesB);
    return activeEdges.diff(this.vertices[vertex_idx].cwEdges);
  }
}

Set.prototype.diff = function(other) {
  return new Set([...this].filter(x => !other.has(x)));
}

edgeLabel = function(edge) {
  const a = vertices.findIndex(v => v.key === edge.A.key) + 1;
  const b = vertices.findIndex(v => v.key === edge.B.key) + 1;
  return `${a}|${b}`;
}

listEdges = function(edgeArray, label = "") {
  edge_str = [];
  for(edge of edgeArray) {
    edge_str.push(edgeLabel(edge));
  }  
  console.log(`${label}${edge_str.join(', ')}`);
}