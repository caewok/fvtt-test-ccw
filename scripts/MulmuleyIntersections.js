/* globals
canvas,
foundry,
PIXI,
CONFIG
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
  
  draw({ color = COLORS.blue, alpha = 1, width = 5 } = {}) {
    canvas.controls.debug.lineStyle(width, color, alpha).
        moveTo(this.A.x, this.A.y).
        lineTo(this.B.x, this.B.y);    
  }
  
  static drawEdge(e, { color = COLORS.blue, alpha = 1, width = 5 } = {}) {
    Segment.fromEdge(e).draw({ color, alpha, width });
  }
  
}

class Face {
  constructor() {
    this.adjacencies = [];
    
    this._isOpen = undefined; // true if open, false if closed, undefined at start.
    this._creationOrientation = undefined; // TOP or BOTTOM
  }
  
  get label() {
    const str = [];
    this.adjacencies.forEach(adj => str.push(`${adj.label}`));
    return str.join(` ->> `);
  }
  
  
  open(...pts) {
    this._isOpen = true;
    
    this.adjacencies.push(...pts);
  }
  
  close(...pts) {
    const adjs = this.adjacencies;
    this._isOpen = false;
    
    this.adjacencies.push(...pts);
    
    // if this is a BOTTOM face relative to the creating segment, then 
    // the adjacencies must be reversed.
    if(this._creationOrientation === BOTTOM) adjs.reverse();
    
    // successors are in order of the array, looping around to beginning
    // also set the face for each adjacency.
    const ln = adjs.length;
    for(let i = 0; i < ln; i += 1) {
      const next_i = (i + 1) % ln;
      adjs[i].successor = adjs[next_i];
      adjs[i].face = this;
    }
  }
  
  static open(...pts) {
    const f = new Face();
    f.open(...pts);
    return f;
  }
  
  
  static create(...pts) {
    const f = new Face();
    f.close(...pts);
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
    
    const ln = this.adjacencies.size;
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
  
    const ln = this.adjacencies.size;
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
      
      // if endpoint is to left of S, right.neighbor gives the next vertex in R i+1
      // if endpoint is to the right of S, left.neighbor gives the next vertex?
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
    const rising = left.x < right.x;
    //const s_rising = max_xy.y > ix.y; // 
    console.log(`Transition: s0 is ${rising ? "below" : "above"} other right endpoint.`);
    
    //while(i < ln && foundry.utils.orient2dFast(max_xy, min_xy, successor) > 0) {
    if(rising) {
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
      next_v: rising ? h.successor : h,
      ix: new Vertex(ix.x, ix.y),
      rising: rising
    };
  }
  
  draw({ color = COLORS.lightblue, alpha = 0.25} = {}) {
    // draw as polygon, using vertices
    const pts = [];
    let i = 0;
    const ln = this.adjacencies.size;
    const v0 = this.adjacencies.values().next().value;
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

 _buildSegmentIntersectionFaces(ix, left, right, next_v, adjs, curr_faces, rising = true) {
   // track faces added for debugging
   const old_faces = [];
      
   // intersection needs 4 adjacencies: t, l, b, r
   const ix_adjs = [ Adjacency.fromVertex(ix), 
               Adjacency.fromVertex(ix), 
               Adjacency.fromVertex(ix), 
               Adjacency.fromVertex(ix)];
  
   // Set neighbors CCW
   ix_adjs[TOP].neighbor = ix_adjs[LEFT];
   ix_adjs[LEFT].neighbor = ix_adjs[BOTTOM];
   ix_adjs[BOTTOM].neighbor = ix_adjs[RIGHT];
   ix_adjs[RIGHT].neighbor = ix_adjs[TOP]; 
   
   // rising = TOP
   const pos = rising ? TOP : BOTTOM;
   const opp = pos ^ 1;
   
   // 1. Finish right face with vertex as final point. Typically a triangle but not always   
   const last_adj = adjs[pos][adjs[pos].length - 1]
   if(pos === BOTTOM && 
      !next_v.equals(last_adj) &&
      !next_v.equals(ix_adjs[RIGHT])) {
     adjs[pos].push(next_v.matchFace(last_adj));
     }
   
   this._closeSegmentFace(adjs, curr_faces, ix_adjs[RIGHT], pos);
   
   // 2. Open new face using vertex --> next_v --> attachment
   old_faces.push(curr_faces[pos]);
   curr_faces[pos] = new Face();
   
   // TO-DO: do we need to check for endpoints to use instead of attachments?
   //        like with _buildSegmentFace?
   //adjs[pos] = [ix_adjs[pos], next_v, next_v.endpoint.attachments[pos]];
   const v = this._findAttachment(next_v, pos, next_v);
   adjs[pos] = [ix_adjs[pos], next_v, v];
   
   
   // 3. opposite face gets another vertex at the intersection
   adjs[opp].unshift(ix_adjs[opp]);
   
   // 4. opposite face can be finished using either left or right adjacency 
   //    and associated attachment.
   const closing_side = pos === TOP ? left : right;
   let v_opp = this._findAttachment(closing_side.neighbor, opp, closing_side);
   if(!v_opp.neighbor.equals(closing_side)) { adjs[opp].push(v_opp.neighbor); }
   
   // if the closing_side is an endpoint, we need to follow it to its attachment
   if(closing_side?.endpoint?.attachments && 
      !closing_side.endpoint.attachments[opp].equals(closing_side)) {
     const att = closing_side.endpoint.attachments[opp];
     adjs[opp].push(att.matchFace(closing_side));   
   }
   
   this._closeSegmentFace(adjs, curr_faces, closing_side, opp);
   
   // 5. open new opposite face using vertex --> nothing
   old_faces.push(curr_faces[opp]);
   curr_faces[opp] = new Face();
   adjs[opp] = [ix_adjs[LEFT]];
   
   // is there another vertex to the left (i.e., intersection) before reaching 
   // the next attachment? if so, add
   if(!closing_side.endpoint && !closing_side.neighbor.endpoint) {
     adjs[opp].push(closing_side.matchFace(next_v));
   }
   
   return old_faces;
 
 } 


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
  
 

    
  _buildSegmentFace(s, ix, left, right, next_v, adjs, curr_faces, position = BOTTOM) {
    
    const s1 = s.min_xy;
    const opp = position ^ 1;
    
    // construct new adjacencies for the intersection
    // adj1 will be for this current face; adj2 will be for the new face
    // for intersection tracking, mark the segment for the intersection points
    const ix_adj1 = Adjacency.fromVertex(ix);
    const ix_adj2 = Adjacency.fromVertex(ix);
    
    ix_adj1.segment = s;
    ix_adj2.segment = s;
    
    ix_adj1.neighbor = ix_adj2;
    ix_adj2.neighbor = ix_adj1;
    
    const closing_v = position === BOTTOM ? left : right;    
    adjs[position].push(closing_v);
    this._closeSegmentFace(adjs, curr_faces, ix_adj1, position)
   
    // store old face to return
    const old_face = curr_faces[position];
    
    if(ix.equals(s1)) {
      // close this face position and then the opposite face position
      
      // neither below are likely necessary as will be set on close
//       ix_adj1.face = curr_faces[opp];
//       ix_adj2.face = curr_faces[bottom];     
      
      ix_adj1.neighbor = ix_adj2;
      ix_adj2.neighbor = ix_adj1;
    
      ix_adj1.endpoint = s1;
      ix_adj2.endpoint = s1;     
      
      s1.neighbor = position === BOTTOM ? ix_adj2 : ix_adj1;
      
      // close the opposite face
      const closing_v = opp === BOTTOM ? left : right;
      adjs[opp].push(closing_v);
      this._closeSegmentFace(adjs, curr_faces, ix_adj2, opp);
      
      // mark off the curr_faces to make it easier to determine which was last
      curr_faces[position] = null;
    
    } else {
      // Construct new face to replace what we just closed
      curr_faces[position] = new Face();
      
      // probably not necessary as will be set when face is closed
//       ix_adj2.face = curr_faces[position];  

      // add the starting adjacencies
      adjs[position] = [ix_adj2];
      
      
      // if the next attachment belongs to an endpoint for a segment that we have already 
      // processed, then it is possible (likely?) that we have something like this:
      // e.g.    •------• e
      //      •-------------•
      //                ^ we are here, processing the bottom segment.
      // In this case, we need to use endpoint e and not the attachment above e.
      
      // basic case: next_v.attachment[position]
      // if we just closed BOTTOM face, next_v is the top (attachment to be moved)
      // and vice-versa
      const v = this._findAttachment(next_v, position);      
      adjs[position].push(v); 
      
      // is there another vertex ccw (i.e., intersection) before reaching 
      // the next attachment? if so, add
      if(!v.successor.endpoint && !v.successor.neighbor.endpoint) {
        adjs[position].push(v.successor) // face should already match by definition
      }
        
      // move the attachment for this next endpoint at the opposite side
      // position = bottom: top attachment for right|left line moved down to s
      // position = top: bottom attachment moved up
      ix_adj2.endpoint = next_v.endpoint;
      this.adjacencies.delete(ix_adj2.endpoint.attachments[opp].key);
      this.adjacencies.delete(ix_adj2.endpoint.attachments[opp].neighbor.key);
      ix_adj2.endpoint.attachments[opp] = ix_adj2;       
    }
    
    return old_face;
    
      
    // TO-DO: Make below simpler/faster
    // if the next attachment belongs to an endpoint for a segment that we have already 
    // processed, then it is possible (likely?) that we have something like this:
    // e.g.    •------• e
    //      •-------------•
    //                ^ we are here, processing the bottom segment.
    // In this case, we need to use endpoint e and not the attachment above e.
 //    const next_attachment = next_v.endpoint.attachments[position];
//     if(this.partitioned_segments.has(next_v.endpoint.segment)) {
//       const pt = next_v.endpoint.y.between(ix_adj2.y, next_attachment.y) ?
//                    Adjacency.fromVertex(next_v.endpoint) : next_attachment;
//       adjs[position] = [ix_adj2, pt];             
//     } else {
//       adjs[position] = [ix_adj2, next_attachment];
//     }
      
 
  }
  
  addSegment({ draw = false, idx = undefined } = {}) {
    // randomly add a segment to the partition
    // remove from the segments array
    
/*
At s0: 
2'C|2'B  1'B•1'A
   |        |
C  |  B1    |  A face
 ix|--------|s    
   |        |
   |  B2    | 
   |        |
2"C|2"B  1"B•1"A


B1 and B2 are combined at start as B:

1"B.endpoint ->> s
1'B.endpoint ->> s

s.attachment.top    ->> 1'B
s.attachment.bottom ->> 1"B
  
B face: 1'B.successor ->> 2'B.successor ->> 2"B.successor ->> 1"B 

1'B.neighbor ->> 1'A
1"B.neighbor ->> 1"A, ... 

Create 2 new faces: B1 and B2. Blank at first

Create 2 new adjacencies at point s. Call them sB1 and sB2. (A face is invisible)
-- do we need an endpoint? Technically these are not attachments. 

Create 2 new adjacencies at point ix. Call them ixB1 and ixB2

Once we know ix and we know the top face B1 is finished:
- B1 face: sB1.successor ->> 1'B1.successor ->> 2'B1.successor ->> ixB1.successor ->> sB1
- 

Once we know ix and we know the bottom face B2 is finished, same as above.

Once we know B1 and B2:
- sB1.neighbor ->> sB2
- sB2.neighbor ->> sB1
- ixB1.neighbor ->> sB2
- ixB2.neighbor ->> sB1

If we are shifting an attachment up, say at vertex 2"
- ixB2 goes away
- ixB1 is an attachment, replacing 2"B
- ixC1 is an attachment, replacing 2"C

3'D |     2'C|2'B  1'B•1'A
    |        •        |
D   |    C1  |  B1    |  A face
ix2 |------ix|--------|s    
    |                 |
    •            B2   | 
    |                 |
    |              1"B•1"A
  
Here, bottom face B2 extends across, and the former 2" is replaced by ixC1 and ixB1  

  
  
*/    
    // ------ Initial setup ----- //
    
    if(typeof idx === "undefined") {
      idx = this.process_queue.pop()
    } else {
      // drop idx from the queue if it exists
      const i = this.process_queue.findIndex(elem => elem === idx);
      if(~i) { this.process_queue.splice(i, 1); }
    }
    
    const s = this.segments.get(idx);
        
    // we will move from s0 right to s1.
    const s0 = s.max_xy;
    const s1 = s.min_xy;
    
    // Debugging 
    const new_faces = []; // track faces created
    const colors = [
      COLORS.lightblue, 
      COLORS.lightgreen, 
      COLORS.lightred
    ]; // drawing faces
    const color_ln = colors.length; // to alternate face colors
    if(draw) {
      console.log(`Adding segment ${s._index}.`);
      canvas.controls.debug.clear()
      this.labelSegments()
      this.draw({shade_faces: false});
      s.draw({width: 2});
    }
    
    
    // ------ Set variables for the while loop ----- //
    
    // Create two new faces, to be filled in as we move along segment from s0 to s1.
    // Along the way, each face will be closed and replaced by another, depending
    // on the layout. 
    const curr_faces = [new Face(), new Face()]; // BOTTOM and TOP faces
    const adjs = [ [], [] ] // BOTTOM and TOP adjacencies
        
    // Get the top and bottom beginning of the respective new faces
    // neighbor unchanged; successor and face must change later

        
    // Create adjacencies at s0
    // one adj will link to the nw face.
    // second adj will link to sw face.
    const s0nw = Adjacency.fromVertex(s0); 
    const s0sw = Adjacency.fromVertex(s0);
    
    s0.neighbor = s0nw; // link endpoint to first adjacency to the nw.
    s0nw.endpoint = s0; // link adjacency back to s0 endpoint
    s0sw.endpoint = s0; // link adjacency back to s0 endpoint
    
    s0nw.face = curr_faces[TOP];
    s0sw.face = curr_faces[BOTTOM]; 
    
    s0nw.neighbor = s0sw;    
    s0sw.neighbor = s0nw;                                         
    
    adjs[TOP].push(s0nw, s0.attachments[TOP]);
    adjs[BOTTOM].push(s0sw, s0.attachments[BOTTOM]);
   
    let curr_v = s0.attachments[TOP];
    let curr_ix = s0;
         
    // i and ln_endpoints to avoid infinite loops while debugging
    let i = 0;
    const ln_endpoints = this.endpoints.length;
    while(i < ln_endpoints && !curr_ix.equals(s1)) {
      i += 1;
      
      // for coloring
      const ci = i % color_ln;
      
      // do traversal / transition until we find other end of s
      const [right, left] = curr_v.traverse(s);
      const { next_v, ix, is_left, rising } = Face.transition(left, right, s);
      curr_v = next_v;
      curr_ix = ix;
      
      if(typeof rising === "undefined") {
        // transitioning through a vertical attachment
        // if endpoint is to the left of s, build the bottom face;
        // if endpoint is to the right of s, build the top face
        console.log(`Endpoint is ${is_left ? "left" : "right"}.`)
        
        const pos = is_left ? BOTTOM : TOP;
        const old_face = this._buildSegmentFace(s, ix, left, right, next_v, 
                                                adjs, curr_faces, pos);
        new_faces.push(old_face);
        if(draw) old_face.draw({color: colors[ci]})
          
        if(!old_face.consistencyTest({ test_neighbor: false, 
                                       test_successor: true, 
                                       test_face: true })) {
          console.error(`Failed consistency test at i ${i}`);
          return new_faces;                                                  
        }
          
      } else {
        // transitioning through other segment
        console.log(`Processing intersection ${ix.label}.`);
      
        // record the intersection
        this.intersections.push({
            ix: ix,
            s1: s,
            s2: left.segment 
        });
        
        const old_faces = this._buildSegmentIntersectionFaces(ix, left, right, next_v, 
                                                              adjs, curr_faces, rising);
        old_faces.forEach(f => {
          console.log(`Adding intersection face ${f.label}.`);
          if(draw) f.draw({color: colors[ci]})
          new_faces.push(f);
          if(!f.consistencyTest({ test_neighbor: false, 
                                         test_successor: true, 
                                         test_face: true })) {
            console.error(`Failed intersection consistency test at i ${i} for f ${f.label}`, f, new_faces);
          }
         });                                                      
      }
    }
    
   
    const last_face = curr_faces[0] || curr_faces[1];
    
    console.log(`Adding last face ${last_face.label}.`);
    new_faces.push(last_face);
    
    const ci = (i + 1) % color_ln;
    if(draw) last_face.draw({ color: colors[ci] })
    
    if(!last_face.consistencyTest({ test_neighbor: false, 
                                   test_successor: true, 
                                   test_face: true })) {
      console.error(`Failed consistency test at last face`);
      return new_faces;                                                  
    }
          
    this.partitioned_segments.add(s);
    return new_faces;
    
  }
  
  draw({ shade_faces = true } = {}) {
    // initial drawing is just the verticals with endpoints identified
    this.endpoints.forEach(e => {
      Vertex.drawPoint(e, { color: COLORS.blue });
    });
    
    // for each adjacency, draw the edge connecting it to the next
    this.adjacencies.forEach(adj => {
      Segment.drawEdge({ A: adj, B: adj.successor }, 
                       { color: COLORS.lightblue, width: 1 });
    });  
    
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



// testing

// TO-DO:

/* more consistent rules for building segment faces

building top face: 
- add vertex
- add pt. If pt is attachment or intersection or endpoint, stop
- otherwise, add pt.successor
- repeat if pt.successor is not attachment or intersection?

building bottom face:
(cannot use successor on the front end; must handle from the closing)
- vertex
- pt

closing top face:
- add intersection

closing bottom face:
- add intersection







*/

partition.clearLabels();
canvas.controls.debug.clear()
walls = canvas.walls.placeables;
partition = new Partition(walls);
partition.labelSegments()
partition.initialize();
partition.consistencyTest();
partition.consistencyTest({ test_neighbor: true, 
                            test_successor: true, 
                            test_face: true });
// 
// partition.draw({shade_faces: false});
// 
//   
//   
// 
// new_faces = partition.addSegment({ draw: true, idx: 5 });
// 
// new_faces = partition.addSegment({ draw: true });
// 
// 
// // locate all the faces using adjacencies
// faces = new Set()
// partition.adjacencies.forEach(adj => faces.add(adj.face));
// 
// 
// 
// 

// new addSegment
//idx = 




// // to reset drawing
// canvas.controls.debug.clear()
// partition.labelSegments()
// partition.draw({shade_faces: false});
// 
// 
//     draw = true
//     if(typeof idx === "undefined") {
//       idx = partition.process_queue.pop()
//     } else {
//       // drop idx from the queue if it exists
//        i = partition.process_queue.findIndex(elem => elem === idx);
//       if(~i) { partition.process_queue.splice(i, 1); }
//     }
//     
//      s = partition.segments.get(idx);
//     
//     if(draw) console.log(`Adding segment ${s._index}.`);
//     
//     
//     
//    
//     
//     // we will move from s0 right to s1.
//      s0 = s.max_xy;
//      s1 = s.min_xy;
//     
//     // Debugging 
//      new_faces = []; // track faces created
//      colors = [
//       COLORS.lightblue, 
//       COLORS.lightgreen, 
//       COLORS.lightred
//     ]; // drawing faces
//      color_ln = colors.length; // to alternate face colors
//     if(draw) s.draw({width: 2})
//    
//     
//     // ------ Set variables for the while loop ----- //
//     
//     // Create two new faces, to be filled in as we move along segment from s0 to s1.
//     // Along the way, each face will be closed and replaced by another, depending
//     // on the layout. 
//      curr_faces = [new Face(), new Face()]; // BOTTOM and TOP faces
//      adjs = [ [], [] ] // BOTTOM and TOP adjacencies
//         
//     // Get the top and bottom beginning of the respective new faces
//     // neighbor unchanged; successor and face must change later
// 
//         
//     // Create adjacencies at s0
//     // one adj will link to the nw face.
//     // second adj will link to sw face.
//      s0nw = Adjacency.fromVertex(s0); 
//      s0sw = Adjacency.fromVertex(s0);
//     
//     s0.neighbor = s0nw; // link endpoint to first adjacency to the nw.
//     s0nw.endpoint = s0; // link adjacency back to s0 endpoint
//     s0sw.endpoint = s0; // link adjacency back to s0 endpoint
//     
//     s0nw.face = curr_faces[TOP];
//     s0sw.face = curr_faces[BOTTOM]; 
//     
//     s0nw.neighbor = s0sw;    
//     s0sw.neighbor = s0nw;                                         
//     
//     adjs[TOP].push(s0nw, s0.attachments[TOP]);
//     adjs[BOTTOM].push(s0sw, s0.attachments[BOTTOM]);
//    
//      curr_v = s0.attachments[TOP];
//      curr_ix = s0;
//          
//     // i and ln_endpoints to avoid infinite loops while debugging
//      i = 0;
//      ln_endpoints = partition.endpoints.length;
//     while(i < ln_endpoints && !curr_ix.equals(s1)) {
//       i += 1;
//       
//       // for coloring
//        ci = i % color_ln;
//       
//       // do traversal / transition until we find other end of s
//       let [right, left] = curr_v.traverse(s);
//       let { next_v, ix, is_left, rising } = Face.transition(left, right, s);
//       curr_v = next_v;
//       curr_ix = ix;
//       
// 
//       
//       if(typeof rising === "undefined") {
//         // transitioning through a vertical attachment
//         position = is_left ? BOTTOM : TOP;
//         old_face = partition._buildSegmentFace(s, ix, left, right, next_v, adjs, curr_faces, position);
//         new_faces.push(old_face)
//         if(draw) old_face.draw({color: colors[ci]})
//           
//         if(!old_face.consistencyTest({ test_neighbor: false, 
//                                        test_successor: true, 
//                                        test_face: true })) {
//           console.error(`Failed consistency test at i ${i}`);
//           //return new_faces;                                                  
//         }
//                  
//       } else {
//         // transitioning through other segment
//         console.log(`Need to transition through other segment.`);
//         
//         // record the intersection
//         partition.intersections.push({
//             ix: ix,
//             s1: s,
//             s2: left.segment 
//         });
//       
//         old_faces = partition._buildSegmentIntersectionFaces(ix, left, right, next_v, 
//                                                               adjs, curr_faces, rising);
//         old_faces.forEach(f => {
//           new_faces.push(f);
//             if(draw) f.draw({color: colors[ci]})
//             if(!old_face.consistencyTest({ test_neighbor: false, 
//                                            test_successor: true, 
//                                            test_face: true })) {
//               console.error(`Failed intersection consistency test at i ${i} for face ${f.label}`, f, new_faces);
//             }
//          });     
//       
//       }
//       
//       if(curr_ix.equals(s1)) { console.log("Done loop!") }
//     }
//         
//     last_face = curr_faces[0] || curr_faces[1];
//     new_faces.push(last_face);
//     
//     ci = (i + 1) % color_ln;
//     if(draw) last_face.draw({ color: colors[ci] })
//     
//     if(!last_face.consistencyTest({ test_neighbor: false, 
//                                    test_successor: true, 
//                                    test_face: true })) {
//       console.error(`Failed consistency test at last face`);
//       //return new_faces;                                                  
//     }
//           
//     partition.partitioned_segments.add(s);    
        
                

     

    
