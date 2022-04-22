/* globals
game,
canvas,
foundry
*/

// Myers (1985)
// https://publications.mpi-cbg.de/Myers_1985_5441.pdf

/*
// Segments at Myers fig. 3
str = '[{"A":{"x":2700,"y":1000},"B":{"x":3900,"y":1800}},{"A":{"x":2700,"y":1800},"B":{"x":3900,"y":1000}},{"A":{"x":2700,"y":1400},"B":{"x":3900,"y":1400}},{"A":{"x":2700,"y":1200},"B":{"x":3900,"y":1500}},{"A":{"x":2700,"y":1600},"B":{"x":3900,"y":1300}}]'
segments = JSON.parse(str).map(s => new SimplePolygonEdge(s.A, s.B));

*/

import { pointForSegmentGivenX } from "./IntersectionsSweep.js";
import { SkipList } from "./SkipList.js";
import { MODULE_ID } from "./module.js";
import { drawVertex, drawEdge, COLORS, clearLabels, labelVertex } from "./Drawing.js";
import { compareXY, compareYX, pointsEqual } from "./utilities.js";
import { DoubleLinkedList } from "./DoubleLinkedList.js";
import { interpolationFindIndexBefore } from "./BinarySearch.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";

function SweepMeyers(segments, reportFn = (e1, e2, ix) => {}) {
  let debug = game.modules.get(MODULE_ID).api.debug;

  if(debug) {
    canvas.controls.debug.clear();
    clearLabels();
    segments.forEach(s => drawEdge(s, COLORS.black));
    segments.forEach(s => labelVertex(s.nw, s.id));
  }

  // Myers p. 626.
  // construct the lists.
  let { EVENT, BEG, VERT, END, WORK } = constructLists(segments);
  let xot = new XOT();

  if(debug) { console.table({ EVENT, BEG, VERT, END, WORK }); }

  // See algorithm 1, p. 633
  let ln = EVENT.length;
  for(let i = 0; i < ln; i += 1) {
    let sweep_x = EVENT[i];
    if(debug) { console.log(`Event x(${i}) = ${sweep_x}`); }

    xot.sweep_x = sweep_x;
    if(debug) {
      drawEdge(new SimplePolygonEdge({x: xot.sweep_x, y: 0}, {x: xot.sweep_x, y: canvas.dimensions.height}), COLORS.lightblue, 0.75);
    }

    // 4A
    // Add segments in BEG(i) and list their start point ix
    if(debug) console.table(BEG[i], ["_id", "_node", "_work", "_work_i"])

    for(let e of BEG[i]) {
      e._node = xot.insert(e);
      if(debug) {
        console.log(`\tAdding ${e.nw.x},${e.nw.y}|${e.se.x},${e.se.y}`);
        drawEdge(e);
      }

      let f = e._node.next.isSentinel ? undefined : e._node.next.data; // Below(e)
      if(f) {
        remove(f, WORK);
        enter(f, WORK, EVENT);
      }
      enter(e, WORK, EVENT);
      report(e, sweep_x, reportFn, REPORT_CONDITION.Begin);
    }

    // 4B
    // Find all intersections with segments in VERT(i)
    if(debug) console.table(VERT[i], ["_id", "_node", "_work", "_work_i"])
    for(let e of VERT[i]) {
      e._node = xot.insert(s);
      report(e, sweep_x, reportFn, REPORT_CONDITION.Vertical);
    }

    for(let e of VERT[i]) {
      xot.removeNode(e._node);
    }

    // 4C
    // Delete segments in END(i)
    if(debug) console.table(END[i], ["_id", "_node", "_work", "_work_i"])
    for(let e of END[i]) {
      let f = e._node.next.isSentinel ? undefined : e._node.next.data; // Below(e)

      xot.removeNode(e._node); // Delete(e)
      remove(e._work, WORK);
      if(f) {
        xot.removeNode(f);
        enter(f, WORK, EVENT);
      }
    }

    // 4D
    // Find all "event exchange" intersections in [xi, xi+1]
    let iter = 0;
    let max_iter = 1_000
    if(debug) { console.table(WORK[i].inorder(), ["_id"])}
    while(WORK[i].length > 0 && iter < max_iter) {
      iter += 1;
      let e = WORK[i].pop();
      //let g = e._node.prev.isSentinel ? undefined : e._node.prev.data; // Above(e)
      let g = e._node.prev.data; // Above(e)
      let ix = foundry.utils.lineLineIntersection(e.nw, e.se, g.nw, g.se);
      if(ix) {
        console.log(`${e._id} (e) and ${g._id} (above(e)) intersect at ${ix.x},${ix.y}`);
        reportFn(e, g, ix);
      }

      let f = e._node.next.isSentinel ? undefined : e._node.next.data; // Below(e)
      xot.swapNodes(e._node, g._node); // xot.swap(e) // exchange e with above(e)

      remove(e._node.prev.data, WORK);
      if(f) {
        remove(f, WORK);
        enter(f, WORK, EVENT);
      }
      enter(e, WORK, EVENT);
    }

    if(iter >= max_iter) { console.warn("Max iterations reached."); }

    if(debug) { xot.log(); console.table(WORK); }
  }
}


