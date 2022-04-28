/* globals
game,
*/

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }]*/

'use strict';

/*
Myers (1985)
https://publications.mpi-cbg.de/Myers_1985_5441.pdf

Variation on a sweep-line algorithm that seems easier to implement (and faster) than
Bentley-Ottoman.

Segments sorted by x-order into groups:
- EVENT: x-values for each segment endpoint
- BEG: The nw endpoint of each non-vertical segment.
- VERT: The x-value of each vertical segment.
- END: The se endpoint of each non-vertical segment.

Move a sweep-line across EVENTS (x coordinate of segment endpoints). At each EVENT:
1. Add segments from BEG to a skip-list ordered by their y-values at the x-coordinate
   of the EVENT. This implies that segments are re-ordered as the sweep line moves to new
   x values. This re-ordering is accomplished by swapping segments based on intersections.

2. Process segments in VERT at a given x EVENT.

3. Remove segments in END from the skip-list. In other words, once the sweep reaches the
   se endpoint, the segment can be removed.

4. During (1) and (3), segments can be "entered" into a WORK queue (a doubly-linked list)
   to be processed for intersections. Basically, the algorithm compares the nw and se
   endpoints and if they flip y-order, that means at some point the segments intersect.
   For example, the segments make an X. The trick is to insert the segment into the WORK
   queue that corresponds to the EVENT x-value right before the intersection. So
   a segment that intersects the one immediately above it between EVENT and EVENT + 1
   is inserted into the WORK queue for EVENT.

(1), (2), (3), and (4) all report intersections when found. It appears that the algorithm
only reports actual segment intersections, such that an additional intersection check
is not required. As a result, the algorithm need not report the ix point. If it is
desirable to do so, foundry.utils.lineLineIntersection can be used.

"Single": Check each segment in an array against every other segment in that array.

*/

/*
// Segments at Myers fig. 3
str = '[{"A":{"x":2700,"y":1000},"B":{"x":3900,"y":1800}},{"A":{"x":2700,"y":1800},"B":{"x":3900,"y":1000}},{"A":{"x":2700,"y":1400},"B":{"x":3900,"y":1400}},{"A":{"x":2700,"y":1200},"B":{"x":3900,"y":1500}},{"A":{"x":2700,"y":1600},"B":{"x":3900,"y":1300}}]'
segments = JSON.parse(str).map(s => new SimplePolygonEdge(s.A, s.B));

*/

import { pointForSegmentGivenX } from "./utilities.js";
import { SkipList } from "./SkipList.js";
import { MODULE_ID } from "./module.js";
import { DoubleLinkedList } from "./DoubleLinkedList.js";
import { interpolationFindIndexBeforeScalar } from "./BinarySearch.js";


/**
 * Identify intersections between segments in an Array.
 * Expected O(nlog(n) + i); Worst case O((n + i)log(n))
 * Fast for large number of segments assuming the segments do not all intersect one another.
 * - Counts shared endpoints.
 * - Passes pairs of intersecting segments to a reporting function but does not
 *   calculate the intersection point.
 * @param {Segments[]} segments   Array of objects that contain points A.x, A.y, B.x, B.y
 * @param {Function} reportFn     Callback function that is passed pairs of
 *                                segment objects that intersect.
 */
export function findIntersectionsMyersSingle(segments, reportFn = (_s1, _s2) => {}) {
  // Myers p. 626. Construct the lists. Then pass the lists to Algorithm 1.
  if(!segments.length) return;
  sweepMyers(constructLists(segments), reportFn);
}

/**
 * Identify intersections between two arrays of segments.
 * Segments within a single array are not checked for intersections.
 * (If you want intra-array, see findIntersectionsMyersSingle.)
 * Expected O(nlog(n) + i); Worst case O((n + i)log(n))
 * Only does limited trimming of segments that are obviously outside the area of interest
 * but in general runs the same sweep algorithm. Thus, the sortRedBlack algorithm
 * might be faster, depending on the total number segments to examine.
 * Fast for large number of segments assuming the segments do not all intersect one another.
 * - Counts shared endpoints.
 * - Passes pairs of intersecting segments to a reporting function but does not
 *   calculate the intersection point.
 * @param {Segments[]} segments   Array of objects that contain points A.x, A.y, B.x, B.y
 * @param {Function} reportFn     Callback function that is passed pairs of
 *                                segment objects that intersect.
 */
