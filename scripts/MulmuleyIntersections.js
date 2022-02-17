/* globals
canvas,
foundry,
PIXI,
CONFIG,
_pixi_graphics_smooth,
game
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

const MODULE_ID = 'testccw';
const log = function(...args) {
  try {
    if (game.modules.get(MODULE_ID).api.debug) {
      console.log(MODULE_ID, '|', ...args);
    }
  } catch (e) {
    // empty
  }
}

function compareXY(a, b) {
  return ( a.x - b.x ) || (a.y - b.y );
}

// Used in Partition.addSegment; LEFT/RIGHT in _buildSegmentIntersectionFaces
const BOTTOM = 0;
const TOP = 1;

const TOPRIGHT = 0;
const BOTTOMRIGHT = 1;
const TOPLEFT = 2;
const BOTTOMLEFT = 3;

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

  static keyFromPoint(p) { return (Math.round(p.x) << 16) ^ Math.round(p.y);}

  static fromPoint(p) { return new this(p.x, p.y); }

  draw({ color = COLORS.red, alpha = 1, radius = 5 } = {}) {
    canvas.controls.debug
      .beginFill(color, alpha)
      .drawCircle(this.x, this.y, radius)
      .endFill();
  }

  static drawPoint(p, { color = COLORS.red, alpha = 1, radius = 5 } = {}) {
    Vertex.fromPoint(p).draw({ color, alpha, radius });
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

  contains(p) {
    // is p collinear?
    if(!foundry.utils.orient2dFast(this.A, this.B, p).almostEqual(0)) return false;

    // is the distance between a, p + distance between b,p equal to distance a,b?
    const distAB = Math.hypot(this.A, this.B);
    const distAP = Math.hypot(this.A, p);
    const distBP = Math.hypot(this.B, p);

    return (distAP + distBP).almostEqual(distAB);
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

  traverseRight(v) {
    if(!(v instanceof Adjacency)) {
      console.error(`Need to convert Vertex to Adjacency for Segment.traverse.`);
    }

    const max_xy = this.max_xy;
    const min_xy = this.min_xy;

    if(!(v instanceof Adjacency)) {
      console.error(`Need to convert Vertex to Adjacency for Segment.traverse.`);
    }

    const ln = v.face.adjacencies.length;
    let i = 0;
    let curr = v;
    while(i < ln && foundry.utils.orient2dFast(max_xy, min_xy, curr) > 0) {
      curr = curr.successor;
      i += 1;
    }

    return curr;
  }

  traverse(v) {
    const max_xy = this.max_xy;
    const min_xy = this.min_xy;

    const ln = v.face.adjacencies.length;
    let i = 0;

    // start with an adjacency to the right of s
    let curr = this.traverseRight(v);

    // now find the first adjacency to the left of s
    let successor = curr.successor;
    while(i < ln && foundry.utils.orient2dFast(max_xy, min_xy, successor) < 0) {
      curr = successor;
      successor = curr.successor;
      i += 1;
    }

    if(i >= ln) {
      console.warn(`traverse hit i for ${v.label}`);
    }

    // match right with TOP, left with BOTTOM b/c when moving
    // east --> west along a segment s, the right will be towards the TOP
    // useful when opening/closing faces
    const out = Array(2);
    out[TOP] = curr; // right
    out[BOTTOM] = successor; // left
    return out;
  }

  _transitionAttachment(left, right, l_endpoint) {
    // left|right is vertical, with right at the top
    // so, what is the fastest way to calculate x,y point on S at a known x value?
    // y = mx + b; b = y - mx
    // works unless s is vertical...
    if(!isFinite(this.slope)) {
      console.error(`transition currently requires finite slope (non-vertical) s.`);
    }
    const new_y = this.calculateY(l_endpoint.x);
    const e_is_left = foundry.utils.orient2dFast(this.max_xy,
                                                 this.min_xy,
                                                 l_endpoint) > 0;

    // next_v provides a vertex with the next face, after s crosses through left|right
    return {
      next_v: e_is_left ? right.neighbor : left.neighbor,
      is_left: e_is_left,
      ix: new Vertex(l_endpoint.x, new_y)
    };
  }

  _transitionIntersection(left, right) {
    // we are crossing a segment: right|left.
    // mark the intersection
    const ix = foundry.utils.lineLineIntersection(this.max_xy, this.min_xy, left, right);
    if(!ix) {
      console.error(`Transition expected an intersection at ${this.max_xy.label} | ${this.min_xy.label} x ${left.label} | ${right.label}`);

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

    let other_segment = left.segment ?? right.segment;
    if(!other_segment) {
      // should mean both left and right are intersections; get the intersection of their
      // segments
      if(!left.segments || !right.segments) {
        console.error(`Face.transition: No segments found.`);
      }
      other_segment = [...left.segments.intersection(right.segments)][0];
      if(!other_segment) {
        console.error(`Face.transition: No segment found.`);
      }
    }

    // is the other segment right endpoint above (to right) or below (to left) of s?
    // orient2d positive if c is to the left of s (this)
    const s0_below = foundry.utils.orient2dFast(this.max_xy, this.min_xy, other_segment.max_xy) < 0;

//     const s0_below = this.max_xy.y > other_segment.max_xy.y;
    //const s_rising = max_xy.y > ix.y; //
    log(`Transition: s0 is ${s0_below ? "below" : "above"} other right endpoint.`);

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
      s0_below: s0_below,
      other_segment: other_segment
    };

  }

  transition(traversal) {
    const left = traversal[BOTTOM];
    const right = traversal[TOP];

    if(!(left instanceof Adjacency) ||
       !(right instanceof Adjacency)) {
      console.error(`Need to convert to Adjacency for Face.traverse.`);
    }

    // is left|right vertical and associated with the same endpoint?
    // then we have a vertical attachment
    const l_endpoint = left.endpoint || left.neighboring_endpoint;
    const r_endpoint = right.endpoint || right.neighboring_endpoint;
    if(left.x === right.x && l_endpoint === r_endpoint) {
      return this._transitionAttachment(left, right, l_endpoint);
    }

    // otherwise we are crossing another segment: right|left.
    return this._transitionIntersection(left, right);
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


  openNextV(v0, next_v) {
    // store next_v temporarily
    this.adjacencies.push(v0);

    let dir = this.orientation === TOP ? "successor" : "predecessor";
    this._next_v = next_v[dir];
    this.adjacencies.push(this._next_v);
  }


  openIx(ix, next_v) {
    this.adjacencies.push(ix);
    this._next_v = next_v;
  }

  updateNextV(next_v) {
    let dir = this.orientation === TOP ? "successor" : "predecessor";

    let curr = this._next_v[dir];
    let i_max = 100;
    let i = 0;
    while(curr.x > next_v.x && i < i_max) {
      i += 1;
      this.adjacencies.push(curr);
      curr = curr[dir];
    }
    this._next_v = next_v;

    if(i >= i_max) { console.error(`updateNextV hit i_max`);}
  }

  closeNextV(v0, closing_v) {
    this.updateNextV(closing_v);
    this.adjacencies.push(closing_v);
    this.adjacencies.push(v0);
    if(this.orientation === BOTTOM) this.adjacencies.reverse();
    this._linkAdjacencies();
  }

  updateIx(ix, s0) {
    // like updateNextV, but stop when to the left/right of the line
    let dir = this.orientation === TOP ? "successor" : "predecessor";

    // orient2d positive if c is to the left of the a|b line
    const done = this.orientation === TOP ?
      (c) => foundry.utils.orient2dFast(s0, ix, c) > 0 :
      (c) => foundry.utils.orient2dFast(s0, ix, c) < 0;

    let curr = this._next_v[dir];
    let i_max = 100;
    let i = 0;


    while(!done(curr) && i < i_max) {
      i += 1;
      this.adjacencies.push(curr);
      curr = curr[dir];
    }
    this._next_v = curr;

    if(i >= i_max) { console.error(`updateNextV hit i_max`);}
  }

  closeIx(ix, s0) {
    this.updateIx(ix, s0);
    this.adjacencies.push(ix);
    if(this.orientation === BOTTOM) this.adjacencies.reverse();
    this._linkAdjacencies();
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
    //if(this.equals(this.successor)) {
  if(this.x === this.successor.x && this.y === this.successor.y) {
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
    this.adjacencies = new Set();

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

    // whether to run consistency checks
    this.consistency_check = true;
  }

  get faces() {
    const faces = new Set();
    this.adjacencies.forEach(adj => faces.add(adj.face));
    return faces;
  }

  calculateIntersections() {
    // use for loop solely to avoid infinite loops on errors
    const ln = this.process_queue.length;
    for(let i = 0; i < ln; i += 1) {
      this.addSegment();
    }
    return this.intersections;
  }


  _buildAdjacencies(adjs, face) {
    //this.faces.add(face);

    adjs.forEach(adj => this.adjacencies.add(adj));
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
      return Adjacency.fromVertex(v, f);
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

    initial_face.adjacencies.forEach(adj => this.adjacencies.add(adj));

    let prior_top = initial_face.adjacencies[ADJS.tl];
    let prior_bottom = initial_face.adjacencies[ADJS.bl];

    // move left-to-right through sorted endpoints
    let prior_e;
    this.endpoints.forEach(e => {
      // can skip opening and just supply the 4 adjacencies in order
      const f = Face.create(new Adjacency(e.x, y_bottom),        // br
                            new Adjacency(e.x, y_top),           // tr
                            Adjacency.fromVertex(prior_top),     // tl
                            Adjacency.fromVertex(prior_bottom)); // bl

      // set the neighbors for the left side
      f.adjacencies[ADJS.tl].setNeighbor(prior_top);
      f.adjacencies[ADJS.bl].setNeighbor(prior_bottom);

      // set the endpoint links for the adjacencies
      // attachments point to the right face
      if(prior_e) {
        prior_e.attachments = new Array(2);
        prior_e.attachments[BOTTOM] = f.adjacencies[ADJS.bl];
        prior_e.attachments[TOP] = f.adjacencies[ADJS.tl];
        f.adjacencies[ADJS.bl].endpoint = prior_e;
        f.adjacencies[ADJS.tl].endpoint = prior_e;

      }



      // attachments point to the left face
//       e.attachments = new Array(2);
//       e.attachments[BOTTOM] = f.adjacencies[ADJS.br];
//       e.attachments[TOP] = f.adjacencies[ADJS.tr];
//       f.adjacencies[ADJS.br].endpoint = e;
//       f.adjacencies[ADJS.tr].endpoint = e;

      prior_top = f.adjacencies[ADJS.tr];
      prior_bottom = f.adjacencies[ADJS.br];
      prior_e = e;

      this.adjacencies.add(prior_top);
      this.adjacencies.add(prior_bottom);
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

    prior_e.attachments = new Array(2);
    prior_e.attachments[BOTTOM] = last_f.adjacencies[ADJS.bl];
    prior_e.attachments[TOP] = last_f.adjacencies[ADJS.tl];
    last_f.adjacencies[ADJS.bl].endpoint = prior_e;
    last_f.adjacencies[ADJS.tl].endpoint = prior_e;
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

  _buildSegmentIntersectionFaces(s, traversal, transition, curr_faces) {
/*
Can think of intersection of two segments as forming a box divided into 4.
If s goes from s0 on the right to s1 on the left, and intersects
t, we get:
   |
 tl| tr
--------- s0
 bl| br
   |
   t

So we can think of the faces to the right of t as top (above s) and
bottom (below s). We will close these faces.

If s intersects t at an angle, tr or br will be acute angles with respect to
the intersection.
*/

    let s0 = s.max_xy;
