// Melhorn Bentley-Sweep application
// https://domino.mpi-inf.mpg.de/internet/reports.nsf/c125634c000710cd80255ef200387b6e/81f0d2a8c80387f6c125614d006bfa41/$FILE/MPI-I-94-160.pdf

/* globals
game,
canvas,
foundry
*/

// Sweep algorithm but combine separate events where the points are equal

import { compareXY, compareYX, pointsEqual } from "./utilities.js";
import { PriorityQueueArray } from "./PriorityQueueArray.js";
import { MODULE_ID } from "./module.js";
import { SkipList } from "./SkipList.js";
import { drawVertex, drawEdge, COLORS, clearLabels, labelVertex } from "./Drawing.js";
import { pointForSegmentGivenX } from "./IntersectionsSweep.js";



function SweepMelhorn(segments, reportFn = (e1, e2, ix) => {}) {
  let debug = game.modules.get(MODULE_ID).api.debug;

  if(debug) {
    canvas.controls.debug.clear();
    clearLabels();
    segments.forEach(s => drawEdge(s, COLORS.black));
    segments.forEach(s => labelVertex(s.nw, s.id));
  }

  // for the moment, keep a separate sorted structure
  // likely redundant
  let segmentsSorted = [...segments];
  segmentsSorted.sort((a, b) => compareXY(a.nw, b.nw));

  let xstructure = new XStructure(segments);
  let ystructure = new YStructure();

  // reverse segments so we can easily pop the segments
  // likely redundant
  segmentsSorted.reverse();

  // probably unnecessary, but for testing...
  ystructure.sweep_pt = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY };

  let event;
  while(event = xstructure.next()) {
    // event = xstructure.next()

    let sit = event.sit;
    ystructure.sweep_pt = event.point;

    let sweep_params = {
      event: event,
      sit_pred: null,
      sit_succ: null,
      sit_first: null,
      sit_last: null
    };


    if(ystructure.length > 0) {
      // Melhorn 13
      // Handle segments passing though or ending in sweep_pt (p). Melhorn 13
      // If sit === null, at most one segment in Y containing p.
      // Find by looking up zero-length segment (sweep_pt, sweep_pt) in Ystructure

      // if not found, no segment in Ystructure contains p.
      // sit_pred and sit_succ: predecessor and successor to segments containing p
      if(!sit) {
        // at most one segment in Y containing p.
        // create a zero-length segment s = (p, p)
        let zseg = { segment: { A: event.point, B: event.point, nw: event.point, se: event.point} };
        sit = ystructure.search(zseg);
      }

      if(sit) {
        subsequentSegments(sit, ystructure, sweep_params); // Melhorn 14
        deleteEndingSegments(ystructure, sweep_params); // Melhorn 15
        reverseSubsequent(xstructure, ystructure, sweep_params); // Melhorn 16
      }
    }

    // Insert starting segments and compute new ix. Melhorn 17
    insertStartingSegments(segmentsSorted, xstructure, ystructure, sweep_params);

    // compute possible intersections. Melhorn 17
    if(sweep_params.sit_pred) { compute_intersection(xstructure, ystructure, sweep_params.sit_pred); }
    sit = sweep_params.sit_succ && sweep_params.sit_succ.prev;
    sit && sit.isSentinel && (sit = null);
    if(sit && sit !== sweep_params.sit_pred) { compute_intersection(xstructure, ystructure, sit); }

    if(debug) { ystructure.log(); xstructure.log(); }

  }

}


// Melhorn 14
// find subsequence of ending or passing segments.
// all segments incident to p from left or from above
function subsequentSegments(sit, ystructure, sweep_params) {
  sweep_params.sit_last = sit;
  while(sweep_params.sit_last.xit === sweep_params.event) {
    sweep_params.sit_last = sweep_params.sit_last.next;
  }

  sweep_params.sit_succ = sweep_params.sit_last.next;
  sweep_params.sit_pred = sweep_params.sit_last.prev;

  while(sweep_params.sit_pred.xit === sweep_params.event) {
    sweep_params.sit_pred = sweep_params.sit_pred.prev;
  }

  sweep_params.sit_first = sweep_params.sit_pred.prev;

  // set to null if sentinel
  sweep_params.sit_last && sweep_params.sit_last.isSentinel && (sweep_params.sit_last = null);
  sweep_params.sit_first && sweep_params.sit_first.isSentinel && (sweep_params.sit_first = null);
  sweep_params.sit_succ && sweep_params.sit_succ.isSentinel && (sweep_params.sit_succ = null);
  sweep_params.sit_pred && sweep_params.sit_pred.isSentinel && (sweep_params.sit_pred = null);
}

