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

function randomPositiveZeroInteger(max) {
  return Math.floor(Math.random() * max)
}


function compareXY(a, b) { 
  return ( a.x - b.x ) || (a.y - b.y );
}

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
    this.adjacencies = new Set();
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
    
    let curr = v;
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
    
    // if right or its neighbor have an endpoint, we are crossing a vertical attachment.
    // find the next face using the neighbor
    const endpoint = right.endpoint || right.neighbor.endpoint;
    if(endpoint) {
      // left|right is vertical, with right at the top
      // so, what is the fastest way to calculate x,y point on S at a known x value?
      // y = mx + b; b = y - mx
      // works unless s is vertical...
      const m = (s.B.y - s.A.y) / (s.B.x - s.A.x);
      if(!isFinite(m)) {
        console.error(`transition currently requires finite slope (non-vertical) s.`);
      }
      const b = s.A.y - m * s.A.x;
      const new_y = m * endpoint.x + b;
      
      
      
      const e_is_left = foundry.utils.orient2dFast(max_xy, min_xy, endpoint) > 0;
//       if(e_is_left) {
//         // if endpoint is to the left of S, the right vertex is shifted down 
//         // to the intersection of S with left|right     
//         right.y = new_y;
//         right.neighbor.y = new_y;
//         right._key = undefined;
//         right.neighbor._key = undefined;
//         
//         // right face changes
//         right.face.adjacencies.delete(right);
//         right.neighbor.face.adjacencies.delete(right.neighbor)
//         // right.face becomes new face between right, left, and 
//         
//       } else {
//         // if endpoint is to the right of S, the left vertex is shifted up
//         // to the intersection of S with left|right
//         left.y = new_y;
//         left.neighbor.y = new_y;
//         left._key = undefined;
//         left.neighbor._key = undefined;
//         
//         left.face.adjacencies.delete(left);
//         left.neighbor.face.adjacencies.delete(left.neighbor);
//         
//       }
    
      // if endpoint is to left of S, right.neighbor gives the next vertex in R i+1
      // if endpoint is to the right of S, left.neighbor gives the next vertex?
      return {
        next_v: e_is_left ? right.neighbor : left.neighbor,
        new_y: new_y,
        is_left: e_is_left,
        ix: new Vertex(endpoint.x, new_y)
      }
    }
    


    let h = left.neighbor;
    
    // we are crossing a segment: right|left.
    // mark the intersection
    const ix = foundry.utils.lineLineIntersection(max_xy, min_xy, left, right);
    if(!ix) {
      console.error(`Transition expected an intersection at ${max_xy.label} | ${min_xy.label} x ${left.label} | ${right.label}`);

    }  
    
    this.intersections.push({
      ix: ix,
      s1: s,
      s2: endpoint.segment // TO-DO: I think endpoint is undefined
    });
    

    // walk along the segment right|left to the left, turning around at the endpoint
    // and find the first vertex on the other "side" that is to the right of S.
    // one approach is to use 
    // use the intersection to determine if each successor is ccw or cw.
    // but likely faster to compare x-coordinate of the point with the intersection.
    // see discussion at Mulmuley p. 261–62.
    
    let curr = h;
    let successor = curr.successor;
    
    const ln = 100;//this.adjacencies.size * 10;
    const i = 0;
    //while(i < ln && foundry.utils.orient2dFast(max_xy, min_xy, successor) > 0) {
    while(i < ln && successor.x < ix.x) {
      curr = curr.successor.neighbor;
    }   
     
    return {
      next_v: curr.successor,
      ix: ix
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
  constructor(x, y, face, neighbor, successor) {
    super(x, y);
  
    this.face = face;
    this.neighbor = neighbor;
    this.successor = successor;
  }
  
  static fromVertex(v, face, neighbor, successor) {
    return new this(v.x, v.y, face, neighbor, successor);
  }
  
  consistencyTest() {
    // has face, neighbor, successor
    if(!this.face) {
      console.error(`${this.label} has no face.`);
      return false;
    }
    
    if(!this.neighbor) {
      console.error(`${this.label} has no neighbor.`);
      return false;
    }
    
   if(!this.successor) {
      console.error(`${this.label} has no successor.`);
      return false;
   }
   
   // neighbor should have the same location
   if(!this.equals(this.neighbor)) {
      console.error(`${this.label} has neighbor ${this.neighbor.label}.`);
      return false;     
   }
   
   // neighbor should have different face
  if(this.face === this.neighbor.face) {
      console.error(`${this.label} has neighbor ${this.neighbor.label} with different face.`);
      return false;     
   }
   
   // successor should share the same face
   if(this.face !== this.successor.face) {
      console.error(`${this.label} has successor with different face ${this.label}.`);
      return false;     
   }
   
   // successor should have different vertex
    if(this.equals(this.successor)) {
      console.error(`${this.label} has successor ${this.successor.label}.`);
      return false;     
   }  
   
   // this face should have this adjacency
   if(!this.face.adjacencies.has(this)) {
      console.error(`Face for ${this.label} does not have this adjacency.`);
      return false;         
   }
   
   // this face should have this successor
   if(!this.face.adjacencies.has(this.successor)) {
      console.error(`Face for ${this.label} does not have successor ${this.successor.label}.`);
      return false;         
   }
   
   // if there is an endpoint...
   if(!this.endpoint) return true;

   if(!this.endpoint.equals(this)) {
      console.error(`${this.label} endpoint ${this.endpoint.label} does not match.`);
      return false;         
   }   
   
  
  } 

}

