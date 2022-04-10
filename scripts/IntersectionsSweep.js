/* globals
foundry,
drawEdge,
drawVertex,
COLORS,
labelVertex,
clearLabels,
canvas

*/

// https://www.geeksforgeeks.org/given-a-set-of-line-segments-find-if-any-two-segments-intersect/
// Intersect lines using sweep

// Event object:
// pt, isLeft, index

/* testing
api = game.modules.get(`testccw`).api;
SimplePolygonEdge = api.SimplePolygonEdge;
benchmarkLoopFn = api.benchmarkLoopFn

let { COLORS, clearDrawings, clearLabels, drawEdge, drawPolygon, drawVertex, labelVertex } = api.Drawing;

findIntersectionsBruteSingle = api.findIntersectionsBruteSingle;
findIntersectionsSortSingle = api.findIntersectionsSortSingle;
findIntersectionsSort2Single = api.findIntersectionsSort2Single;
findIntersectionsSweepSingle = api.findIntersectionsSweepSingle;

reportFn = (e1, e2, ix) => {}

function randomPoint(max_coord) {
  return { x: Math.floor(Math.random() * max_coord),
           y: Math.floor(Math.random() * max_coord) };
}
function randomSegment(max_coord = 5000) {
  let a = randomPoint(max_coord);
  let b = randomPoint(max_coord);
  while(pointsEqual(a, b)) {
    // don't create lines of zero length
    a = randomPoint(max_coord);
    b = randomPoint(max_coord);
  }
  return new SimplePolygonEdge(a, b);
}

function compareXY(a, b) {
  const diff_x = a.x - b.x;
  if(diff_x.almostEqual(0)) {
    const diff_y = a.y - b.y;
    return diff_y.almostEqual(0) ? 0 : diff_y;
  }
  return diff_x;
}

function compareYX(a, b) {
  const diff_y = a.y - b.y;
  if(diff_y.almostEqual(0)) {
    const diff_x = a.x - b.x;
    return diff_x.almostEqual(0) ? 0 : diff_x;
  }
  return diff_y;
}

function pointsEqual(p1, p2) { return (p1.x.almostEqual(p2.x) && p1.y.almostEqual(p2.y)) }


canvas.controls.debug.clear()
walls = [...canvas.walls.placeables]
segments = walls.map(w => SimplePolygonEdge.fromWall(w));

N = 100
await benchmarkLoopFn(N, findIntersectionsSingle, "brute sort", segments)
await benchmarkLoopFn(N, processIntersections, "sweep", segments)


Test random
reportFnBrute = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_brute.push(x); // avoid pushing null
}

reportFnSort = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_sort.push(x);
}

reportFnSweep = (s1, s2, ix) => {
  reporting_arr_sweep.push(ix);
}

reporting_arr_brute = []
reporting_arr_sort = []
reporting_arr_sweep = []

segments = Array.fromRange(10).map(i => randomSegment(5000))
canvas.controls.debug.clear()
segments.forEach(s => drawEdge(s, COLORS.black))

findIntersectionsBruteSingle(segments, reportFnBrute)
findIntersectionsSortSingle(segments, reportFnSort)
findIntersectionsSweepSingle(segments, reportFnSweep)

reporting_arr_brute.sort(compareXY)
reporting_arr_sort.sort(compareXY)
reporting_arr_sweep.sort(compareXY)

reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sort[idx]))
reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep[idx]))



Bench



function applyFn(fn, num_segments, max_coord) {
  segments = Array.fromRange(num_segments).map(i => randomSegment(max_coord))
  return fn(segments);
}

N = 100
num_segments = 10
max_coord = Math.pow(2, 13)
await benchmarkLoopFn(N, applyFn, "brute", findIntersectionsBruteSingle, num_segments, max_coord)
await benchmarkLoopFn(N, applyFn, "sort", findIntersectionsSortSingle, num_segments, max_coord)
await benchmarkLoopFn(N, applyFn, "sort2", findIntersectionsSort2Single, num_segments, max_coord)
await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord)

let i;
let segments
for(i = 0; i < 100; i += 1) {
  i % 10 !== 0 || console.log(`${i}`);

  reporting_arr_brute = []
  reporting_arr_sweep = []

  segments = Array.fromRange(10).map(i => randomSegment(5000))
  findIntersectionsBruteSingle(segments, reportFnBrute)
  findIntersectionsSweepSingle(segments, reportFnSweep)

  reporting_arr_brute.sort(compareXY)
  reporting_arr_sweep.sort(compareXY)

  if(reporting_arr_brute.length !== reporting_arr_sweep.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep[idx]))) {

     console.table(reporting_arr_brute);
     console.table(reporting_arr_sweep);
     console.error(`ixs not equal .`, segments)
     break;
  }
}

// enlarge segments
orig_segments = [...segments]
segments = segments.map(s => {
  return new SimplePolygonEdge({x: s.A.x * 20, y: s.A.y * 20},
                               {x: s.B.x * 20, y: s.B.y * 20})

})

N = 100
num_segments = 1000
max_coord = Math.pow(2, 13)

num_segments_arr = [10, 100, 1000]
for(let i = 0; i < num_segments_arr.length; i += 1) {

  let num_segments = num_segments_arr[i]
  console.log(`\nNum Segments ${num_segments}`);

  use_binary_swap = UseBinary.No;
  use_binary_delete = UseBinary.No;
  use_binary_event_queue = UseBinary.No;
  use_binary_insert = UseBinary.No;

  await benchmarkLoopFn(N, applyFn, "brute", findIntersectionsBruteSingle, num_segments, max_coord);
  await benchmarkLoopFn(N, applyFn, "sort", findIntersectionsSortSingle, num_segments, max_coord);

  console.log("No binary");
  await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord);

  console.log("binary event queue");
  use_binary_event_queue = UseBinary.Yes;
  use_binary_event_queue = UseBinary.No;
  await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord);

  console.log("binary insert");
  use_binary_insert = UseBinary.Yes;
  use_binary_insert = UseBinary.No;
  await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord)

  console.log("binary swap");
  use_binary_swap = UseBinary.Yes;
  use_binary_swap = UseBinary.No;
  await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord)

  console.log("binary delete");
  use_binary_delete = UseBinary.Yes;
  use_binary_delete = UseBinary.No;
  await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord)

  console.log("binary all")
  use_binary_swap = UseBinary.Yes;
  use_binary_delete = UseBinary.Yes;
  use_binary_event_queue = UseBinary.Yes;
  use_binary_insert = UseBinary.Yes;
  await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord)

}

Num Segments 10
brute | 100 iterations | 0.8ms | 0.008ms per
sort | 100 iterations | 0.7ms | 0.006999999999999999ms per
No binary
sweep | 100 iterations | 4.1ms | 0.040999999999999995ms per
binary event queue
sweep | 100 iterations | 4.5ms | 0.045ms per
binary insert
sweep | 100 iterations | 3.4ms | 0.034ms per
binary swap
sweep | 100 iterations | 2.5ms | 0.025ms per
binary delete
sweep | 100 iterations | 2.2ms | 0.022000000000000002ms per
binary all
sweep | 100 iterations | 4.7ms | 0.047ms per

Num Segments 100
brute | 100 iterations | 15ms | 0.15ms per
sort | 100 iterations | 18.1ms | 0.18100000000000002ms per
No binary
sweep | 100 iterations | 172.7ms | 1.7269999999999999ms per
binary event queue
sweep | 100 iterations | 165.2ms | 1.652ms per
binary insert
sweep | 100 iterations | 161.3ms | 1.6130000000000002ms per
binary swap
sweep | 100 iterations | 161.1ms | 1.611ms per
binary delete
sweep | 100 iterations | 163.4ms | 1.6340000000000001ms per
binary all
sweep | 100 iterations | 166.9ms | 1.669ms per

Num Segments 1000
brute | 100 iterations | 927.2ms | 9.272ms per
sort | 100 iterations | 875.3ms | 8.753ms per
No binary
sweep | 100 iterations | 76798.6ms | 767.9860000000001ms per
binary event queue
sweep | 100 iterations | 75643.2ms | 756.432ms per
binary insert
sweep | 100 iterations | 74025.8ms | 740.258ms per
binary swap
sweep | 100 iterations | 74537.6ms | 745.3760000000001ms per
binary delete
sweep | 100 iterations | 73871.1ms | 738.711ms per
binary all
sweep | 100 iterations | 26438.5ms | 264.385ms per



canvas.controls.debug.clear()
segments = Array.fromRange(10).map(i => randomSegment(max_coord))
segments.forEach(s => drawEdge(s, COLORS.black))
processIntersections(segments)

*/