export function findIntersectionsMyersRedBlack(red, black, reportFn = (_s1, _s2) => {}) {
  // Myers p. 626. Construct the lists. Then pass the lists to Algorithm 1.
  if(!red.length || !black.length) return;
  sweepMyers(constructRedBlackLists(red, black), reportFn);
}

/**
 * Helper function that runs the Myers sweep algorithm.
 * @param {Object[]} Lists constructed by constructLists or constructRedBlackLists.
 * @param {Function} reportFn     Callback function that is passed pairs of
 *                                segment objects that intersect.
 */
function sweepMyers(lists, reportFn = (_s1, _s2) => {}) {
  const { EVENT, BEG, VERT, END, WORK } = lists;
  const xot = new XOT();

  // See algorithm 1, p. 633
  const ln = EVENT.length;
  for(let i = 0; i < ln; i += 1) {
    const beg = BEG[i];
    const vert = VERT[i];
    const end = END[i];
    const work = WORK[i];
    const sweep_x = EVENT[i];
    xot.sweep_x = sweep_x;

    // 4A
    // Add segments in BEG(i) and list their start point ix
    let ln = beg.length;
    for(let j = 0; j < ln; j += 1) {
      const e = beg[j];
//     for(let e of BEG[i]) {

      e._node = xot.insert(e);

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
    ln = vert.length;
    for(let j = 0; j < ln; j += 1) {
      const e = vert[j];
//     for(let e of VERT[i]) {
      e._node = xot.insert(e);
      report(e, sweep_x, reportFn, REPORT_CONDITION.Vertical);
    }

    // check the previous for an endpoint intersection with current
    // b/c if two verticals share an endpoint, they will not be picked up by report fn
    for(let j = 1; j < ln; j += 1) {
      const g = vert[j - 1];
      const e = vert[j];
      if(e.wallKeys.has(g.nw.key) || e.wallKeys.has(g.se.key)) {
        reportFn(e, g);
      }
    }

    for(let j = 0; j < ln; j += 1) {
      const e = vert[j];
      deleteFromXOT(e, xot);
    }

    // 4C
    // Delete segments in END(i)
    ln = end.length;
    for(let j = 0; j < ln; j += 1) {
      const e = end[j];
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
    while(work.length > 0) {
      const e = pop(i, WORK);
      //let g = e._node.prev.isSentinel ? undefined : e._node.prev.data; // Above(e)
      if(!e._node) continue; // likely already removed as an endpoint

      const g = e._node.prev.data; // Above(e)
      if(typeof e._red === "undefined" || (e._red ^ g._red)) { reportFn(e, g); } // skip when segments are the same color


      let f = e._node && e._node.next; // Below(e)
      f = (!f || f.isSentinel) ? undefined : f.data;
      xot.swapNodes(e._node, g._node); // xot.swap(e) // exchange e with above(e)
      remove(e._node.next.data, WORK); // remove(Below(e))

      if(f) {
        remove(f, WORK);
        enter(f, WORK, EVENT);
      }
      enter(e, WORK, EVENT);
    }
  }
}


// Tests based on Myers p. 633.
// Conditions are negated compared to Myers p. 633 so that _reportDirection can easily
// break out of the while loop.
const REPORT_CONDITION = {
  Vertical: (y1, y2, y3) => y1 < y2 || y1 > y3, // y1 is not between [y2, y3]
  Begin: (y1, y2) => y1 !== y2,
  End: (y1, y2, y3) => y1 !== y3
};


/**
 * Report intersections between e and segments above or below e in the XOT skip list.
 * Basically, walk up the XOT skip list, and then down the XOT skip list.
 * @param {Segment} e   Segment to check for intersections.
 * @param {Number}  sweep_x       X-coordinate for the current sweep position.
 * @param {Function} reportFn     Callback function for reporting segment intersections.
 * @param {REPORT_CONDITION} cond Test based on whether this segment is from VERT,
 *                                BEG, or END lists.
 */
function report(e, sweep_x, reportFn, cond) {
  _reportDirection(e, sweep_x, reportFn, cond, "next");
  _reportDirection(e, sweep_x, reportFn, cond, "prev");
}

/**
 * Helper function to report intersections between e and segments above or below e in the
 * XOT skip list.
 * @param {Segment} e             Segment to check for intersections.
 * @param {Number}  sweep_x       X-coordinate for the current sweep position.
 * @param {Function} reportFn     Callback function for reporting segment intersections.
 * @param {REPORT_CONDITION} cond Test based on whether this segment is from VERT,
 *                                BEG, or END lists.
 * @param {"next"|"prev"}         Which direction to walk from e along the skip list.
 */
function _reportDirection(e, sweep_x, reportFn, cond, dir) {
  let g = e._node[dir].isSentinel ? undefined : e._node[dir].data; // Below(e) or Above(e)
  while(g) {
    const p1 = pointForSegmentGivenX(g, sweep_x);
    const yg = p1 ? p1.y : g.nw.y;
    if(cond(yg, e.nw.y, e.se.y)) { break; }
    if(typeof e._red === "undefined" || (e._red ^ g._red)) {  reportFn(e, g); } // skip when segments are the same color


    g = g._node[dir].isSentinel ? undefined : g._node[dir].data; // Below(e) or Above(e)
  }
}

/**
 * Equivalent to Myers Delete from Algorithm 1.
 * Remove the segment s from the skip list.
 * @param {Segment} s     Segment to remove
 * @param {SkipList} xot  Skip list for tracking y-order of segments.
 */
function deleteFromXOT(s, xot) {
  xot.removeNode(s._node);
  s._node = undefined;
  s._red = undefined;
}

/**
 * Equivalent to Myers pop from Algorithm 1.
 * Remove the segment that is at the WORK list i.
 * @param {Number}              i     Index of the WORK list from which to remove the
 *                                    segment.
 * @param {DoubleLinkedList[]}  WORK  Array of double-linked lists.
 * @return {Segment} Segment popped from the work list.
 */
function pop(i, WORK) {
  let s = WORK[i].pop();
  s._work = undefined;
  s._work_i = undefined;
  return s;
}

/**
 * Equivalent to Myers enter from Algorithm 1.
 * Enter the segment e into a specific work list.
 * @param {Segment}             e     Segment to enter into the work list.
 * @param {DoubleLinkedList[]}  WORK  Array of double-linked lists.
 * @param {Number[]}            EVENT Array of x-coordinates.
 */
function enter(e, WORK, EVENT) {
  if(!e._node) return;
  const g = e._node.prev.isSentinel ? undefined : e._node.prev.data; // Above(e)
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
  const dy = y1 - y2;
  const cmp = dy || XOT.slope(e) - XOT.slope(g);
  if(cmp < 0) {
    const i = hash(e, g, EVENT);
    if(~i) {
      if(game.modules.get(MODULE_ID).api.debug) { console.log(`Adding e ${e.id} to WORK ${i} (hash e and g ${g.id}).`); }
      e._work = WORK[i].push(e);
      e._work_i = i;
    }
  }
}

/**
 * Equivalent to Myers remove from Algorithm 1.
 * Given a segment, use its link to a work node to remove the segment from the work list.
 * Because of the link, this remove can be done in O(1) time.
 * @param {Segment} e   Segment to remove from the work list.
 * @param {DoubleLinkedList[]}  WORK  Array of double-linked lists.
 */
function remove(e, WORK) {
  if(!e._work) return;
  if(game.modules.get(MODULE_ID).api.debug) { console.log(`Removing ${e.id} from WORK ${e._work_i}.`); }
  WORK[e._work_i].removeNode(e._work);
  e._work_i = undefined;
  e._work = undefined;
}

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

A reasonably close method is to binary search the EVENT array. Because x events are
more or less evenly distributed, an interpolation search works well. Alternatively,
an interpolate binary search would work.
*/

/**
 * Use a binary search method to find the EVENT i just before
 * e and g intersect.
 * @param {Segment}   e     Segment that potentially intersects with g.
 * @param {Segment}   g     Segment that potentially intersects with e.
 * @param {Number[]}  EVENT Array of x-coordinates.
 */
function hash(e, g, EVENT) {
  const x = intersectX(e.nw, e.se, g.nw, g.se);
  if(typeof x === "undefined") { return; }

  //let i = binaryFindIndex(EVENT, elem => elem > x) - 1;
  if(x === EVENT[0]) return 0;

  return interpolationFindIndexBeforeScalar(EVENT, x);
  //return interpolateBinaryFindIndexBeforeScalar(EVENT, x);
}

/**
 * Simplified version of foundry.util.lineLineIntersection that just
 * determines the x value of the intersections between a|b and c|d.
 * @param {Point} a
 * @param {Point} b
 * @param {Point} c
 * @param {Point} d
 */
function intersectX(a, b, c, d) {
  // Check denominator - avoid parallel lines where d = 0
  const dnm = ((d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y));
  if (dnm === 0) return undefined;

  // Vector distance from a
  const t0 = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / dnm;
  return a.x + t0 * (b.x - a.x);
}

/**
 * Construct the lists described in Myer p. 626:
 * - BEG, VERT, END, EVENT, and WORK
 * Each contain an array (possibly null) with ordered segments.
 * @param {Segment[]} segments
 * @return {Object} Object with the constructed lists.
 */
function constructLists(segments) {
  const aux = [];
  segments.forEach(s => buildTuple(s, aux));
  aux.sort(cmpAuxList);

  let curr_ev = aux[0].start_x;
  const EVENT = [curr_ev];
  const VERT = [[]];
  const BEG = [[]];
  const END = [[]];
  const WORK = [new DoubleLinkedList()]; // alt: DoubleLinkedObjectList
  const ln = aux.length;
  let j = 0;
  for(let i = 0; i < ln; i += 1) {
    const tuple = aux[i];
    if(tuple.start_x !== curr_ev) {
      j += 1;
      curr_ev = tuple.start_x;
      EVENT.push(curr_ev);
      VERT.push([]);
      BEG.push([]);
      END.push([]);
      WORK.push(new DoubleLinkedList());
    }

    switch(tuple.type) {
      case 0:
        BEG[j].push(tuple.segment);
        break;

      case 1:
        VERT[j].push(tuple.segment);
        break;

      case 2:
        END[j].push(tuple.segment);
        break;
    }
  }

  return { EVENT, VERT, BEG, END, WORK };
}

/**
 * Build the tuple for a given segment for sorting.
 * See Myer p. 626 and constructLists/constructRedBlackLists
 * @param {Segment} s     Segment for the tuple.
 * @param {Object[]} aux  Array to hold the tuples.
 */
function buildTuple(s, aux) {
    // for debugging and just-in-case
    s._work = undefined;
    s._work_i = undefined;
    s._node = undefined;
    s._red = undefined;
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
}


/**
 * Comparison function to sort the lists in constructLists.
 * @param {Object} a  Tuple object with segment, start_x, type, and start_y
 * @param {Object} b  Tuple object with segment, start_x, type, and start_y
 * @return {Number} Sort order
 */
function cmpAuxList(a, b) {
  return a.start_x - b.start_x ||
         a.type - b.type ||
         a.start_y - b.start_y;
}

/**
 * Helper skip list class to store the current sweep x coordinate.
 * As the algorithm swaps segments, the skip list retains valid locations at
 * the start of each iteration because the sweep moves in unison with the swaps.
 */
class XOT extends SkipList {
  constructor() {
    // Set the sentinels of the skip list to be fake segment objects.
    // y-order from top to bottom (opposite of Myer, b/c the y-axis is flipped here)
    const min_seg = { A: { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER },
                    B: { x: Number.MAX_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER },
                    id: "minSentinel"}; // id just for debugging
    const max_seg = { A: { x: Number.MIN_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER },
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

 /**
  * @type {Number}
  */
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

 /**
  * Myers p. 627
  * Compare y coordinates at the sweep point; fall back to starting endpoint if vertical
  * @param {Segment} s1
  * @parma {Segment} s2
  */
  xOrder(s1, s2) {
    const p1 = pointForSegmentGivenX(s1, this._sweep_x);
    const p2 = pointForSegmentGivenX(s2, this._sweep_x);
    const y1 = p1 ? p1.y : s1.nw.y;
    const y2 = p2 ? p2.y : s2.nw.y;
    const dy = y1 - y2;
    return dy || (XOT.slope(s1) - XOT.slope(s2));
  }

 /**
  * Calculate the slope of the segment
  * @param {Segment} s
  * @return {Number|Number.POSITIVE_INFINITY}
  */
  static slope(s) {
    const dx = s.se.x - s.nw.x;
    if(!dx) { return Number.POSITIVE_INFINITY; }
    return (s.se.y - s.nw.y) / dx;
  }
}



/**
 * Construct the lists described in Myer p. 626:
 * - BEG, VERT, END, EVENT, and WORK
 * Each contain an array (possibly null) with ordered segments.
 * For red/black, make the following adjustments versus constructLists:
 * 1. Identify the first and last indices for red and black segments.
 *    Drop any segment left that ends prior to the larger of the first red/black index.
 *    Same for segments to the right.
 * 2. Mark each segment as red/black so the primary algorithm can ignore accordingly.
 * @param {Segment[]} segments
 * @return {Object} Object with the constructed lists.
 */
function constructRedBlackLists(red, black) {
  let aux = [];

  // Track the first nw x coordinate and last se x coordinate.
  let red_nw = Number.POSITIVE_INFINITY;
  let black_nw = Number.POSITIVE_INFINITY;
  let red_se = Number.NEGATIVE_INFINITY;
  let black_se = Number.NEGATIVE_INFINITY;

  red.forEach(s => {

    red_nw = Math.min(s.nw.x, red_nw);
    red_se = Math.max(s.se.x, red_se);
    buildTuple(s, aux);
    s._red = true; // must be set after buildTuple
  });

  black.forEach(s => {
    black_nw = Math.min(s.nw.x, black_nw);
    black_se = Math.max(s.se.x, black_se);
    buildTuple(s, aux);
    s._red = false; // must be set after buildTuple
  });

  // Take the maximum of red_nw or black_nw. Any segment that ends before that point
  // (has a se x coordinate less than that) can be ignored.
  // Same at the other end: min of red_se or black_se. Any segment that ends after
  // that point can be ignored. (nw coordinate greater than that)
  // Effectively, this brackets the segments so that ending segments are dropped if
  // they definitely cannot intersect with an opposing color.
  const nw_limit = Math.max(red_nw, black_nw);
  const se_limit = Math.min(red_se, black_se);
  aux = aux.filter(t => t.segment.se.x >= nw_limit || t.segment.nw.x <= se_limit);

  aux.sort(cmpAuxList);

  let curr_ev = aux[0].start_x;
  const EVENT = [curr_ev];
  const VERT = [[]];
  const BEG = [[]];
  const END = [[]];
  const WORK = [new DoubleLinkedList()]; // alt: DoubleLinkedObjectList
  const ln = aux.length;
  let j = 0;
  for(let i = 0; i < ln; i += 1) {
    const tuple = aux[i];
    if(tuple.start_x !== curr_ev) {
      j += 1;
      curr_ev = tuple.start_x;
      EVENT.push(curr_ev);
      VERT.push([]);
      BEG.push([]);
      END.push([]);
      WORK.push(new DoubleLinkedList());
    }

    switch(tuple.type) {
      case 0:
        BEG[j].push(tuple.segment);
        break;

      case 1:
        VERT[j].push(tuple.segment);
        break;

      case 2:
        END[j].push(tuple.segment);
        break;
    }
  }

  return { EVENT, VERT, BEG, END, WORK };
}