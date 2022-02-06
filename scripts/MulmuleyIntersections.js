/* globals
canvas,
foundry,
PIXI,
CONFIG,
_pixi_graphics_smooth
*/

'use strict';

// https://pdf.sciencedirectassets.com/272313/1-s2.0-S0747717108X80629/1-s2.0-S0747717108800648/main.pdf

// MULMULEY Algorithm
// J. Symbolic Computation (1990),10,253-280


// 1. Extend a vertical segment "attachment" from each endpoint in either direction until it hits the canvas border. This is G0.

// 2. Randomly select an input segment and add it to the partition to get G1.
// Keep randomly adding segments until done


// Definitions
// Partition: Set of segments and vertical lines through segments.
// Attachment: For a vertical line through an endpoint, where the line meets the 
//             segment or canvas edge above or below. 
// Vertex v of the partition: 
//   (1) endpoint of an input segment
//   (2) point of intersection
//   (3) point of attachment
//   (4) corner of the canvas
// Face: Space bounded by vertical lines and/or segments on all sides. 
// Boundary: Boundary of Face R, represented as ∂R. The vertical lines and/or segments
//           enclosing the face.
// Visible: Vertex v is visible when in the face R if ∂R has a tangent discontinuity at v.
//          (i.e., the line running through v is not a straight line, but breaks at v)

// import { compareXY, randomPositiveZeroInteger } from "./utilities.js";

// function randomPositiveZeroInteger(max) {
//   return Math.floor(Math.random() * max)
// }

/* more consistent rules for building segment faces

(assume a top face; reverse for bottom)
Goal is to set up all but the closing adjacencies
Opening at an attachment-segment vertex
v0 = ix
- Follow the face successors until reaching the x coordinate for the next_v.
- Don't include that last vertex because it might be skipped in next iteration
- Trick is finding the first vertex on the face to follow
Simple Face:
- for the current v, get the attachment.
- test for face match?
- next vertex on face will be the attachment at next_v; stop

Face with endpoint
- for the current v, get the attachment, which should be at the endpoint?
- next vertex on face either at next_v x coordinate (stop) or a processed intersection (add)

closing
v0 = ix
- Situations where we need more than ix?
- need to get that closing attachment
- can we walk face predecessors until we reach the last point?
- or should we just aim for the attachment?





*/


function compareXY(a, b) { 
  return ( a.x - b.x ) || (a.y - b.y );
}

// Used in Partition.addSegment; LEFT/RIGHT in _buildSegmentIntersectionFaces
const BOTTOM = 0;
const TOP = 1;
const LEFT = 2;
const RIGHT = 3;

class Vertex {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    //this.successor = new Map(); // keyed by face
    //this.neighbor = new Map();  // keyed by face
  }
  
  get key() {
    return this._key ?? ( this._key = Vertex.keyFromPoint(this) );
  }
  
  get label() {
    return `${this.x},${this.y}`;
  }
  
  static keyFromPoint(p) { return (p.x << 16) ^ p.y;}
  
  static fromPoint(p) { return new this(p.x, p.y); }
  
  draw({ color = COLORS.red, alpha = 1, radius = 5 } = {}) {
    canvas.controls.debug
      .beginFill(color, alpha)
      .drawCircle(this.x, this.y, radius)
      .endFill();
  }
  
  static drawPoint(p, { color = COLORS.red, alpha = 1, radius = 5 } = {}) {
    Vertex.fromPoint(p).draw({ color, alpha, radius })
  }
  
  equals(other) { return this.key === other.key; }
}

class Segment {
  constructor(a, b) {
    this.A = new Vertex(a.x, a.y);
    this.B = new Vertex(b.x, b.y);
  }
  
  get slope() {
    return this._slope ?? (this._slope = (this.B.y - this.A.y) / (this.B.x - this.A.x));
  }
  
  get y_intercept() {
    return this._y_intercept ?? (this._y_intercept = this.A.y - this.slope * this.A.x);
  
  }
  
  get min_xy() {
    if(!this._min_xy) {
      const first_is_min = compareXY(this.A, this.B) < 0;
      this._min_xy = first_is_min ? this.A : this.B;
      this._max_xy = !first_is_min ? this.A : this.B; // will use later
    }
    return this._min_xy;
  }
  
  get max_xy() {
    if(!this._max_xy) { this.min_xy; }
    return this._max_xy;
  }
  
  get label() {
    return `${this.A.label} | ${this.B.label}`;
  }
  
  calculateY(x) {
    return this.slope * x + this.y_intercept;
  }
  
  static fromEdge(e) { return new this(e.A, e.B); }
  
  // color, alpha, width, possibly others
  draw(opts = {}) {
    opts.color = opts.color ?? COLORS.blue;
    opts.alpha = opts.alpha ?? 1;
    opts.width = opts.width ?? 5;
  
    //canvas.controls.debug.lineStyle(width, color, alpha).
    canvas.controls.debug.lineStyle(opts).
        moveTo(this.A.x, this.A.y).
        lineTo(this.B.x, this.B.y);    
  }
  
  static drawEdge(e, opts = {}) {
    opts.color = opts.color ?? COLORS.blue;
    opts.alpha = opts.alpha ?? 1;
    opts.width = opts.width ?? 5;

    Segment.fromEdge(e).draw(opts);
  }
  
}

class Face {
  constructor({ orientation = TOP } = {}) {
    this.adjacencies = [];
    
//     this._isOpen = undefined; // true if open, false if closed, undefined at start.
    this.orientation = orientation; // TOP or BOTTOM
  }
  
  get label() {
    const str = [];
    this.adjacencies.forEach(adj => str.push(`${adj.label}`));
    return str.join(` ->> `);
  }
  
  _linkAdjacencies() {
    // successors are in order of the array, looping around to beginning
    // also set the face for each adjacency.
    const adjs = this.adjacencies;
    const ln = adjs.length;
    for(let i = 0; i < ln; i += 1) {
      const next_i = (i + 1) % ln;
      adjs[i].successor = adjs[next_i];
      adjs[next_i].predecessor = adjs[i];
      adjs[i].face = this;
    }    
  }
  
  
  /*
  Open:
  v0: The new crossing to add, where vertical attachment line crosses s.
  attachment: link to the endpoint attachment
  target: next_v, indicting the face to be traced and the x value to reach
  
1. Add v0.
2. Add attachment and any subsequent (successor/predecessor) vertex until reaching 
   the target x
   
   --> confirm that the attachments are moved to the nearest processed endpoint, 
   meaning attachment is in fact the first point and we don't have to go looking for it.
  
  Close:
  v0: The new crossing to add to close.
  attachment: link to the endpoint attachment. May be undefined for intersections.
  
1. Add attachment. 
2. Add v0
3. Reverse points if BOTTOM

--> confirm that the attachment is the correct one to add and we don't need to go 
    looking for it.
--> confirm that we don't need more than one attachment/vertex to add here.
  */
  