//     let pos = transition.s0_below ? TOP : BOTTOM;
    //let opp = pos ^ 1;
    let old_faces = [];

    // intersection needs 4 adjacencies: tr, tl, bl, br
    let ix_adjs = [ Adjacency.fromVertex(transition.ix),
                    Adjacency.fromVertex(transition.ix),
                    Adjacency.fromVertex(transition.ix),
                    Adjacency.fromVertex(transition.ix)];

    // Set neighbors CCW
    ix_adjs[TOPLEFT].neighbor = ix_adjs[TOPRIGHT];
    ix_adjs[BOTTOMLEFT].neighbor = ix_adjs[TOPLEFT];
    ix_adjs[BOTTOMRIGHT].neighbor = ix_adjs[BOTTOMLEFT];
    ix_adjs[TOPRIGHT].neighbor = ix_adjs[BOTTOMRIGHT];

    let segments = new Set([s, transition.other_segment]);
    ix_adjs.forEach(adj => adj.segments = segments);

    this.adjacencies.add(ix_adjs[TOPRIGHT]);
    this.adjacencies.add(ix_adjs[TOPLEFT]);
    this.adjacencies.add(ix_adjs[BOTTOMLEFT]);
    this.adjacencies.add(ix_adjs[BOTTOMRIGHT]);

    // 1. Close the TOP face
    curr_faces[TOP].closeIx(ix_adjs[TOPRIGHT], s0);
    old_faces.push(curr_faces[TOP]);

    log(`At intersection ${ix_adjs[TOPRIGHT].label}, \n\tclosed TOPRIGHT face ${curr_faces[TOP].label}`);

    if(this.consistency_check && !curr_faces[TOP].consistencyTest({ test_neighbor: false,
                                         test_successor: true,
                                         test_face: true })) {
      log(`Face ${curr_faces[TOP].label} failed consistency test`);
    }

    // 2. Close the BOTTOM face
    curr_faces[BOTTOM].closeIx(ix_adjs[BOTTOMRIGHT], s0);
    old_faces.push(curr_faces[BOTTOM]);

    log(`At intersection ${ix_adjs[BOTTOMRIGHT].label}, \n\tclosed BOTTOMRIGHT face ${curr_faces[BOTTOM].label}`);

    if(this.consistency_check && !curr_faces[BOTTOM].consistencyTest({ test_neighbor: false,
                                         test_successor: true,
                                         test_face: true })) {
      log(`Face ${curr_faces[BOTTOM].label} failed consistency test`);
    }

    // 3. open face for the TOPLEFT adjacency
    // Build the next_v using the intersection

    let top_next_v = transition.s0_below ? transition.next_v : transition.next_v.successor;
    ix_adjs[TOPLEFT].successor = top_next_v;

    // for top s0, when TR is obtuse angle