let REPORT_CONDITION = {
  Vertical: (y1, y2, y3) => y1 !== y2 && y1 !== y3,
  Begin: (y1, y2) => y1 !== y2
}


function report(e, sweep_x, reportFn, cond) {
  _reportDirection(e, sweep_x, reportFn, cond, "next");
  _reportDirection(e, sweep_x, reportFn, cond, "prev");
}

function _reportDirection(e, sweep_x, reportFn, cond, dir) {
  let g = e._node[dir].isSentinel ? undefined : e._node[dir].data; // Below(e) or Above(e)
  while(g) {
    yg = pointForSegmentGivenX(g, sweep_x).y;
    if(cond(yg, e.nw.y, e.se.y)) { break; }

    console.log("e and g intersect", e, g);
    let ix = foundry.utils.lineLineIntersection(e.nw, e.se, g.nw, g.se);
    if(ix) { reportFn(e, g, ix); }
    g = g._node[dir].isSentinel ? undefined : g._node[dir].data; // Below(e) or Above(e)
  }
}

// function report_vertical(e, sweep_x, reportFn) {
//   // yg(xi) ∈ [ye', ye''] means g.y at sweep_x equals e.nw.y or e.se.y
//   let g = e._node.next;  // below e
//   while(!g.isSentinel) {
//     yg = pointForSegmentGivenX(g, sweep_x).y;
//     if(yg !== e.nw.y && yg !== e.se.y) { break; }
//
//     console.log("e and g intersect", e, g);
//     let ix = foundry.utils.lineLineIntersection(e.nw, e.se, g.nw, g.se);
//     if(ix) { reportFn(e, g, ix); }
//     g = g._node.next;
//   }
//
//   g = e._node.prev; // above e
//   while(!g.isSentinel && yg === e.nw.y || yg === e.se.y) {
//     yg = pointForSegmentGivenX(g, sweep_x).y;
//     if(yg !== e.nw.y && yg !== e.se.y) { break; }
//
//     console.log("e and g intersect", e, g);
//     let ix = foundry.utils.lineLineIntersection(e.nw, e.se, g.nw, g.se);
//     if(ix) { reportFn(e, g, ix); }
//     g = g._node.prev;
//   }
// }
//
//
// function report_begin(e, sweep_x, reportFn) {
//   // yg(xi) = ey. means g.y at sweep x equals starting e.y
//   let g = e._node.next;  // below e
//   while(!g.isSentinel) {
//     yg = pointForSegmentGivenX(g, sweep_x).y;
//     if(yg !== e.nw.y) { break; }
//
//     console.log("e and g intersect", e, g);
//     let ix = foundry.utils.lineLineIntersection(e.nw, e.se, g.nw, g.se);
//     if(ix) { reportFn(e, g, ix); }
//     g = g._node.next;
//   }
//   g = e._node.prev; // above e
//   while(!g.isSentinel) {
//     yg = pointForSegmentGivenX(g, sweep_x).y;
//     if(yg !== e.nw.y) { break; }
//
//     console.log("e and g intersect", e, g);
//     let ix = foundry.utils.lineLineIntersection(e.nw, e.se, g.nw, g.se);
//     if(ix) { reportFn(e, g, ix); }
//     g = g._node.prev;
//   }
// }


function enter(e, WORK, EVENT) {
  let g = e._node.prev.isSentinel ? undefined : e._node.prev.data; // Above(e)

  // e greater than g at x where x is minimum of e.se.x or g.se.x?
  // see p. 628. 1.3. e @ xi < f @ xi and e @ xi+1 > f @ x+1 or
  // f @ xi < e @ xi and f @ xi+1 > e @ xi+1


  if(g &&
     ((e.nw.y > g.nw.y && e.se.y < g.se.y) ||
      (e.nw.y < g.nw.y && e.se.y > g.se.y))) {
    let i = hash(e, g, EVENT);
    if(~i) {
      console.log(`Adding to WORK ${i}.`, e);
      e._work = WORK[i].push(e);
      e._work_i = i;
    }
  }
}

function remove(e, WORK) {
  if(!e._work) return;
  console.log(`Removing from WORK ${e._work_i}.`, e);
  WORK[e._work_i].removeNode(e._work);
  e.work_i = undefined;
  e._work = undefined;
}

// function report(s, cond) {
//   let g = s._node.next;
//   while(!g.isSentinel && cond) {
//     // e & g intersect
//     console.log("e and g intersect", s, g);
//     g = g.next;
//   }
//   g = s._node.prev;
//   while(!g.isSentinel && cond) {
//     console.log("e and g intersect", s, g);
//     g = g.prev;
//   }
// }