  openSuccessor(v0, v1, x) {
    if(!x) { console.error(`Expected x value.`); }
    if(this.orientation === TOP) {
      this.adjacencies.push(v0);
    }
    
    while(v1.successor.x > x) {
      v1 = v1.successor;
      this.adjacencies.push(v1);    
    } 
    
    if(this.orientation === BOTTOM) {
      this.adjacencies.push(v0);
      this.adjacencies.reverse();
    } 
  
  }
  
  
  
  open(v0, v1, x) {
    this.adjacencies.push(v0);    
    if(!x) { console.error(`Expected x value.`); }
    const dir = this.orientation === TOP ? "successor" : "predecessor";
    
    while(v1[dir].x > x) {
      v1 = v1[dir];
      this.adjacencies.push(v1);    
    }    
    
  }
  
  _findAttachment(v, matching_face) {
    const endpoint = v.endpoint || v.neighbor.endpoint;
    if(endpoint && endpoint.neighbor && v.face !== matching_face) {
      // if the endpoint has a neighbor vertex, then we must use that instead
      // if that vertex shares this face
      // (means the endpoint has been processed and blocks on this side)
      
      v = endpoint.neighbor.matchFace(undefined, matching_face);
      
      //if(endpoint.neighbor && endpoint.neighbor.face === ) { return endpoint.neighbor}
    
       // otherwise, if we are at an attachment, we are done
      
    } 
    
    if(v.face !== matching_face) {
        // likely starting a new face where a process line above/below s
        // is ending. Need to get past that endpoint to the attachment 
        v = v.endpoint.attachments[this.orientation].matchFace(undefined, matching_face);
    }
      
    return v; 
    
    // how about points after the initial intersection or endpoint?
  
  }
  
//   _findAttachment(v) {
//     if(!v.endpoint?.attachments) { 
//       return v;  // intersection or attachment;
//     }
//     
//     const closing_v = v;    
//     v = v.endpoint.attachments[this.orientation];
//     if(closing_v.face && v.face !== closing_v.face) { 
//       // need to use the endpoint vertex instead
//       v = closing_v.endpoint.neighbor; 
//     }
//     return v;
//   }

  matchFace(v) {
    if(v.face === this) return v;
    
    let neighbor = v.neighbor;  
    while(neighbor.face !== this && neighbor !== v) {
      neighbor = neighbor.neighbor;
    }
    
    if(neighbor === v) {
      console.warn(`matchFace for face ${this.label} and v ${v.label} did not find a match.`);
    }
    
    return neighbor;
  }
  
  close(v0, closing_v) {
    const adjs = this.adjacencies;
//     this._isOpen = false;
    
    if(closing_v) { adjs.push(closing_v); }
    
    adjs.push(v0);
    
    // if this is a BOTTOM face relative to the creating segment, then 
    // the adjacencies must be reversed.
    if(this.orientation === BOTTOM) adjs.reverse();
    
    this._linkAdjacencies();
  }
  
  static open(...pts) {
    const f = new Face();
    f.adjacencies.push(...pts);
    return f;
  }
  
  
  static create(...pts) {
    const f = new Face();
    f.adjacencies.push(...pts);
    f._linkAdjacencies();
    return f;
  }
  
  consistencyTest({ test_neighbor = false, 
                    test_successor = false, 
                    test_face = false } = {}) {    
    // face adjacency successors should all be in face, form a circle
    const adjs = [...this.adjacencies.values()];
    const ln = adjs.length;
    for(let i = 0; i < ln; i += 1) {
      const next_i = (i + 1) % ln;
      const adj = adjs[i];
      
      
      if(!adj.consistencyTest({test_neighbor, test_successor, test_face})) {
        console.error(`adj ${adj.label} fails consistency test.`, adj, this);
        return false;
      }
      
      // face adjacency successors should all be in face
      if(!this.adjacencies.includes(adj.successor)) {
        console.error(`adj ${adj.label} successor ${adj.successor.label} not in face.`, adj, this);
        return false;
      }
      
      // face adjacency successors should all be in face
      if(!this.adjacencies.includes(adj.predecessor)) {
        console.error(`adj ${adj.label} predecessor ${adj.predecessor.label} not in face.`, adj, this);
        return false;
      }
      
      // face adjacency successors should form counterclockwise simple poly
      if(adj.successor !== adjs[next_i]) {
        console.error(`adj ${adj.label} successor ${adj.successor.label} not in order. Next in face is ${adjs[next_i].label}.`, adj, this);
        return false;
      }
      
      if(foundry.utils.orient2dFast(adj, 
           adj.successor, adj.successor.successor) <= 0) {
        console.error(`adj ${adj.label} successors ${adj.successor.label} and ${adj.successor.successor.label} not ccw.`, adj, this);
        return false;            
      }
            
      // face adjacency predecessors should form clockwise simple poly
      if(adjs[next_i].predecessor !== adj) {
        console.error(`adj ${adjs[next_i].label} predecessor ${adjs[next_i].predecessor.label} not in order. Prior in face is ${adj.label}.`, adj, this);
        return false;
      }
   
      if(foundry.utils.orient2dFast(adj, 
           adj.predecessor, adj.predecessor.predecessor) >= 0) {
        console.error(`adj ${adj.label} predecessors ${adj.predecessor.label} and ${adj.predecessor.predecessor.label} not cw.`, adj, this);
        return false;            
      }   

    }
    
    return true;
  }
  

  
  traverseRight(v, s) {
    const max_xy = s.max_xy;
    const min_xy = s.min_xy;

    if(!(v instanceof Adjacency)) {
      console.error(`Need to convert Vertex to Adjacency for Face.traverse.`);
    }
    
    if(v.face !== this) {
      console.error(`Face.traverse v does not have this face.`);
    }
    
    const ln = this.adjacencies.length;
    let i = 0;
    let curr = v;
    while(i < ln && foundry.utils.orient2dFast(max_xy, min_xy, curr) > 0) {
      curr = curr.successor;
      i += 1;
    }   
    
    return curr;
  
  }
  