class Partition {
  constructor(segments) {
    this.segments = segments.map(s => Segment.fromEdge(s));
    
    const endpoints = [];
    this.segments.forEach((s, i) => {
      // track segments for intersection reporting
      const e1 = s.A;
      const e2 = s.B;
      e1.segment = s;
      e2.segment = s;
      
      s._index = i; // for drawing/debugging
    
      endpoints.push(e1, e2); 
    });
    endpoints.sort(compareXY);
    this.endpoints = endpoints;
    
    this.faces = new Set();
    this.adjacencies = new Map();
    
    // track segments incorporated into the partition
    this.partitioned_segments = [];
  }
  
  _buildNewFace(vertices) {
    const f = new Face();
    this.faces.add(f);
    
    vertices = vertices.map(v => {
      if(v instanceof Adjacency) {
        v.face = f;
        return v;
      }
      return Adjacency.fromVertex(v, f)
    });
    
    vertices.forEach(v => this.adjacencies.set(v.key, v))
    
    f.adjacencies = new Set(vertices);    
    
    // successors are ccw to next one
    const ln = vertices.length;
    for(let i = 0; i < ln; i += 1) {
      const next_i = (i + 1) % ln;
      vertices[i].successor = vertices[next_i];
    }
    
    return { face: f, adjacencies: vertices };
  }
  
  // tr, tl, bl, br
 //  _buildNewFace(tl, tr, bl, br) {    
//     // face has vertices in ccw order
//     const f = new Face();
//     this.faces.add(f);
//     
//     const adj_tl = Adjacency.fromVertex(tl, f);
//     const adj_tr = Adjacency.fromVertex(tr, f);
//     const adj_bl = Adjacency.fromVertex(bl, f);
//     const adj_br = Adjacency.fromVertex(br, f);
//     
//     f.adjacencies.add(adj_tl);
//     f.adjacencies.add(adj_tr);
//     f.adjacencies.add(adj_bl);
//     f.adjacencies.add(adj_br);
//         
//     // successors are ccw to next one
//     adj_tr.successor = adj_tl;
//     adj_tl.successor = adj_bl;
//     adj_bl.successor = adj_br;
//     adj_br.successor = adj_tr;
//         
//     // cannot set neighbors without the other face
// //     return { tl: adj_tl, tr: adj_tr, bl: adj_bl, br: adj_br };
//     return f;
//   }
  
//   _buildNewAdjacency(p, f1, f2) {
//     const adj1 = new Adjacency(p, f1);
//     const adj2 = new Adjacency(p, f2);
//     adj1.next = adj2;
//     adj2.next = adj1;
//       
//     this.adjacencies.set(p, adj1);
//   }
    