// Bentley Ottoman Sweep

// First version
// Track segments by Y-axis (resolve ties using X-axis) in NotATree, which
//   is an array treated similarly to a BinarySearchTree.
//   relies on binary search to insert.
//   every segment inserted once. O(log n)
//
// Track events by X-axis (resolve ties using Y-axis) in EventQueue, which
//   is (more or less) a priority queue based on a sorted array of events.

// Second version: red/black sweep
// Don't report intersections within the same group
// two options for starting the sweep:
// 1. set sweep line to nw point of smaller (second?) group
//    use the event queue, which is sorted, to identify segments intersected by the sweep
//    For each segment intersected, include in the tree
//    Drop everything before the nw point in the event queue
// 2. set sweep line to nw point of smaller (second?) group
//    use the event queue, which is sorted, to identify segments intersected by the sweep
//    Drop from the event queue any segment that is completely prior to the nw point
//    (basically, drop segments that are too far left to possibly impact the black group)
// For ending sweep:
// Stop early whenever the final smaller (second?) group is complete. Can flag that
// point in the queue, somehow



import { compareXY, compareYX } from "./utilities.js";






debug = false;

let UseBinary = {
  Yes: 0,
  Test: 1,
  No: 2,
}


use_binary_swap = UseBinary.Yes;
use_binary_delete = UseBinary.Yes;
use_binary_event_queue = UseBinary.Yes;
use_binary_insert = UseBinary.Yes;