  traverse(v, s) {
    if(!(v instanceof Adjacency)) {
      console.error(`Need to convert Vertex to Adjacency for Face.traverse.`);
    }
    
    if(v.face !== this) {
      console.error(`Face.traverse v does not have this face.`);
    }
  
    const max_xy = s.max_xy;
    const min_xy = s.min_xy;
  
    const ln = this.adjacencies.length;
    let i = 0;
        
    // start with an adjacency to the right of s
    let curr = this.traverseRight(v, s);
    
    // now find the first adjacency to the left of s
    let successor = curr.successor;
    while(i < ln && foundry.utils.orient2dFast(max_xy, min_xy, successor) < 0) {
      curr = successor
      successor = curr.successor;
      i += 1;
    }
        
    return [curr, successor];
  }
  
  
  static transition(left, right, s) {
    if(!(left instanceof Adjacency) || !(right instanceof Adjacency)) {
      console.error(`Need to convert to Adjacency for Face.traverse.`);
    }
    
    const max_xy = s.max_xy;
    const min_xy = s.min_xy;
    
    // is left|right vertical and associated with the same endpoint? 
    // then we have a vertical attachment
    const l_endpoint = left.endpoint || left.neighbor.endpoint;
    const r_endpoint = right.neighbor.endpoint || right.endpoint;    
    
    if(left.x === right.x && l_endpoint === r_endpoint) {
      // left|right is vertical, with right at the top
      // so, what is the fastest way to calculate x,y point on S at a known x value?
      // y = mx + b; b = y - mx
      // works unless s is vertical...
      if(!isFinite(s.slope)) {
        console.error(`transition currently requires finite slope (non-vertical) s.`);
      }
      const new_y = s.calculateY(l_endpoint.x);
      const e_is_left = foundry.utils.orient2dFast(max_xy, min_xy, l_endpoint) > 0;
      
      // next_v provides a vertex with the next face, after s crosses through left|right
      return {
        next_v: e_is_left ? right.neighbor : left.neighbor,
        is_left: e_is_left,
        ix: new Vertex(l_endpoint.x, new_y)
      }      
    }
    
   
    
    // we are crossing a segment: right|left.
    // mark the intersection
    const ix = foundry.utils.lineLineIntersection(max_xy, min_xy, left, right);
    if(!ix) {
      console.error(`Transition expected an intersection at ${max_xy.label} | ${min_xy.label} x ${left.label} | ${right.label}`);

    }  
    
    // walk along the segment right|left to the left, turning around at the endpoint
    // and find the first vertex on the other "side" that is to the right of S.
    // one approach is to use 
    // use the intersection to determine if each successor is ccw or cw.
    // but likely faster to compare x-coordinate of the point with the intersection.
    // see discussion at Mulmuley p. 261–62.
    let h = left.neighbor;
    
    const ln = 1000; // to prevent infinite loops while debugging
    let i = 0;
    
    const s0_below = min_xy.y < left.segment.min_xy.y;
    //const s_rising = max_xy.y > ix.y; // 
    console.log(`Transition: s0 is ${s0_below ? "below" : "above"} other right endpoint.`);
    
    //while(i < ln && foundry.utils.orient2dFast(max_xy, min_xy, successor) > 0) {
    if(s0_below) {
      while(i < ln && h.successor.x < ix.x) {
        h = h.successor.neighbor;
        i += 1;
      }   
    } else {
      while(i < ln && h.successor.x > ix.x) {
        h = h.successor.neighbor;
        i += 1;
      }   
    }
        
//     const e_is_left = foundry.utils.orient2dFast(max_xy, min_xy, r_endpoint) > 0;
     
    return {
      next_v: s0_below ? h.successor : h,
      ix: new Vertex(ix.x, ix.y),
      s0_below: s0_below
    };
  }
  
  draw({ color = COLORS.lightblue, alpha = 0.25} = {}) {
    // draw as polygon, using vertices
    const pts = [];
    let i = 0;
    const ln = this.adjacencies.length;
    const v0 = this.adjacencies[0];
    pts.push(v0.x, v0.y);
    let curr = v0.successor;
    while(i < ln && !curr.equals(v0)) {
      i += 1;
      pts.push(curr.x, curr.y);
      curr = curr.successor;
    }
    
    const poly = new PIXI.Polygon(...pts);
    canvas.controls.debug.beginFill(color, alpha).drawShape(poly).endFill();
  }
  
//   addVertex(p) {
//     if(!(p instanceof Vertex)) p = Vertex.fromPoint(p);
//     this.vertices[this.vertices.length - 1]._next = p;
//     this.vertices.push(p);
//   }
  
}

class Adjacency extends Vertex {
  constructor(x, y, { face = undefined, 
                      neighbor = undefined, 
                      successor = undefined } = {}) {
    super(x, y);
  
    this.face = face;
    this.neighbor = neighbor;
    this.successor = successor;
  }
  
  static fromVertex(v, face, neighbor, successor) {
    return new this(v.x, v.y, face, neighbor, successor);
  }
  
  setNeighbor(other) {
    if(!other.equals(this)) {
      console.error(`Attempting to set neighbor for ${this.label} to ${other.label}!`);
    }
    other.neighbor = this;
    this.neighbor = other;
  }
  
  matchFace(other_v, other_face) {
    if(!other_face) { other_face = other_v.face; }
    let curr_v = this.neighbor;
    
    let i = 0;
    const max_i = 100;
    while(i < max_i && curr_v && curr_v !== this) {
      if(curr_v.face === other_face) break;
      curr_v = curr_v.neighbor;
      i += 1;
    }
    return curr_v;
  }
  
  traverseRight(s) {
    // traverse to the right of s around this adjacency's face.
    return this.face.traverseRight(this, s);
  }
  
  traverse(s) {
    // traverse from where the segment intersects this adjacency's face to the right to
    // where the segment intersects this adjacency's face to the left.
    return this.face.traverse(this, s);
  }
  