// Melhorn 15
function deleteEndingSegments(ystructure, sweep_params) {
  let debug = game.modules.get(MODULE_ID).api.debug;
  let i1 = sweep_params.sit_pred;
  let i2 = sweep_params.sit_first;
  while(i2 && i2 !== sweep_params.sit_succ) {
    let s = i2.segment;
    if(pointsEqual(event.point, s.se)) { // ending segment
      ystructure.removeNode(i2);
      if(debug) {
        const s = i2.data.segment;
        console.log(`\Removing ${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`);
        drawEdge(s, COLORS.red);
      }

    } else { // continuing segment
      if(i2 !== sweep_params.sit_last) { i2.xit = null; }
      i1 = i2;
    }
    i2 = i1.next;
  }
  sweep_params.sit_first = sweep_params.sit_pred?.next;
  sweep_params.sit_last = sweep_params.sit_succ?.prev;

  // set to null if sentinel
  sweep_params.sit_last && sweep_params.sit_last.isSentinel && (sweep_params.sit_last = null);
  sweep_params.sit_first && sweep_params.sit_first.isSentinel && (sweep_params.sit_first = null);
}


// Melhorn 16
function reverseSubsequent(xstructure, ystructure, sweep_params) {
  let debug = game.modules.get(MODULE_ID).api.debug;
  let xit = sweep_params.sit_pred?.xit;
  if(xit) {
    if(--xit.count === 0) {
      xstructure.binaryRemove(xit);
    }
    sweep_params.sit_pred.xit = null;
  }

  if(sweep_params.sit_last && sweep_params.sit_pred && sweep_params.sit_last !== sweep_params.sit_pred) {
    xit = sweep_params.sit_last.xit;
    if(xit) {
      if(--xit.count === 0) {
        xstructure.binaryRemove(xit);
      }
    }
    if(debug) { console.log(`\tReversing nodes.`, sweep_params.sit_first, sweep_params.sit_last)}
    ystructure.reverseNodes(sweep_params.sit_first, sweep_params.sit_last);
  }
}


// Melhorn 17.
function insertStartingSegments(segmentsSorted, xstructure, ystructure, sweep_params) {
  let debug = game.modules.get(MODULE_ID).api.debug;
  while(segmentsSorted.length > 0 &&
      pointsEqual(segmentsSorted[segmentsSorted.length - 1].nw, sweep_params.event.point)) {
    let seg = segmentsSorted.pop();


    // insert the right endpoint of seg into Xstructure
    let x_data = { point: seg.se, sit: null };
    let xit = xstructure.binaryInsert(x_data);

    // ignoring possibility of zero-length segments for now

    //
    let y_data = { segment: seg, xit: xit };

    // Melhorn: existing ≈ sit
    let existing = ystructure.search(y_data); // TO-DO: what is the proper search object?
    if(!existing || ystructure.comparator(existing, y_data)) {
      // no segment with the same underlying line in ystructure
      // (either does not exist or is not collinear)
      existing = ystructure.insert(y_data);
      if(debug) {
        const s = y_data.segment;
        console.log(`\tAdding ${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`);
        drawEdge(s);
      }

    } else {
      // seg is collinear with the segment associated with sit.
      // if seg is longer then use seg; otherwise do nothing.
      if(compareYX(seg.se, existing.segment.se) > 0) {
        // seg extends further right or below; replace existing with seg
        existing.segment = seg;
      }
    }

    // add a link from xstructure --> ystructure for the segment
    // Melhorn 17: X_structure.change_inf(end_it, sit)
    x_data.sit = existing;
    if(!sweep_params.sit_succ) {
      sweep_params.sit_succ = existing.next; // next segment in ystructure
      sweep_params.sit_pred = existing.prev; // prev segment in ystructure

      sweep_params.sit_succ.isSentinel && (sweep_params.sit_succ = null);
      sweep_params.sit_pred.isSentinel && (sweep_params.sit_pred = null);

      // sit_pred is no longer adjacent to sit_succ.
      // change current ix event to null and delete corresponding item in xstructure
      if(sweep_params.sit_pred && sweep_params.sit_pred.xit) {
        if(--sweep_params.sit_pred.xit.count === 0) xstructure.remove(sweep_params.sit_pred.xit);
        sweep_params.sit_pred.xit = null;
      }
    }
  }
}


