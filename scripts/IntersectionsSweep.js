/* globals
foundry,
game,
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
findIntersectionsSweepLinkedSingle = api.findIntersectionsSweepLinkedSingle;
findIntersectionsSweepSkipListSingle = api.findIntersectionsSweepSkipListSingle;
findIntersectionsSweepCombinedSwapSingle = api.findIntersectionsSweepCombinedSwapSingle;
findIntersectionsSweepCombinedSkipSingle = api.findIntersectionsSweepCombinedSkipSingle;


EventQueue = api.EventQueue;
SegmentArray = api.SegmentArray;
binaryFindIndex = api.binaryFindIndex;
binaryIndexOf = api.binaryIndexOf;
OrderedArray = api.OrderedArray;
PriorityQueueArray = api.PriorityQueueArray;
SkipList = api.SkipList;
pointForSegmentGivenX = api.pointForSegmentGivenX;
EventType = api.EventType;
hashSegments = api.hashSegments;
OrderedDoubleLinkedList = api.OrderedDoubleLinkedList;
findIntersectionsSweepCombinedSingle = api.findIntersectionsSweepCombinedSingle


MODULE_ID = 'testccw'
UseBinary = {
  No: 0,
  Yes: 1,
  Test: 2,
}

reportFn = (e1, e2, ix) => {}

function compareYX(a, b) {
  const diff_y = a.y - b.y;
  if(diff_y.almostEqual(0)) {
    const diff_x = a.x - b.x;
    return diff_x.almostEqual(0) ? 0 : diff_x;
  }
  return diff_y;
}

function compareYXInt(a, b) {
  return (a.y - b.y) || (a.x - b.x);
}

function compareXY(a, b) {
  const diff_x = a.x - b.x;
  if(diff_x.almostEqual(0)) {
    const diff_y = a.y - b.y;
    return diff_y.almostEqual(0) ? 0 : diff_y;
  }
  return diff_x;
}

function compareXYInt(a, b) {
  return (a.x - b.x) || (a.y - b.y);
}

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


function pointsEqual(p1, p2) { return (p1.x.almostEqual(p2.x) && p1.y.almostEqual(p2.y)) }


canvas.controls.debug.clear()
walls = [...canvas.walls.placeables]
segments = walls.map(w => SimplePolygonEdge.fromWall(w));

// store coordinates for testing
s_coords = segments.map(s => {
  return { A: { x: s.A.x, y: s.A.y}, B: {x: s.B.x, y: s.B.y} }
});

// change to string
str = JSON.stringify(s_coords);

// back to Segment
JSON.parse(str).map(s => new SimplePolygonEdge(s.A, s.B))




N = 100
await benchmarkLoopFn(N, findIntersectionsBruteSingle, "brute sort", segments)
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

reportFnSweepLink = (s1, s2, ix) => {
  reporting_arr_sweep_link.push(ix);
}

reportFnSweepSkip = (s1, s2, ix) => {
  reporting_arr_sweep_skip.push(ix);
}

reportFnSweepCombined = (s1, s2, ix) => {
  reporting_arr_sweep_combined.push(ix);
}



function applyFn(fn, num_segments, max_coord) {
  segments = Array.fromRange(num_segments).map(i => randomSegment(max_coord))
  return fn(segments);
}

reporting_arr_brute = []
reporting_arr_sort = []
reporting_arr_sweep = []
reporting_arr_sweep_link = []
reporting_arr_sweep_skip = []

segments = Array.fromRange(10).map(i => randomSegment(5000))
canvas.controls.debug.clear()
segments.forEach(s => drawEdge(s, COLORS.black))

findIntersectionsBruteSingle(segments, reportFnBrute)
findIntersectionsSortSingle(segments, reportFnSort)
// findIntersectionsSweepSingle(segments, reportFnSweep)
findIntersectionsSweepLinkedSingle(segments, reportFnSweepLink)
findIntersectionsSweepSkipListSingle(segments, reportFnSweepSkip)

reporting_arr_brute.sort(compareXY)
reporting_arr_sort.sort(compareXY)
// reporting_arr_sweep.sort(compareXY)
reporting_arr_sweep_link.sort(compareXY)
reporting_arr_sweep_skip.sort(compareXY)

sort_passes = reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sort[idx]))
// sweep_passes =reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep[idx]))
sweep_link_passes = reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_link[idx]))
sweep_skip_passes = reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_skip[idx]))

if(!sort_passes) {
  console.warn(`Sort ≠ Brute ixs`)
  console.table(reporting_arr_brute);
  console.table(reporting_arr_sort)
}

if(!sweep_link_passes) {
  console.warn(`Sort ≠ Brute ixs`)
  console.table(reporting_arr_brute);
  console.table(reporting_arr_sweep_link)
}

if(!sweep_skip_passes) {
  console.warn(`Sort ≠ Brute ixs`)
  console.table(reporting_arr_brute);
  console.table(reporting_arr_sweep_skip)
}

Bench





N = 100
num_segments = 10
max_coord = Math.pow(2, 13)
await benchmarkLoopFn(N, applyFn, "brute", findIntersectionsBruteSingle, num_segments, max_coord)
await benchmarkLoopFn(N, applyFn, "sort", findIntersectionsSortSingle, num_segments, max_coord)
await benchmarkLoopFn(N, applyFn, "sort2", findIntersectionsSort2Single, num_segments, max_coord)
await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord)
await benchmarkLoopFn(N, applyFn, "sweep linked", findIntersectionsSweepLinkedSingle, num_segments, max_coord)
await benchmarkLoopFn(N, applyFn, "sweep linked", findIntersectionsSweepLinkedSingle, num_segments, max_coord)



segments = Array.fromRange(10).map(i => randomSegment(5000))
reporting_arr_brute = []
reporting_arr_sweep = []
reporting_arr_sweep_link = []
reporting_arr_sweep_skip = []


findIntersectionsBruteSingle(segments(reportFnBrute));
let n = segments.length
let k = reporting_arr_brute.length
console.log(`${n} segments with ${k} intersections.\n\tO(n^2): ${Math.pow(n, 2)}\n\tO(nlog(n) + n*n*.5): ${n * Math.log(n) + n*n*.5}\n\tO((n+k)log(n)):${(n+k)*Math.log(n)}`)
await benchmarkLoopFn(N, findIntersectionsBruteSingle, "brute", segments);
await benchmarkLoopFn(N, findIntersectionsSweepSingle, "sweep", segments);
await benchmarkLoopFn(N, findIntersectionsSweepLinkedSingle, "sweep linked", segments);
await benchmarkLoopFn(N, findIntersectionsSweepSkipListSingle, "sweep skip", segments);
await benchmarkLoopFn(N, findIntersectionsSweepCombinedSingle, "sweep combined", segments);

let i;
let segments
for(i = 0; i < 100; i += 1) {
  i % 10 !== 0 || console.log(`${i}`);

  reporting_arr_brute = []
  reporting_arr_sweep = []
  reporting_arr_sweep_link = []
  reporting_arr_sweep_skip = []
  reporting_arr_sweep_combined = []

  segments = Array.fromRange(10).map(i => randomSegment(5000))
  findIntersectionsBruteSingle(segments, reportFnBrute)
  findIntersectionsSweepSingle(segments, reportFnSweep)
  findIntersectionsSweepLinkedSingle(segments, reportFnSweepLink)
  findIntersectionsSweepSkipListSingle(segments, reportFnSweepSkip)
  findIntersectionsSweepCombinedSingle(segments, reportFnSweepCombined)

  reporting_arr_brute.sort(compareXY)
  reporting_arr_sweep.sort(compareXY)
  reporting_arr_sweep_link.sort(compareXY)
//   reporting_arr_sweep_skip.sort(compareXY)
  reporting_arr_sweep_combined.sort(compareXY)

//   if(reporting_arr_brute.length !== reporting_arr_sweep.length ||
//      !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep[idx]))) {
//
//      console.table(reporting_arr_brute);
//      console.table(reporting_arr_sweep);
//      console.error(`ixs not equal .`, segments)
//      break;
//   }

  if(reporting_arr_brute.length !== reporting_arr_sweep_link.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_link[idx]))) {

     console.table(reporting_arr_brute);
     console.table(reporting_arr_sweep_link);
     console.error(`ixs not equal .`, segments)
     break;
  }


//   if(reporting_arr_brute.length !== reporting_arr_sweep_link.length ||
//      !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_skip[idx]))) {
//
//      console.table(reporting_arr_brute);
//      console.table(reporting_arr_sweep_link);
//      console.error(`ixs not equal .`, segments)
//      break;
//   }
}

// enlarge segments
orig_segments = [...segments]
segments = segments.map(s => {
  return new SimplePolygonEdge({x: s.A.x * 20, y: s.A.y * 20},
                               {x: s.B.x * 20, y: s.B.y * 20})

})

N = 100
max_coord = Math.pow(2, 13)
num_segments_arr = [10, 100, 200, 1000, 2000, 5000]
for(let i = 0; i < num_segments_arr.length; i += 1) {

  let num_segments = num_segments_arr[i]
  console.log(`\nNum Segments ${num_segments}`);

  let use_slow = num_segments < 201;



  await benchmarkLoopFn(N, applyFn, "brute", findIntersectionsBruteSingle, num_segments, max_coord);
  await benchmarkLoopFn(N, applyFn, "sort", findIntersectionsSortSingle, num_segments, max_coord);


  if(use_slow) {
    console.log("No binary");
    api.debug_binary = UseBinary.No;
    await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord);
    await benchmarkLoopFn(N, applyFn, "sweep linked", findIntersectionsSweepLinkedSingle, num_segments, max_coord);
    await benchmarkLoopFn(N, applyFn, "sweep skip", findIntersectionsSweepSkipListSingle, num_segments, max_coord);
    await benchmarkLoopFn(N, applyFn, "sweep combined", findIntersectionsSweepCombinedSingle, num_segments, max_coord);
    await benchmarkLoopFn(N, applyFn, "sweep combined skip", findIntersectionsSweepCombinedSkipSingle, num_segments, max_coord);
  }

  if(use_slow) {
    console.log("Test binary");
    api.debug_binary = UseBinary.Test;
    await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord);
    await benchmarkLoopFn(N, applyFn, "sweep linked", findIntersectionsSweepLinkedSingle, num_segments, max_coord);
    await benchmarkLoopFn(N, applyFn, "sweep skip", findIntersectionsSweepSkipListSingle, num_segments, max_coord);
    await benchmarkLoopFn(N, applyFn, "sweep combined", findIntersectionsSweepCombinedSingle, num_segments, max_coord);
    await benchmarkLoopFn(N, applyFn, "sweep combined skip", findIntersectionsSweepCombinedSkipSingle, num_segments, max_coord);
  }

  console.log("Binary");
  api.debug_binary = UseBinary.Yes;
  use_slow && await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord);
  use_slow && await benchmarkLoopFn(N, applyFn, "sweep linked", findIntersectionsSweepLinkedSingle, num_segments, max_coord);
  await benchmarkLoopFn(N, applyFn, "sweep skip", findIntersectionsSweepSkipListSingle, num_segments, max_coord);
  use_slow && await benchmarkLoopFn(N, applyFn, "sweep combined", findIntersectionsSweepCombinedSingle, num_segments, max_coord);
  use_slow && await benchmarkLoopFn(N, applyFn, "sweep combined skip", findIntersectionsSweepCombinedSkipSingle, num_segments, max_coord);

  api.debug_binary = UseBinary.Test;
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


/* Benchmark different methods to store the y-segment queue
// use points b/c simpler than building whole segments
// Build N points, add to queue, random sort and remove from queue



blankFn = function(pts, { remove = true } = {}) {
  arr = [];
  pts.forEach(pt => {});

  if(!remove) return;
  pts.sort((a,b) => Math.random() - 0.5);
  pts.forEach(pt => {});
}

orderedArrayFn = function(pts, { remove = true} = {}) {
  arr = new OrderedArray(compareXY);
  pts.forEach(pt => arr.insert(pt));

  if(!remove) return;
  pts.sort((a,b) => Math.random() - 0.5);
  pts.forEach(pt => {
    const idx = arr.indexOf(pt);
    arr.removeAtIndex(idx);
  });
}

orderedBinaryArrayFn = function(pts, { remove = true} = {}) {
  arr = new OrderedArray(compareXY);
  pts.forEach(pt => arr.binaryInsert(pt));

  if(!remove) return;
  pts.sort((a,b) => Math.random() - 0.5);
  pts.forEach(pt => {
    const idx = arr.binaryIndexOf(pt);
    arr.removeAtIndex(idx);
  });
}

linkedFn = function(pts, { remove = true} = {}) {
  arr = new OrderedDoubleLinkedList(compareXY);
  pts.forEach(pt => arr.insert(pt));

  if(!remove) return;
  pts.sort((a,b) => Math.random() - 0.5);
  pts.forEach(pt => arr.removeData(pt));
}

skipFn = function(pts, { remove = true} = {}) {
  arr = new SkipList(compareXY);
  pts.forEach(pt => arr.insert(pt));

  if(!remove) return;
  pts.sort((a,b) => Math.random() - 0.5);
  pts.forEach(pt => arr.removeData(pt));
}

N = 1000
num_pts = 10;
pts = Array.fromRange(num_pts).map(e => randomPoint(5000));
await benchmarkLoopFn(N, blankFn, "blankFn", pts, { remove: false});
await benchmarkLoopFn(N, orderedArrayFn, "orderedArrayFn", pts, { remove: false});
await benchmarkLoopFn(N, orderedBinaryArrayFn, "orderedBinaryArrayFn", pts, { remove: false});
await benchmarkLoopFn(N, linkedFn, "linkedFn", pts, { remove: false});
await benchmarkLoopFn(N, skipFn, "skipFn", pts, { remove: false});

await benchmarkLoopFn(N, blankFn, "blank", pts, { remove: true});
await benchmarkLoopFn(N, orderedArrayFn, "orderedArrayFn", pts, { remove: true});
await benchmarkLoopFn(N, orderedBinaryArrayFn, "orderedBinaryArrayFn", pts, { remove: true});
await benchmarkLoopFn(N, linkedFn, "linkedFn", pts, { remove: true});
await benchmarkLoopFn(N, skipFn, "skipFn", pts, { remove: true});


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
import { PriorityQueueArray } from "./PriorityQueueArray.js";
import { MODULE_ID, UseBinary } from "./module.js";
import { OrderedArray } from "./OrderedArray.js";
import { binaryFindIndex, binaryIndexOf } from "./BinarySearch.js";
import { drawVertex, drawEdge, COLORS, clearLabels, labelVertex } from "./Drawing.js";

// function segmentCompare(segment, elem, sweep_x) {
//   // must use the current sweep location to set nw for each existing element
//   segment._tmp_nw = pointForSegmentGivenX(segment, sweep_x) || segment._tmp_nw;
//   elem._tmp_nw = pointForSegmentGivenX(elem, sweep_x) || elem._tmp_nw; // if vertical keep existing
//
//   // if compareXY is not 0, use that comparison result.
//
//   // otherwise, segment and elem share nw endpoint or se endpoint equals _tmp_nw at sweep
//   // sort by extending the lines to the nw: whichever is higher in the nw
//   // direction is first in the sort.
//   // can determine this directly by extending lines from the se, or indirectly by
//   // determining their orientation relative to one another
//
//   // if they share the nw endpoint, the first orientation will return 0; test again
//   // in opposite direction. So first orientation tests > shape; second tests < shape
//   // of the X.
//
//   return compareYX(segment._tmp_nw, elem._tmp_nw) ||
//          foundry.utils.orient2dFast(elem.se, elem.nw, segment.nw) ||
//          foundry.utils.orient2dFast(elem.nw, elem.se, segment.se);
// }



export function findIntersectionsSweepSingle(segments, reportFn = (e1, e2, ix) => {}) {
  // id the segments for testing
  const debug = game.modules.get(MODULE_ID).api.debug;

  if(debug) {
    canvas.controls.debug.clear();
    clearLabels();
    segments.forEach(s => drawEdge(s, COLORS.black));
    segments.forEach(s => labelVertex(s.nw, s.id));
  }

  let tracker = new Set(); // to note pairs for which intersection is checked already
  let tree = new SegmentArray(); // pretend this is actually a tree
  let e = new EventQueue(segments);

  let num_ixs = 0; // mainly for testing

  // traverse the queue
  let curr;
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
        num_ixs += handleIntersectionEvent(curr, e, tree, tracker, reportFn);
        break;
      case EventType.Right:
        num_ixs += handleRightEvent(curr, e, tree, tracker);
        break;
    }

    if(debug) { console.table(tree.data, ["_id"]); }

  }

  return num_ixs;
}

function handleLeftEvent(curr, e, tree, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;

  if(debug) {
    console.log(`\tLeft endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
    drawEdge(curr.segment);
  }

  // get the above and below points
  let idx = tree.insert(curr.segment, curr.point.x);

  // check if curr intersects with its predecessor and successor
  // if we already checked this pair, we can skip
  let below = tree.successor(idx); // below means higher index, so successor
  if(below) { num_ixs += checkForIntersection(below, curr.segment, e, tracker); }

  let above = tree.predecessor(idx);
  if(above) { num_ixs += checkForIntersection(above, curr.segment, e, tracker); }

  return num_ixs;
}

function handleIntersectionEvent(curr, e, tree, tracker, reportFn) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;

  // report intersection
  reportFn(curr.segment1, curr.segment2, curr.point);

  if(debug) {
    console.log(`\tIntersection event ${curr.point.x},${curr.point.y}`);
    drawVertex(curr.point);
    console.log(`\tSwapping ${curr.segment1.nw.x},${curr.segment1.nw.y}|${curr.segment1.se.x},${curr.segment1.se.y} and ${curr.segment2.nw.x},${curr.segment2.nw.y}|${curr.segment2.se.x},${curr.segment2.se.y}`);
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

    let below = tree.successor(Math.max(new_idx1, new_idx2));
    let above = tree.predecessor(Math.min(new_idx1, new_idx2));

    if(below) { num_ixs += checkForIntersection(below, bottom_segment, e, tracker); }
    if(above) { num_ixs += checkForIntersection(above, top_segment, e, tracker); }
  }

  return num_ixs;
}

function handleRightEvent(curr, e, tree, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  const debug_binary = game.modules.get(MODULE_ID).api.debug_binary;

  let num_ixs = 0;

  if(debug) {
    console.log(`\tRight endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
  }

  // curr point is right of its segment
  // check if predecessor and successor intersect with each other

  let idx, idx_bin;
  switch(debug_binary) {
    case UseBinary.Yes:
      idx = tree.deletionBinaryIndexOf(curr.segment, curr.point.x);
      break;

    case UseBinary.Test:
      idx = tree.indexOf(curr.segment);
      idx_bin = tree.deletionBinaryIndexOf(curr.segment, curr.point.x);
      if(idx !== idx_bin) { console.warn(`delete segment: idx bin ${idx_bin} ≠ ${idx} at sweep ${curr.point.x}`); }
      break;

    case UseBinary.No:
      idx = tree.indexOf(curr.segment);
      break;
  }

//   let idx = tree.deletionBinaryIndexOf(curr.segment, curr.point.x);
//   let idx_bin = tree.deletionBinaryIndexOf(curr.segment, curr.point.x);
//
//   if(idx !== idx_bin) {
//     console.warn(`handleRightEvent: idx ${idx} ≠ idx_bin ${idx_bin} for endpoint ${curr.point.x},${curr.point.y}`);
//   }

  if(!~idx) console.error("Segment not found", curr);
  let below = tree.successor(idx);
  let above = tree.predecessor(idx);
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
 * Construct numeric index to represent unique pairing
 * digits_multiplier is Math.pow(10, numDigits(n));
 */