  consistencyTest({test_neighbor = false, test_successor = false, test_face = false} = {}) {
    // has face, neighbor, successor
    if(!this.face) {
      console.error(`${this.label} has no face.`, this);
      return false;
    }
    
    if(!this.neighbor) {
      console.error(`${this.label} has no neighbor.`, this);
      return false;
    }
    
   if(!this.successor) {
      console.error(`${this.label} has no successor.`, this);
      return false;
   }
   
   // don't pass through test_neighbor to avoid infinite loop
   if(test_neighbor && !this.neighbor.consistencyTest()) {
      console.error(`Neighbor ${this.neighbor.label} failed.`, this);
      return false;    
   }
   
   // don't pass through test_successor to avoid infinite loop
   if(test_successor && !this.successor.consistencyTest()) {
      console.error(`Successor ${this.successor.label} failed.`, this);
      return false;    
   }
     
   // don't pass through test_face to avoid infinite loop  
   if(test_face && !this.face.consistencyTest()) {
      console.error(`Face ${this.face.label} failed.`, this);
      return false;    
   }
      
   // neighbor should have the same location
   if(!this.equals(this.neighbor)) {
      console.error(`${this.label} has neighbor ${this.neighbor.label}.`, this);
      return false;     
   }
   
   // neighbor should have different face
  if(this.face === this.neighbor.face) {
      console.error(`${this.label} has neighbor ${this.neighbor.label} with different face.`, this);
      return false;     
   }
   
   // successor should share the same face
   if(this.face !== this.successor.face) {
      console.error(`${this.label} with face ${this.face.label} has successor with different face ${this.successor.face.label}.`, this);
      return false;     
   }
   
   // successor should have different vertex
    if(this.equals(this.successor)) {
      console.error(`${this.label} has successor ${this.successor.label}.`, this);
      return false;     
   }  
   
   // this face should have this adjacency
   if(!this.face.adjacencies.includes(this)) {
      console.error(`Face ${this.face.lablel} for ${this.label} does not have this adjacency.`, this);
      return false;         
   }
   
   // this face should have this successor
   if(!this.face.adjacencies.includes(this.successor)) {
      console.error(`Face ${this.face.label} for ${this.label} does not have successor ${this.successor.label}.`, this);
      return false;         
   }
   
   // if there is an endpoint...
   if(!this.endpoint) return true;

   // should be able to go adj ->> endpoint ->> attachment ->> adj
//    if(!(this.endpoint.attachments.top.equals(this) || 
//         this.endpoint.attachments.bottom.equals(this))) {
//       console.error(`${this.label} endpoint ${this.endpoint.label} attachment top ${this.endpoint.attachments.top.label} or bottom ${this.endpoint.attachments.bottom.label} does not match.`, this);
//       return false;         
//    }   
   
   // endpoint must be between the attachments vertically
//    if(this.endpoint.attachments[BOTTOM].y < this.endpoint.y) {
//      console.error(`${this.label} endpoint ${this.endpoint.label} bottom attachment ${this.endpoint.attachments[BOTTOM].label} is misplaced.`);
//      return false;
//    }
//    
//   if(this.endpoint.attachments[TOP].y > this.endpoint.y) {
//      console.error(`${this.label} endpoint ${this.endpoint.label} top attachment ${this.endpoint.attachments[TOP].label} is misplaced.`);
//      return false;
//    }
   
   return true;
  } 

}

class Partition {
  constructor(segments) {
    this.intersections = []; // to track intersections found
    this.segments = new Map();
//     this.faces = new Set();
    this.adjacencies = new Map();
    
    const endpoints = [];
    segments.forEach((s, i) => {
      const new_s = Segment.fromEdge(s);
    
      // track segments for intersection reporting
      const e1 = new_s.A;
      const e2 = new_s.B;
      e1.segment = new_s;
      e2.segment = new_s;
      
      new_s._index = i; // for drawing/debugging
    
      endpoints.push(e1, e2); 
      this.segments.set(i, new_s);
    });
    endpoints.sort(compareXY);
    this.endpoints = endpoints;
    
    // keep a set of partitioned_segments for quick look-up
    this.partitioned_segments = new Set();
    
    // to save effort and make debugging easier, randomly generate 
    // process order in advance
    this.process_queue = Array.fromRange(this.segments.size);
    this.process_queue.sort(() => Math.random() - 0.5);
  }
  
  get faces() {
    const faces = new Set()
    this.adjacencies.forEach(adj => faces.add(adj.face));
    return faces;
  }
  
  
  _buildAdjacencies(adjs, face) {
    //this.faces.add(face);
  
    adjs.forEach(adj => this.adjacencies.set(adj.key, adj));
    adjs.forEach(adj => adj.face = face);
    
    face.adjacencies = new Set(adjs);
    
    // successors are in order of the array, looping around to beginning
    const ln = adjs.length;
    for(let i = 0; i < ln; i += 1) {
      const next_i = (i + 1) % ln;
      adjs[i].successor = adjs[next_i];
    }
    
    // neighbors are unknown
  }
  
  _buildNewFace(vertices) {
    const f = new Face();
    
    vertices = vertices.map(v => {
      if(v instanceof Adjacency) {
        v.face = f;
        return v;
      }
      return Adjacency.fromVertex(v, f)
    });
    
    this._buildAdjacencies(vertices, f);
    
    return { face: f, adjacencies: vertices };
  }
    