// Melhorn 23
// does not appear to correctly find the intersection;
// something about the calc is wrong; perhaps the reversal of the y axis?
// function compute_intersection(xstructure, structure, sit0) {
//    let sit1 = sit0.next;
//    if(sit1.isSentinel) return;
//
//    let seg0 = sit0.data.segment;
//    let seg1 = sit1.data.segment;
//
//    // see Melhorn 5 for description of dx, dy
//    let dx0 = seg0.nw.x - seg0.se.x;
//    let dy0 = seg0.nw.y - seg0.se.y;
//
//    let dx1 = seg1.nw.x - seg1.se.x;
//    let dy1 = seg1.nw.y - seg1.se.y;
//
//    let i = dy0 * dx1 - dy1 * dx0;
//    if(i.almostEqual(0) || i < 0) return; // slope s0 ≤ slope s1
//
//    // the underlying lines in
//    let w = i;
//    let c1 = s0.se.x * s0.nw.y - s0.nw.x * s0.se.y;
//    let c2 = s1.se.x * s1.nw.y - s1.nw.x * s1.se.y;
//
//    let x = c2 * dx0 - c1 * dx1;
//    let d0 = x - s0.se.x * w;
//
//    // intersect in a point but must test whether it is on segments
//
//    if(d0 > 0) return;
//    if(x > s1.se.x) return;
//
//    let y = c2 * dy0 - c1 * dy1;
//    if(d0.almostEqual(0) && y > (s0.se.y * w)) return;
//
//    // ix = foundry.utils.lineLineIntersection(seg0.nw, seg0.se, seg1.nw, seg1.se);
//
//    let x_data = { point: { x: x / w, y: y / w}, sit: null, count: 1 };
//    let xit = xstructure.binaryInsert(x_data);
//    sit0.data.xit = xit; // Melhorn: Y_structure.change_inf(sit0, xit)
// }

// Melhorn 23
// Take an item from the ystructure and determine if its segment intersects
// with successor right/below of the sweep line
function compute_intersection(xstructure, ystructure, sit0) {
  let sit1 = sit0.next;
  if(sit1.isSentinel) return;

  let s0 = sit0.data.segment;
  let s1 = sit1.data.segment;

  // segment1 is the successor of segment0 in the Y-structure.
  // therefore, the underlying lines intersect right or below iff the slope of seg0
  // exceeds the slope of seg1.
  // i.e., segment 1 sw point is oriented ccw (above) segment 0 sw
  // if shared se endpoint, need to check orientation using nw points

  let abc, abd;
  if(pointsEqual(s0.se, s1.se)) {
    abc = foundry.utils.orient2dFast(s0.nw, s0.se, s1.nw);
    if(abc.almostEqual(0) || abc > 0) return;
  } else {
    abd = foundry.utils.orient2dFast(s0.nw, s0.se, s1.se);
    if(abd.almostEqual(0) || abd < 0) return;
  }

  // now test for whether intersection is contained w/in the segments
  // this is the rest of foundry.utils.lineSegmentIntersects
  abc = abc ?? foundry.utils.orient2dFast(s0.nw, s0.se, s1.nw);
  abd = abd ?? foundry.utils.orient2dFast(s0.nw, s0.se, s1.se);
  let cda = foundry.utils.orient2dFast(s1.nw, s1.se, s0.nw);
  let cdb = foundry.utils.orient2dFast(s1.nw, s1.se, s0.se);

  if((abc * abd) <= 0 && (cda * cdb) <= 0) {
    // segments intersect; find point
    let ix = foundry.utils.lineLineIntersection(s0.nw, s0.se, s1.nw, s1.se);
    if(!ix) return;

    if(game.modules.get(MODULE_ID).api.debug) {
      console.log(`\tIntersection found at ${ix.x},${ix.y}`);
      drawVertex(ix, COLORS.lightred, .5);
    }

    // add to xstructure and link xstructure to the ystructure for seg0
    let x_data = { point: ix, sit: null, count: 1 };
    let xit = xstructure.binaryInsert(x_data);
    sit0.data.xit = xit;
  }
}