export function hashSegments(s1, s2) {
  // need s1, s2 hash to be equivalent to s2,s1 hash
  // if nw endpoint is the same, then we need to compare the se to get unique ordering
  // key is a string to ensure uniqueness; integer key would likely overflow
  const cmp_nw = compareXY(s1.nw, s2.nw);
  const order = cmp_nw ? cmp_nw < 0 : compareXY(s1.se, s2.se) < 0;
  const key = order ?
    "" + s1.nw.key + s1.se.key + s2.nw.key + s2.se.key :
    "" + s2.nw.key + s2.se.key + s1.nw.key + s1.se.key;

  return key;
}


export function checkForIntersection(s1, s2, e, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;
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
 * instead of a self-balancing tree, see how we do with just an
 * array that we pretend is an ordered tree.
 * array sorted from smallest y (above) to largest y (below)
 */

export class SegmentArray extends OrderedArray {


 /**
  * For a given x position, return the y position along the segment or undefined if
  * the segment is vertical. Does not check fo whether the point is on the segment,
  * versus beyond the segment.
  * @param {Segment}  s   Object with A.x, A.y, B.x, and B.y coordinates.
  * @param {Number}   x   X-coordinate from which to generate a y-coordinate.
  * @return {Point|Undefined}
  */
  static pointForSegmentGivenX(s, x) {
    const denom = s.B.x - s.A.x;
    if(!denom) return undefined;
    return { x: x, y: ((s.B.y - s.A.y) / denom * (x - s.A.x)) + s.A.y };
  }

 /**
  * Take in a sweep_x to adjust the segment comparison as the sweep moves along the x axis.
  * Otherwise like the OrderedArray version.
  * @param {Segment}  segment   Object with A.x, A.y, B.x, B.y coordinates, plus
  *                             _tmp_nw set when inserting in this class's array.
  * @param {Number}   sweep_x   X-coordinate used in the comparison.
  * @return {Number}  Index of the segment in the array.
  */
  binaryIndexOf(segment, sweep_x) {
    // if segment._tmp_nw is undefined, it either has not been added or
    // already removed.
    if(!segment._tmp_nw) { return -1; }

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

    segment._tmp_nw = SegmentArray.pointForSegmentGivenX(segment, sweep_x) || segment._tmp_nw; // if vertical, use existing
    return binaryIndexOf(this.data, segment, (a, b) => this._segmentCompare(a, b, sweep_x));
  }

 /**
  * Like binaryIndexOf, but fall back to the se coordinate if the line is vertical.
  * @param {Segment}  segment   Object with A.x, A.y, B.x, B.y coordinates, plus
  *                             _tmp_nw set when inserting in this class's array.
  * @param {Number}   sweep_x   X-coordinate used in the comparison.
  * @return {Number}  Index of the segment in the array.
  */
  deletionBinaryIndexOf(segment, sweep_x) {
    if(!segment._tmp_nw) { return -1; }

    segment._tmp_nw = pointForSegmentGivenX(segment, sweep_x) || segment.se; // deleting, so we want the end
    return binaryIndexOf(this.data, segment, (a, b) => this._segmentCompareForDeletion(a, b, sweep_x));
  }

 /**
  * Insert an object in the array.
  * Takes an x coordinate to insert at the correct position given the sweep location.
  * @param {Object}   obj      Object with A.x, A.y, B.x, B.y coordinates, plus a nw
  *                            property indicating whether A or B are more nw.
  * @param {Number}   sweep_x Sweep location
  * @return {number}  Index where the object was inserted.
  */
  insert(segment, sweep_x) {
    const debug_binary = game.modules.get(MODULE_ID).api.debug_binary;
    if(typeof sweep_x === "undefined") { console.warn("insert requires sweep_x"); }

    // add a temporary index flag, because during the sweep segments are swapped at
    // intersections, thus switching their "y" values accordingly.
    segment._tmp_nw = segment.nw;

    // for debugging
    let idx, idx_bin;
    switch(debug_binary) {
      case UseBinary.Yes:
        idx = binaryFindIndex(this.data, elem => this._elemIsAfter(segment, elem, sweep_x));
        break;

      case UseBinary.Test:
        idx = this.data.findIndex(elem => this._elemIsAfter(segment, elem, sweep_x));
        idx_bin = binaryFindIndex(this.data, elem => this._elemIsAfter(segment, elem, sweep_x));
        if(idx !== idx_bin) { console.warn(`insert segment: idx bin ${idx_bin} ≠ ${idx} at sweep ${sweep_x}`); }
        break;

      case UseBinary.No:
        idx = this.data.findIndex(elem => this._elemIsAfter(segment, elem, sweep_x));
        break;
    }

    return this._insertAt(segment, idx);
  }

 /**
  * Swap two segments in the array.
  */
  swap(segment1, segment2, sweep_x) {
    const debug_binary = game.modules.get(MODULE_ID).api.debug_binary;
    if(!segment1._tmp_nw || !segment2._tmp_nw) { return -1; }

    let idx1, idx2, idx_bin1, idx_bin2;
    switch(debug_binary) {
      case UseBinary.Yes:
        idx1 = this.binaryIndexOf(segment1, sweep_x);
        idx2 = this.binaryIndexOf(segment2, sweep_x);
        break;

      case UseBinary.Test:
        idx1 = this.data.indexOf(segment1);
        idx2 = this.data.indexOf(segment2);
        idx_bin1 = this.binaryIndexOf(segment1, sweep_x);
        idx_bin2 = this.binaryIndexOf(segment2, sweep_x);
        if(idx1 !== idx_bin1) { console.warn(`swap segment1: idx bin1 ${idx_bin1} ≠ ${idx1} at sweep ${sweep_x}`); }
        if(idx2 !== idx_bin2) { console.warn(`swap segment2: idx bin2 ${idx_bin2} ≠ ${idx2} at sweep ${sweep_x}`); }
        break;

      case UseBinary.No:
        idx1 = this.data.indexOf(segment1);
        idx2 = this.data.indexOf(segment2);
        break;
    }

    if(!~idx1 || !~idx2) {
//       console.warn("swap segments not found.");
      return [undefined, undefined];
    }

    // change their temporary values (only *after* finding their current index)

    [ segment2._tmp_nw, segment1._tmp_nw ] = [ segment1._tmp_nw, segment2._tmp_nw ];

    // change their position
    //this.swapIndices(idx1, idx2);
    this.data[idx1] = segment2;
    this.data[idx2] = segment1;

    return [idx2, idx1];
  }

 /**
  * Delete a segment at a given index
  * Just like OrderedArray.deleteAtIndex but marks the tmp flag as undefined.
  * @param {number} idx   Index of segment to remove
  */
  deleteAtIndex(idx) {
    if(idx < 0 || idx > ( this.data.length - 1)) {
      console.log(`Attempted deleteAtIndex ${idx} with data length ${this.data.length}`, this.data);
      return;
    }

    this.data[idx]._tmp_nw = undefined;
    this.data.splice(idx, 1);
  }

 /**
  * Comparison function that uses a changeable sweep_x value
  * to adjust the comparison as the sweep moves across the x axis.
  */
  _segmentCompare(segment, elem, sweep_x) {
    // use the current sweep location to set nw for each existing element
    elem._tmp_nw = SegmentArray.pointForSegmentGivenX(elem, sweep_x) || elem._tmp_nw; // if vertical keep existing

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

 /**
  * Like segmentCompare, but reverses the orientation so that the comparison is correct
  * when comparing segments for deletion after a swap along a vertical line.
  */
  _segmentCompareForDeletion(segment, elem, sweep_x) {
    elem._tmp_nw = SegmentArray.pointForSegmentGivenX(elem, sweep_x) || elem._tmp_nw; // deleting, so we want the end
    return compareYX(segment._tmp_nw, elem._tmp_nw) ||
           -foundry.utils.orient2dFast(elem.se, elem.nw, segment.nw) ||
           -foundry.utils.orient2dFast(elem.nw, elem.se, segment.se);
  }

 /**
  * Helper function transforming the comparator output to true/false; used by insert.
  * @param {Object}   obj     Object to search for
  * @param {Object}   elem    Element of the array
  * @param {number}   sweep_x Position of the sweep
  * @return {boolean} True if the element is after the segment in the ordered array.
  */
  _elemIsAfter(segment, elem, sweep_x) { return this._segmentCompare(segment, elem, sweep_x) < 0; }

}

export function pointForSegmentGivenX(s, x) {
    const denom = s.B.x - s.A.x;
    if(!denom) return undefined;
    return { x: x, y: ((s.B.y - s.A.y) / denom * (x - s.A.x)) + s.A.y };
  }



// When events have the same point, prefer Left types first
export const EventType = {
  Left: 0,
  Intersection: 1,
  Right: 2,
};


// Needs to approximate a priority queue.
// In particular, it is possible for an intersection event to be added that would be
// the very next event, possibly several jumps in front of the current segment event
// had they been all sorted with the intersection event.

export class EventQueue extends PriorityQueueArray {
  constructor(arr, { comparator = EventQueue.eventCmp,
                     sort = (arr, cmp) => arr.sort(cmp) } = {}) {
    // push all points to a vector of events
    const data = [];
    arr.forEach(s => {
      data.push({ point: s.nw, eventType: EventType.Left, segment: s });
      data.push({ point: s.se, eventType: EventType.Right, segment: s });
    });

    super(data, { comparator, sort });
  }

  static eventCmp(e1, e2) {
    const cmp_res = compareXY(e1.point, e2.point);
    return cmp_res ? -cmp_res : e2.eventType - e1.eventType;
  }

  insert(event) {
    const debug_binary = game.modules.get(MODULE_ID).api.debug_binary;

    let idx, idx_bin;
    switch(debug_binary) {
      case UseBinary.Yes:
        idx = binaryFindIndex(this.data, elem => this._elemIsAfter(event, elem));
        break;

      case UseBinary.Test:
        idx = this.data.findIndex(elem => this._elemIsAfter(event, elem));
        idx_bin = binaryFindIndex(this.data, elem => this._elemIsAfter(event, elem));
        if(idx !== idx_bin) { console.warn(`EQ insert: idx bin ${idx_bin} ≠ ${idx}`); }
        break;

      case UseBinary.No:
        idx = this.data.findIndex(elem => this._elemIsAfter(event, elem));
    }

    this._insertAt(event, idx);
  }
}





/**
Varieties of lines to test:

canvas.controls.debug.clear()
walls = [...canvas.walls.placeables]
segments = walls.map(w => SimplePolygonEdge.fromWall(w));

// store coordinates for testing
s_coords = segments.map(s => {
  return { A: { x: s.A.x, y: s.A.y}, B: {x: s.B.x, y: s.B.y} }
});

// change to string
str = JSON.stringify(s_coords);

// back to segment
segments = JSON.parse(str).map(s => new SimplePolygonEdge(s.A, s.B));

test_strings = new Map();


// Intersect at endpoint: <, >, V, upside down V
// >
str = '[{"A":{"x":1900,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":2100}}]'
test_strings.set(">", str);

// <
str = '[{"A":{"x":2800,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":2800,"y":2100}}]'
test_strings.set("<", str);

// V
str = '[{"A":{"x":2000,"y":1200},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":2800,"y":1200}}]'
test_strings.set("V", str);

// upside down V
str = '[{"A":{"x":2400,"y":1600},"B":{"x":2800,"y":2100}},{"A":{"x":2000,"y":2100},"B":{"x":2400,"y":1600}}]'
test_strings.set("upside down V", str);

// +
str = '[{"A":{"x":1912,"y":2000},"B":{"x":3300,"y":2000}},{"A":{"x":2600,"y":1300},"B":{"x":2600,"y":2812}}]'
test_strings.set("+", str);

// vertical line, multiple lines cross (the "TV antenna")
str = '[{"A":{"x":2600,"y":1300},"B":{"x":2600,"y":2812}},{"A":{"x":2037,"y":1450},"B":{"x":3137,"y":1700}},{"A":{"x":2162,"y":2325},"B":{"x":3925,"y":2350}},{"A":{"x":1675,"y":2650},"B":{"x":2875,"y":2612}},{"A":{"x":1912,"y":2000},"B":{"x":3300,"y":2000}}]'
test_strings.set("TV antenna", str);

// Vertical line with endpoints intersecting
str = '[{"A":{"x":2037,"y":1450},"B":{"x":2600,"y":1600}},{"A":{"x":2600,"y":2000},"B":{"x":3300,"y":2000}},{"A":{"x":1675,"y":2650},"B":{"x":2600,"y":2500}},{"A":{"x":2600,"y":1300},"B":{"x":2600,"y":2812}},{"A":{"x":2600,"y":2600},"B":{"x":2100,"y":2700}},{"A":{"x":2600,"y":2300},"B":{"x":3925,"y":2350}}]'
test_strings.set("TV antenna endpoints", str);

// horizontal line, multiple lines cross
str = '[{"A":{"x":1675,"y":2650},"B":{"x":2200,"y":2000}},{"A":{"x":2200,"y":2100},"B":{"x":2500,"y":2600}},{"A":{"x":2037,"y":1450},"B":{"x":2700,"y":2500}},{"A":{"x":3700,"y":2300},"B":{"x":3300,"y":2000}},{"A":{"x":1700,"y":2200},"B":{"x":3700,"y":2200}},{"A":{"x":2600,"y":2100},"B":{"x":3900,"y":2400}}]'
test_strings.set("horizontal with crossing", str);

// horizontal line, endpoints intersecting
str = '[{"A":{"x":1675,"y":2650},"B":{"x":2000,"y":2200}},{"A":{"x":2300,"y":2200},"B":{"x":2500,"y":2600}},{"A":{"x":2500,"y":2200},"B":{"x":2700,"y":2500}},{"A":{"x":2600,"y":2100},"B":{"x":3000,"y":2200}},{"A":{"x":1700,"y":2200},"B":{"x":3700,"y":2200}},{"A":{"x":3600,"y":2200},"B":{"x":3300,"y":2000}}]'
test_strings.set("horizontal with intersecting", str);

// Asterix *, center is endpoint
str = '[{"A":{"x":1900,"y":1600},"B":{"x":2400,"y":1600}},{"A":{"x":1900,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":1900,"y":2200},"B":{"x":2400,"y":1600}},{"A":{"x":2900,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":2900,"y":2200},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":2200},"B":{"x":2400,"y":1600}},{"A":{"x":2900,"y":1600},"B":{"x":2400,"y":1600}}]'
test_strings.set("* with endpoint", str);

// Asterix *, overlap at center point
str = '[{"A":{"x":1900,"y":1100},"B":{"x":2900,"y":2100}},{"A":{"x":1900,"y":2100},"B":{"x":2900,"y":1100}},{"A":{"x":1900,"y":1600},"B":{"x":2900,"y":1600}},{"A":{"x":2400,"y":1100},"B":{"x":2400,"y":2100}}]'
test_strings.set("* with overlap", str);

// Near asterix. > plus * on the right; shared endpoint at center
str = '[{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":2200}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":2400,"y":2200}}]'
test_strings.set("Near *", str);

// evil near asterix. Like near asterix, but has intersecting lines on the right side.
str = '[{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":2200}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":2400,"y":2200}},{"A":{"x":2312,"y":1300},"B":{"x":3325,"y":1237}},{"A":{"x":2475,"y":1925},"B":{"x":3350,"y":1862}},{"A":{"x":2637,"y":1687},"B":{"x":3087,"y":1400}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1600}},{"A":{"x":2712,"y":1437},"B":{"x":3262,"y":2100}}]'
test_strings.set("Evil *", str);


// Intersect at endpoint for two co-linear horizontal lines --
// colinear, so no overlap
str = '[{"A":{"x":2400,"y":1800},"B":{"x":3000,"y":1800}},{"A":{"x":1900,"y":1800},"B":{"x":2400,"y":1800}}]'

// Intersect at endpoint for two co-linear vertical lines
// colinear, so no overlap


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

reportFnSweepLink = (s1, s2, ix) => {
  reporting_arr_sweep_link.push(ix);
}

reportFnSweepSkip  = (s1, s2, ix) => {
  reporting_arr_sweep_skip.push(ix);
}

reportFnSweepCombined = (s1, s2, ix) => {
  reporting_arr_sweep_combined.push(ix);
}

reportFnSweepSwapCombined = (s1, s2, ix) => {
  reporting_arr_sweep_swap_combined.push(ix);
}

reportFnSweepSkipCombined = (s1, s2, ix) => {
  reporting_arr_sweep_skip_combined.push(ix);
}

for([key, str] of test_strings) {
  console.log(`\nTesting ${key}`)
  reporting_arr_brute = []
  reporting_arr_sort = []
  reporting_arr_sweep = []
  reporting_arr_sweep_link = []
  reporting_arr_sweep_skip = []
  reporting_arr_sweep_combined = []
  reporting_arr_sweep_skip_combined = []
  reporting_arr_sweep_swap_combined = [];


  segments = JSON.parse(str).map(s => new SimplePolygonEdge(s.A, s.B));
  canvas.controls.debug.clear()
  clearLabels();
  segments.forEach(s => drawEdge(s, COLORS.black))

  findIntersectionsBruteSingle(segments, reportFnBrute)
  findIntersectionsSortSingle(segments, reportFnSort)
  findIntersectionsSweepSingle(segments, reportFnSweep)
  findIntersectionsSweepLinkedSingle(segments, reportFnSweepLink)
  findIntersectionsSweepSkipListSingle(segments, reportFnSweepSkip)
  findIntersectionsSweepCombinedSingle(segments, reportFnSweepCombined)
//   findIntersectionsSweepCombinedSwapSingle(segments, reportFnSweepSwapCombined)
  findIntersectionsSweepCombinedSkipSingle(segments, reportFnSweepSkipCombined)

  // for a shared endpoint where the two lines are co-linear, brute will
  // not report an intersection but sweep will.
  if(key === "* with endpoint" || key === "Near *" || key === "Evil *") {
    reporting_arr_brute.push(reporting_arr_brute[0], reporting_arr_brute[0]);
    reporting_arr_sort.push(reporting_arr_sort[0], reporting_arr_sort[0]);
  }

  reporting_arr_brute.sort(compareXY)
  reporting_arr_sort.sort(compareXY)
  reporting_arr_sweep.sort(compareXY)
  reporting_arr_sweep_link.sort(compareXY)
  reporting_arr_sweep_skip.sort(compareXY)
  reporting_arr_sweep_combined.sort(compareXY)
//   reporting_arr_sweep_swap_combined.sort(compareXY)
  reporting_arr_sweep_skip_combined.sort(compareXY)


  if(reporting_arr_brute.length !== reporting_arr_sort.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sort[idx]))) {

     console.error(`\tx Sort`, )
//      console.table(reporting_arr_brute);
//      console.table(reporting_arr_sort);
  } else {
     console.log(`\t√ Sort`)
  }

  if(reporting_arr_brute.length !== reporting_arr_sweep.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep[idx]))) {

     console.error(`\tx Sweep`, )
    //  console.table(reporting_arr_brute);
//      console.table(reporting_arr_sweep);
  } else {
     console.log(`\t√ Sweep`)
  }

  if(reporting_arr_brute.length !== reporting_arr_sweep_link.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_link[idx]))) {

     console.error(`\tx Sweep link`, )
//      console.table(reporting_arr_brute);
//      console.table(reporting_arr_sweep_link);
  } else {
     console.log(`\t√ Sweep link`)
  }

  if(reporting_arr_brute.length !== reporting_arr_sweep_skip.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_skip[idx]))) {

     console.error(`\tx Sweep skip`, )
//      console.table(reporting_arr_brute);
//      console.table(reporting_arr_sweep_skip);
  } else {
     console.log(`\t√ Sweep skip`)
  }

  if(reporting_arr_brute.length !== reporting_arr_sweep_combined.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_combined[idx]))) {

     console.error(`\tx Sweep combined`, )
//      console.table(reporting_arr_brute);
//      console.table(reporting_arr_sweep_combined);
  } else {
     console.log(`\t√ Sweep combined`)
  }

//   if(reporting_arr_brute.length !== reporting_arr_sweep_swap_combined.length ||
//      !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_swap_combined[idx]))) {
//
//      console.error(`\tx Sweep swap combined`, )
// //      console.table(reporting_arr_brute);
// //      console.table(reporting_arr_sweep_swap_combined);
//   } else {
//      console.log(`\t√ Sweep swap combined`)
//   }

  if(reporting_arr_brute.length !== reporting_arr_sweep_skip_combined.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_skip_combined[idx]))) {

     console.error(`\tx Sweep skip combined`, )
//      console.table(reporting_arr_brute);
//      console.table(reporting_arr_sweep_skip_combined);
  } else {
     console.log(`\t√ Sweep skip combined`)
  }
}




*/