  initialize() {
    const x_left = 0;
    const x_right = canvas.dimensions.width;
     
    const y_top = 0;
    const y_bottom = canvas.dimensions.height;
    
    // Assume we are treating the bottom of the canvas as a segment.
    // Each face created is a "TOP" face, with adjacencies going from 
    // bottom right --> top right --> top left --> bottom left
    // bottom right and top right are on the vertical line for the endpoint
    
    // initial face is outside the canvas
    // (or the entire canvas, depending on how you look at it)
    // Here, we will pretend we are starting in the lower right corner to follow
    // the same sequence as above
    const ADJS = { br: 0, tr: 1, tl: 2, bl: 3 };    
    const initial_face = Face.create(new Adjacency(x_right, y_bottom),
                                     new Adjacency(x_right, y_top),
                                     new Adjacency(x_left, y_top),
                                     new Adjacency(x_left, y_bottom));
                                   
    initial_face.adjacencies.forEach(adj => this.adjacencies.set(adj.key, adj));    
                        
    let prior_top = initial_face.adjacencies[ADJS.tl];            
    let prior_bottom = initial_face.adjacencies[ADJS.bl];
    
    // move left-to-right through sorted endpoints
    this.endpoints.forEach(e => {      
      // can skip opening and just supply the 4 adjacencies in order
      const f = Face.create(new Adjacency(e.x, y_bottom),
                            new Adjacency(e.x, y_top),
                            Adjacency.fromVertex(prior_top),
                            Adjacency.fromVertex(prior_bottom));
            
      // set the neighbors for the left side
      f.adjacencies[ADJS.tl].setNeighbor(prior_top);
      f.adjacencies[ADJS.bl].setNeighbor(prior_bottom);  

      // set the endpoint links for the adjacencies
      // attachments point to the left face
      e.attachments = [ f.adjacencies[ADJS.br], f.adjacencies[ADJS.tr]]; // BOTTOM, TOP
      f.adjacencies[ADJS.br].endpoint = e;
      f.adjacencies[ADJS.tr].endpoint = e;
                  
      prior_top = f.adjacencies[ADJS.tr];        
      prior_bottom = f.adjacencies[ADJS.br];
      
      this.adjacencies.set(prior_top.key, prior_top);
      this.adjacencies.set(prior_bottom.key, prior_bottom);                           
    });
         
    // construct the face between the right endpoint and the canvas edge
    const initial_top = initial_face.adjacencies[ADJS.tr];
    const initial_bottom = initial_face.adjacencies[ADJS.br];

    const last_f = Face.create(Adjacency.fromVertex(initial_bottom),
                               Adjacency.fromVertex(initial_top),
                               Adjacency.fromVertex(prior_top),
                               Adjacency.fromVertex(prior_bottom));
                     
    // set neighbors on right side
    last_f.adjacencies[ADJS.tr].setNeighbor(initial_top);
    last_f.adjacencies[ADJS.br].setNeighbor(initial_bottom);  
                                      
    // set neighbors on left side
    last_f.adjacencies[ADJS.tl].setNeighbor(prior_top);
    last_f.adjacencies[ADJS.bl].setNeighbor(prior_bottom);                                    
  }

    
 //  initialize() {
//     // for each segment, get the top and bottom canvas vertices.   
//     const x_left = 0;
//     const x_right = canvas.dimensions.width;
//      
//     const y_top = 0;
//     const y_bottom = canvas.dimensions.height;
//     
//     const tl = new Vertex(x_left, y_top);
//     const tr = new Vertex(x_right, y_top);
//     const bl = new Vertex(x_left, y_bottom);
//     const br = new Vertex(x_right, y_bottom);
//     
//     
//     // initial face is outside the canvas
//     // (or the entire canvas, depending on how you look at it)
//     //this.faces.clear();
//     
//     const { adjacencies: first_adjacencies } = this._buildNewFace([tr, tl, bl, br]);
//   
//     // for tracking which vertex corresponds to the face adjacency array
//     // tr, tl, bl, br
//     const ADJS = { tr: 0, tl: 1, bl: 2, br: 3 };
//       
//     // f0 is a bit different, as we want to track the 
//     // left vertices as if they were the right vertices.
//     let prior_adjacencies = [...first_adjacencies];
//     prior_adjacencies[ADJS.tr] = first_adjacencies[ADJS.tl];
//     prior_adjacencies[ADJS.br] = first_adjacencies[ADJS.bl];
//     
//     
//     let prior_tr = tl;
//     let prior_br = bl;
//     
// 
//   
//     this.endpoints.forEach(e => {
//       // as we move left-to-right, the previous face will
//       // help inform the current 
//       // right vertices have faces of this face and next face,
//       // so have to wait until next loop for those.
//       
//       const tr = new Vertex(e.x, y_top);
//       const br = new Vertex(e.x, y_bottom);
//       const tl = prior_tr;
//       const bl = prior_br;
//       
//       const { adjacencies } = this._buildNewFace([tr, tl, bl, br]);
//       
//       // set the endpoint links to the adjacencies
//       e.attachments = [ adjacencies[ADJS.br], adjacencies[ADJS.tr]]; // BOTTOM, TOP
//       
//       
//       adjacencies[ADJS.tr].endpoint = e;
//       adjacencies[ADJS.br].endpoint = e;
//       
//       // set neighbors for the adjacencies
//       adjacencies[ADJS.tl].neighbor = prior_adjacencies[ADJS.tr];
//       prior_adjacencies[ADJS.tr].neighbor = adjacencies[ADJS.tl];
//       
//       adjacencies[ADJS.bl].neighbor = prior_adjacencies[ADJS.br];
//       prior_adjacencies[ADJS.br].neighbor = adjacencies[ADJS.bl];
//            
//       prior_tr = tr;
//       prior_br = br;     
//       prior_adjacencies = adjacencies; 
//     });
//     
//     // final step treats the prior_tr, prior_br as left vertices,
//     // with right corners   
//     
// 
// // tr, tl, bl, br
//     
//     const { adjacencies } = this._buildNewFace([tr, prior_tr, prior_br, br]);
//     
//     adjacencies[ADJS.tl].neighbor = prior_adjacencies[ADJS.tr];
//     prior_adjacencies[ADJS.tr].neighbor = adjacencies[ADJS.tl];
//       
//     adjacencies[ADJS.bl].neighbor = prior_adjacencies[ADJS.br];
//     prior_adjacencies[ADJS.br].neighbor = adjacencies[ADJS.bl];
//     
//     // and handle the right-most corners?
//     adjacencies[ADJS.tr].neighbor = first_adjacencies[ADJS.tr];
//     first_adjacencies[ADJS.tr].neighbor = adjacencies[ADJS.tr];
//     
//     adjacencies[ADJS.br].neighbor = first_adjacencies[ADJS.br];
//     first_adjacencies[ADJS.br].neighbor = adjacencies[ADJS.br];    
//     
//     
//   }
    
    
/*
Building rules:
2'C|2'B  1'B•1'A
   |        |
C  |  B1    |  A face
 ix|--------|s0    
   |        |
   |  B2    | 
   |        |
2"C|2"B  1"B•1"A

A. Starting on a new segment at ix === endpoint s0
√ sB1 and sB2 are new adjacencies
√ s0.neighbor ->> sB1.neighbor ->> sB2.neighbor ->> sB1
√ sB1.endpoint = s0; sB2.endpoint = s0
√ B1 and B2 faces are new

B. At ix where ix ≠ endpoint s1.
1. endpoint for ix is at bottom: 
√ close bottom face
√ ixB2 and ixC2 adjacencies are new
√ ixB2.face = B2
√ ixC2.face = C2 (new)
√ can determine successors for all bottom adjacencies around B2.
√ ixB2.neighbor ->> ixC2.neighbor ->> ixB2
√ attachment 2 top is set to ixC2. (attachments always to the left)
√ 2'B and 2'C adjacencies are removed
√ C2 face is new
√ start new bottom face adjacencies

2. endpoint for ix is at the top (reverse all from 1)

C. at ix where ix === endpoint s1
1. endpoint for ix is at bottom:
- close bottom face
- ixB1 and ixB2 are new adjacencies
- ixB1.face = B1; ixB2.face = B2
- ixB1.neighbor ->> ixB2.neighbor ->> ixB1
- ixB1.endpoint = s1; ixB2.endpoint = s1
- s1.neighbor = ixB1
- can determine successors for all bottom adjacencies around B2.

D. closing other face (here, assume top)
- close top face
- can determine successors for all top adjacencies around B1.

*/