//     ix_adjs[TOPLEFT].successor = transition.next_v.successor;

    // for top s0, when TR is acute angle (next_v faces down)
//     ix_adjs[TOPLEFT].successor = transition.next_v.successor;

    // for bottom s0, when TR is acute angle
//     ix_adjs[TOPLEFT].successor = transition.next_v;



    curr_faces[TOP] = new Face({ orientation: TOP });
    curr_faces[TOP].openIx(ix_adjs[TOPLEFT], ix_adjs[TOPLEFT]);
    log(`At intersection ${ix_adjs[TOPLEFT].label}, \n\topened TOPLEFT face ${curr_faces[TOP].label}`);

    // 4. open face for the BOTTOMLEFT adjacency
    // Build the next_v using the intersection
    let bottom_next_v = transition.s0_below ? transition.next_v.predecessor : transition.next_v;
    ix_adjs[BOTTOMLEFT].predecessor = bottom_next_v;

    // shape goes, ccw, transition.next_v --> ix --> transition.next_v.successor
    // to ensure transition.next_v is picked up as part of face,
    //   set the predecessor and successor for ix

    // for top s0, when TR is obtuse angle
//     ix_adjs[BOTTOMLEFT].predecessor = transition.next_v;

    // for top s0, when TR is acute angle (next_v faces down)