/**
 * Contains an item for each point in St ∪ E ∪ I.
 * St: Set of all start points of segments that lie to the right of sweep line L.
 *  E: Set of all endpoints of segments that intersect L.
 *  I: Intersections to the right of L for segments adjacent to one another in YStructure.
 * Ordered lexigraphically (x, y) before (x', y') if x < x' or x = x' and y < y'
 */
class XStructure extends PriorityQueueArray {
  constructor(segments) {
    // push all left points to vector of events
    const data = [];
    segments.forEach(s => {
      data.push({ point: s.nw, sit: null, count: 0 });
    });

    super(data, { comparator: XStructure.eventCmp, sort: (arr, cmp) => arr.sort(cmp) });
  }

  static eventCmp(e1, e2) {
    // reverse b/c priority queue so lower xy values have higher priority
    return -compareXY(e1.point, e2.point);
  }

  // debug helper that displays a table of elements in the queue
  log() {
    console.table(this.data.map(obj => {
      return {
        x: obj.point.x,
        y: obj.point.y,
        sit: obj.sit,
        count: obj.count
      };
    }), ["x", "y", "sit", "count"]);
  }
}

/**
 * Contains the set S of line segments that intersect the sweep line.
 * Ordered as their intersections appear on the line L from lowest y to highest y.
 *
 * To facilitate the sweep, the data actually contains
 *
 */
class YStructure extends SkipList {
  constructor() {
    const min_seg = { A: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY },
                        B: { x: Number.POSITIVE_INFINITY, y: Number.NEGATIVE_INFINITY }};
    const max_seg = { A: { x: Number.NEGATIVE_INFINITY, y: Number.POSITIVE_INFINITY },
                        B: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }};

    const minObject = { segment: min_seg, xit: null };
    const maxObject = { segment: max_seg, xit: null };
    super({ minObject, maxObject });
    this.comparator = this.segmentCmp;
    this._sweep_pt = {x: 0, y: 0};
  }

  get sweep_pt() { return this._sweep_pt; }
  set sweep_pt(value) { this._sweep_pt = value; }

  // debug helper that displays a table of elements in the queue
  log() {
    console.table(this.inorder().map(d => {
      return {
        id: d.segment._id,
        segment: `${d.segment.nw.x},${d.segment.nw.y}|${d.segment.se.x},${d.segment.se.y}`,
        xit: d.xit
      };
    }), ["id", "segment", "xit"]);
  }


 /**
  * Melhorn assumes homogenous coordinates, probably b/c it is easier to express
  * intersections. For example, if an intersection is calculated as num / denom,
  * where denom = 2, that could be expressed as (x, y, 2) instead of (x/2, y/2).
  *
  * For our purposes, assume all coordinates are (x, y) or (x, y, 1).
  * By definition, the YStructure should not contain more than 1 vertical line.
  * We also assume here that neither segment is zero-length.
  * For now, we assume segments do not partially overlap—i.e., the underlying line
  * for two segments is not identical. See Melhorn p. 20 for testing slopes to determine.
  * Also ignoring the floating point filter piece for now.
  *
  * Swap "above" with "below" in Melhorn b/c y coordinates are reversed in Foundry.
  */
  segmentCmp(data1, data2) {
    // In Mehlhorn p. 20:
    // sweep point: px, py, pw: sweep point
    // s1:  px, py, pz and dx, dy
    // s2: spx,spy,spz|sqx,sqy,sqw and sdx, sdy
    // sweep line: rx,ry,rz
    let s1 = data1.segment;
    let s2 = data2.segment;

    // to make it easier to compare to Melhorn, for now redefine variables
    let px = s1.nw.x;
    let py = s1.nw.y;
    let pw = 1;
    let dx = s1.se.x - s1.nw.x;
    let dy = s1.se.y - s1.nw.y;

    let spx = s2.nw.x;
    let spy = s2.nw.y;
    let spw = 1;
    let sqx = s2.se.x;
    let sqy = s2.se.y;
    let sqw = 1;
    let sdx = s2.se.x - s2.nw.x;
    let sdy = s2.se.y - s2.nw.y;

    let rx = this.sweep_pt.x;
    let ry = this.sweep_pt.y;
    let rw = 1;

    // test if underlying line are identical: three slopes are equal.
    let t1 = dy * sdx - sdy * dx;
    if(t1.almostEqual(0)) {
      let mdx = sqx * pw - px * sqw;
      let mdy = sqy * pw - py * sqw;
      let sign2 = dy * mdx - mdy * dx;
      if(sign2.almostEqual(0)) {
        let sign3 = sdy * mdx - mdy * sdx;
        if(sign3.almostEqual(0)) {
          return 0;
        }
      }
    }

    if(dx.almostEqual(0)) {
      // s1 is vertical; it intersects l within (x_sweep, y_sweep + 𝜀)
      // s1 is before s2 if p_sweep is *above* the intersection of l ∩ s2.
      let i = (spy * sdx - spx * sdy) * rw + (sdy * rx - ry * sdx) * spw;
      return i <= 0 ? 1 : -1;
    } else if(sdx.almostEqual(0)) {
      // s2 is vertical; it intersects l in (x_sweep, y_sweep + 𝜀)
      // s1 is before s2 if p_sweep is *below* or at the intersection of l and s1.
      let i = (py * dx - px * dy) * rw + (dy * rx - ry * dx) * pw;
      return i <= 0 ? -1 : 1;

    } else {
      // neither is vertical. Compare the intersection of l ∩ s1 and l ∩ s2
      // if y values are different, return the sign
      // if difference is zero, return -1 if:
      // 1. the common ix is not *below* p_sweep and s1 has the smaller slope or
      // 2. the common ix is *below* p_sweep and s1 has the larger slope
      let t2 = sdx * spw * (py * dx * rw + dy * (rx * pw - px * rw)) -
                  dx * pw * (spy * sdx * rw + sdy * (rx * spw - spx * rw));

      if(t2) return t2; // or t2?

      // s1 and s2 intersect in a point.
      let t3 = (py * dx - px * dy) * rw + (dy * rx - ry * dx) * pw;
      return t3 <= 0 ? t1 : -t1;
    }
  }
}