  _buildSegmentIntersectionFaces(ix, left, right, curr_v, next_v, curr_faces, s0_below = true) {
    /*
    left.draw({color: COLORS.green, radius: 8})
    right.draw({color:COLORS.orange, radius: 8})
    curr_v.draw({color:COLORS.yellow, radius: 8})
    next_v.draw({color:COLORS.red, radius: 8})
    */
   
    // intersection needs 4 adjacencies: t, l, b, r
    let ix_adjs = [ Adjacency.fromVertex(ix), 
                      Adjacency.fromVertex(ix), 
                      Adjacency.fromVertex(ix), 
                      Adjacency.fromVertex(ix)];
  
    // Set neighbors CCW
    ix_adjs[TOP].neighbor = ix_adjs[LEFT];
    ix_adjs[LEFT].neighbor = ix_adjs[BOTTOM];
    ix_adjs[BOTTOM].neighbor = ix_adjs[RIGHT];
    ix_adjs[RIGHT].neighbor = ix_adjs[TOP];   
    
    this.adjacencies.set(ix_adjs[TOP].key, ix_adjs[TOP]);
    // this.adjacencies.set(ix_adjs[LEFT].key, ix_adjs[LEFT]);
//     this.adjacencies.set(ix_adjs[BOTTOM].key, ix_adjs[BOTTOM]);
//     this.adjacencies.set(ix_adjs[RIGHT].key, ix_adjs[RIGHT]);
    
    let pos = s0_below ? TOP : BOTTOM;
    let opp = pos ^ 1;
    let old_faces = []
    let closing_v, opening_v;

    // 1. open face for the LEFT (opp) adjacency
    // shares portion of face with curr_v; use that to walk to relevant points
    // may only have one adjacency (triangle-shaped face)
    let f_left = new Face({ orientation: opp });    
    f_left.open(ix_adjs[LEFT], curr_v, next_v.x)

    // 2. open face for the pos (TOP or BOTTOM) adjacency
    // shares other portion of face with curr_v
    let f_pos = new Face({ orientation: pos });
    opening_v = curr_v.matchFace(next_v);
    f_pos.adjacencies.push(ix_adjs[pos]);
    f_pos.open(opening_v, opening_v, next_v.x)

    // 3. Close the right (pos) face, using vertex as the final point
    curr_faces[pos].close(ix_adjs[RIGHT])
    old_faces.push(curr_faces[pos])
    
    // 4. Close the opp (TOP or BOTTOM) face
    // add the intersection
    curr_faces[opp].adjacencies.unshift(ix_adjs[opp])
    
    // close the face
    closing_v = pos === TOP ? left : right;
    let dir = pos === TOP ? "successor" : "predecessor";
    curr_faces[opp].close(closing_v, closing_v[dir])
    old_faces.push(curr_faces[opp])
     
    // 5. add the new faces
    curr_faces[opp] = f_left;
    curr_faces[pos] = f_pos;
        
    return old_faces;
  }

//  _buildSegmentIntersectionFaces(ix, left, right, next_v, adjs, curr_faces, rising = true) {
//    // track faces added for debugging
//    const old_faces = [];
//       
//    // intersection needs 4 adjacencies: t, l, b, r
//    const ix_adjs = [ Adjacency.fromVertex(ix), 
//                Adjacency.fromVertex(ix), 
//                Adjacency.fromVertex(ix), 
//                Adjacency.fromVertex(ix)];
//   
//    // Set neighbors CCW
//    ix_adjs[TOP].neighbor = ix_adjs[LEFT];
//    ix_adjs[LEFT].neighbor = ix_adjs[BOTTOM];
//    ix_adjs[BOTTOM].neighbor = ix_adjs[RIGHT];
//    ix_adjs[RIGHT].neighbor = ix_adjs[TOP]; 
//    
//    // rising = TOP
//    const pos = rising ? TOP : BOTTOM;
//    const opp = pos ^ 1;
//    
//    // 1. Finish right face with vertex as final point. Typically a triangle but not always   
//    const last_adj = adjs[pos][adjs[pos].length - 1]
//    if(pos === BOTTOM && 
//       !next_v.equals(last_adj) &&
//       !next_v.equals(ix_adjs[RIGHT])) {
//      adjs[pos].push(next_v.matchFace(last_adj));
//      }
//    
//    this._closeSegmentFace(adjs, curr_faces, ix_adjs[RIGHT], pos);
//    
//    // 2. Open new face using vertex --> next_v --> attachment
//    old_faces.push(curr_faces[pos]);
//    curr_faces[pos] = new Face();
//    
//    // TO-DO: do we need to check for endpoints to use instead of attachments?
//    //        like with _buildSegmentFace?
//    //adjs[pos] = [ix_adjs[pos], next_v, next_v.endpoint.attachments[pos]];
//    const v = this._findAttachment(next_v, pos, next_v);
//    adjs[pos] = [ix_adjs[pos], next_v, v];
//    
//    
//    // 3. opposite face gets another vertex at the intersection
//    adjs[opp].unshift(ix_adjs[opp]);
//    
//    // 4. opposite face can be finished using either left or right adjacency 
//    //    and associated attachment.
//    const closing_side = pos === TOP ? left : right;
//    let v_opp = this._findAttachment(closing_side.neighbor, opp, closing_side);
//    if(!v_opp.neighbor.equals(closing_side)) { adjs[opp].push(v_opp.neighbor); }
//    
//    // if the closing_side is an endpoint, we need to follow it to its attachment
//    if(closing_side?.endpoint?.attachments && 
//       !closing_side.endpoint.attachments[opp].equals(closing_side)) {
//      const att = closing_side.endpoint.attachments[opp];
//      adjs[opp].push(att.matchFace(closing_side));   
//    }
//    
//    this._closeSegmentFace(adjs, curr_faces, closing_side, opp);
//    
//    // 5. open new opposite face using vertex --> nothing
//    old_faces.push(curr_faces[opp]);
//    curr_faces[opp] = new Face();
//    adjs[opp] = [ix_adjs[LEFT]];
//    
//    // is there another vertex to the left (i.e., intersection) before reaching 
//    // the next attachment? if so, add
//    if(!closing_side.endpoint && !closing_side.neighbor.endpoint) {
//      adjs[opp].push(closing_side.matchFace(next_v));
//    }
//    
//    return old_faces;
//  
//  } 


 _closeSegmentFace(adjs, curr_faces, v, position) {
    adjs[position].push(v);
    
    // bottom adjacencies are in clockwise order; reverse
    // push + reverse appears a lot faster than shifting: 
    // https://jsbench.me/gbkyp4o43l/1    
    if(position === BOTTOM) { adjs[position].reverse(); }
    
    // construct successors, add face
    this._buildAdjacencies(adjs[position], curr_faces[position]);
 }
 
 
  _findAttachment(next_v, position, closing_v) {
    if(!next_v.endpoint?.attachments) {
      // likely next_v is an intersection. 
      // Return whichever next_v neighbor matches the face of the closing v
      console.log(`_findAttachment thinks ${next_v.label} is an intersection.`);
      return next_v.matchFace(closing_v);
    }
  
    let v = next_v.endpoint.attachments[position];
    if(v.face !== next_v.face) {
      // need to use the endpoint vertex instead
      v = next_v.endpoint.neighbor;
      if(v.face !== next_v.face) {
        v = v.neighbor;
      }
    }
    return v;
  }
  