//     ix_adjs[BOTTOMLEFT].predecessor = transition.next_v;

    // for bottom s0, when TR is acute angle
//     ix_adjs[BOTTOMLEFT].predecessor = transition.next_v.predecessor

    curr_faces[BOTTOM] = new Face({ orientation: BOTTOM });
    curr_faces[BOTTOM].openIx(ix_adjs[BOTTOMLEFT], ix_adjs[BOTTOMLEFT]);
    log(`At intersection ${ix_adjs[BOTTOMLEFT].label}, \n\topened BOTTOMLEFT face ${curr_faces[BOTTOM].label}`);

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

  _buildStartSegmentFaces(s) {
    let s0 = s.max_xy;
    let curr_faces = Array(2);

    // Create adjacencies at s0. These will link to the nw face (TOP) and sw face (BOTTOM)
    let s0nw = Adjacency.fromVertex(s0);
    let s0sw = Adjacency.fromVertex(s0);

    s0nw.segment = s;
    s0sw.segment = s;

    // link the adjacencies as neighbors, plus link to endpoint
    s0nw.neighboring_endpoint = s0; // link adjacency back to s0 endpoint
    s0sw.neighboring_endpoint = s0; // link adjacency back to s0 endpoint
    s0nw.setNeighbor(s0sw);

    curr_faces[TOP] = new Face({ orientation: TOP });
    curr_faces[TOP].openNextV(s0nw, s0.attachments[BOTTOM].neighbor);

    curr_faces[BOTTOM] = new Face({ orientation: BOTTOM });
    curr_faces[BOTTOM].openNextV(s0sw, s0.attachments[TOP].neighbor);

    log(`For starting endpoint ${s.max_xy.label}, opened faces \n\t   TOP: ${curr_faces[TOP].label}\n\tBOTTOM: ${curr_faces[BOTTOM].label}`);

    this.adjacencies.add(s0nw);
    this.adjacencies.add(s0sw);

    return curr_faces;
  }

  _closeEndSegmentFaces(s, traversal, transition, curr_faces) {
    let pos = transition.is_left ? BOTTOM : TOP;
    let opp = pos ^ 1;
    let s1 = s.min_xy;

    let ix_adj1 = Adjacency.fromVertex(transition.ix);
    let ix_adj2 = Adjacency.fromVertex(transition.ix);

    ix_adj1.segment = s;
    ix_adj2.segment = s;
    ix_adj1.setNeighbor(ix_adj2);

    ix_adj1.neighboring_endpoint = s1;
    ix_adj2.neighboring_endpoint = s1;

    // close one face
    curr_faces[pos].closeNextV(ix_adj1, traversal[pos]);
    log(`At ix ${ix_adj1.label}, \n\tclosed ${pos === BOTTOM ? "BOTTOM" : "TOP"} face ${curr_faces[pos].label}`);

    if(this.consistency_check && !curr_faces[pos].consistencyTest({ test_neighbor: false,
                                         test_successor: true,
                                         test_face: true })) {
      log(`Face ${curr_faces[pos].label} failed consistency test`);
    }


    // close the other face
    curr_faces[opp].closeNextV(ix_adj2, traversal[opp]);
    log(`At ix ${ix_adj2.label}, \n\tclosed ${opp === BOTTOM ? "BOTTOM" : "TOP"} face ${curr_faces[opp].label}`);

    if(this.consistency_check && !curr_faces[opp].consistencyTest({ test_neighbor: false,
                                         test_successor: true,
                                         test_face: true })) {
      log(`Face ${curr_faces[opp].label} failed consistency test`);

    }

    this.adjacencies.add(ix_adj1);
    this.adjacencies.add(ix_adj2);

    return curr_faces;
  }

  _buildSegmentFace(s, traversal, transition, curr_faces) {
    let pos = transition.is_left ? BOTTOM : TOP;
    let opp = pos ^ 1;

    let ix_adj1 = Adjacency.fromVertex(transition.ix);
    let ix_adj2 = Adjacency.fromVertex(transition.ix);

    ix_adj1.segment = s;
    ix_adj2.segment = s;
    ix_adj1.setNeighbor(ix_adj2);

    // only needed to capture faces that contain processed intersections
    // needs to happen before closing the pos face, because after intersections,
    // closing the pos face can modify the face._next_v predecessor/successor
    curr_faces[opp].updateNextV(transition.next_v);
    log(`At ix ${ix_adj1.label}: \n\tupdated ${opp === BOTTOM ? "BOTTOM" : "TOP"} face ${curr_faces[opp].label}`);


    // move the attachment for this next endpoint at the opposite side
    // position === bottom: top attachment for right|left line moved down to s
    // position === top: bottom attachment moved up
    // attachments point to the right face (ix_adj1)
    ix_adj1.endpoint = transition.next_v.neighbor.endpoint;
    this.adjacencies.delete(ix_adj1.endpoint.attachments[opp]);
    ix_adj1.endpoint.attachments[opp] = ix_adj1;

    // drop the adjacency opposite where we closed
//     this.adjacencies.delete(traversal[opp]);
    this.adjacencies.delete(traversal[opp].neighbor);

    // close old face by tracing the prior left/right face in the opposite direction
    // this time, include left/right in the adjacencies
    curr_faces[pos].closeNextV(ix_adj1, traversal[pos]);

    log(`At ix ${ix_adj1.label}, \n\tclosed ${pos === BOTTOM ? "BOTTOM" : "TOP"} face ${curr_faces[pos].label}`);

    if(this.consistency_check && !curr_faces[pos].consistencyTest({ test_neighbor: false,
                                         test_successor: true,
                                         test_face: true })) {
      log(`Face ${curr_faces[pos].label} failed consistency test`);
    }

    // store old face to return
    let old_face = curr_faces[pos];

    // open new face by tracing the current left/right like with the starting point
    curr_faces[pos] = new Face({ orientation: pos });
    curr_faces[pos].openNextV(ix_adj2, transition.next_v);


    log(`At ix ${ix_adj1.label}, \n\topened ${pos === BOTTOM ? "BOTTOM" : "TOP"} face ${curr_faces[pos].label}`);



    this.adjacencies.add(ix_adj1);
    this.adjacencies.add(ix_adj2);

    return [old_face];
  }

    addSegment({ draw = false, idx = undefined } = {}) {
      // ------ Initial setup ----- //
      // randomly select segment or choose user-selected
      if(this.process_queue.length === 0) return false;

      if(typeof idx === "undefined") {
        idx = this.process_queue.pop();
      } else {
        if(idx > this.segments.length) {
          console.warn(`addSegment given an invalid idx ${idx}.`);
          return false;
        }

        // drop idx from the queue if it exists
        const i = this.process_queue.findIndex(elem => elem === idx);
        if(~i) { this.process_queue.splice(i, 1); }
      }

      let s = this.segments.get(idx);
      let s0 = s.max_xy;
      let s1 = s.min_xy;

      let new_faces = []; // track faces created

      if(draw) {
        log(`Adding segment ${s._index}.`);
        canvas.controls.debug.clear();
        this.labelSegments();
        this.draw({shade_faces: false});
        s.draw({width: 2});
      }

      // do the initial traverse/transition
      // (in most cases, could enter the endpoint and attachment directly,
      //  but this may fail in some cases, like when another segment
      //  is above the endpoint.)

      // arbitrarily start with the TOP face
      let curr_ix = s0;
      let curr_v = s0.attachments[TOP].neighbor;
      let traversal = s.traverse(curr_v);
      let transition = s.transition(traversal);
      curr_v = transition.next_v;
      curr_ix = transition.ix;

      let curr_faces = this._buildStartSegmentFaces(s);

      // ------ Loop over vertical attachments at endpoints ----- //
      let i = 0;
      let ln_endpoints = this.endpoints.length;
      let old_faces;
      while(i < ln_endpoints && !curr_ix.equals(s1)) {
        if(typeof transition.s0_below === "undefined") {
          old_faces = this._buildSegmentFace(s,
                                             traversal,
                                             transition,
                                             curr_faces);
        } else {
          log(`Recording intersection ${transition.ix.label}`);
          // record the intersection
          this.intersections.push({
            ix: transition.ix,
            s1: s,
            s2: transition.other_segment
          });

          old_faces = this._buildSegmentIntersectionFaces(s,
                                                          traversal,
                                                          transition,
                                                          curr_faces);
        }

        new_faces.push(...old_faces);
        old_faces.forEach(f => {
          if(draw) f.draw({ color: nextShade() });
          if(this.consistency_check && !f.consistencyTest({ test_neighbor: false,
                                  test_successor: true,
                                  test_face: true })) {
            console.error(`Failed consistency test at ${f.label}`);
          }
        });

        traversal = s.traverse(curr_v);
        transition = s.transition(traversal);

        curr_v = transition.next_v;
        curr_ix = transition.ix;
      }
      old_faces = this._closeEndSegmentFaces(s, traversal, transition, curr_faces);

      new_faces.push(...old_faces);
      old_faces.forEach(f => {
        if(draw) f.draw({ color: nextShade() });
        if(this.consistency_check && !f.consistencyTest({ test_neighbor: false,
                                test_successor: true,
                                test_face: true })) {
          console.error(`Failed consistency test at last face ${f.label}`);
        }
      });


      // ---------- Cleanup ------------ //

      this.partitioned_segments.add(s);

      if(this.consistency_check) this.consistencyTest({ test_neighbor: true,
                            test_successor: true,
                            test_face: true });

      return new_faces;
    }



  draw({ shade_faces = true, clear = true, label = true } = {}) {
    if(clear) canvas.controls.debug.clear();
    if(label) this.labelSegments();

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
    const d = canvas.controls.debug;

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
    });
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
    this.adjacencies.forEach(adj => {
      const key = adj.key;
      if(!adj.consistencyTest({ test_neighbor, test_successor, test_face })) {
        console.error(`adj ${adj.label} fails consistency test.`, adj, this);
        return false;
      }

      if(adj.key !== key) {
        console.error(`adj ${adj.label} (${key}) does not match.`, adj, this);
        return false;
      }
    });

    // confirm each endpoint has an adjacency
    this.endpoints.forEach(e => {
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

    });

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
};

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
  };
}

let nextShade = nextShadeFn();