use_binary_swap = UseBinary.No;
use_binary_delete = UseBinary.No;
use_binary_event_queue = UseBinary.No;
use_binary_insert = UseBinary.No;

use_binary_swap = UseBinary.Test;
use_binary_delete = UseBinary.Test;
use_binary_event_queue = UseBinary.Test;
use_binary_insert = UseBinary.Test;

export function findIntersectionsSweepSingle(segments, reportFn = (e1, e2, ix) => {}) {
  // id the segments for testing

  if(debug) {
    canvas.controls.debug.clear();
    clearLabels();
    segments.forEach(s => drawEdge(s, COLORS.black));
    segments.forEach(s => labelVertex(s.nw, s.id));
  }

  let tracker = new Set(); // to note pairs for which intersection is checked already
  let tree = new NotATree(); // pretend this is actually a tree
  let e = new EventQueue(segments);

  let num_ixs = 0; // mainly for testing

  // traverse the queue
  let curr;
  let prev_sweep_x = null;
  while(curr = e.next()) {
// console.table(tree.data, ["_id"])
//     curr = e.next()

    if(debug) {
      console.log(`${Object.getOwnPropertyNames(EventType)[curr.eventType]} event; Sweep at x = ${curr.point.x}.`);
      console.log(`\tEvent Queue: ${e.data.length}; Tree: ${tree.data.length}`, e.data, tree.data);
      drawEdge({A: {x: curr.point.x, y: 0}, B: { x: curr.point.x, y: canvas.dimensions.height}}, COLORS.lightblue, .5);
//       console.table(tree.data, ["_id"])
    }

    switch(curr.eventType) {
      case EventType.Left:
        num_ixs += handleLeftEvent(curr, e, tree, tracker);
        break;
      case EventType.Intersection:
        num_ixs += handleIntersectionEvent(curr, e, tree, tracker, reportFn, prev_sweep_x);
        break;
      case EventType.Right:
        num_ixs += handleRightEvent(curr, e, tree, tracker);
        break;
    }

    prev_sweep_x = curr.point.x;

  }

  return num_ixs;
}