  _buildStartSegmentFaces(s, next_v) {
    console.log(`Opening faces for starting endpoint ${s.max_xy.label}`);
    const s0 = s.max_xy;
    const curr_faces = [ new Face({ orientation: BOTTOM }), 
                         new Face({ orientation: TOP }) ];
     
    // Create adjacencies at s0. These will link to the nw face (TOP) and sw face (BOTTOM)                     
    const s0nw = Adjacency.fromVertex(s0);
    const s0sw = Adjacency.fromVertex(s0);

    // link the adjacencies as neighbors, plus link to endpoint
    
    s0nw.endpoint = s0; // link adjacency back to s0 endpoint
    s0sw.endpoint = s0; // link adjacency back to s0 endpoint 
    s0nw.setNeighbor(s0sw); // link endpoint to first adjacency to the nw.
                            
    curr_faces[TOP].open(s0nw, s0nw.endpoint.attachments[BOTTOM], next_v.x);
    curr_faces[BOTTOM].open(s0sw, s0sw.endpoint.attachments[TOP], next_v.x);

    return curr_faces;
  }
  
  _closeEndSegmentFaces(s, ix, left, right, curr_faces, is_left) {
    console.log(`Closing faces for ending endpoint ${s.min_xy.label}`);
    let pos = is_left ? BOTTOM : TOP;
    let opp = pos ^ 1;
    let s1 = s.min_xy;
    
    // construct new adjacencies for the intersection
    // adj1 will be for this current face; adj2 will be for the new face
    // for intersection tracking, mark the segment for the intersection points  
    let ix_adj1 = Adjacency.fromVertex(ix);
    let ix_adj2 = Adjacency.fromVertex(ix);
    this.adjacencies.set(ix_adj1.key, ix_adj1);
    
    ix_adj1.segment = s;
    ix_adj2.segment = s;
    ix_adj1.setNeighbor(ix_adj2);
    
    // close one face
    let closing_v = is_left ? left : right;
    curr_faces[pos].close(ix_adj1, closing_v);    
    
    // close the other face
    let closing_v_opp = is_left ? right : left;
    ix_adj1.endpoint = s1;
    ix_adj2.endpoint = s1;
    s1.neighbor = pos === BOTTOM ? ix_adj2 : ix_adj1;
    curr_faces[opp].close(ix_adj2, closing_v_opp);
  
    return curr_faces;
  }
  
 
  _buildSegmentFace(s, ix, left, right, curr_v, next_v, curr_faces, is_left) {
    let pos = is_left ? BOTTOM : TOP;
    let opp = pos ^ 1;
    
    // construct new adjacencies for the intersection
    // adj1 will be for this current face; adj2 will be for the new face
    // for intersection tracking, mark the segment for the intersection points  
    let ix_adj1 = Adjacency.fromVertex(ix);
    let ix_adj2 = Adjacency.fromVertex(ix);
    this.adjacencies.set(ix_adj1.key, ix_adj1); // neighbor would share same key
    //     this.adjacencies.set(ix_adj2.key, ix_adj2);   
    console.log(`Closing ${is_left ? "BOTTOM" : "TOP"} face for vertex ${ix_adj1.label}`);
    
    ix_adj1.segment = s;
    ix_adj2.segment = s;
    ix_adj1.setNeighbor(ix_adj2);
   
    // close the face
    let closing_v = is_left ? left : right;
    curr_faces[pos].close(ix_adj1, closing_v);
    
    // store old face to return
    let old_face = curr_faces[pos];
        
    // open the new face
    curr_faces[pos] = new Face({ orientation: pos });
    curr_faces[pos].open(ix_adj2, curr_v, next_v.x);
    
     
    // move the attachment for this next endpoint at the opposite side
    // position = bottom: top attachment for right|left line moved down to s
    // position = top: bottom attachment moved up
    ix_adj2.endpoint = curr_v.endpoint;
    this.adjacencies.delete(ix_adj2.endpoint.attachments[opp].key);
//     this.adjacencies.delete(ix_adj2.endpoint.attachments[opp].neighbor.key);
    ix_adj2.endpoint.attachments[opp] = ix_adj2; 
    
    
    return [old_face];  
  }
    