function segmentCompareLinkedGen() {
  let _sweep = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY };
  return {
    sweep(value) { _sweep = value; },
    segmentCompare(segment, elem) {
      // if both are colinear, they share an underlying line; return 0
      let abc = foundry.utils.orient2dFast(segment.nw, segment.se, elem.nw);
      let abd = foundry.utils.orient2dFast(segment.nw, segment.se, elem.se);

      if(abc === 0 && abd === 0) return 0;


      if((segment.nw.x - segment.se.x).almostEqual(0)) {
        // segment is vertical, elem is not
        // segment is before elem if sweep is below the intersection
        // of the vertical sweep line with elem
        // i.e., the sweep point is oriented below elem (cw)
        let cds = foundry.utils.orient2dFast(elem.nw, elem.se, _sweep);
        // if cds === 0, is it -1, 0, or 1?
        if(cds === 0) console.warn("segmentCompare: segment vertical; elem orientation to sweep is 0", segment, elem, _sweep);
        return -cds;

      } else if((elem.nw.x - elem.se.x).almostEqual(0)) {
        // elem is vertical, segment is not
        // segment is before elem if intersection of the vertical sweep line
        // with segment is not above sweep (ccw)
        let abs = foundry.utils.orient2dFast(segment.nw, segment.se, _sweep);
        if(abs === 0) console.warn("segmentCompare: elem vertical; segment orientation to sweep is 0", segment, elem, _sweep);
        return abs;
      } else {
        // neither are vertical.
        // compare intersection point of segment and element with the vertical sweep line
        let ix_segment = pointForSegmentGivenX(segment, _sweep.x);
        let ix_elem = pointForSegmentGivenX(elem, _sweep.x);

        let diff_y = ix_segment.y - ix_elem.y;
        if((diff_y).almostEqual(0)) {
          // if identical intersection (recall x is already the same):
          // - if not above sweep, s1 is before s2 if s1 has smaller slope
          // - if above sweep, s1 is before s2 if s1 has the larger slope
          return (ix_segment.y - _sweep.y) > 0 ? abd : -abd;

        } else {
          // if the intersections of segment and elem with the vertical sweep line
          // are different, segment is before elem if segment ix is below elem ix.
          return diff_y;
        }
      }
    }
  };
}