function handleLeftEvent(curr, e, tree, tracker) {
  let num_ixs = 0;

  if(debug) {
    console.log(`\tLeft endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
    drawEdge(curr.segment);
  }

  // get the above and below points
  let idx = tree.insert(curr.segment, curr.point.x);

  // check if curr intersects with its predecessor and successor
  // if we already checked this pair, we can skip
  let below = tree.belowIndex(idx);
  if(below) { num_ixs += checkForIntersection(below, curr.segment, e, tracker); }

  let above = tree.aboveIndex(idx);
  if(above) { num_ixs += checkForIntersection(above, curr.segment, e, tracker); }

  return num_ixs;
}

function handleIntersectionEvent(curr, e, tree, tracker, reportFn, prev_sweep_x) {
  let num_ixs = 0;

  // report intersection
  reportFn(curr.segment1, curr.segment2, curr.point);

  if(debug) {
    console.log(`\tIntersection event ${curr.point.x},${curr.point.y}`);
    drawVertex(curr.point);
    console.log(`\tSwapping ${curr.segment1.nw.x},${curr.segment1.nw.y}|${curr.segment1.se.x},${curr.segment1.se.y} and ${curr.segment2.nw.x},${curr.segment2.nw.y}|${curr.segment2.se.x},${curr.segment2.se.y}`)
  }

  // swap A, B
  let [new_idx1, new_idx2] = tree.swap(curr.segment1, curr.segment2, curr.point.x);
  if(typeof new_idx1 !== "undefined") {
    // undefined should be only when the two segments share a se endpoint

    // check for intersection between the upper segment and above
    // and between lower segment and below
    let [bottom_segment, top_segment] = new_idx1 > new_idx2 ?
        [curr.segment1, curr.segment2] :
        [curr.segment2, curr.segment1];

    let below = tree.belowIndex(Math.max(new_idx1, new_idx2));
    let above = tree.aboveIndex(Math.min(new_idx1, new_idx2));

    if(below) { num_ixs += checkForIntersection(below, bottom_segment, e, tracker); }
    if(above) { num_ixs += checkForIntersection(above, top_segment, e, tracker); }
  }

  return num_ixs;
}

function handleRightEvent(curr, e, tree, tracker) {
  let num_ixs = 0;

  if(debug) {
    console.log(`\tRight endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
  }

  // curr point is right of its segment
  // check if predecessor and successor intersect with each other

  let idx;
  switch(use_binary_delete) {
    case UseBinary.Yes:
      idx = tree.deletionBinaryIndexOf(curr.segment, curr.point.x);
      break;

    case UseBinary.Test:
      idx = tree.indexOf(curr.segment)
      const idx_bin = tree.deletionBinaryIndexOf(curr.segment, curr.point.x);
      if(idx !== idx_bin) { console.warn(`delete segment: idx bin ${idx_bin} ≠ ${idx} at sweep ${curr.point.x}`); }
      break;

    case UseBinary.No:
      idx = tree.indexOf(curr.segment)
      break;
  }

//   let idx = tree.deletionBinaryIndexOf(curr.segment, curr.point.x);
//   let idx_bin = tree.deletionBinaryIndexOf(curr.segment, curr.point.x);
//
//   if(idx !== idx_bin) {
//     console.warn(`handleRightEvent: idx ${idx} ≠ idx_bin ${idx_bin} for endpoint ${curr.point.x},${curr.point.y}`);
//   }

  if(!~idx) console.error("Segment not found", curr);
  let below = tree.belowIndex(idx);
  let above = tree.aboveIndex(idx);
  if(below && above) { num_ixs += checkForIntersection(below, above, e, tracker); }

  if(debug) {
    console.log(`\tDeleting ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
    drawEdge(curr.segment, COLORS.red);
  }

  tree.deleteAtIndex(idx);
  // do we need to delete associated ix events? (Hopefully not; that may be hard.)
  // probably handled by the tracker eliminating ix overlap

  return num_ixs;
}


/**
 * instead of a self-balancing tree, see how we do with just an
 * array that we pretend is an ordered tree.
 * array sorted from smallest y (above) to largest y (below)
 */

class NotATree {
  constructor() {
    this.data = [];
  }

  // something above the segment has a lower index
//   above(segment) { return this.aboveIndex(this.indexOf(segment)); } // unused

  aboveIndex(idx) { return this.data[idx - 1]; }

  // something below the segment has a higher index
//   below(segment) { return this.belowIndex(this.indexOf(segment)); } // unused

  belowIndex(idx) { return this.data[idx + 1]; }

  atIndex(idx) { return this.data[idx]; }

  // index
  indexOf(segment) { return this.data.indexOf(segment); }

  // following alternative to indexOf looks like it works
  // but causes -1 to sometimes be passed to deleteAtIndex;
  // unclear if this is actually working properly
  binaryIndexOf(segment, sweep_x) {
    // trick: if segment._tmp_nw is undefined, it either has not been
    // added or has already been removed. See insert and delete
    // Must catch this case to avoid throwing error on _segmentIndexCompareYX
    // which would otherwise try to access the undefined ._tmp_nw to compare
//     let idx_orig = this.indexOf(segment);


    if(!segment._tmp_nw) {
//       if(idx_orig !== -1) { console.warn(`binaryIndex: idx_orig is ${idx_orig}, not -1.`); }
//       return idx_orig;
      return -1;
    }

    // if the segment is vertical, there is a good chance we will not know its location.
    // A vertical line may have multiple intersections at the same sweep_x.
    // This will proceed:
    // - identify intersection
    // - swap intersection
    // - identify second intersection
    // <-- here, the segment has already been swapped but we are still at the same sweep_x,
    //     so we would need to somehow know that to know where it is in the data array.
    // - swap second intersection ...

    // Instead, bail out and return a non-binary search instead
    if(segment.A.x === segment.B.x) { return this.data.indexOf(segment); }

    segment._tmp_nw = pointForSegmentGivenX(segment, sweep_x) || segment._tmp_nw; // if vertical, use existing
    let idx = binaryIndexOf(this.data, segment, (a, b) => this._segmentCompare(a, b, sweep_x));

//     if(idx_orig !== idx) {
//       console.warn(`binaryIndex: idx_orig is ${idx_orig}, not ${idx}`);
//       idx = idx_orig;
//     }

    return idx;
  }

  deletionBinaryIndexOf(segment, sweep_x) {
    // same as binaryIndexOf but we are comparing from the right (se),
    // so must use _segmentCompareForDeletion
    if(!segment._tmp_nw) { return -1 }
    segment._tmp_nw = pointForSegmentGivenX(segment, sweep_x) || segment.se; // deleting, so we want the end
    return binaryIndexOf(this.data, segment, (a, b) => this._segmentCompareForDeletion(a, b, sweep_x));
  }



//
//   indexOfWithUpdate(segment, sweep_x) {
//     segment._tmp_nw = pointForSegmentGivenX(segment, sweep_x);
//     return binaryIndexOf(this.data, segment, (a, b) => this._segmentIndexCompareYXWithUpdate(a, b, sweep_x));
//   }

  // insert
  // return index of the insertion
  insert(segment, sweep_x) {
    // must use a temporary index flag, because we may be switching
    // segments and therefore switching their "y" values temporarily.
    // need the x value for when y values are the same.
    // need se for when the segments share nw endpoint.

    // when inserting a new object, must also recalculate the x, y based on
    // current sweep line position and insert accordingly
    if(typeof sweep_x === "undefined") { console.warn("insert requires sweep_x"); }

    segment._tmp_nw = segment.nw;

    // find first element that has larger y than the segment
    // note that segmentCompareYX is using the current sweep location to calculate
    // points of comparison

    let idx;
    switch(use_binary_insert) {
      case UseBinary.Yes:
        idx = binaryFindIndex(this.data, elem => this._elemIsAfter(segment, elem, sweep_x));
        break;

      case UseBinary.Test:
        idx = this.data.findIndex(elem => this._elemIsAfter(segment, elem, sweep_x));
        const idx_bin = binaryFindIndex(this.data, elem => this._elemIsAfter(segment, elem, sweep_x));
        if(idx !== idx_bin) { console.warn(`insert segment: idx bin ${idx_bin} ≠ ${idx} at sweep ${sweep_x}`); }
        break;

      case UseBinary.No:
        idx = this.data.findIndex(elem => this._elemIsAfter(segment, elem, sweep_x));
        break;
    }

    if(~idx) {
      // insert event at index
      this.data.splice(idx, undefined,segment);
      return idx;

    } else {
      // not found; event has the largest y
      this.data.push(segment);
      return this.data.length - 1;
    }
  }

  swap(segment1, segment2, sweep_x) {
    if(!segment1._tmp_nw || !segment2._tmp_nw) { return -1; }

    let idx1, idx2;
    switch(use_binary_insert) {
      case UseBinary.Yes:
        idx1 = this.binaryIndexOf(segment1, sweep_x);
        idx2 = this.binaryIndexOf(segment2, sweep_x);
        break;

      case UseBinary.Test:
        idx1 = this.indexOf(segment1);
        idx2 = this.indexOf(segment2);
        const idx_bin1 = this.binaryIndexOf(segment1, sweep_x);
        const idx_bin2 = this.binaryIndexOf(segment2, sweep_x);
        if(idx1 !== idx_bin1) { console.warn(`swap segment1: idx bin1 ${idx_bin1} ≠ ${idx1} at sweep ${sweep_x}`); }
        if(idx2 !== idx_bin2) { console.warn(`swap segment2: idx bin2 ${idx_bin2} ≠ ${idx2} at sweep ${sweep_x}`); }
        break;

      case UseBinary.No:
        idx1 = this.indexOf(segment1);
        idx2 = this.indexOf(segment2);
        break;
    }

    if(!~idx1 || !~idx2) {
//       console.warn("swap segments not found.");
      return [undefined, undefined];
    }

    // change their temporary values (only *after* finding their current index)

    [ segment2._tmp_nw, segment1._tmp_nw ] = [ segment1._tmp_nw, segment2._tmp_nw ];

    // change their position
    this.data[idx1] = segment2;
    this.data[idx2] = segment1;

    return [idx2, idx1];
  }

  // delete
  // unused
//   delete(segment) {
//     const idx = this.indexOf(segment);
//     if(~idx) { this.deleteAtIndex(idx); }
//   }

  deleteAtIndex(idx) {
    if(idx < 0 || idx > ( this.data.length - 1)) {
      console.log(`Attempted deleteAtIndex ${idx} with data length ${this.data.length}`, this.data);
      return;
    }

    this.data[idx]._tmp_nw = undefined;
    this.data.splice(idx, 1);
  }

  _segmentCompareForDeletion(segment, elem, sweep_x) {
    // same as this._segmentCompare, but the orientation is flipped b/c we are
    // comparing segments after potential swap
     elem._tmp_nw = pointForSegmentGivenX(elem, sweep_x) || elem._tmp_nw;
     return compareYX(segment._tmp_nw, elem._tmp_nw) ||
            -foundry.utils.orient2dFast(elem.se, elem.nw, segment.nw) ||
            -foundry.utils.orient2dFast(elem.nw, elem.se, segment.se);
  }

  _segmentCompare(segment, elem, sweep_x) {
    // must use the current sweep location to set nw for each existing element
    elem._tmp_nw = pointForSegmentGivenX(elem, sweep_x) || elem._tmp_nw; // if vertical keep existing

    // if compareXY is not 0, use that comparison result.

    // otherwise, segment and elem share nw endpoint or se endpoint equals _tmp_nw at sweep
    // sort by extending the lines to the nw: whichever is higher in the nw
    // direction is first in the sort.
    // can determine this directly by extending lines from the se, or indirectly by
    // determining their orientation relative to one another

    // if they share the nw endpoint, the first orientation will return 0; test again
    // in opposite direction. So first orientation tests > shape; second tests < shape
    // of the X.

    return compareYX(segment._tmp_nw, elem._tmp_nw) ||
           foundry.utils.orient2dFast(elem.se, elem.nw, segment.nw) ||
           foundry.utils.orient2dFast(elem.nw, elem.se, segment.se);
  }

  _elemIsAfter(segment, elem, sweep_x) {
    return this._segmentCompare(segment, elem, sweep_x) < 0;
  }

//   _segmentCompareYX(segment, elem, sweep_x) {
//     // must use the current sweep location to set nw for each existing element
//     const new_pt_e = pointForSegmentGivenX(elem, sweep_x);
//     if(new_pt_e) elem._tmp_nw = new_pt_e;
//
//     const cmp_nw = compareYX(segment._tmp_nw, elem._tmp_nw);
//     if(cmp_nw) return cmp_nw < 0;
//
//     // segments share nw endpoint.
//     // the form a < with the point to the nw.
//     // need to determine which segment is the bottom half
//     // if segments extended nw (forming an X), the bottom half would become the top half
//     // and that would be the segment to sort first
//     // so the one that is to the right on the se side is the upper on the nw side
//
//     // orientation: positive: segment is to left of elem; segment sorted before elem
//     const orientation = foundry.utils.orient2dFast(elem._tmp_nw, elem._tmp_se, segment._tmp_se);
//     return orientation < 0;
//   }
}

function pointForSegmentGivenX(s, x) {
  const denom = s.B.x - s.A.x;
  if(!denom) return undefined;

  return { x: x, y: ((s.B.y - s.A.y) / denom * (x - s.A.x)) + s.A.y };
}



// When events have the same point, prefer Left types first
let EventType = {
  Left: 0,
  Intersection: 1,
  Right: 2,
}

// Needs to approximate a priority queue.
// In particular, it is possible for an intersection event to be added that would be
// the very next event, possibly several jumps in front of the current segment event
// had they been all sorted with the intersection event.

class EventQueue {
  constructor(segments) {
    // push all points to a vector of events
    const data = [];
    segments.forEach(s => {
      data.push({ point: s.nw, eventType: EventType.Left, segment: s });
      data.push({ point: s.se, eventType: EventType.Right, segment: s });
    });

    // sort all events according to x then y coordinate
    // reverse so that we can pop
    data.sort(this.eventCmp);

    this.data = data;
  }

  eventCmp(e1, e2) {
    const cmp_res = compareXY(e1.point, e2.point);
    return cmp_res ? -cmp_res : e2.eventType - e1.eventType;
  }

  next() {
    return this.data.pop();
  }

  insert(event) {

    let idx;
    switch(use_binary_event_queue) {
      case UseBinary.Yes:
        idx = binaryFindIndex(this.data, elem => this.eventCmp(event, elem) < 0);
        break;

      case UseBinary.Test:
        idx = this.data.findIndex(elem => this.eventCmp(event, elem) < 0);
        const idx_bin = binaryFindIndex(this.data, elem => this.eventCmp(event, elem) < 0);
        if(idx !== idx_bin) { console.warn(`EQ insert: idx bin ${idx_bin} ≠ ${idx}`); }
        break;

      case UseBinary.No:
        idx = this.data.findIndex(elem => this.eventCmp(event, elem) < 0);
    }

    // if index is -1, then e is the smallest x and is appended to end (will be first)
    // (this is different than how splice works for -1)
    ~idx ? this.data.splice(idx, undefined, event) : this.data.push(event);
  }
}



// Find an index based on binary search
// EventQueue and NotATree both use findIndex to run through each element
// in the array, stopping when they first find the value that exceeds a comparator
// use:
// cmpNum = (a, b) => a - b;
// arr = [0,1,2,3,4,5,6,7]
// arr.sort(cmpNum)
// binaryFindIndex(arr, elem => elem > 3)
// binaryFindIndex(arr, (elem, idx) => elem + idx > 3)

/* test
pts = Array.fromRange(10).map(obj => randomPoint(5000));
pts.sort((a, b) => compareXY(a, b))

// if compareXY < 0, a is before b
let i;
for(i = 0; i < pts.length; i += 1) {
  let pt = pts[i];
  let bin_idx1 = binaryFindIndex(pts, obj => compareXY(pt, obj) <= 0);
  let bin_idx2 = binaryFindIndex(pts, obj => compareXY(obj, pt) > 0);
  let idx1 = pts.findIndex(obj => compareXY(pt, obj) <= 0);
  let idx2 = pts.findIndex(obj => compareXY(pt, obj) > 0);

  if(bin_idx1 !== idx1) {
    // should not fail
    console.error(`first bin index\t${bin_idx1} ≠ ${idx1}`);
  }

  if(bin_idx2 !== idx2) {
    // will fail
    console.error(`second bin index\t${bin_idx2} ≠ ${idx2}`);
  }

}

*/

function binaryFindIndex(arr, callbackFn) {
  let start = 0;
  let end = arr.length - 1;
  let mid = -1;

  // need first index for which callbackFn returns true
  // b/c the array is sorted, once the callbackFn is true for an index,
  // it is assumed true for the rest
  // so, e.g, [F,F,F, T, T, T, T]
  // progressively check until we have no items left.



  // Iterate, halving the search each time we find a true value
  let last_true_index = -1;
  while (start <= end){
    // find the mid index
    mid = Math.floor((start + end) / 2);

    // determine if this index returns true
    const res = callbackFn(arr[mid], mid);

    if(res) {
      // if we found a true value, we can ignore everything after mid
      last_true_index = mid;
      end = mid - 1;
    } else {
      // otherwise, the first true value might be after mid
      // (b/c it is sorted, it cannot be before)
      start = mid + 1;
    }
  }

  return last_true_index;
}

// Just like Javascript array sort
// If compareFunction  is
// < 0: sort a before b
// > 0: sort b before a
// To use, sort an array and then use binaryIndexOf with the same comparator function
// arr = [0,1,2,3,4,5,6,7]
// cmpNum = (a, b) => a - b;
// arr.sort(cmpNum); // only needed if array not yet sorted
// binaryIndexOf(arr, 2, cmpNum)

/* test
pts = Array.fromRange(10).map(obj => randomPoint(5000));
pts.sort((a, b) => compareXY(a, b))

// if compareXY < 0, a is before b
let i;
for(i = 0; i < pts.length; i += 1) {
  let pt = pts[i];
  let idx = pts.indexOf(pt);
  let bin_idx = binaryIndexOf(pts, pt, compareXY);
  if(idx !== bin_idx) {
    console.error(`binary index ${bin_idx} ≠ ${idx}`);
  }
}
*/

function binaryIndexOf(arr, obj, cmpFn) {
  let start = 0;
  let end = arr.length - 1;

  // iterate, halving the search each time
  while (start <= end) {
    let mid = Math.floor((start + end) / 2);
    let res = cmpFn(obj, arr[mid]);
    if(!res) return mid;

    if(res > 0) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return -1;
}


/**
 * Construct numeric index to represent unique pairing
 * digits_multiplier is Math.pow(10, numDigits(n));
 */
function hashSegments(s1, s2) {
  const key = compareXY(s1.nw, s2.nw) < 0 ?
    "" + s1.nw.key + s1.se.key + s2.nw.key + s2.se.key :
    "" + s2.nw.key + s2.se.key + s1.nw.key + s1.se.key;

  return key;
}


function checkForIntersection(s1, s2, e, tracker) {
  let num_ixs = 0;
  const hash = hashSegments(s1, s2);
//   const hash_rev = hashSegments(s2, s1);
  if(!(tracker.has(hash)) &&
    foundry.utils.lineSegmentIntersects(s1.A, s1.B, s2.A, s2.B)) {
    num_ixs += 1;

    // for testing

    const ix = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
    if(!ix) return num_ixs; // likely collinear lines

    if(debug) {
      console.log(`\tIntersection found at ${ix.x},${ix.y}`);
      drawVertex(ix, COLORS.lightred, .5);
    }

    const event_ix = {
      point: ix,
      eventType: EventType.Intersection,
      segment1: s1,
      segment2: s2
    };
    e.insert(event_ix);

    tracker.add(hash);
//     tracker.add(hash_rev);
  } else {
    if(debug) {
      const ix = foundry.utils.lineSegmentIntersection(s1.A, s1.B, s2.A, s2.B);
      if(ix) { console.log(`Would have added duplicate ix event for ${ix.x},${ix.y}`); }
    }
  }

  return num_ixs;
}



/**
Varieties of lines to test:

vertical line, multiple lines cross
horizontal line, multiple lines cross
Asterix *, center is endpoint
Asterix *, overlap at center point
Intersect at endpoint: <, >, V, upside down V
Intersect at endpoint for two co-linear horizontal lines --
Intersect at endpoint for two co-linear vertical lines

Triangle with overlap
Triangle intersecting at points

*/