    addSegment({ draw = false, idx = undefined } = {}) {
      // ------ Initial setup ----- //
      // randomly select segment or choose user-selected
      if(typeof idx === "undefined") {
        idx = this.process_queue.pop()
      } else {
        // drop idx from the queue if it exists
        const i = this.process_queue.findIndex(elem => elem === idx);
        if(~i) { this.process_queue.splice(i, 1); }
      }
      
      let s = this.segments.get(idx);
      let s0 = s.max_xy;
      let s1 = s.min_xy;

      let new_faces = []; // track faces created

      if(draw) {
        console.log(`Adding segment ${s._index}.`);
        canvas.controls.debug.clear()
        this.labelSegments()
        this.draw({shade_faces: false});
        s.draw({width: 2});
      }
    
      // do the initial traverse/transition
      // (in most cases, could enter the endpoint and attachment directly, 
      //  but this may fail in some cases, like when another segment
      //  is above the endpoint.)
      
      // arbitrarily start with the TOP face
      let curr_v = s0.attachments[TOP];
      
      let traverse_res = curr_v.traverse(s);
      let transition_res = Face.transition(traverse_res[1], traverse_res[0], s);
      
      // Build top and bottom starting faces
      let curr_faces;
      if(typeof transition_res.s0_below === "undefined") {
        curr_faces = this._buildStartSegmentFaces(s, transition_res.next_v);
      } else {
        // intersection is the next vertex
        const next_v = transition_res.s0_below ? traverse_res[1] : traverse_res[0];
        curr_faces = this._buildStartSegmentFaces(s, next_v);
      }

      
            
      // ------ Loop over vertical attachments at endpoints ----- //
      let i = 0;
      let ln_endpoints = this.endpoints.length;
      let prior_traverse, prior_transition, old_faces;
      do {
        i += 1;

        if(transition_res.ix.equals(s1)) {
          old_faces = this._closeEndSegmentFaces(s, 
                                                 transition_res.ix,
                                                 traverse_res[1], 
                                                 traverse_res[0], 
                                                 curr_faces,
                                                 transition_res.is_left);
          new_faces.push(...old_faces);   
          old_faces.forEach(f => {
            if(draw) f.draw({ color: nextShade() });
            if(!f.consistencyTest({ test_neighbor: false, 
                                           test_successor: true, 
                                           test_face: true })) {
              console.error(`Failed consistency test at last face`);  
            }    
          });
          break;
        }
        
        prior_traverse = traverse_res;
        prior_transition = transition_res;
        
        traverse_res = transition_res.next_v.traverse(s);
        transition_res = Face.transition(traverse_res[1], traverse_res[0], s);
        
        if(typeof prior_transition.s0_below === "undefined") {
          const next_v = ( typeof transition_res.s0_below === "undefined" ) ? 
                       transition_res.next_v : transition_res.ix;
          old_faces = this._buildSegmentFace(s, 
                                             prior_transition.ix, 
                                             prior_traverse[1], // left
                                             prior_traverse[0], // right
                                             prior_transition.next_v, // curr_v
                                             next_v,
                                             curr_faces,
                                             prior_transition.is_left);                                                       
        } else {
          console.log(`Recording intersection ${prior_transition.ix.label}`);
          // record the intersection
          this.intersections.push({
              ix: prior_transition.ix,
              s1: s,
              s2: prior_traverse[0].segment || prior_traverse[1].segment
          });
    
          // process intersection
          old_faces = this._buildSegmentIntersectionFaces(prior_transition.ix,
                                                          prior_traverse[1], // left
                                                          prior_traverse[0], // right
                                                          prior_transition.next_v, // curr_v
                                                          transition_res.next_v,
                                                          curr_faces,
                                                          prior_transition.s0_below)
        }
        
        new_faces.push(...old_faces);                                              
        old_faces.forEach(f => {
          if(draw) f.draw({ color: nextShade() });
          if(!f.consistencyTest({ test_neighbor: false, 
                                         test_successor: true, 
                                         test_face: true })) {
            console.error(`Failed consistency test at last face`);  
          }    
        });
  
      } while(i < ln_endpoints)
      
      // ---------- Cleanup ------------ //
      
      this.partitioned_segments.add(s);
      
      this.consistencyTest({ test_neighbor: true, 
                            test_successor: true, 
                            test_face: true });
      
      return new_faces;
    }
  

  
  draw({ shade_faces = true } = {}) {
    // initial drawing is just the verticals with endpoints identified
    this.endpoints.forEach(e => {
      Vertex.drawPoint(e, { color: COLORS.blue });
      
      // draw the attachments, if any
      if(e.attachments) {
        const shader = new _pixi_graphics_smooth.DashLineShader({dash: 5, gap: 8});
        Segment.drawEdge({ A: e, B: e.attachments[TOP] }, 
                         { color: COLORS.lightblue, width: 1, shader});
                         
        Segment.drawEdge({ A: e, B: e.attachments[BOTTOM] }, 
                         { color: COLORS.lightblue, width: 1, shader});                 
      }
      
    });
    
    // for each adjacency, draw the edge connecting it to the next
//     this.adjacencies.forEach(adj => {
//       Segment.drawEdge({ A: adj, B: adj.successor }, 
//                        { color: COLORS.lightblue, width: 1 });
//     });  
    
    // draw partitioned segments
    this.partitioned_segments.forEach(s => {
      s.draw({ color: COLORS.green, width: 1});
    });
    
    // alternate colors; fill in faces
    // no index in a set!
    if(!shade_faces) return;
    let i = -1;
    const colors = [COLORS.lightblue, COLORS.lightgreen, COLORS.lightred];
    this.faces.forEach(f => {
      i += 1;
      if(!i) return; // skip the initial (outside) face
      
      
      const ci = i % 3;
      
      f.draw({color: colors[ci]});
      
    });
  }
  
  labelSegments() {
    const d = canvas.controls.debug
  
    if ( !d.polygonText ) {
      d.polygonText = canvas.controls.addChild(new PIXI.Container());
    }
    const polygonText = d.polygonText;
    
    this.segments.forEach(s => {
      // update existing label if it exists at or very near endpoint
      let idx = polygonText.children.findIndex(c => s.A.x.almostEqual(c.position.x) && s.A.y.almostEqual(c.position.y));
      if(idx !== -1) { d.polygonText.removeChildAt(idx); }
    
       const t = polygonText.addChild(new PIXI.Text(String(s._index), CONFIG.canvasTextStyle));
       t.position.set(s.A.x, s.A.y);
    })
  
  }
  
  clearLabels() {
    if(!canvas.controls.debug.polygonText) return;
    canvas.controls.debug.polygonText.removeChildren();
  }
   
  // ----- DEBUGGING -----
  consistencyTest({ test_neighbor = false, 
                    test_successor = false, 
                    test_face = false } = {}) {
    // confirm all adjacency successors have the same face, different vertex
    // confirm that all adjacency neighbors have the same vertex, different face
    // confirm that all adjacencies can be found in faces for the partition and vice-versa
    for(let [key, adj] of this.adjacencies.entries()) {
      if(!adj.consistencyTest({ test_neighbor, test_successor, test_face })) {
        console.error(`adj ${adj.label} fails consistency test.`, adj, this);
        return false;
      }
    
      if(adj.key !== key) {
        console.error(`adj ${adj.label} (${key}) does not match.`, adj, this);
        return false;
      }

  
//       if(!this.faces.has(adj.face)) {
//         console.error(`adj ${adj.label} (${key}) face ${adj.face.label} not in partition faces.`, adj, this);
//         return false;     
//       }
    }

    // confirm each endpoint has an adjacency
    for(let e of this.endpoints.values()) {
      if(!(e.attachments[TOP] instanceof Adjacency)) {
        console.error(`endpoint ${e.label} does not have top adjacency.`, e, this);
        return false;    
      }
      
      if(!(e.attachments[BOTTOM] instanceof Adjacency)) {
        console.error(`endpoint ${e.label} does not have bottom adjacency.`, e, this);
        return false;    
      }
  
      if(e.x !== e.attachments[TOP].x || e.x !== e.attachments[BOTTOM].x) {
        console.error(`endpoint ${e.label} does not match adjacency.`, e, this);
        return false;        
      }
    }
    
    return true;
  }
  

}


let COLORS = {
  orange: 0xFFA500,
  yellow: 0xFFFF00,
  greenyellow: 0xADFF2F,
  green:0x00FF00,
  lightgreen: 0x90ee90,
  blue: 0x0000FF,
  lightblue: 0xADD8E6,
  red: 0xFF0000,
  lightred: 0xFFCCCB,
  gray: 0x808080,
  black: 0x000000,
  white: 0xFFFFFF
}

let SHADES = [
  COLORS.lightblue, 
  COLORS.lightgreen, 
  COLORS.lightred
];

function nextShadeFn() {
  let i = -1;
  return function() {
    i += 1;
    return SHADES[i % SHADES.length];
  }
}

let nextShade = nextShadeFn();    