/* Hash and finding the interval
Myers p. 630–31

Imagine two segments forming an X. There is some event interval, say x(i) to x(i+1), in
which they cross and thereby intersect. Before the intersection, a is above and b is
below. After the intersection, b is above and a is below. Given that we might have
lots of event intervals (sweep locations) from x(0) to x(EV), where EV = total number
of EVENTS, we want to find the correct start of the interval, x(i) to x(i+1) that
contains the intersection.

Myers suggests dividing the intervals into buckets, then searching the bucket.

Assume 10 events, ranging from x = 100 to x = 1000, at 100 pixel intervals.
EV = 10
Divide interval [x(i), x(EV)] into EV buckets of size ∆ = (x(ev) - x(1)) / EV
∆ = (1000 - 100) / 10 = 90

Assume e and f intersect at x = 450. δ = H(450) = (450 - 100) / 90 = 3.889
i in range min(δ), min(δ + 1). 3 – 4 (or maybe 3 – 5)

*/

function hash(e, g, EVENT) {
  const x = intersectX(e.nw, e.se, g.nw, g.se);
  if(typeof x === "undefined") { return; }
  return interpolationFindIndexBefore(EVENT, x);
}

function intersectX(a, b, c, d) {
  // Check denominator - avoid parallel lines where d = 0
  const dnm = ((d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y));
  if (dnm === 0) return undefined;

  // Vector distance from a
  const t0 = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / dnm;
  return a.x + t0 * (b.x - a.x);
}


function constructLists(segments) {
  const aux = [];
  segments.forEach(s => {
    // for debugging
    s._work = undefined;
    s._work_i = undefined;
    s._node = undefined;
    if(s.A.x === s.B.x) {
      // vertical segment
      const tuple = {
        segment: s,
        start_x: s.nw.x,
        type: 1,
        start_y: s.nw.y
      };

      aux.push(tuple);

    } else {
      const tuple1 = {
        segment: s,
        start_x: s.nw.x,
        type: 0,
        start_y: s.nw.y
      };

      const tuple2 = {
        segment: s,
        start_x: s.se.x,
        type: 2,
        start_y: s.se.y
      };

      aux.push(tuple1, tuple2);
    }
  });

  aux.sort(cmpAuxList);

  let curr_ev = aux[0].start_x;
  let EVENT = [curr_ev];
  let VERT = [[]];
  let BEG = [[]];
  let END = [[]];
  let WORK = [new DoubleLinkedList()];
  let ln = aux.length;
  let j = 0;
  for(let i = 0; i < ln; i += 1) {
    let tuple = aux[i];
    if(tuple.start_x !== curr_ev) {
      j += 1;
      curr_ev = tuple.start_x;
      EVENT.push(curr_ev);
      VERT.push([]);
      BEG.push([]);
      END.push([]);
      WORK.push(new DoubleLinkedList());
    }

    if(tuple.type === 0) {
      BEG[j].push(tuple.segment);
    } else if(tuple.type === 1) {
      VERT[j].push(tuple.segment);
    } else {
      END[j].push(tuple.segment);
    }
  }

  return { EVENT, VERT, BEG, END, WORK };
}

function cmpAuxList(a, b) {
  return a.start_x - b.start_x ||
         a.type - b.type ||
         a.start_y - b.start_y;
}

class XOT extends SkipList {
  constructor() {
    let min_seg = { A: { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER },
                        B: { x: Number.MAX_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER }};
    let max_seg = { A: { x: Number.MIN_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER },
                        B: { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER }};

    min_seg.nw = min_seg.A;
    min_seg.se = min_seg.B;
    max_seg.nw = max_seg.A;
    max_seg.se = max_seg.B;

    super({ minObject: min_seg, maxObject: max_seg });
    this.comparator = this.xOrder;
    this._sweep_x = Number.MIN_SAFE_INTEGER;
  }

  get sweep_x() { return this._sweep_x; }
  set sweep_x(value) { this._sweep_x = value; }

  // debug helper that displays a table of elements in the queue
  log() {
    console.log(`XOT sweep @ ${this._sweep_x}`);
    console.table(this.inorder().map(s => {
      return {
        id: s._id,
        segment: `${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`,
      };
    }), ["id", "segment"]);
  }

  xOrder(s1, s2) {
    // Myers p. 627
    // compare y coordinates at the sweep point; fall back to starting endpoint if vertical
    let y1 = pointForSegmentGivenX(s1, this._sweep_x).y || s1.nw.y;
    let y2 = pointForSegmentGivenX(s2, this._sweep_x).y || s2.nw.y;
    let dy = y1 - y2;
    if(dy) { return dy; }

    let m1 = XOT.slope(s1);
    let m2 = XOT.slope(s2);

    return m1 - m2;
  }

  static slope(s) {
    const dx = s.se.x - s.nw.x;
    if(!dx) { return Number.POSITIVE_INFINITY; }
    return (s.se.y - s.nw.y) / dx;
  }
}