/* Test segmentCmp
ystructure = new YStructure();

// both segments have same underlying line: return 0
data1 = { segment: new SimplePolygonEdge({ x: 1, y: 1 }, { x: 2, y: 2 }) }
data2 = { segment: new SimplePolygonEdge({ x: 3, y: 3 }, { x: 4, y: 4 }) }
ystructure.segmentCmp(data1, data2) // 0

// first segment is vertical and must intersect sweep
// s1 before s2 (negative value) if sweep is above s2 intersection with sweep
data1 = { segment: new SimplePolygonEdge({ x: 1, y: -10 }, { x: 1, y: 10 }) }
data2 = { segment: new SimplePolygonEdge({ x: -10, y: 10 }, { x: 10, y: 5 }) }
ystructure.sweep_pt = {x: 1, y: 1}
ystructure.segmentCmp(data1, data2) // -1

// second segment is vertical
// s1 before s2 if s1 intersection is not below psweep
ystructure.segmentCmp(data2, data1) // 1

// data2 intersects above sweep
data1 = { segment: new SimplePolygonEdge({ x: 1, y: -10 }, { x: 1, y: 10 }) }
data2 = { segment: new SimplePolygonEdge({ x: -10, y: -10 }, { x: 10, y: -5 }) }
ystructure.segmentCmp(data1, data2) // 1
ystructure.segmentCmp(data2, data1) // -1

// neither vertical, then s1 before s2 if:
// - s1 ix sweep is below s2 ix sweep
// - if sweep ix identical:
//   - s1 has smaller slope & ix is below psweep
//   - s2 has larger slope & ix is above psweep

// - s1 ix sweep above s2 ix sweep
data1 = { segment: new SimplePolygonEdge({ x: -100, y: 100 }, { x: 100, y: -100 }) }
data2 = { segment: new SimplePolygonEdge({ x: -100, y: -100 }, { x: 100, y: 100 }) }
ystructure.sweep_pt = {x: -10, y: 0}
ystructure.segmentCmp(data1, data2) //  800000
ystructure.segmentCmp(data2, data1) // -800000

// - s1 ix sweep below s2 ix sweep
ystructure.sweep_pt = {x: 10, y: 0}
ystructure.segmentCmp(data1, data2) // -800000
ystructure.segmentCmp(data2, data1) //  800000

// identical
ystructure.sweep_pt = {x: 0, y: 0}
ystructure.segmentCmp(data1, data2) // -800000
ystructure.segmentCmp(data2, data1) //  800000


// versus segmentCompareLinkedGen
ystructure = new YStructure();
segCmp = segmentCompareLinkedGen();

sweep_pt = { x: 500, y: 500 }
ystructure.sweep_pt = sweep_pt;
segCmp.sweep(sweep_pt);

for(let i = 0; i < 100; i += 1) {
  clearDrawings()
  s1 = randomSegment(1000);
  s2 = randomSegment(1000);
  drawVertex(sweep_pt);
  drawEdge({A: {x: sweep_pt.x, y: 0}, B: {x: sweep_pt.x, y: 1000}}, COLORS.lightblue, alpha = .75);
  drawEdge(s1, COLORS.black);
  drawEdge(s2, COLORS.black);

  res1 = ystructure.segmentCmp({ segment: s1 }, { segment: s2 });
  res2 = segCmp.segmentCompare(s1, s2);
  if(Math.sign(res1) !== Math.sign(res2)) {
    console.error(`${res1} ≠ ${res2}`)
    break;
  }

  res1 = ystructure.segmentCmp({ segment: s2 }, { segment: s1 });
  res2 = segCmp.segmentCompare(s2, s1);
  if(Math.sign(res1) !== Math.sign(res2)) {
    console.error(`${res1} ≠ ${res2}`)
    break;
  }
}

*/