  initialize() {
    // for each segment, get the top and bottom canvas vertices.   
    const x_left = 0;
    const x_right = canvas.dimensions.width;
     
    const y_top = 0;
    const y_bottom = canvas.dimensions.height;
    
    const tl = new Vertex(x_left, y_top);
    const tr = new Vertex(x_right, y_top);
    const bl = new Vertex(x_left, y_bottom);
    const br = new Vertex(x_right, y_bottom);
    
    
    // initial face is outside the canvas
    // (or the entire canvas, depending on how you look at it)
    this.faces.clear();
    
    const { adjacencies: first_adjacencies } = this._buildNewFace([tr, tl, bl, br]);
  
    // for tracking which vertex corresponds to the face adjacency array
    // tr, tl, bl, br
    const ADJS = { tr: 0, tl: 1, bl: 2, br: 3 };
      
    // f0 is a bit different, as we want to track the 
    // left vertices as if they were the right vertices.
    let prior_adjacencies = [...first_adjacencies];
    prior_adjacencies[ADJS.tr] = first_adjacencies[ADJS.tl];
    prior_adjacencies[ADJS.br] = first_adjacencies[ADJS.bl];
    
    
    let prior_tr = tl;
    let prior_br = bl;
  
    this.endpoints.forEach(e => {
      // as we move left-to-right, the previous face will
      // help inform the current 
      // right vertices have faces of this face and next face,
      // so have to wait until next loop for those.
      
      const tr = new Vertex(e.x, y_top);
      const br = new Vertex(e.x, y_bottom);
      const tl = prior_tr;
      const bl = prior_br;
      
      const { adjacencies } = this._buildNewFace([tr, tl, bl, br]);
      
      // set the endpoint/border links to the adjacencies
      e.borders = { top: adjacencies[ADJS.tr], 
                    bottom: adjacencies[ADJS.br]}
      
      adjacencies[ADJS.tr].endpoint = e;
      adjacencies[ADJS.br].endpoint = e;
      
      // set neighbors for the adjacencies
      adjacencies[ADJS.tl].neighbor = prior_adjacencies[ADJS.tr];
      prior_adjacencies[ADJS.tr].neighbor = adjacencies[ADJS.tl];
      
      adjacencies[ADJS.bl].neighbor = prior_adjacencies[ADJS.br];
      prior_adjacencies[ADJS.br].neighbor = adjacencies[ADJS.bl];
           
      prior_tr = tr;
      prior_br = br;     
      prior_adjacencies = adjacencies; 
    });
    
    // final step treats the prior_tr, prior_br as left vertices,
    // with right corners   
    

// tr, tl, bl, br
    
    const { adjacencies } = this._buildNewFace([tr, prior_tr, prior_br, br]);
    
    adjacencies[ADJS.tl].neighbor = prior_adjacencies[ADJS.tr];
    prior_adjacencies[ADJS.tr].neighbor = adjacencies[ADJS.tl];
      
    adjacencies[ADJS.bl].neighbor = prior_adjacencies[ADJS.br];
    prior_adjacencies[ADJS.br].neighbor = adjacencies[ADJS.bl];
    
    // and handle the right-most corners?
    adjacencies[ADJS.tr].neighbor = first_adjacencies[ADJS.tr];
    first_adjacencies[ADJS.tr].neighbor = adjacencies[ADJS.tr];
    
    adjacencies[ADJS.br].neighbor = first_adjacencies[ADJS.br];
    first_adjacencies[ADJS.br].neighbor = adjacencies[ADJS.br];    
    
    
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
  
*/    
    
    if(!idx) idx = randomPositiveZeroInteger(this.segments.length);
    const s = this.segments.splice(idx, 1)[0];
    
    if(draw) console.log(`Adding segment ${s._index} currently at idx ${idx}: ${s.label}`);
    
    this.partitioned_segments.push(s);
    
    if(draw) s.draw({width: 2})
    const colors = [COLORS.lightblue, COLORS.lightgreen, COLORS.lightred];
    
    // get the first region, R0 that S traverses, starting at
    // the max S. 
    const s0 = s.max_xy;
    const s1 = s.min_xy;
    
    // get the vertical attachment to s0
    let curr_border = s0.borders.top;        
    let curr_face = curr_border.face;
    this.faces.delete(curr_face);
    let curr_ix = s0;
    
    let curr_top_pts = [curr_ix, s0.borders.top];
    let curr_bottom_pts = [curr_ix, s0.borders.bottom];
    
    const new_faces = [];
    
    
    
    let i = 0;
    const ln_endpoints = this.endpoints.length;
    while(i < ln_endpoints && !curr_ix.equals(s1)) {
      i += 1;
      
      // for coloring
      const ci = i % 3;
  
      // do traversal / transition until we find other end of s
      const [right, left] = curr_face.traverse(curr_border, s);
      const { next_v, new_y, ix, is_left } = Face.transition(left, right, s);
        
      if(typeof new_y !== "undefined") {
        // transitioning through a vertical attachment
        curr_border = next_v.endpoint.borders.top; // should just be right.neighbor?
        curr_face = next_v.face;
        //this.faces.delete(curr_face);
//         curr_ix = ix;
        // this.adjacencies.set(ix.key, ix)
                
        if(is_left) {
          // endpoint is on bottom half
          // bottom face is now complete; build          
          curr_bottom_pts.push(left, ix);
          const { face: f_bottom, adjacencies } = this._buildNewFace(curr_bottom_pts);
          new_faces.push(f_bottom);
          
          if(draw) { f_bottom.draw({ color: colors[ci] }); }
          
          // start new bottom face from current intersection
          // but use left's neighbor, associated with the next face
          // TO-DO: Is there always only one other neighbor for this location?
          curr_bottom_pts = [ix, left.neighbor];
          
          
          // adjacencies[0] is the starting ix from somewhere to the right on the segment
          // adjacencies[length - 1] is this ix
          // this ix neighbor is the next adjacencies[0]
          // this ix endpoint needs to be added
          

          curr_ix.neighbor = adjacencies[0];
          adjacencies[0].neighbor = curr_ix;
          curr_ix = adjacencies[adjacencies.length - 1];
          this.adjacencies.set(curr_ix);
          
          //move top attachment down to ix unless we are at an endpoint of s
          if(!curr_ix.equals(s1) && !curr_ix.equals(s0)) {
            this.adjacencies.delete(next_v.endpoint.borders.top.key);
           //  curr_ix.endpoint = next_v.endpoint;
//             curr_ix.borders = next_v.borders;
            next_v.endpoint.borders.top = curr_ix;          
          }
          
        } else {
          // endpoint is on top half
          // top face is now complete; build
          curr_top_pts.push(right, ix);
          const { face: f_top, adjacencies } = this._buildNewFace(curr_top_pts);
          new_faces.push(f_top);
          if(draw) { f_top.draw({ color: colors[ci] }); }
          
          // start new top face from current intersection   
          // but use right's neighbor, associated with the next face    
          // TO-DO: Is there always only one other neighbor for this location?   
          curr_top_pts = [ix, right.neighbor];
          
          adjacencies[0].neighbor = 
          
          curr_ix.neighbor = adjacencies[0];
          adjacencies[0].neighbor = curr_ix;
          
          curr_ix = adjacencies[adjacencies.length - 1];
          this.adjacencies.set(curr_ix);

          // move bottom attachment up to ix unless we are at an endpoint of s
          if(!curr_ix.equals(s1) && !curr_ix.equals(s0)) {
            this.adjacencies.delete(next_v.endpoint.borders.bottom.key);
//             curr_ix.endpoint = next_v.endpoint;
//             curr_ix.borders = next_v.borders;
            next_v.endpoint.borders.bottom = curr_ix;
          }
        }
        
      } else {
        // transitioning through other segment
        console.log(`Need to transition through other segment.`);
      }
    
    }
    
    // one of the two last faces remain open; close
    const ci = (i + 1) % 3;
    if(curr_top_pts.some(pt => pt.x === curr_ix.x)) {
      // top closed; close bottom
      curr_bottom_pts.push(s1.borders.bottom, curr_ix);
      let { face: f_bottom } = this._buildNewFace(curr_bottom_pts);
      new_faces.push(f_bottom);
      if(draw) { f_bottom.draw({color: colors[ci]}); }
    } else {
      curr_top_pts.push(s1.borders.top, curr_ix);
      let { face: f_top } = this._buildNewFace(curr_top_pts);
      new_faces.push(f_top);
      if(draw) { f_top.draw({color: colors[ci]}); }     
    }
    
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
      s.draw({ color: COLORS.blue, width: 1});
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
  consistencyTest() {
    // confirm all adjacency successors have the same face, different vertex
    // confirm that all adjacency neighbors have the same vertex, different face
    // confirm that all adjacencies can be found in faces for the partition and vice-versa
    for(let [key, adj] of this.adjacencies.entries()) {
      adj.consistencyTest();
    
      if(adj.key !== key) {
        console.log(`adj ${adj.label} (${key}) does not match.`);
        return false;
      }

  
      if(!this.faces.has(adj.face)) {
        console.log(`adj ${adj.label} (${key}) face not in partition faces.`);
        return false;     
      }
    }

    // confirm each endpoint has an adjacency
    for(let e of this.endpoints.values()) {
      if(!(e.borders.top instanceof Adjacency)) {
        console.log(`endpoint ${e.label} does not have top adjacency.`);
        return false;    
      }
      
      if(!(e.borders.bottom instanceof Adjacency)) {
        console.log(`endpoint ${e.label} does not have bottom adjacency.`);
        return false;    
      }
  
      if(e.x !== e.borders.top.x || e.x !== e.borders.bottom.x) {
        console.log(`endpoint ${e.label} does not match adjacency.`);
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

// partition.clearLabels();
canvas.controls.debug.clear()
walls = canvas.walls.placeables;
partition = new Partition(walls);
partition.labelSegments()
partition.initialize();
partition.consistencyTest();
partition.draw({shade_faces: false});

new_faces = partition.addSegment({ draw: true });


new_faces = partition.addSegment({ draw: true, idx: 1 });
new_faces = partition.addSegment({ draw: true, idx: 5 });

// test if partition is still consistent
partition.consistencyTest();
