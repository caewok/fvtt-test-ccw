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

import { pointsEqual } from "./utilities.js";
import { pointForSegmentGivenX } from "./IntersectionsSweep.js";
import { SkipList } from "./SkipList.js";
import { MODULE_ID } from "./module.js";
import { drawVertex, drawEdge, COLORS, clearLabels, labelVertex } from "./Drawing.js";
import { DoubleLinkedList } from "./DoubleLinkedList.js";
import { interpolationFindIndexBefore } from "./BinarySearch.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";

export function sweepMyers(segments, reportFn = (e1, e2, ix) => {}) {
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
    if(debug) {
      console.log(`BEG[${i}]`);
      console.table(BEG[i], ["_id", "_node", "_work", "_work_i"]);
    }

    for(let e of BEG[i]) {
      e._node = xot.insert(e);
      if(debug) {
        console.log(`\tAdding ${e.id}: ${e.nw.x},${e.nw.y}|${e.se.x},${e.se.y}`);
        drawEdge(e);
      }

      let f = e._node && e._node.next; // Below(e)
      f = (!f || f.isSentinel) ? undefined : f.data;
      if(f) {
        remove(f, WORK);
        enter(f, WORK, EVENT);
      }
      enter(e, WORK, EVENT);
      report(e, sweep_x, reportFn, REPORT_CONDITION.Begin);
    }

    // 4B
    // Find all intersections with segments in VERT(i)
    if(debug) {
      console.log(`VERT[${i}]`);
      console.table(VERT[i], ["_id", "_node", "_work", "_work_i"]);
    }
    for(let e of VERT[i]) {
      e._node = xot.insert(e);
      report(e, sweep_x, reportFn, REPORT_CONDITION.Vertical);
    }

    for(let e of VERT[i]) {
      deleteFromXOT(e, xot);
    }

    // 4C
    // Delete segments in END(i)
    if(debug) {
      console.log(`END[${i}]`);
      console.table(END[i], ["_id", "_node", "_work", "_work_i"]);
    }
    for(let e of END[i]) {
      if(xot.length === 0) break;
      if(!e._node) continue;

      let f = e._node.next; // Below(e)
      f = (!f || f.isSentinel) ? undefined : f.data;

      deleteFromXOT(e, xot);
      remove(e, WORK);
      if(f) {
        remove(f, WORK);
        enter(f, WORK, EVENT);
      }
    }

    // 4D
    // Find all "event exchange" intersections in [xi, xi+1]
    let iter = 0;
    let max_iter = 1_000;
    if(debug) {
      console.log(`WORK[${i}]`);
      console.table(WORK[i].inorder(), ["_id"]);
    }
    while(WORK[i].length > 0 && iter < max_iter) {
      iter += 1;

      let e = pop(i, WORK);
      //let g = e._node.prev.isSentinel ? undefined : e._node.prev.data; // Above(e)
      if(!e._node) continue; // likely already removed as an endpoint

      let g = e._node.prev.data; // Above(e)
      let ix = foundry.utils.lineLineIntersection(e.nw, e.se, g.nw, g.se);
      if(ix) {
        if(debug) {
          console.log(`${e.id} (e) and ${g.id} (above(e)) intersect at ${ix.x},${ix.y}`);
          drawVertex(ix);
        }
        reportFn(e, g, ix);
      }

      let f = e._node && e._node.next; // Below(e)
      f = (!f || f.isSentinel) ? undefined : f.data;
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


// Conditions are negated compared to Myers p. 633
let REPORT_CONDITION = {
  // y1 is not between [y2, y3]
  Vertical: (y1, y2, y3) => y1 < y2 || y1 > y3,
  Begin: (y1, y2) => y1 !== y2,
  End: (y1, y2, y3) => y1 !== y3
};


function report(e, sweep_x, reportFn, cond) {
  _reportDirection(e, sweep_x, reportFn, cond, "next");
  _reportDirection(e, sweep_x, reportFn, cond, "prev");
}

function _reportDirection(e, sweep_x, reportFn, cond, dir) {
  let g = e._node[dir].isSentinel ? undefined : e._node[dir].data; // Below(e) or Above(e)

  let iter = 0;
  let max_iter = 10_000;
  while(g && iter < max_iter) {
    iter += 1;
    let yg = pointForSegmentGivenX(g, sweep_x).y;
    if(cond(yg, e.nw.y, e.se.y) && !pointsEqual(e.se, g.se)) { break; } // if the se points are equal, they would get placed in WORK but be removed prior to processing.

    if(game.modules.get(MODULE_ID).api.debug) { console.log(`${e.id} and ${g.id} intersect`); }
    let ix = foundry.utils.lineLineIntersection(e.nw, e.se, g.nw, g.se);
    if(ix) {
      if(game.modules.get(MODULE_ID).api.debug) {
        drawVertex(ix);
      }
      reportFn(e, g, ix);
    }
    g = g._node[dir].isSentinel ? undefined : g._node[dir].data; // Below(e) or Above(e)
  }
  if(iter >= max_iter) { console.log("_reportDirection: hit max iterations."); }
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

function deleteFromXOT(s, xot) {
  xot.removeNode(s._node);
  s._node = undefined;
}

function pop(i, WORK) {
  let s = WORK[i].pop();
  s._work = undefined;
  s._work_i = undefined;
  return s;
}

function enter(e, WORK, EVENT) {
  if(!e._node) return;
  let g = e._node.prev.isSentinel ? undefined : e._node.prev.data; // Above(e)
  if(!g) return;

  // if(g && e > min(xe",xg")g) then push(e, Hash(e,g))
  // (" means the se endpoint)
  // e greater than g at x when x is minimum of e.se.x or g.se.x?

  // see p. 628. 1.3. e @ xi < f @ xi and e @ xi+1 > f @ x+1 or
  //                  f @ xi < e @ xi and f @ xi+1 > e @ xi+1

  // Replicates xOrder function from XOT class, but with modifications for
  // how to determine the sweep_x point
  // set y1 and y2 as if e.se and g.se were equal

  let y1 = e.se.y;
  let y2 = e.se.y;
  if(e.se.x < g.se.x) {
    // min is xe"; find g at xe"
    y1 = e.se.y;
    const p2 = pointForSegmentGivenX(g, e.se.x);
    y2 = p2 ? p2.y : g.nw.y;

  } else if(e.se.x > g.se.x) {
    // min is xg"; find e at xg"
    const p1 = pointForSegmentGivenX(e, g.se.x);
    y1 = p1 ? p1.y : e.nw.y;
    y2 = g.se.y;
  }
  let dy = y1 - y2;
  let cmp = dy || XOT.slope(e) - XOT.slope(g);
  if(cmp < 0) {
    let i = hash(e, g, EVENT);
    if(~i) {
      if(game.modules.get(MODULE_ID).api.debug) { console.log(`Adding ${e.id} to WORK ${i}.`); }
      e._work = WORK[i].push(e);
      e._work_i = i;
    }
  }
}

function remove(e, WORK) {
  if(!e._work) return;
  if(game.modules.get(MODULE_ID).api.debug) { console.log(`Removing ${e.id} from WORK ${e._work_i}.`); }
  WORK[e._work_i].removeNode(e._work);
  e._work_i = undefined;
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
  if(game.modules.get(MODULE_ID).api.debug) {
    console.log(`Intersection likely at x = ${x}`);
    drawEdge({A: {x: x, y: canvas.dimensions.height}, B: {x: x, y: 0}}, COLORS.red, .2);
  }

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
                    B: { x: Number.MAX_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER },
                    id: "minSentinel"}; // id just for debugging
    let max_seg = { A: { x: Number.MIN_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER },
                    B: { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER },
                    id: "maxSentinel"}; // id just for debugging

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
        id: s.id,
        segment: `${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`,
      };
    }), ["id", "segment"]);
  }

  xOrder(s1, s2) {
    // Myers p. 627
    // compare y coordinates at the sweep point; fall back to starting endpoint if vertical
    let p1 = pointForSegmentGivenX(s1, this._sweep_x);
    let p2 = pointForSegmentGivenX(s2, this._sweep_x);
    let y1 = p1 ? p1.y : s1.nw.y;
    let y2 = p2 ? p2.y : s2.nw.y;
    let dy = y1 - y2;
    return dy || (XOT.slope(s1) - XOT.slope(s2));
  }

  static slope(s) {
    const dx = s.se.x - s.nw.x;
    if(!dx) { return Number.POSITIVE_INFINITY; }
    return (s.se.y - s.nw.y) / dx;
  }
}