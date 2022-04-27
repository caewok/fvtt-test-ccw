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
DoubleLinkedList = api.DoubleLinkedList;
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

reportFnMyers = (s1, s2, ix) => {
  reporting_arr_myers.push(ix);
}


function applyFn(fn, num_segments, max_coord, report_type = "brute") {
  let reporting_arr = [];
  let reportFn;
  if(report_type === "brute") {
    reportFn = (s1, s2) => {
      const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
      if(x) reporting_arr.push(x);
    }
  } else {
    reportFn = (s1, s2, ix) => {
      reporting_arr.push(ix)
    }
  }

  const segments = Array.fromRange(num_segments).map(i => randomSegment(max_coord));
  return fn(segments, reportFn);
}

reporting_arr_brute = []
reporting_arr_sort = []
reporting_arr_sweep = []
reporting_arr_sweep_link = []
reporting_arr_sweep_skip = []
reporting_arr_myers = []

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


// using existing map segments
N = 100
walls = [...canvas.walls.placeables]
segments = walls.map(w => SimplePolygonEdge.fromWall(w));
reportWithTest = (s1, s2) => foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);

await benchmarkLoopFn(N, findIntersectionsBruteSingle, "brute", segments, reportWithTest)
await benchmarkLoopFn(N, findIntersectionsSortSingle, "sort", segments, reportWithTest)
// await benchmarkLoopFn(N, findIntersectionsSweepSingle, "sweep", segments)
await benchmarkLoopFn(N, findIntersectionsSweepLinkedSingle, "sweep linked", segments)
// await benchmarkLoopFn(N, findIntersectionsSweepSkipListSingle, "sweep skip", segments)
await benchmarkLoopFn(N, findIntersectionsSweepCombinedSingle, "sweep combined", segments)
await benchmarkLoopFn(N, findIntersectionsSweepCombinedSkipSingle, "sweep skip combined", segments)
await benchmarkLoopFn(N, findIntersectionsMyersSingle, "myers", segments, reportWithTest)

// filtered endpoints
reportWithFilteredEndpointsTest = (s1, s2) => {
  if(s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
}
console.log("Filtered endpoints")
await benchmarkLoopFn(N, findIntersectionsBruteSingle, "brute", segments, reportWithFilteredEndpointsTest)
await benchmarkLoopFn(N, findIntersectionsSortSingle, "sort", segments, reportWithFilteredEndpointsTest)
await benchmarkLoopFn(N, findIntersectionsMyersSingle, "myers", segments, reportWithFilteredEndpointsTest)
await benchmarkLoopFn(N, sweepMyersNoEndpoints, "myers", segments, reportWithTest)

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
  reporting_arr_sort = [];
  reporting_arr_sweep = []
  reporting_arr_sweep_link = []
  reporting_arr_sweep_skip = []
  reporting_arr_sweep_combined = []
  reporting_arr_myers = []

  segments = Array.fromRange(10).map(i => randomSegment(5000))
  findIntersectionsBruteSingle(segments, reportFnBrute)
  findIntersectionsSortSingle(segments, reportFnSort)
  findIntersectionsSort2Single(segments, reportFnSort)
  findIntersectionsSweepSingle(segments, reportFnSweep)
  findIntersectionsSweepLinkedSingle(segments, reportFnSweepLink)
  findIntersectionsSweepSkipListSingle(segments, reportFnSweepSkip)
  findIntersectionsSweepCombinedSingle(segments, reportFnSweepCombined)
  sweepMyers(segments, reportFnMyers)

  reporting_arr_brute.sort(compareXY)
//   reporting_arr_sweep.sort(compareXY)
//   reporting_arr_sweep_link.sort(compareXY)
//   reporting_arr_sweep_skip.sort(compareXY)
//   reporting_arr_sweep_combined.sort(compareXY)
  reporting_arr_myers.sort(compareXY)



  if(reporting_arr_brute.length !== reporting_arr_myers.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_myers[idx]))) {

     console.table(reporting_arr_brute);
     console.table(reporting_arr_myers);
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
max_coord = Math.pow(2, 13)
num_segments_arr = [10, 100, 200, 1000, 2000, 5000]
for(let i = 0; i < num_segments_arr.length; i += 1) {

  let num_segments = num_segments_arr[i]
  console.log(`\nNum Segments ${num_segments}`);

  let use_slow = num_segments < 201;



  await benchmarkLoopFn(N, applyFn, "brute", findIntersectionsBruteSingle, num_segments, max_coord, "brute");
  await benchmarkLoopFn(N, applyFn, "sort", findIntersectionsSortSingle, num_segments, max_coord, "brute");
  await benchmarkLoopFn(N, applyFn, "sort 2", findIntersectionsSort2Single, num_segments, max_coord, "brute");

  if(use_slow) {
    console.log("No binary");
    api.debug_binary = UseBinary.No;
    await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord, "sweep");
    await benchmarkLoopFn(N, applyFn, "sweep linked", findIntersectionsSweepLinkedSingle, num_segments, max_coord, "sweep");
    await benchmarkLoopFn(N, applyFn, "sweep skip", findIntersectionsSweepSkipListSingle, num_segments, max_coord, "sweep");
    await benchmarkLoopFn(N, applyFn, "sweep combined", findIntersectionsSweepCombinedSingle, num_segments, max_coord, "sweep");
    await benchmarkLoopFn(N, applyFn, "sweep combined skip", findIntersectionsSweepCombinedSkipSingle, num_segments, max_coord, "sweep");
  }

  if(use_slow) {
    console.log("Test binary");
    api.debug_binary = UseBinary.Test;
    await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord, "sweep");
    await benchmarkLoopFn(N, applyFn, "sweep linked", findIntersectionsSweepLinkedSingle, num_segments, max_coord, "sweep");
    await benchmarkLoopFn(N, applyFn, "sweep skip", findIntersectionsSweepSkipListSingle, num_segments, max_coord, "sweep");
    await benchmarkLoopFn(N, applyFn, "sweep combined", findIntersectionsSweepCombinedSingle, num_segments, max_coord, "sweep");
    await benchmarkLoopFn(N, applyFn, "sweep combined skip", findIntersectionsSweepCombinedSkipSingle, num_segments, max_coord, "sweep");
  }

  console.log("Binary");
  api.debug_binary = UseBinary.Yes;
  use_slow && await benchmarkLoopFn(N, applyFn, "sweep", findIntersectionsSweepSingle, num_segments, max_coord, "sweep");
  use_slow && await benchmarkLoopFn(N, applyFn, "sweep linked", findIntersectionsSweepLinkedSingle, num_segments, max_coord, "sweep");
  await benchmarkLoopFn(N, applyFn, "sweep skip", findIntersectionsSweepSkipListSingle, num_segments, max_coord, "sweep");
  use_slow && await benchmarkLoopFn(N, applyFn, "sweep combined", findIntersectionsSweepCombinedSingle, num_segments, max_coord, "sweep");
  use_slow && await benchmarkLoopFn(N, applyFn, "sweep combined skip", findIntersectionsSweepCombinedSkipSingle, num_segments, max_coord, "sweep");

  await benchmarkLoopFn(N, applyFn, "sweep myers", sweepMyers, num_segments, max_coord, "sweep");

  api.debug_binary = UseBinary.Test;
}


// timing
reportFnMyers = (s1, s2, ix) => {
  reporting_arr_myers.push(ix);
}

N = 100
num_segments = 1000;
max_coord = Math.pow(2, 13);
timings = []
for(let i = 0; i < N; i += 1) {
  const segments = Array.fromRange(num_segments).map(i => randomSegment(max_coord));
  reporting_arr_myers = []
  timings.push(sweepMyers(segments, reportFnMyers));
}

// report min/max/median/mean timings
let totals = {
  min: Number.POSITIVE_INFINITY,
  max: Number.NEGATIVE_INFINITY,
  mean: 0,
  median: 0,
  total: 0,
  values: null
}

let timing_totals = {}
for(const k of Object.keys(timings[0])) {
  timing_totals[k] = { ... totals }
  timing_totals[k].values = [];
}

timings.forEach(t => {
  for(const k of Object.keys(t)) {
    timing_totals[k].min = Math.min(timing_totals[k].min, t[k]);
    timing_totals[k].max = Math.max(timing_totals[k].max, t[k]);
    timing_totals[k].total += t[k];
    timing_totals[k].values.push(t[k]);
  }
});



for(const k of Object.keys(timing_totals)) {
  timing_totals[k].mean = timing_totals[k].total / N;
  timing_totals[k].values.sort((a, b) => a - b);
  timing_totals[k].median = timing_totals[k].values[Math.floor(N / 2)];
}
timing_totals






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
import { binaryFindIndex, binaryIndexOfObject } from "./BinarySearch.js";
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
    return binaryIndexOfObject(this.data, segment, (a, b) => this._segmentCompare(a, b, sweep_x));
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
    return binaryIndexOfObject(this.data, segment, (a, b) => this._segmentCompareForDeletion(a, b, sweep_x));
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

reportFnSweepMyers = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_sweep_myers.push(x); // avoid pushing null
}

reportFnSweepMyersNoEndpoints = (s1, s2, ix) => {
  reporting_arr_sweep_myers_no_endpoints.push(ix);
}

reportFnSweepMyersFilteredEndpoints = (s1, s2) => {
  if(s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_sweep_myers_filtered_endpoints.push(x); // avoid pushing null
}


reportFnBruteFilterEndpoints = (s1, s2) => {
  if(s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;

  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_brute_filtered.push(x); // avoid pushing null
}

reportFnSortFilterEndpoints = (s1, s2) => {
  if(s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;

  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_sort_filtered.push(x); // avoid pushing null
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
  reporting_arr_sweep_myers = [];

  reporting_arr_brute_filtered = []
  reporting_arr_sort_filtered = []
  reporting_arr_sweep_myers_no_endpoints = [];
  reporting_arr_sweep_myers_filtered_endpoints = [];


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
  findIntersectionsMyersSingle(segments, reportFnSweepMyers)

  findIntersectionsBruteSingle(segments, reportFnBruteFilterEndpoints)
  sweepMyersNoEndpoints(segments, reportFnSweepMyersNoEndpoints)
  findIntersectionsSortSingle(segments, reportFnSortFilterEndpoints)
  findIntersectionsMyersSingle(segments, reportFnSweepMyersFilteredEndpoints)

  // for a shared endpoint where the two lines are co-linear, brute will
  // not report an intersection but sweep will.
  // meyers will work like brute
  if(key === "* with endpoint" || key === "Near *" || key === "Evil *") {
    reporting_arr_brute.push(reporting_arr_brute[0], reporting_arr_brute[0]);
    reporting_arr_sort.push(reporting_arr_sort[0], reporting_arr_sort[0]);
    reporting_arr_sweep_myers.push(reporting_arr_sweep_myers[0], reporting_arr_sweep_myers[0])
  }

  reporting_arr_brute.sort(compareXY)
  reporting_arr_sort.sort(compareXY)
  reporting_arr_sweep.sort(compareXY)
  reporting_arr_sweep_link.sort(compareXY)
  reporting_arr_sweep_skip.sort(compareXY)
  reporting_arr_sweep_combined.sort(compareXY)
//   reporting_arr_sweep_swap_combined.sort(compareXY)
  reporting_arr_sweep_skip_combined.sort(compareXY)
  reporting_arr_sweep_myers.sort(compareXY)

  reporting_arr_brute_filtered.sort(compareXY);
  reporting_arr_sort_filtered.sort(compareXY)
  reporting_arr_sweep_myers_no_endpoints.sort(compareXY);
  reporting_arr_sweep_myers_filtered_endpoints.sort(compareXY);

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

  if(reporting_arr_brute.length !== reporting_arr_sweep_myers.length ||
     !reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_myers[idx]))) {

     console.error(`\tx Sweep Myers`, )
//      console.table(reporting_arr_brute);
//      console.table(reporting_arr_sweep_myers);
  } else {
     console.log(`\t√ Sweep Myers`)
  }


  // versions that skip endpoints
  if(reporting_arr_brute_filtered.length !== reporting_arr_sort_filtered.length ||
     !reporting_arr_brute_filtered.every((pt, idx) => pointsEqual(pt, reporting_arr_sort_filtered[idx]))) {

     console.error(`\tx Endpoint Filtered Sort`, )
//      console.table(reporting_arr_brute_filtered);
//      console.table(reporting_arr_sort_filtered);
  } else {
     console.log(`\t√ Endpoint Filtered Sort`)
  }

  // versions that skip endpoints
  if(reporting_arr_brute_filtered.length !== reporting_arr_sweep_myers_no_endpoints.length ||
     !reporting_arr_brute_filtered.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_myers_no_endpoints[idx]))) {

     console.error(`\tx Endpoint Excluded Myers`, )
//      console.table(reporting_arr_brute_filtered);
//      console.table(reporting_arr_sweep_myers_no_endpoints);
  } else {
     console.log(`\t√ Endpoint Excluded Myers`)
  }

  // versions that skip endpoints
  if(reporting_arr_brute_filtered.length !== reporting_arr_sweep_myers_filtered_endpoints.length ||
     !reporting_arr_brute_filtered.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep_myers_filtered_endpoints[idx]))) {

     console.error(`\tx Endpoint Filtered Myers`, )
//      console.table(reporting_arr_brute_filtered);
//      console.table(reporting_arr_sweep_myers_filtered_endpoints);
  } else {
     console.log(`\t√ Endpoint Filtered Myers`)
  }
}




*/

// this is the end
// str = '[{"A":{"x":1944,"y":4563},"B":{"x":1971,"y":4482}},{"A":{"x":1971,"y":4482},"B":{"x":2052,"y":4414}},{"A":{"x":2052,"y":4414},"B":{"x":2146,"y":4374}},{"A":{"x":2146,"y":4374},"B":{"x":2227,"y":4374}},{"A":{"x":2227,"y":4374},"B":{"x":2457,"y":4293}},{"A":{"x":2457,"y":4293},"B":{"x":2565,"y":4225}},{"A":{"x":2565,"y":4225},"B":{"x":2484,"y":4077}},{"A":{"x":2484,"y":4077},"B":{"x":2403,"y":4050}},{"A":{"x":2403,"y":4050},"B":{"x":2322,"y":4063}},{"A":{"x":2322,"y":4063},"B":{"x":2187,"y":3996}},{"A":{"x":2187,"y":3996},"B":{"x":2119,"y":4036}},{"A":{"x":2119,"y":4036},"B":{"x":2079,"y":4077}},{"A":{"x":2079,"y":4077},"B":{"x":2025,"y":4063}},{"A":{"x":2025,"y":4063},"B":{"x":1822,"y":3928}},{"A":{"x":1822,"y":3928},"B":{"x":1836,"y":3874}},{"A":{"x":1836,"y":3874},"B":{"x":1768,"y":3726}},{"A":{"x":1768,"y":3726},"B":{"x":1890,"y":3564}},{"A":{"x":1890,"y":3564},"B":{"x":1971,"y":3537}},{"A":{"x":1971,"y":3537},"B":{"x":2038,"y":3591}},{"A":{"x":2038,"y":3591},"B":{"x":2119,"y":3577}},{"A":{"x":2119,"y":3577},"B":{"x":2106,"y":3429}},{"A":{"x":2106,"y":3429},"B":{"x":2065,"y":3334}},{"A":{"x":2065,"y":3334},"B":{"x":1930,"y":3294}},{"A":{"x":1930,"y":3294},"B":{"x":1849,"y":3226}},{"A":{"x":1849,"y":3226},"B":{"x":1809,"y":3226}},{"A":{"x":1809,"y":3226},"B":{"x":1782,"y":3253}},{"A":{"x":1782,"y":3253},"B":{"x":1755,"y":3307}},{"A":{"x":1755,"y":3307},"B":{"x":1606,"y":3294}},{"A":{"x":1606,"y":3294},"B":{"x":1539,"y":3199}},{"A":{"x":1539,"y":3199},"B":{"x":1593,"y":3051}},{"A":{"x":1593,"y":3051},"B":{"x":1539,"y":2943}},{"A":{"x":1539,"y":2943},"B":{"x":1593,"y":2781}},{"A":{"x":1593,"y":2781},"B":{"x":1647,"y":2781}},{"A":{"x":1647,"y":2781},"B":{"x":1674,"y":2821}},{"A":{"x":1674,"y":2821},"B":{"x":1755,"y":2835}},{"A":{"x":1755,"y":2835},"B":{"x":1795,"y":2794}},{"A":{"x":1795,"y":2794},"B":{"x":1890,"y":2794}},{"A":{"x":1890,"y":2794},"B":{"x":1930,"y":2727}},{"A":{"x":1930,"y":2727},"B":{"x":1863,"y":2605}},{"A":{"x":1863,"y":2605},"B":{"x":1890,"y":2538}},{"A":{"x":1890,"y":2538},"B":{"x":1930,"y":2362}},{"A":{"x":1930,"y":2362},"B":{"x":2052,"y":2281}},{"A":{"x":2052,"y":2281},"B":{"x":2146,"y":2349}},{"A":{"x":2146,"y":2349},"B":{"x":2173,"y":2349}},{"A":{"x":2173,"y":2349},"B":{"x":2268,"y":2362}},{"A":{"x":2268,"y":2362},"B":{"x":2322,"y":2349}},{"A":{"x":2322,"y":2349},"B":{"x":2308,"y":2133}},{"A":{"x":2308,"y":2133},"B":{"x":2241,"y":1984}},{"A":{"x":2241,"y":1984},"B":{"x":2160,"y":1944}},{"A":{"x":2160,"y":1944},"B":{"x":2173,"y":1863}},{"A":{"x":2173,"y":1863},"B":{"x":2146,"y":1809}},{"A":{"x":2146,"y":1809},"B":{"x":2106,"y":1795}},{"A":{"x":2106,"y":1795},"B":{"x":2025,"y":1822}},{"A":{"x":2025,"y":1822},"B":{"x":1957,"y":1890}},{"A":{"x":1957,"y":1890},"B":{"x":1876,"y":1890}},{"A":{"x":1876,"y":1890},"B":{"x":1768,"y":1984}},{"A":{"x":1768,"y":1984},"B":{"x":1687,"y":1944}},{"A":{"x":1687,"y":1944},"B":{"x":1660,"y":1809}},{"A":{"x":1660,"y":1809},"B":{"x":1660,"y":1687}},{"A":{"x":1660,"y":1687},"B":{"x":1701,"y":1633}},{"A":{"x":1701,"y":1633},"B":{"x":1728,"y":1471}},{"A":{"x":1728,"y":1471},"B":{"x":1795,"y":1377}},{"A":{"x":1795,"y":1377},"B":{"x":1849,"y":1269}},{"A":{"x":1849,"y":1269},"B":{"x":1984,"y":1201}},{"A":{"x":1984,"y":1201},"B":{"x":2079,"y":1242}},{"A":{"x":2079,"y":1242},"B":{"x":2173,"y":1188}},{"A":{"x":2173,"y":1188},"B":{"x":2268,"y":1201}},{"A":{"x":2268,"y":1201},"B":{"x":2416,"y":1161}},{"A":{"x":2416,"y":1161},"B":{"x":2470,"y":1201}},{"A":{"x":2470,"y":1201},"B":{"x":2578,"y":1309}},{"A":{"x":2578,"y":1309},"B":{"x":2673,"y":1350}},{"A":{"x":2673,"y":1350},"B":{"x":2740,"y":1309}},{"A":{"x":2740,"y":1309},"B":{"x":2781,"y":1323}},{"A":{"x":2781,"y":1323},"B":{"x":2821,"y":1377}},{"A":{"x":2821,"y":1377},"B":{"x":2862,"y":1471}},{"A":{"x":2862,"y":1471},"B":{"x":2916,"y":1552}},{"A":{"x":2916,"y":1552},"B":{"x":2970,"y":1566}},{"A":{"x":2970,"y":1566},"B":{"x":2970,"y":1512}},{"A":{"x":2970,"y":1512},"B":{"x":3024,"y":1431}},{"A":{"x":3024,"y":1431},"B":{"x":3105,"y":1350}},{"A":{"x":3105,"y":1350},"B":{"x":3078,"y":1296}},{"A":{"x":3078,"y":1296},"B":{"x":3118,"y":1188}},{"A":{"x":3118,"y":1188},"B":{"x":3145,"y":1174}},{"A":{"x":3145,"y":1174},"B":{"x":3172,"y":1107}},{"A":{"x":3172,"y":1107},"B":{"x":3213,"y":1080}},{"A":{"x":3213,"y":1080},"B":{"x":3240,"y":1093}},{"A":{"x":3240,"y":1093},"B":{"x":3294,"y":1134}},{"A":{"x":3294,"y":1134},"B":{"x":3307,"y":1107}},{"A":{"x":3307,"y":1107},"B":{"x":3375,"y":1080}},{"A":{"x":3375,"y":1080},"B":{"x":3415,"y":1107}},{"A":{"x":3415,"y":1107},"B":{"x":3483,"y":1188}},{"A":{"x":3483,"y":1188},"B":{"x":3564,"y":1255}},{"A":{"x":3564,"y":1255},"B":{"x":3685,"y":1107}},{"A":{"x":3685,"y":1107},"B":{"x":3753,"y":1093}},{"A":{"x":3753,"y":1093},"B":{"x":3793,"y":945}},{"A":{"x":3793,"y":945},"B":{"x":3861,"y":918}},{"A":{"x":3861,"y":918},"B":{"x":3942,"y":918}},{"A":{"x":3942,"y":918},"B":{"x":3969,"y":972}},{"A":{"x":3969,"y":972},"B":{"x":3996,"y":1053}},{"A":{"x":3996,"y":1053},"B":{"x":4036,"y":1093}},{"A":{"x":4036,"y":1093},"B":{"x":4063,"y":1147}},{"A":{"x":4063,"y":1147},"B":{"x":4063,"y":1215}},{"A":{"x":4063,"y":1215},"B":{"x":4023,"y":1309}},{"A":{"x":4023,"y":1309},"B":{"x":3982,"y":1363}},{"A":{"x":3982,"y":1363},"B":{"x":3955,"y":1431}},{"A":{"x":3955,"y":1431},"B":{"x":3901,"y":1471}},{"A":{"x":3901,"y":1471},"B":{"x":3847,"y":1512}},{"A":{"x":3847,"y":1512},"B":{"x":3847,"y":1566}},{"A":{"x":3847,"y":1566},"B":{"x":3901,"y":1647}},{"A":{"x":3901,"y":1647},"B":{"x":3955,"y":1687}},{"A":{"x":3955,"y":1687},"B":{"x":4023,"y":1674}},{"A":{"x":4023,"y":1674},"B":{"x":4077,"y":1728}},{"A":{"x":4077,"y":1728},"B":{"x":4158,"y":1795}},{"A":{"x":4158,"y":1795},"B":{"x":4239,"y":1741}},{"A":{"x":4239,"y":1741},"B":{"x":4320,"y":1620}},{"A":{"x":4320,"y":1620},"B":{"x":4401,"y":1593}},{"A":{"x":4401,"y":1593},"B":{"x":4482,"y":1633}},{"A":{"x":4482,"y":1633},"B":{"x":4522,"y":1620}},{"A":{"x":4522,"y":1620},"B":{"x":4563,"y":1579}},{"A":{"x":4563,"y":1579},"B":{"x":4657,"y":1552}},{"A":{"x":4657,"y":1552},"B":{"x":4819,"y":1552}},{"A":{"x":4819,"y":1552},"B":{"x":4900,"y":1539}},{"A":{"x":4900,"y":1539},"B":{"x":5008,"y":1471}},{"A":{"x":5008,"y":1471},"B":{"x":5062,"y":1458}},{"A":{"x":5062,"y":1458},"B":{"x":5197,"y":1390}},{"A":{"x":5197,"y":1390},"B":{"x":5305,"y":1390}},{"A":{"x":5305,"y":1390},"B":{"x":5400,"y":1404}},{"A":{"x":5400,"y":1404},"B":{"x":5494,"y":1296}},{"A":{"x":5494,"y":1296},"B":{"x":5481,"y":1215}},{"A":{"x":5481,"y":1215},"B":{"x":5494,"y":1147}},{"A":{"x":5494,"y":1147},"B":{"x":5602,"y":1053}},{"A":{"x":5602,"y":1053},"B":{"x":5710,"y":1107}},{"A":{"x":5710,"y":1107},"B":{"x":5805,"y":1053}},{"A":{"x":5805,"y":1053},"B":{"x":5940,"y":1053}},{"A":{"x":5940,"y":1053},"B":{"x":5953,"y":999}},{"A":{"x":5953,"y":999},"B":{"x":6075,"y":972}},{"A":{"x":6075,"y":972},"B":{"x":6358,"y":972}},{"A":{"x":6358,"y":972},"B":{"x":6412,"y":985}},{"A":{"x":6412,"y":985},"B":{"x":6439,"y":1039}},{"A":{"x":6439,"y":1039},"B":{"x":6561,"y":1134}},{"A":{"x":6561,"y":1134},"B":{"x":6615,"y":1147}},{"A":{"x":6615,"y":1147},"B":{"x":6642,"y":1039}},{"A":{"x":6642,"y":1039},"B":{"x":6723,"y":1026}},{"A":{"x":6723,"y":1026},"B":{"x":6804,"y":972}},{"A":{"x":6804,"y":972},"B":{"x":6925,"y":945}},{"A":{"x":6925,"y":945},"B":{"x":7141,"y":1066}},{"A":{"x":7141,"y":1066},"B":{"x":7236,"y":1093}},{"A":{"x":7236,"y":1093},"B":{"x":7614,"y":1390}},{"A":{"x":7614,"y":1390},"B":{"x":7614,"y":1539}},{"A":{"x":7614,"y":1539},"B":{"x":7060,"y":1687}},{"A":{"x":7060,"y":1687},"B":{"x":6952,"y":1633}},{"A":{"x":6952,"y":1633},"B":{"x":6885,"y":1660}},{"A":{"x":6885,"y":1660},"B":{"x":6844,"y":1728}},{"A":{"x":6844,"y":1728},"B":{"x":6736,"y":1782}},{"A":{"x":6736,"y":1782},"B":{"x":6723,"y":1822}},{"A":{"x":6723,"y":1822},"B":{"x":6736,"y":1876}},{"A":{"x":6736,"y":1876},"B":{"x":6831,"y":1836}},{"A":{"x":6831,"y":1836},"B":{"x":6885,"y":1944}},{"A":{"x":6885,"y":1944},"B":{"x":6871,"y":1971}},{"A":{"x":6871,"y":1971},"B":{"x":6804,"y":1998}},{"A":{"x":6804,"y":1998},"B":{"x":6723,"y":2160}},{"A":{"x":6723,"y":2160},"B":{"x":6763,"y":2389}},{"A":{"x":6763,"y":2389},"B":{"x":6669,"y":2484}},{"A":{"x":6669,"y":2484},"B":{"x":6547,"y":2511}},{"A":{"x":6547,"y":2511},"B":{"x":6480,"y":2457}},{"A":{"x":6480,"y":2457},"B":{"x":6372,"y":2403}},{"A":{"x":6372,"y":2403},"B":{"x":6304,"y":2416}},{"A":{"x":6304,"y":2416},"B":{"x":6304,"y":2470}},{"A":{"x":6304,"y":2470},"B":{"x":6210,"y":2484}},{"A":{"x":6210,"y":2484},"B":{"x":6115,"y":2403}},{"A":{"x":6115,"y":2403},"B":{"x":5899,"y":2484}},{"A":{"x":5899,"y":2484},"B":{"x":5899,"y":2524}},{"A":{"x":5899,"y":2524},"B":{"x":5940,"y":2632}},{"A":{"x":5940,"y":2632},"B":{"x":5926,"y":2673}},{"A":{"x":5926,"y":2673},"B":{"x":5818,"y":2686}},{"A":{"x":5818,"y":2686},"B":{"x":5764,"y":2781}},{"A":{"x":5764,"y":2781},"B":{"x":5697,"y":2781}},{"A":{"x":5697,"y":2781},"B":{"x":5616,"y":2659}},{"A":{"x":5616,"y":2659},"B":{"x":5643,"y":2592}},{"A":{"x":5643,"y":2592},"B":{"x":5643,"y":2470}},{"A":{"x":5643,"y":2470},"B":{"x":5670,"y":2416}},{"A":{"x":5670,"y":2416},"B":{"x":5656,"y":2322}},{"A":{"x":5656,"y":2322},"B":{"x":5535,"y":2227}},{"A":{"x":5535,"y":2227},"B":{"x":5521,"y":2079}},{"A":{"x":5521,"y":2079},"B":{"x":5737,"y":1998}},{"A":{"x":5737,"y":1998},"B":{"x":5764,"y":2025}},{"A":{"x":5764,"y":2025},"B":{"x":5791,"y":2011}},{"A":{"x":5791,"y":2011},"B":{"x":5778,"y":1957}},{"A":{"x":5778,"y":1957},"B":{"x":5953,"y":1849}},{"A":{"x":5953,"y":1849},"B":{"x":6021,"y":1876}},{"A":{"x":6021,"y":1876},"B":{"x":6102,"y":1836}},{"A":{"x":6102,"y":1836},"B":{"x":6088,"y":1782}},{"A":{"x":6088,"y":1782},"B":{"x":5899,"y":1714}},{"A":{"x":5899,"y":1714},"B":{"x":5791,"y":1714}},{"A":{"x":5791,"y":1714},"B":{"x":5737,"y":1795}},{"A":{"x":5737,"y":1795},"B":{"x":5494,"y":1903}},{"A":{"x":5494,"y":1903},"B":{"x":5427,"y":1984}},{"A":{"x":5427,"y":1984},"B":{"x":5292,"y":2025}},{"A":{"x":5292,"y":2025},"B":{"x":5143,"y":1944}},{"A":{"x":5143,"y":1944},"B":{"x":5089,"y":1849}},{"A":{"x":5089,"y":1849},"B":{"x":5022,"y":1822}},{"A":{"x":4968,"y":1876},"B":{"x":4711,"y":1944}},{"A":{"x":4711,"y":1944},"B":{"x":4536,"y":1903}},{"A":{"x":4536,"y":1903},"B":{"x":4441,"y":1998}},{"A":{"x":4441,"y":1998},"B":{"x":4414,"y":2133}},{"A":{"x":4414,"y":2133},"B":{"x":4482,"y":2268}},{"A":{"x":5022,"y":1822},"B":{"x":4968,"y":1876}},{"A":{"x":4482,"y":2268},"B":{"x":4401,"y":2565}},{"A":{"x":4401,"y":2565},"B":{"x":4441,"y":2619}},{"A":{"x":4441,"y":2619},"B":{"x":4536,"y":2565}},{"A":{"x":4536,"y":2565},"B":{"x":4684,"y":2578}},{"A":{"x":4684,"y":2578},"B":{"x":4792,"y":2700}},{"A":{"x":4792,"y":2700},"B":{"x":4900,"y":2700}},{"A":{"x":4900,"y":2700},"B":{"x":4914,"y":2727}},{"A":{"x":4914,"y":2727},"B":{"x":5008,"y":2686}},{"A":{"x":5008,"y":2686},"B":{"x":5184,"y":2794}},{"A":{"x":5184,"y":2794},"B":{"x":5238,"y":2889}},{"A":{"x":5238,"y":2889},"B":{"x":5238,"y":2943}},{"A":{"x":5238,"y":2943},"B":{"x":5359,"y":3078}},{"A":{"x":5359,"y":3078},"B":{"x":5400,"y":3240}},{"A":{"x":5400,"y":3240},"B":{"x":5265,"y":3456}},{"A":{"x":5265,"y":3456},"B":{"x":5184,"y":3496}},{"A":{"x":5184,"y":3496},"B":{"x":5143,"y":3604}},{"A":{"x":5143,"y":3604},"B":{"x":5062,"y":3618}},{"A":{"x":5062,"y":3618},"B":{"x":5022,"y":3577}},{"A":{"x":5022,"y":3577},"B":{"x":5008,"y":3496}},{"A":{"x":5008,"y":3496},"B":{"x":4954,"y":3442}},{"A":{"x":4954,"y":3442},"B":{"x":4914,"y":3334}},{"A":{"x":4914,"y":3334},"B":{"x":4806,"y":3253}},{"A":{"x":4806,"y":3253},"B":{"x":4725,"y":3105}},{"A":{"x":4725,"y":3105},"B":{"x":4711,"y":3010}},{"A":{"x":4711,"y":3010},"B":{"x":4576,"y":2970}},{"A":{"x":4576,"y":2970},"B":{"x":4495,"y":3037}},{"A":{"x":4495,"y":3037},"B":{"x":4360,"y":3078}},{"A":{"x":4360,"y":3078},"B":{"x":4239,"y":3172}},{"A":{"x":4239,"y":3172},"B":{"x":4225,"y":3267}},{"A":{"x":4225,"y":3267},"B":{"x":4252,"y":3307}},{"A":{"x":4252,"y":3307},"B":{"x":4360,"y":3307}},{"A":{"x":4360,"y":3307},"B":{"x":4441,"y":3402}},{"A":{"x":4441,"y":3402},"B":{"x":4455,"y":3469}},{"A":{"x":4455,"y":3469},"B":{"x":4441,"y":3496}},{"A":{"x":4441,"y":3496},"B":{"x":4374,"y":3591}},{"A":{"x":4374,"y":3591},"B":{"x":4401,"y":3672}},{"A":{"x":4401,"y":3672},"B":{"x":4576,"y":3793}},{"A":{"x":4576,"y":3793},"B":{"x":4644,"y":3915}},{"A":{"x":4644,"y":3915},"B":{"x":4644,"y":4023}},{"A":{"x":4644,"y":4023},"B":{"x":4495,"y":4266}},{"A":{"x":4495,"y":4266},"B":{"x":4360,"y":4212}},{"A":{"x":4360,"y":4212},"B":{"x":4266,"y":4144}},{"A":{"x":4266,"y":4144},"B":{"x":4212,"y":4036}},{"A":{"x":4212,"y":4036},"B":{"x":4144,"y":4009}},{"A":{"x":4144,"y":4009},"B":{"x":4090,"y":4023}},{"A":{"x":4090,"y":4023},"B":{"x":4063,"y":3969}},{"A":{"x":4063,"y":3969},"B":{"x":4023,"y":3996}},{"A":{"x":4023,"y":3996},"B":{"x":4009,"y":4063}},{"A":{"x":4009,"y":4063},"B":{"x":4117,"y":4279}},{"A":{"x":4117,"y":4279},"B":{"x":4117,"y":4360}},{"A":{"x":4117,"y":4360},"B":{"x":4077,"y":4401}},{"A":{"x":4077,"y":4401},"B":{"x":4050,"y":4509}},{"A":{"x":4050,"y":4509},"B":{"x":3955,"y":4522}},{"A":{"x":3955,"y":4522},"B":{"x":3672,"y":4320}},{"A":{"x":3672,"y":4320},"B":{"x":3604,"y":4401}},{"A":{"x":3604,"y":4401},"B":{"x":3510,"y":4347}},{"A":{"x":3510,"y":4347},"B":{"x":3456,"y":4225}},{"A":{"x":3456,"y":4225},"B":{"x":3375,"y":4158}},{"A":{"x":3375,"y":4158},"B":{"x":3307,"y":4009}},{"A":{"x":3307,"y":4009},"B":{"x":3240,"y":3996}},{"A":{"x":3240,"y":3996},"B":{"x":3172,"y":4023}},{"A":{"x":3172,"y":4023},"B":{"x":3159,"y":4063}},{"A":{"x":2646,"y":4482},"B":{"x":2376,"y":4549}},{"A":{"x":2376,"y":4549},"B":{"x":2119,"y":4563}},{"A":{"x":2281,"y":1566},"B":{"x":2335,"y":1552}},{"A":{"x":2335,"y":1552},"B":{"x":2376,"y":1566}},{"A":{"x":2376,"y":1566},"B":{"x":2335,"y":1620}},{"A":{"x":2335,"y":1620},"B":{"x":2308,"y":1606}},{"A":{"x":2308,"y":1606},"B":{"x":2281,"y":1566}},{"A":{"x":2457,"y":1701},"B":{"x":2484,"y":1647}},{"A":{"x":2484,"y":1647},"B":{"x":2538,"y":1633}},{"A":{"x":2538,"y":1633},"B":{"x":2619,"y":1660}},{"A":{"x":2619,"y":1660},"B":{"x":2646,"y":1701}},{"A":{"x":2646,"y":1701},"B":{"x":2632,"y":1741}},{"A":{"x":2632,"y":1741},"B":{"x":2646,"y":1809}},{"A":{"x":2646,"y":1809},"B":{"x":2632,"y":1836}},{"A":{"x":2632,"y":1836},"B":{"x":2592,"y":1809}},{"A":{"x":2592,"y":1809},"B":{"x":2551,"y":1755}},{"A":{"x":2551,"y":1755},"B":{"x":2511,"y":1755}},{"A":{"x":2511,"y":1755},"B":{"x":2457,"y":1701}},{"A":{"x":3267,"y":1822},"B":{"x":3334,"y":1836}},{"A":{"x":3334,"y":1836},"B":{"x":3348,"y":1849}},{"A":{"x":3348,"y":1849},"B":{"x":3280,"y":1876}},{"A":{"x":3280,"y":1876},"B":{"x":3253,"y":1849}},{"A":{"x":3253,"y":1849},"B":{"x":3267,"y":1822}},{"A":{"x":3253,"y":1647},"B":{"x":3267,"y":1714}},{"A":{"x":3267,"y":1714},"B":{"x":3294,"y":1728}},{"A":{"x":3294,"y":1728},"B":{"x":3348,"y":1687}},{"A":{"x":3348,"y":1687},"B":{"x":3361,"y":1647}},{"A":{"x":3361,"y":1647},"B":{"x":3321,"y":1620}},{"A":{"x":3321,"y":1620},"B":{"x":3253,"y":1647}},{"A":{"x":3402,"y":1971},"B":{"x":3456,"y":1984}},{"A":{"x":3456,"y":1984},"B":{"x":3510,"y":1971}},{"A":{"x":3510,"y":1971},"B":{"x":3523,"y":1998}},{"A":{"x":3523,"y":1998},"B":{"x":3537,"y":2065}},{"A":{"x":3537,"y":2065},"B":{"x":3510,"y":2119}},{"A":{"x":3510,"y":2119},"B":{"x":3510,"y":2187}},{"A":{"x":3510,"y":2187},"B":{"x":3456,"y":2200}},{"A":{"x":3456,"y":2200},"B":{"x":3429,"y":2160}},{"A":{"x":3429,"y":2160},"B":{"x":3402,"y":2092}},{"A":{"x":3402,"y":2092},"B":{"x":3348,"y":2065}},{"A":{"x":3348,"y":2065},"B":{"x":3348,"y":2011}},{"A":{"x":3348,"y":2011},"B":{"x":3402,"y":1971}},{"A":{"x":3172,"y":2443},"B":{"x":3240,"y":2484}},{"A":{"x":3240,"y":2484},"B":{"x":3253,"y":2484}},{"A":{"x":3253,"y":2484},"B":{"x":3253,"y":2511}},{"A":{"x":3253,"y":2511},"B":{"x":3226,"y":2511}},{"A":{"x":3226,"y":2511},"B":{"x":3199,"y":2538}},{"A":{"x":3199,"y":2538},"B":{"x":3159,"y":2511}},{"A":{"x":3159,"y":2511},"B":{"x":3145,"y":2457}},{"A":{"x":3145,"y":2457},"B":{"x":3172,"y":2443}},{"A":{"x":2970,"y":2497},"B":{"x":3024,"y":2511}},{"A":{"x":3024,"y":2511},"B":{"x":3051,"y":2578}},{"A":{"x":3051,"y":2578},"B":{"x":3091,"y":2592}},{"A":{"x":3091,"y":2592},"B":{"x":3132,"y":2646}},{"A":{"x":3132,"y":2646},"B":{"x":3078,"y":2686}},{"A":{"x":3078,"y":2686},"B":{"x":3024,"y":2686}},{"A":{"x":3024,"y":2686},"B":{"x":2970,"y":2727}},{"A":{"x":2970,"y":2727},"B":{"x":2916,"y":2727}},{"A":{"x":2916,"y":2727},"B":{"x":2889,"y":2700}},{"A":{"x":2889,"y":2700},"B":{"x":2929,"y":2646}},{"A":{"x":2929,"y":2646},"B":{"x":2902,"y":2619}},{"A":{"x":2902,"y":2619},"B":{"x":2916,"y":2565}},{"A":{"x":2916,"y":2565},"B":{"x":2943,"y":2551}},{"A":{"x":2943,"y":2551},"B":{"x":2943,"y":2524}},{"A":{"x":2943,"y":2524},"B":{"x":2970,"y":2497}},{"A":{"x":1957,"y":2970},"B":{"x":2106,"y":2970}},{"A":{"x":2106,"y":2970},"B":{"x":2133,"y":3024}},{"A":{"x":2133,"y":3024},"B":{"x":2133,"y":3051}},{"A":{"x":2133,"y":3051},"B":{"x":2146,"y":3105}},{"A":{"x":2146,"y":3105},"B":{"x":2092,"y":3132}},{"A":{"x":2092,"y":3132},"B":{"x":2025,"y":3091}},{"A":{"x":2025,"y":3091},"B":{"x":1971,"y":3091}},{"A":{"x":1971,"y":3091},"B":{"x":1930,"y":3010}},{"A":{"x":1930,"y":3010},"B":{"x":1957,"y":2970}},{"A":{"x":2281,"y":3685},"B":{"x":2281,"y":3631}},{"A":{"x":2281,"y":3631},"B":{"x":2335,"y":3550}},{"A":{"x":2335,"y":3550},"B":{"x":2389,"y":3550}},{"A":{"x":2389,"y":3550},"B":{"x":2403,"y":3631}},{"A":{"x":2403,"y":3631},"B":{"x":2511,"y":3604}},{"A":{"x":2511,"y":3604},"B":{"x":2538,"y":3645}},{"A":{"x":2538,"y":3645},"B":{"x":2403,"y":3739}},{"A":{"x":2403,"y":3739},"B":{"x":2389,"y":3780}},{"A":{"x":2389,"y":3780},"B":{"x":2349,"y":3739}},{"A":{"x":2349,"y":3739},"B":{"x":2281,"y":3685}},{"A":{"x":3699,"y":3834},"B":{"x":3726,"y":3847}},{"A":{"x":3726,"y":3847},"B":{"x":3753,"y":3834}},{"A":{"x":3753,"y":3834},"B":{"x":3753,"y":3753}},{"A":{"x":3753,"y":3753},"B":{"x":3834,"y":3712}},{"A":{"x":3834,"y":3712},"B":{"x":3834,"y":3658}},{"A":{"x":3834,"y":3658},"B":{"x":3807,"y":3631}},{"A":{"x":3807,"y":3631},"B":{"x":3780,"y":3645}},{"A":{"x":3780,"y":3645},"B":{"x":3726,"y":3631}},{"A":{"x":3726,"y":3631},"B":{"x":3699,"y":3658}},{"A":{"x":3699,"y":3658},"B":{"x":3685,"y":3753}},{"A":{"x":3685,"y":3753},"B":{"x":3699,"y":3793}},{"A":{"x":3699,"y":3793},"B":{"x":3699,"y":3834}},{"A":{"x":3024,"y":3564},"B":{"x":2983,"y":3510}},{"A":{"x":2983,"y":3510},"B":{"x":3010,"y":3442}},{"A":{"x":3010,"y":3442},"B":{"x":3037,"y":3415}},{"A":{"x":3037,"y":3415},"B":{"x":3037,"y":3361}},{"A":{"x":3037,"y":3361},"B":{"x":3051,"y":3321}},{"A":{"x":3051,"y":3321},"B":{"x":3037,"y":3267}},{"A":{"x":3037,"y":3267},"B":{"x":3037,"y":3226}},{"A":{"x":3037,"y":3226},"B":{"x":3091,"y":3213}},{"A":{"x":3091,"y":3213},"B":{"x":3159,"y":3253}},{"A":{"x":3159,"y":3253},"B":{"x":3186,"y":3240}},{"A":{"x":3186,"y":3240},"B":{"x":3253,"y":3307}},{"A":{"x":3253,"y":3307},"B":{"x":3240,"y":3375}},{"A":{"x":3240,"y":3375},"B":{"x":3253,"y":3429}},{"A":{"x":3253,"y":3429},"B":{"x":3280,"y":3469}},{"A":{"x":3280,"y":3469},"B":{"x":3280,"y":3510}},{"A":{"x":3280,"y":3510},"B":{"x":3213,"y":3564}},{"A":{"x":3213,"y":3564},"B":{"x":3172,"y":3550}},{"A":{"x":3172,"y":3550},"B":{"x":3145,"y":3523}},{"A":{"x":3145,"y":3523},"B":{"x":3024,"y":3564}},{"A":{"x":2889,"y":3159},"B":{"x":2929,"y":3132}},{"A":{"x":2929,"y":3132},"B":{"x":2983,"y":3145}},{"A":{"x":2983,"y":3145},"B":{"x":2983,"y":3172}},{"A":{"x":2983,"y":3172},"B":{"x":2956,"y":3186}},{"A":{"x":2956,"y":3186},"B":{"x":2956,"y":3213}},{"A":{"x":2956,"y":3213},"B":{"x":2929,"y":3213}},{"A":{"x":2929,"y":3213},"B":{"x":2902,"y":3186}},{"A":{"x":2902,"y":3186},"B":{"x":2889,"y":3159}},{"A":{"x":3523,"y":2889},"B":{"x":3537,"y":2848}},{"A":{"x":3537,"y":2848},"B":{"x":3618,"y":2808}},{"A":{"x":3618,"y":2808},"B":{"x":3645,"y":2754}},{"A":{"x":3645,"y":2754},"B":{"x":3685,"y":2727}},{"A":{"x":3685,"y":2727},"B":{"x":3712,"y":2781}},{"A":{"x":3712,"y":2781},"B":{"x":3766,"y":2767}},{"A":{"x":3766,"y":2767},"B":{"x":3820,"y":2835}},{"A":{"x":3820,"y":2835},"B":{"x":3807,"y":2916}},{"A":{"x":3807,"y":2916},"B":{"x":3847,"y":2997}},{"A":{"x":3847,"y":2997},"B":{"x":3901,"y":3024}},{"A":{"x":3901,"y":3024},"B":{"x":3928,"y":3091}},{"A":{"x":3928,"y":3091},"B":{"x":3928,"y":3132}},{"A":{"x":3928,"y":3132},"B":{"x":3793,"y":3226}},{"A":{"x":3793,"y":3226},"B":{"x":3739,"y":3213}},{"A":{"x":3739,"y":3213},"B":{"x":3712,"y":3226}},{"A":{"x":3712,"y":3226},"B":{"x":3631,"y":3226}},{"A":{"x":3631,"y":3226},"B":{"x":3604,"y":3199}},{"A":{"x":3604,"y":3199},"B":{"x":3618,"y":3010}},{"A":{"x":3618,"y":3010},"B":{"x":3523,"y":2889}},{"A":{"x":4171,"y":2794},"B":{"x":4144,"y":2767}},{"A":{"x":4144,"y":2767},"B":{"x":4171,"y":2754}},{"A":{"x":4171,"y":2754},"B":{"x":4158,"y":2713}},{"A":{"x":4158,"y":2713},"B":{"x":4198,"y":2686}},{"A":{"x":4198,"y":2686},"B":{"x":4198,"y":2646}},{"A":{"x":4198,"y":2646},"B":{"x":4266,"y":2659}},{"A":{"x":4266,"y":2659},"B":{"x":4293,"y":2700}},{"A":{"x":4293,"y":2700},"B":{"x":4279,"y":2754}},{"A":{"x":4279,"y":2754},"B":{"x":4225,"y":2781}},{"A":{"x":4225,"y":2781},"B":{"x":4171,"y":2794}},{"A":{"x":1971,"y":3807},"B":{"x":2025,"y":3766}},{"A":{"x":2025,"y":3766},"B":{"x":2065,"y":3766}},{"A":{"x":2065,"y":3766},"B":{"x":2079,"y":3780}},{"A":{"x":2079,"y":3780},"B":{"x":2065,"y":3820}},{"A":{"x":2065,"y":3820},"B":{"x":2065,"y":3861}},{"A":{"x":2065,"y":3861},"B":{"x":2025,"y":3874}},{"A":{"x":2025,"y":3874},"B":{"x":2011,"y":3847}},{"A":{"x":2011,"y":3847},"B":{"x":1971,"y":3847}},{"A":{"x":1971,"y":3847},"B":{"x":1971,"y":3807}},{"A":{"x":5346,"y":1566},"B":{"x":5400,"y":1579}},{"A":{"x":5400,"y":1579},"B":{"x":5535,"y":1539}},{"A":{"x":5535,"y":1539},"B":{"x":5535,"y":1566}},{"A":{"x":5535,"y":1566},"B":{"x":5481,"y":1593}},{"A":{"x":5481,"y":1593},"B":{"x":5400,"y":1714}},{"A":{"x":5400,"y":1714},"B":{"x":5332,"y":1701}},{"A":{"x":5332,"y":1701},"B":{"x":5292,"y":1701}},{"A":{"x":5292,"y":1701},"B":{"x":5278,"y":1687}},{"A":{"x":5278,"y":1687},"B":{"x":5292,"y":1633}},{"A":{"x":5292,"y":1633},"B":{"x":5332,"y":1606}},{"A":{"x":5332,"y":1606},"B":{"x":5346,"y":1566}},{"A":{"x":6250,"y":1606},"B":{"x":6372,"y":1660}},{"A":{"x":6372,"y":1660},"B":{"x":6358,"y":1687}},{"A":{"x":6358,"y":1687},"B":{"x":6304,"y":1714}},{"A":{"x":6304,"y":1714},"B":{"x":6277,"y":1701}},{"A":{"x":6277,"y":1701},"B":{"x":6250,"y":1647}},{"A":{"x":6250,"y":1647},"B":{"x":6250,"y":1606}},{"A":{"x":6331,"y":1876},"B":{"x":6372,"y":1863}},{"A":{"x":6372,"y":1863},"B":{"x":6412,"y":1890}},{"A":{"x":6412,"y":1890},"B":{"x":6480,"y":1903}},{"A":{"x":6480,"y":1903},"B":{"x":6453,"y":1971}},{"A":{"x":6453,"y":1971},"B":{"x":6385,"y":1971}},{"A":{"x":6385,"y":1971},"B":{"x":6331,"y":1903}},{"A":{"x":6331,"y":1903},"B":{"x":6331,"y":1876}},{"A":{"x":6547,"y":1377},"B":{"x":6601,"y":1350}},{"A":{"x":6601,"y":1350},"B":{"x":6655,"y":1350}},{"A":{"x":6655,"y":1350},"B":{"x":6709,"y":1336}},{"A":{"x":6709,"y":1336},"B":{"x":6777,"y":1336}},{"A":{"x":6777,"y":1336},"B":{"x":6790,"y":1363}},{"A":{"x":6790,"y":1363},"B":{"x":6777,"y":1417}},{"A":{"x":6777,"y":1417},"B":{"x":6682,"y":1512}},{"A":{"x":6682,"y":1512},"B":{"x":6615,"y":1458}},{"A":{"x":6615,"y":1458},"B":{"x":6588,"y":1458}},{"A":{"x":6588,"y":1458},"B":{"x":6547,"y":1404}},{"A":{"x":6547,"y":1404},"B":{"x":6547,"y":1377}},{"A":{"x":2646,"y":4482},"B":{"x":2781,"y":4360}},{"A":{"x":2781,"y":4360},"B":{"x":3159,"y":4063}},{"A":{"x":2781,"y":4360},"B":{"x":2767,"y":4225}},{"A":{"x":2767,"y":4225},"B":{"x":2700,"y":4050}},{"A":{"x":2700,"y":4050},"B":{"x":2389,"y":3780}},{"A":{"x":2335,"y":3550},"B":{"x":2092,"y":3132}},{"A":{"x":1957,"y":2970},"B":{"x":1944,"y":2916}},{"A":{"x":1944,"y":2916},"B":{"x":2065,"y":2659}},{"A":{"x":2065,"y":2659},"B":{"x":2052,"y":2511}},{"A":{"x":2052,"y":2511},"B":{"x":2227,"y":2457}},{"A":{"x":2227,"y":2457},"B":{"x":2322,"y":2470}},{"A":{"x":2322,"y":2470},"B":{"x":2403,"y":2416}},{"A":{"x":2403,"y":2416},"B":{"x":2430,"y":2254}},{"A":{"x":2430,"y":2254},"B":{"x":2241,"y":1741}},{"A":{"x":2241,"y":1741},"B":{"x":2160,"y":1687}},{"A":{"x":2160,"y":1687},"B":{"x":1957,"y":1741}},{"A":{"x":1957,"y":1741},"B":{"x":1849,"y":1674}},{"A":{"x":1849,"y":1674},"B":{"x":1917,"y":1444}},{"A":{"x":1917,"y":1444},"B":{"x":2092,"y":1336}},{"A":{"x":2092,"y":1336},"B":{"x":2268,"y":1309}},{"A":{"x":2268,"y":1309},"B":{"x":2470,"y":1350}},{"A":{"x":2470,"y":1350},"B":{"x":2646,"y":1485}},{"A":{"x":2646,"y":1485},"B":{"x":2754,"y":1566}},{"A":{"x":2916,"y":2754},"B":{"x":2916,"y":3078}},{"A":{"x":3186,"y":2754},"B":{"x":3186,"y":3078}},{"A":{"x":2916,"y":2754},"B":{"x":3186,"y":2754}},{"A":{"x":3186,"y":3078},"B":{"x":2916,"y":3078}}]'

// crypt (all vert/horiz)
// str = '[{"A":{"x":64,"y":192},"B":{"x":64,"y":256}},{"A":{"x":64,"y":256},"B":{"x":64,"y":320}},{"A":{"x":64,"y":320},"B":{"x":64,"y":384}},{"A":{"x":64,"y":1344},"B":{"x":64,"y":1408}},{"A":{"x":64,"y":1408},"B":{"x":64,"y":1472}},{"A":{"x":64,"y":1472},"B":{"x":64,"y":1536}},{"A":{"x":64,"y":1536},"B":{"x":64,"y":1600}},{"A":{"x":64,"y":1600},"B":{"x":64,"y":1664}},{"A":{"x":64,"y":1664},"B":{"x":64,"y":1728}},{"A":{"x":64,"y":1728},"B":{"x":64,"y":1792}},{"A":{"x":64,"y":1920},"B":{"x":64,"y":1984}},{"A":{"x":64,"y":1984},"B":{"x":64,"y":2048}},{"A":{"x":64,"y":2880},"B":{"x":64,"y":2944}},{"A":{"x":64,"y":2944},"B":{"x":64,"y":3008}},{"A":{"x":64,"y":3136},"B":{"x":64,"y":3200}},{"A":{"x":64,"y":3200},"B":{"x":64,"y":3264}},{"A":{"x":128,"y":128},"B":{"x":128,"y":192}},{"A":{"x":128,"y":192},"B":{"x":64,"y":192}},{"A":{"x":64,"y":384},"B":{"x":128,"y":384}},{"A":{"x":128,"y":384},"B":{"x":128,"y":448}},{"A":{"x":128,"y":448},"B":{"x":128,"y":512}},{"A":{"x":128,"y":1280},"B":{"x":128,"y":1344}},{"A":{"x":128,"y":1344},"B":{"x":64,"y":1344}},{"A":{"x":64,"y":1792},"B":{"x":128,"y":1792}},{"A":{"x":128,"y":1792},"B":{"x":128,"y":1856}},{"A":{"x":128,"y":1856},"B":{"x":128,"y":1920}},{"A":{"x":128,"y":1920},"B":{"x":64,"y":1920}},{"A":{"x":64,"y":2048},"B":{"x":128,"y":2048}},{"A":{"x":128,"y":2048},"B":{"x":128,"y":2112}},{"A":{"x":128,"y":2112},"B":{"x":128,"y":2176}},{"A":{"x":128,"y":2176},"B":{"x":128,"y":2240}},{"A":{"x":128,"y":2240},"B":{"x":128,"y":2304}},{"A":{"x":128,"y":2304},"B":{"x":128,"y":2368}},{"A":{"x":128,"y":2816},"B":{"x":128,"y":2880}},{"A":{"x":128,"y":2880},"B":{"x":64,"y":2880}},{"A":{"x":64,"y":3008},"B":{"x":128,"y":3008}},{"A":{"x":128,"y":3008},"B":{"x":128,"y":3072}},{"A":{"x":128,"y":3072},"B":{"x":128,"y":3136}},{"A":{"x":128,"y":3136},"B":{"x":64,"y":3136}},{"A":{"x":64,"y":3264},"B":{"x":128,"y":3264}},{"A":{"x":128,"y":3264},"B":{"x":128,"y":3328}},{"A":{"x":192,"y":128},"B":{"x":128,"y":128}},{"A":{"x":128,"y":512},"B":{"x":192,"y":512}},{"A":{"x":192,"y":512},"B":{"x":192,"y":576}},{"A":{"x":192,"y":576},"B":{"x":192,"y":640}},{"A":{"x":192,"y":640},"B":{"x":192,"y":704}},{"A":{"x":192,"y":704},"B":{"x":192,"y":768}},{"A":{"x":192,"y":1216},"B":{"x":192,"y":1280}},{"A":{"x":192,"y":1280},"B":{"x":128,"y":1280}},{"A":{"x":128,"y":2368},"B":{"x":192,"y":2368}},{"A":{"x":192,"y":2368},"B":{"x":192,"y":2432}},{"A":{"x":192,"y":2816},"B":{"x":128,"y":2816}},{"A":{"x":128,"y":3328},"B":{"x":192,"y":3328}},{"A":{"x":256,"y":128},"B":{"x":192,"y":128}},{"A":{"x":192,"y":768},"B":{"x":256,"y":768}},{"A":{"x":256,"y":768},"B":{"x":256,"y":832}},{"A":{"x":256,"y":1216},"B":{"x":192,"y":1216}},{"A":{"x":192,"y":2432},"B":{"x":256,"y":2432}},{"A":{"x":256,"y":2432},"B":{"x":256,"y":2496}},{"A":{"x":256,"y":2816},"B":{"x":192,"y":2816}},{"A":{"x":192,"y":3328},"B":{"x":256,"y":3328}},{"A":{"x":320,"y":128},"B":{"x":256,"y":128}},{"A":{"x":256,"y":832},"B":{"x":320,"y":832}},{"A":{"x":320,"y":1216},"B":{"x":256,"y":1216}},{"A":{"x":256,"y":1344},"B":{"x":320,"y":1344}},{"A":{"x":256,"y":1408},"B":{"x":256,"y":1344}},{"A":{"x":256,"y":1472},"B":{"x":256,"y":1408}},{"A":{"x":320,"y":1472},"B":{"x":256,"y":1472}},{"A":{"x":256,"y":1664},"B":{"x":320,"y":1664}},{"A":{"x":256,"y":1728},"B":{"x":256,"y":1664}},{"A":{"x":256,"y":1792},"B":{"x":256,"y":1728}},{"A":{"x":320,"y":1792},"B":{"x":256,"y":1792}},{"A":{"x":256,"y":2496},"B":{"x":320,"y":2496}},{"A":{"x":320,"y":2752},"B":{"x":320,"y":2816}},{"A":{"x":320,"y":2816},"B":{"x":256,"y":2816}},{"A":{"x":256,"y":3264},"B":{"x":320,"y":3264}},{"A":{"x":256,"y":3328},"B":{"x":256,"y":3264}},{"A":{"x":384,"y":128},"B":{"x":320,"y":128}},{"A":{"x":320,"y":832},"B":{"x":384,"y":832}},{"A":{"x":384,"y":832},"B":{"x":384,"y":896}},{"A":{"x":384,"y":1024},"B":{"x":384,"y":1088}},{"A":{"x":384,"y":1088},"B":{"x":384,"y":1152}},{"A":{"x":384,"y":1152},"B":{"x":384,"y":1216}},{"A":{"x":384,"y":1216},"B":{"x":320,"y":1216}},{"A":{"x":320,"y":1344},"B":{"x":384,"y":1344}},{"A":{"x":384,"y":1344},"B":{"x":384,"y":1408}},{"A":{"x":384,"y":1408},"B":{"x":384,"y":1472}},{"A":{"x":384,"y":1472},"B":{"x":320,"y":1472}},{"A":{"x":320,"y":1664},"B":{"x":384,"y":1664}},{"A":{"x":384,"y":1664},"B":{"x":384,"y":1728}},{"A":{"x":384,"y":1728},"B":{"x":384,"y":1792}},{"A":{"x":384,"y":1792},"B":{"x":320,"y":1792}},{"A":{"x":320,"y":2432},"B":{"x":384,"y":2432}},{"A":{"x":320,"y":2496},"B":{"x":320,"y":2432}},{"A":{"x":384,"y":2752},"B":{"x":320,"y":2752}},{"A":{"x":320,"y":3200},"B":{"x":384,"y":3200}},{"A":{"x":320,"y":3264},"B":{"x":320,"y":3200}},{"A":{"x":448,"y":128},"B":{"x":384,"y":128}},{"A":{"x":384,"y":896},"B":{"x":448,"y":896}},{"A":{"x":448,"y":896},"B":{"x":448,"y":960}},{"A":{"x":448,"y":960},"B":{"x":448,"y":1024}},{"A":{"x":448,"y":1024},"B":{"x":384,"y":1024}},{"A":{"x":384,"y":2368},"B":{"x":448,"y":2368}},{"A":{"x":384,"y":2432},"B":{"x":384,"y":2368}},{"A":{"x":448,"y":2752},"B":{"x":384,"y":2752}},{"A":{"x":384,"y":3200},"B":{"x":448,"y":3200}},{"A":{"x":448,"y":3200},"B":{"x":448,"y":3264}},{"A":{"x":448,"y":192},"B":{"x":448,"y":128}},{"A":{"x":512,"y":192},"B":{"x":448,"y":192}},{"A":{"x":448,"y":2304},"B":{"x":512,"y":2304}},{"A":{"x":448,"y":2368},"B":{"x":448,"y":2304}},{"A":{"x":512,"y":2560},"B":{"x":512,"y":2624}},{"A":{"x":512,"y":2624},"B":{"x":512,"y":2688}},{"A":{"x":512,"y":2688},"B":{"x":512,"y":2752}},{"A":{"x":512,"y":2752},"B":{"x":448,"y":2752}},{"A":{"x":448,"y":3264},"B":{"x":512,"y":3264}},{"A":{"x":512,"y":256},"B":{"x":512,"y":192}},{"A":{"x":576,"y":256},"B":{"x":512,"y":256}},{"A":{"x":512,"y":896},"B":{"x":576,"y":896}},{"A":{"x":512,"y":960},"B":{"x":512,"y":896}},{"A":{"x":576,"y":960},"B":{"x":512,"y":960}},{"A":{"x":512,"y":1408},"B":{"x":576,"y":1408}},{"A":{"x":512,"y":1472},"B":{"x":512,"y":1408}},{"A":{"x":512,"y":1536},"B":{"x":512,"y":1472}},{"A":{"x":512,"y":1600},"B":{"x":512,"y":1536}},{"A":{"x":512,"y":1664},"B":{"x":512,"y":1600}},{"A":{"x":576,"y":1664},"B":{"x":512,"y":1664}},{"A":{"x":512,"y":2176},"B":{"x":576,"y":2176}},{"A":{"x":512,"y":2240},"B":{"x":512,"y":2176}},{"A":{"x":512,"y":2304},"B":{"x":512,"y":2240}},{"A":{"x":576,"y":2496},"B":{"x":576,"y":2560}},{"A":{"x":576,"y":2560},"B":{"x":512,"y":2560}},{"A":{"x":512,"y":3264},"B":{"x":576,"y":3264}},{"A":{"x":576,"y":3456},"B":{"x":576,"y":3520}},{"A":{"x":576,"y":3520},"B":{"x":576,"y":3584}},{"A":{"x":576,"y":320},"B":{"x":576,"y":256}},{"A":{"x":640,"y":320},"B":{"x":576,"y":320}},{"A":{"x":576,"y":832},"B":{"x":640,"y":832}},{"A":{"x":576,"y":896},"B":{"x":576,"y":832}},{"A":{"x":576,"y":1024},"B":{"x":576,"y":960}},{"A":{"x":576,"y":1088},"B":{"x":576,"y":1024}},{"A":{"x":576,"y":1152},"B":{"x":576,"y":1088}},{"A":{"x":576,"y":1216},"B":{"x":576,"y":1152}},{"A":{"x":576,"y":1280},"B":{"x":576,"y":1216}},{"A":{"x":576,"y":1344},"B":{"x":576,"y":1280}},{"A":{"x":576,"y":1408},"B":{"x":576,"y":1344}},{"A":{"x":576,"y":1728},"B":{"x":576,"y":1664}},{"A":{"x":576,"y":1792},"B":{"x":576,"y":1728}},{"A":{"x":640,"y":1792},"B":{"x":576,"y":1792}},{"A":{"x":576,"y":2112},"B":{"x":640,"y":2112}},{"A":{"x":576,"y":2176},"B":{"x":576,"y":2112}},{"A":{"x":640,"y":2496},"B":{"x":576,"y":2496}},{"A":{"x":576,"y":3200},"B":{"x":640,"y":3200}},{"A":{"x":576,"y":3264},"B":{"x":576,"y":3200}},{"A":{"x":640,"y":3456},"B":{"x":576,"y":3456}},{"A":{"x":576,"y":3584},"B":{"x":640,"y":3584}},{"A":{"x":640,"y":384},"B":{"x":640,"y":320}},{"A":{"x":704,"y":384},"B":{"x":640,"y":384}},{"A":{"x":640,"y":768},"B":{"x":704,"y":768}},{"A":{"x":640,"y":832},"B":{"x":640,"y":768}},{"A":{"x":704,"y":1408},"B":{"x":704,"y":1472}},{"A":{"x":704,"y":1472},"B":{"x":704,"y":1536}},{"A":{"x":704,"y":1536},"B":{"x":704,"y":1600}},{"A":{"x":704,"y":1600},"B":{"x":704,"y":1664}},{"A":{"x":704,"y":1664},"B":{"x":704,"y":1728}},{"A":{"x":704,"y":1728},"B":{"x":704,"y":1792}},{"A":{"x":704,"y":1792},"B":{"x":640,"y":1792}},{"A":{"x":640,"y":2112},"B":{"x":704,"y":2112}},{"A":{"x":704,"y":2496},"B":{"x":640,"y":2496}},{"A":{"x":640,"y":2944},"B":{"x":704,"y":2944}},{"A":{"x":640,"y":3008},"B":{"x":640,"y":2944}},{"A":{"x":640,"y":3072},"B":{"x":640,"y":3008}},{"A":{"x":640,"y":3136},"B":{"x":640,"y":3072}},{"A":{"x":640,"y":3200},"B":{"x":640,"y":3136}},{"A":{"x":704,"y":3392},"B":{"x":704,"y":3456}},{"A":{"x":704,"y":3456},"B":{"x":640,"y":3456}},{"A":{"x":640,"y":3584},"B":{"x":704,"y":3584}},{"A":{"x":704,"y":448},"B":{"x":704,"y":384}},{"A":{"x":768,"y":448},"B":{"x":704,"y":448}},{"A":{"x":704,"y":768},"B":{"x":768,"y":768}},{"A":{"x":768,"y":768},"B":{"x":768,"y":832}},{"A":{"x":768,"y":1344},"B":{"x":768,"y":1408}},{"A":{"x":768,"y":1408},"B":{"x":704,"y":1408}},{"A":{"x":704,"y":2112},"B":{"x":768,"y":2112}},{"A":{"x":768,"y":2304},"B":{"x":768,"y":2368}},{"A":{"x":768,"y":2368},"B":{"x":768,"y":2432}},{"A":{"x":768,"y":2432},"B":{"x":768,"y":2496}},{"A":{"x":768,"y":2496},"B":{"x":704,"y":2496}},{"A":{"x":704,"y":2880},"B":{"x":768,"y":2880}},{"A":{"x":704,"y":2944},"B":{"x":704,"y":2880}},{"A":{"x":768,"y":3328},"B":{"x":768,"y":3392}},{"A":{"x":768,"y":3392},"B":{"x":704,"y":3392}},{"A":{"x":704,"y":3520},"B":{"x":768,"y":3520}},{"A":{"x":704,"y":3584},"B":{"x":704,"y":3520}},{"A":{"x":832,"y":448},"B":{"x":768,"y":448}},{"A":{"x":768,"y":832},"B":{"x":832,"y":832}},{"A":{"x":832,"y":1344},"B":{"x":768,"y":1344}},{"A":{"x":768,"y":1728},"B":{"x":832,"y":1728}},{"A":{"x":768,"y":1792},"B":{"x":768,"y":1728}},{"A":{"x":768,"y":1856},"B":{"x":768,"y":1792}},{"A":{"x":832,"y":1856},"B":{"x":768,"y":1856}},{"A":{"x":768,"y":2048},"B":{"x":832,"y":2048}},{"A":{"x":768,"y":2112},"B":{"x":768,"y":2048}},{"A":{"x":832,"y":2240},"B":{"x":832,"y":2304}},{"A":{"x":832,"y":2304},"B":{"x":768,"y":2304}},{"A":{"x":768,"y":2880},"B":{"x":832,"y":2880}},{"A":{"x":832,"y":2880},"B":{"x":832,"y":2944}},{"A":{"x":832,"y":3264},"B":{"x":832,"y":3328}},{"A":{"x":832,"y":3328},"B":{"x":768,"y":3328}},{"A":{"x":768,"y":3520},"B":{"x":832,"y":3520}},{"A":{"x":832,"y":3520},"B":{"x":832,"y":3584}},{"A":{"x":832,"y":512},"B":{"x":832,"y":448}},{"A":{"x":896,"y":512},"B":{"x":832,"y":512}},{"A":{"x":832,"y":832},"B":{"x":896,"y":832}},{"A":{"x":896,"y":1344},"B":{"x":832,"y":1344}},{"A":{"x":832,"y":1728},"B":{"x":896,"y":1728}},{"A":{"x":832,"y":1920},"B":{"x":832,"y":1856}},{"A":{"x":832,"y":1984},"B":{"x":832,"y":1920}},{"A":{"x":832,"y":2048},"B":{"x":832,"y":1984}},{"A":{"x":896,"y":2240},"B":{"x":832,"y":2240}},{"A":{"x":832,"y":2944},"B":{"x":896,"y":2944}},{"A":{"x":896,"y":3136},"B":{"x":896,"y":3200}},{"A":{"x":896,"y":3200},"B":{"x":896,"y":3264}},{"A":{"x":896,"y":3264},"B":{"x":832,"y":3264}},{"A":{"x":832,"y":3584},"B":{"x":896,"y":3584}},{"A":{"x":896,"y":576},"B":{"x":896,"y":512}},{"A":{"x":960,"y":576},"B":{"x":896,"y":576}},{"A":{"x":896,"y":832},"B":{"x":960,"y":832}},{"A":{"x":960,"y":1280},"B":{"x":960,"y":1344}},{"A":{"x":960,"y":1344},"B":{"x":896,"y":1344}},{"A":{"x":896,"y":1472},"B":{"x":960,"y":1472}},{"A":{"x":896,"y":1536},"B":{"x":896,"y":1472}},{"A":{"x":896,"y":1600},"B":{"x":896,"y":1536}},{"A":{"x":960,"y":1600},"B":{"x":896,"y":1600}},{"A":{"x":896,"y":1664},"B":{"x":960,"y":1664}},{"A":{"x":896,"y":1728},"B":{"x":896,"y":1664}},{"A":{"x":960,"y":1664},"B":{"x":960,"y":1728}},{"A":{"x":960,"y":1728},"B":{"x":960,"y":1792}},{"A":{"x":960,"y":1792},"B":{"x":960,"y":1856}},{"A":{"x":960,"y":1856},"B":{"x":960,"y":1920}},{"A":{"x":960,"y":1920},"B":{"x":960,"y":1984}},{"A":{"x":960,"y":2240},"B":{"x":896,"y":2240}},{"A":{"x":896,"y":2944},"B":{"x":960,"y":2944}},{"A":{"x":960,"y":3072},"B":{"x":960,"y":3136}},{"A":{"x":960,"y":3136},"B":{"x":896,"y":3136}},{"A":{"x":896,"y":3584},"B":{"x":960,"y":3584}},{"A":{"x":1024,"y":64},"B":{"x":1024,"y":128}},{"A":{"x":1024,"y":128},"B":{"x":1024,"y":192}},{"A":{"x":1024,"y":192},"B":{"x":1024,"y":256}},{"A":{"x":960,"y":640},"B":{"x":960,"y":576}},{"A":{"x":1024,"y":576},"B":{"x":1024,"y":640}},{"A":{"x":1024,"y":640},"B":{"x":960,"y":640}},{"A":{"x":960,"y":832},"B":{"x":1024,"y":832}},{"A":{"x":1024,"y":832},"B":{"x":1024,"y":896}},{"A":{"x":1024,"y":1216},"B":{"x":1024,"y":1280}},{"A":{"x":1024,"y":1280},"B":{"x":960,"y":1280}},{"A":{"x":960,"y":1472},"B":{"x":1024,"y":1472}},{"A":{"x":960,"y":1664},"B":{"x":960,"y":1600}},{"A":{"x":1024,"y":1664},"B":{"x":960,"y":1664}},{"A":{"x":960,"y":1984},"B":{"x":1024,"y":1984}},{"A":{"x":1024,"y":1984},"B":{"x":1024,"y":2048}},{"A":{"x":1024,"y":2048},"B":{"x":1024,"y":2112}},{"A":{"x":960,"y":2304},"B":{"x":960,"y":2240}},{"A":{"x":1024,"y":2304},"B":{"x":960,"y":2304}},{"A":{"x":960,"y":2944},"B":{"x":1024,"y":2944}},{"A":{"x":1024,"y":3072},"B":{"x":960,"y":3072}},{"A":{"x":960,"y":3520},"B":{"x":1024,"y":3520}},{"A":{"x":960,"y":3584},"B":{"x":960,"y":3520}},{"A":{"x":1088,"y":64},"B":{"x":1024,"y":64}},{"A":{"x":1024,"y":256},"B":{"x":1088,"y":256}},{"A":{"x":1088,"y":512},"B":{"x":1088,"y":576}},{"A":{"x":1088,"y":576},"B":{"x":1024,"y":576}},{"A":{"x":1024,"y":896},"B":{"x":1088,"y":896}},{"A":{"x":1088,"y":1216},"B":{"x":1024,"y":1216}},{"A":{"x":1024,"y":1408},"B":{"x":1088,"y":1408}},{"A":{"x":1024,"y":1472},"B":{"x":1024,"y":1408}},{"A":{"x":1088,"y":1664},"B":{"x":1024,"y":1664}},{"A":{"x":1024,"y":2112},"B":{"x":1088,"y":2112}},{"A":{"x":1088,"y":2112},"B":{"x":1088,"y":2176}},{"A":{"x":1024,"y":2368},"B":{"x":1024,"y":2304}},{"A":{"x":1088,"y":2368},"B":{"x":1024,"y":2368}},{"A":{"x":1024,"y":2880},"B":{"x":1088,"y":2880}},{"A":{"x":1024,"y":2944},"B":{"x":1024,"y":2880}},{"A":{"x":1088,"y":3072},"B":{"x":1024,"y":3072}},{"A":{"x":1024,"y":3392},"B":{"x":1088,"y":3392}},{"A":{"x":1024,"y":3456},"B":{"x":1024,"y":3392}},{"A":{"x":1024,"y":3520},"B":{"x":1024,"y":3456}},{"A":{"x":1152,"y":64},"B":{"x":1088,"y":64}},{"A":{"x":1088,"y":256},"B":{"x":1152,"y":256}},{"A":{"x":1152,"y":384},"B":{"x":1152,"y":448}},{"A":{"x":1152,"y":448},"B":{"x":1152,"y":512}},{"A":{"x":1152,"y":512},"B":{"x":1088,"y":512}},{"A":{"x":1088,"y":896},"B":{"x":1152,"y":896}},{"A":{"x":1152,"y":1024},"B":{"x":1152,"y":1088}},{"A":{"x":1152,"y":1216},"B":{"x":1088,"y":1216}},{"A":{"x":1088,"y":1408},"B":{"x":1152,"y":1408}},{"A":{"x":1152,"y":1664},"B":{"x":1088,"y":1664}},{"A":{"x":1088,"y":2176},"B":{"x":1152,"y":2176}},{"A":{"x":1152,"y":2176},"B":{"x":1152,"y":2240}},{"A":{"x":1152,"y":2240},"B":{"x":1152,"y":2304}},{"A":{"x":1152,"y":2304},"B":{"x":1152,"y":2368}},{"A":{"x":1152,"y":2368},"B":{"x":1088,"y":2368}},{"A":{"x":1088,"y":2880},"B":{"x":1152,"y":2880}},{"A":{"x":1152,"y":2880},"B":{"x":1152,"y":2944}},{"A":{"x":1152,"y":3008},"B":{"x":1152,"y":3072}},{"A":{"x":1152,"y":3072},"B":{"x":1088,"y":3072}},{"A":{"x":1088,"y":3392},"B":{"x":1152,"y":3392}},{"A":{"x":1216,"y":64},"B":{"x":1152,"y":64}},{"A":{"x":1152,"y":256},"B":{"x":1216,"y":256}},{"A":{"x":1216,"y":256},"B":{"x":1216,"y":320}},{"A":{"x":1216,"y":320},"B":{"x":1216,"y":384}},{"A":{"x":1216,"y":384},"B":{"x":1152,"y":384}},{"A":{"x":1152,"y":832},"B":{"x":1216,"y":832}},{"A":{"x":1152,"y":896},"B":{"x":1152,"y":832}},{"A":{"x":1216,"y":960},"B":{"x":1216,"y":1024}},{"A":{"x":1216,"y":1024},"B":{"x":1152,"y":1024}},{"A":{"x":1152,"y":1088},"B":{"x":1216,"y":1088}},{"A":{"x":1216,"y":1088},"B":{"x":1216,"y":1152}},{"A":{"x":1216,"y":1152},"B":{"x":1216,"y":1216}},{"A":{"x":1216,"y":1216},"B":{"x":1152,"y":1216}},{"A":{"x":1152,"y":1408},"B":{"x":1216,"y":1408}},{"A":{"x":1152,"y":1728},"B":{"x":1152,"y":1664}},{"A":{"x":1216,"y":1728},"B":{"x":1152,"y":1728}},{"A":{"x":1152,"y":2944},"B":{"x":1216,"y":2944}},{"A":{"x":1216,"y":2944},"B":{"x":1216,"y":3008}},{"A":{"x":1216,"y":3008},"B":{"x":1152,"y":3008}},{"A":{"x":1152,"y":3392},"B":{"x":1216,"y":3392}},{"A":{"x":1216,"y":128},"B":{"x":1216,"y":64}},{"A":{"x":1280,"y":128},"B":{"x":1216,"y":128}},{"A":{"x":1216,"y":832},"B":{"x":1280,"y":832}},{"A":{"x":1280,"y":960},"B":{"x":1216,"y":960}},{"A":{"x":1216,"y":1344},"B":{"x":1280,"y":1344}},{"A":{"x":1216,"y":1408},"B":{"x":1216,"y":1344}},{"A":{"x":1216,"y":1792},"B":{"x":1216,"y":1728}},{"A":{"x":1280,"y":1792},"B":{"x":1216,"y":1792}},{"A":{"x":1216,"y":3392},"B":{"x":1280,"y":3392}},{"A":{"x":1280,"y":3392},"B":{"x":1280,"y":3456}},{"A":{"x":1344,"y":64},"B":{"x":1344,"y":128}},{"A":{"x":1344,"y":128},"B":{"x":1280,"y":128}},{"A":{"x":1280,"y":448},"B":{"x":1344,"y":448}},{"A":{"x":1280,"y":512},"B":{"x":1280,"y":448}},{"A":{"x":1280,"y":576},"B":{"x":1280,"y":512}},{"A":{"x":1280,"y":640},"B":{"x":1280,"y":576}},{"A":{"x":1344,"y":640},"B":{"x":1280,"y":640}},{"A":{"x":1280,"y":768},"B":{"x":1344,"y":768}},{"A":{"x":1280,"y":832},"B":{"x":1280,"y":768}},{"A":{"x":1280,"y":1024},"B":{"x":1280,"y":960}},{"A":{"x":1344,"y":1024},"B":{"x":1280,"y":1024}},{"A":{"x":1280,"y":1344},"B":{"x":1344,"y":1344}},{"A":{"x":1280,"y":1856},"B":{"x":1280,"y":1792}},{"A":{"x":1344,"y":1856},"B":{"x":1280,"y":1856}},{"A":{"x":1280,"y":2816},"B":{"x":1344,"y":2816}},{"A":{"x":1280,"y":2880},"B":{"x":1280,"y":2816}},{"A":{"x":1280,"y":2944},"B":{"x":1280,"y":2880}},{"A":{"x":1280,"y":3008},"B":{"x":1280,"y":2944}},{"A":{"x":1344,"y":3008},"B":{"x":1280,"y":3008}},{"A":{"x":1280,"y":3456},"B":{"x":1344,"y":3456}},{"A":{"x":1344,"y":3456},"B":{"x":1344,"y":3520}},{"A":{"x":1344,"y":3520},"B":{"x":1344,"y":3584}},{"A":{"x":1408,"y":64},"B":{"x":1344,"y":64}},{"A":{"x":1344,"y":448},"B":{"x":1408,"y":448}},{"A":{"x":1408,"y":448},"B":{"x":1408,"y":512}},{"A":{"x":1408,"y":512},"B":{"x":1408,"y":576}},{"A":{"x":1408,"y":576},"B":{"x":1408,"y":640}},{"A":{"x":1408,"y":640},"B":{"x":1344,"y":640}},{"A":{"x":1344,"y":768},"B":{"x":1408,"y":768}},{"A":{"x":1344,"y":1088},"B":{"x":1344,"y":1024}},{"A":{"x":1408,"y":1088},"B":{"x":1344,"y":1088}},{"A":{"x":1344,"y":1280},"B":{"x":1408,"y":1280}},{"A":{"x":1344,"y":1344},"B":{"x":1344,"y":1280}},{"A":{"x":1408,"y":1536},"B":{"x":1408,"y":1600}},{"A":{"x":1408,"y":1600},"B":{"x":1408,"y":1664}},{"A":{"x":1408,"y":1856},"B":{"x":1344,"y":1856}},{"A":{"x":1344,"y":2816},"B":{"x":1408,"y":2816}},{"A":{"x":1408,"y":3008},"B":{"x":1344,"y":3008}},{"A":{"x":1344,"y":3584},"B":{"x":1408,"y":3584}},{"A":{"x":1408,"y":3584},"B":{"x":1408,"y":3648}},{"A":{"x":1472,"y":64},"B":{"x":1408,"y":64}},{"A":{"x":1408,"y":768},"B":{"x":1472,"y":768}},{"A":{"x":1472,"y":1088},"B":{"x":1408,"y":1088}},{"A":{"x":1408,"y":1280},"B":{"x":1472,"y":1280}},{"A":{"x":1472,"y":1472},"B":{"x":1472,"y":1536}},{"A":{"x":1472,"y":1536},"B":{"x":1408,"y":1536}},{"A":{"x":1408,"y":1664},"B":{"x":1472,"y":1664}},{"A":{"x":1472,"y":1664},"B":{"x":1472,"y":1728}},{"A":{"x":1472,"y":1792},"B":{"x":1472,"y":1856}},{"A":{"x":1472,"y":1856},"B":{"x":1408,"y":1856}},{"A":{"x":1408,"y":2816},"B":{"x":1472,"y":2816}},{"A":{"x":1472,"y":2816},"B":{"x":1472,"y":2880}},{"A":{"x":1472,"y":2880},"B":{"x":1472,"y":2944}},{"A":{"x":1408,"y":3072},"B":{"x":1408,"y":3008}},{"A":{"x":1472,"y":3072},"B":{"x":1408,"y":3072}},{"A":{"x":1408,"y":3648},"B":{"x":1472,"y":3648}},{"A":{"x":1536,"y":64},"B":{"x":1472,"y":64}},{"A":{"x":1472,"y":256},"B":{"x":1536,"y":256}},{"A":{"x":1472,"y":320},"B":{"x":1472,"y":256}},{"A":{"x":1472,"y":384},"B":{"x":1472,"y":320}},{"A":{"x":1536,"y":384},"B":{"x":1472,"y":384}},{"A":{"x":1472,"y":704},"B":{"x":1536,"y":704}},{"A":{"x":1472,"y":768},"B":{"x":1472,"y":704}},{"A":{"x":1472,"y":1152},"B":{"x":1472,"y":1088}},{"A":{"x":1536,"y":1088},"B":{"x":1536,"y":1152}},{"A":{"x":1536,"y":1152},"B":{"x":1472,"y":1152}},{"A":{"x":1472,"y":1280},"B":{"x":1536,"y":1280}},{"A":{"x":1536,"y":1472},"B":{"x":1472,"y":1472}},{"A":{"x":1472,"y":1728},"B":{"x":1536,"y":1728}},{"A":{"x":1536,"y":1728},"B":{"x":1536,"y":1792}},{"A":{"x":1536,"y":1792},"B":{"x":1472,"y":1792}},{"A":{"x":1472,"y":2944},"B":{"x":1536,"y":2944}},{"A":{"x":1536,"y":2944},"B":{"x":1536,"y":3008}},{"A":{"x":1536,"y":3008},"B":{"x":1536,"y":3072}},{"A":{"x":1536,"y":3072},"B":{"x":1472,"y":3072}},{"A":{"x":1472,"y":3648},"B":{"x":1536,"y":3648}},{"A":{"x":1600,"y":64},"B":{"x":1536,"y":64}},{"A":{"x":1536,"y":256},"B":{"x":1600,"y":256}},{"A":{"x":1600,"y":256},"B":{"x":1600,"y":320}},{"A":{"x":1600,"y":320},"B":{"x":1600,"y":384}},{"A":{"x":1600,"y":384},"B":{"x":1536,"y":384}},{"A":{"x":1536,"y":640},"B":{"x":1600,"y":640}},{"A":{"x":1536,"y":704},"B":{"x":1536,"y":640}},{"A":{"x":1600,"y":896},"B":{"x":1600,"y":960}},{"A":{"x":1600,"y":960},"B":{"x":1600,"y":1024}},{"A":{"x":1600,"y":1024},"B":{"x":1600,"y":1088}},{"A":{"x":1600,"y":1088},"B":{"x":1536,"y":1088}},{"A":{"x":1536,"y":1280},"B":{"x":1600,"y":1280}},{"A":{"x":1600,"y":1280},"B":{"x":1600,"y":1344}},{"A":{"x":1600,"y":1472},"B":{"x":1536,"y":1472}},{"A":{"x":1536,"y":2432},"B":{"x":1600,"y":2432}},{"A":{"x":1536,"y":2496},"B":{"x":1536,"y":2432}},{"A":{"x":1536,"y":2560},"B":{"x":1536,"y":2496}},{"A":{"x":1536,"y":2624},"B":{"x":1536,"y":2560}},{"A":{"x":1600,"y":2624},"B":{"x":1536,"y":2624}},{"A":{"x":1536,"y":3648},"B":{"x":1600,"y":3648}},{"A":{"x":1600,"y":128},"B":{"x":1600,"y":64}},{"A":{"x":1664,"y":128},"B":{"x":1600,"y":128}},{"A":{"x":1600,"y":576},"B":{"x":1664,"y":576}},{"A":{"x":1600,"y":640},"B":{"x":1600,"y":576}},{"A":{"x":1664,"y":832},"B":{"x":1664,"y":896}},{"A":{"x":1664,"y":896},"B":{"x":1600,"y":896}},{"A":{"x":1600,"y":1344},"B":{"x":1664,"y":1344}},{"A":{"x":1600,"y":1536},"B":{"x":1600,"y":1472}},{"A":{"x":1664,"y":1536},"B":{"x":1600,"y":1536}},{"A":{"x":1600,"y":2432},"B":{"x":1664,"y":2432}},{"A":{"x":1664,"y":2624},"B":{"x":1600,"y":2624}},{"A":{"x":1600,"y":3584},"B":{"x":1664,"y":3584}},{"A":{"x":1600,"y":3648},"B":{"x":1600,"y":3584}},{"A":{"x":1728,"y":128},"B":{"x":1664,"y":128}},{"A":{"x":1664,"y":576},"B":{"x":1728,"y":576}},{"A":{"x":1728,"y":576},"B":{"x":1728,"y":640}},{"A":{"x":1728,"y":832},"B":{"x":1664,"y":832}},{"A":{"x":1664,"y":1344},"B":{"x":1728,"y":1344}},{"A":{"x":1728,"y":1472},"B":{"x":1728,"y":1536}},{"A":{"x":1728,"y":1536},"B":{"x":1664,"y":1536}},{"A":{"x":1664,"y":2432},"B":{"x":1728,"y":2432}},{"A":{"x":1728,"y":2624},"B":{"x":1664,"y":2624}},{"A":{"x":1664,"y":3584},"B":{"x":1728,"y":3584}},{"A":{"x":1792,"y":64},"B":{"x":1792,"y":128}},{"A":{"x":1792,"y":128},"B":{"x":1728,"y":128}},{"A":{"x":1728,"y":640},"B":{"x":1792,"y":640}},{"A":{"x":1792,"y":640},"B":{"x":1792,"y":704}},{"A":{"x":1792,"y":704},"B":{"x":1792,"y":768}},{"A":{"x":1792,"y":768},"B":{"x":1792,"y":832}},{"A":{"x":1792,"y":832},"B":{"x":1728,"y":832}},{"A":{"x":1728,"y":1024},"B":{"x":1792,"y":1024}},{"A":{"x":1728,"y":1088},"B":{"x":1728,"y":1024}},{"A":{"x":1792,"y":1088},"B":{"x":1728,"y":1088}},{"A":{"x":1728,"y":1280},"B":{"x":1792,"y":1280}},{"A":{"x":1728,"y":1344},"B":{"x":1728,"y":1280}},{"A":{"x":1792,"y":1472},"B":{"x":1728,"y":1472}},{"A":{"x":1728,"y":2432},"B":{"x":1792,"y":2432}},{"A":{"x":1792,"y":2624},"B":{"x":1728,"y":2624}},{"A":{"x":1728,"y":3584},"B":{"x":1792,"y":3584}},{"A":{"x":1856,"y":64},"B":{"x":1792,"y":64}},{"A":{"x":1792,"y":256},"B":{"x":1856,"y":256}},{"A":{"x":1792,"y":320},"B":{"x":1792,"y":256}},{"A":{"x":1792,"y":384},"B":{"x":1792,"y":320}},{"A":{"x":1792,"y":448},"B":{"x":1792,"y":384}},{"A":{"x":1856,"y":448},"B":{"x":1792,"y":448}},{"A":{"x":1792,"y":960},"B":{"x":1856,"y":960}},{"A":{"x":1792,"y":1024},"B":{"x":1792,"y":960}},{"A":{"x":1792,"y":1152},"B":{"x":1792,"y":1088}},{"A":{"x":1792,"y":1216},"B":{"x":1792,"y":1152}},{"A":{"x":1792,"y":1280},"B":{"x":1792,"y":1216}},{"A":{"x":1856,"y":1472},"B":{"x":1792,"y":1472}},{"A":{"x":1792,"y":2368},"B":{"x":1856,"y":2368}},{"A":{"x":1792,"y":2432},"B":{"x":1792,"y":2368}},{"A":{"x":1856,"y":2624},"B":{"x":1792,"y":2624}},{"A":{"x":1792,"y":3584},"B":{"x":1856,"y":3584}},{"A":{"x":1920,"y":64},"B":{"x":1856,"y":64}},{"A":{"x":1856,"y":256},"B":{"x":1920,"y":256}},{"A":{"x":1920,"y":256},"B":{"x":1920,"y":320}},{"A":{"x":1920,"y":320},"B":{"x":1920,"y":384}},{"A":{"x":1920,"y":384},"B":{"x":1920,"y":448}},{"A":{"x":1920,"y":448},"B":{"x":1856,"y":448}},{"A":{"x":1856,"y":960},"B":{"x":1920,"y":960}},{"A":{"x":1920,"y":1472},"B":{"x":1856,"y":1472}},{"A":{"x":1856,"y":1728},"B":{"x":1920,"y":1728}},{"A":{"x":1856,"y":1792},"B":{"x":1856,"y":1728}},{"A":{"x":1856,"y":1856},"B":{"x":1856,"y":1792}},{"A":{"x":1920,"y":1856},"B":{"x":1856,"y":1856}},{"A":{"x":1856,"y":2176},"B":{"x":1920,"y":2176}},{"A":{"x":1856,"y":2240},"B":{"x":1856,"y":2176}},{"A":{"x":1856,"y":2304},"B":{"x":1856,"y":2240}},{"A":{"x":1856,"y":2368},"B":{"x":1856,"y":2304}},{"A":{"x":1920,"y":2624},"B":{"x":1856,"y":2624}},{"A":{"x":1856,"y":3520},"B":{"x":1920,"y":3520}},{"A":{"x":1856,"y":3584},"B":{"x":1856,"y":3520}},{"A":{"x":1984,"y":64},"B":{"x":1920,"y":64}},{"A":{"x":1920,"y":960},"B":{"x":1984,"y":960}},{"A":{"x":1984,"y":960},"B":{"x":1984,"y":1024}},{"A":{"x":1984,"y":1024},"B":{"x":1984,"y":1088}},{"A":{"x":1984,"y":1472},"B":{"x":1920,"y":1472}},{"A":{"x":1920,"y":1728},"B":{"x":1984,"y":1728}},{"A":{"x":1984,"y":1856},"B":{"x":1920,"y":1856}},{"A":{"x":1920,"y":2112},"B":{"x":1984,"y":2112}},{"A":{"x":1920,"y":2176},"B":{"x":1920,"y":2112}},{"A":{"x":1984,"y":2624},"B":{"x":1920,"y":2624}},{"A":{"x":1920,"y":2944},"B":{"x":1984,"y":2944}},{"A":{"x":1920,"y":3008},"B":{"x":1920,"y":2944}},{"A":{"x":1920,"y":3072},"B":{"x":1920,"y":3008}},{"A":{"x":1984,"y":3072},"B":{"x":1920,"y":3072}},{"A":{"x":1920,"y":3392},"B":{"x":1984,"y":3392}},{"A":{"x":1920,"y":3456},"B":{"x":1920,"y":3392}},{"A":{"x":1920,"y":3520},"B":{"x":1920,"y":3456}},{"A":{"x":1984,"y":128},"B":{"x":1984,"y":64}},{"A":{"x":2048,"y":128},"B":{"x":1984,"y":128}},{"A":{"x":1984,"y":1088},"B":{"x":2048,"y":1088}},{"A":{"x":2048,"y":1088},"B":{"x":2048,"y":1152}},{"A":{"x":2048,"y":1152},"B":{"x":2048,"y":1216}},{"A":{"x":2048,"y":1216},"B":{"x":2048,"y":1280}},{"A":{"x":1984,"y":1536},"B":{"x":1984,"y":1472}},{"A":{"x":2048,"y":1472},"B":{"x":2048,"y":1536}},{"A":{"x":2048,"y":1536},"B":{"x":1984,"y":1536}},{"A":{"x":1984,"y":1664},"B":{"x":2048,"y":1664}},{"A":{"x":1984,"y":1728},"B":{"x":1984,"y":1664}},{"A":{"x":1984,"y":1920},"B":{"x":1984,"y":1856}},{"A":{"x":2048,"y":1920},"B":{"x":1984,"y":1920}},{"A":{"x":1984,"y":2048},"B":{"x":2048,"y":2048}},{"A":{"x":1984,"y":2112},"B":{"x":1984,"y":2048}},{"A":{"x":2048,"y":2624},"B":{"x":1984,"y":2624}},{"A":{"x":1984,"y":2944},"B":{"x":2048,"y":2944}},{"A":{"x":2048,"y":2944},"B":{"x":2048,"y":3008}},{"A":{"x":2048,"y":3008},"B":{"x":2048,"y":3072}},{"A":{"x":2048,"y":3072},"B":{"x":1984,"y":3072}},{"A":{"x":1984,"y":3392},"B":{"x":2048,"y":3392}},{"A":{"x":2112,"y":128},"B":{"x":2048,"y":128}},{"A":{"x":2048,"y":1280},"B":{"x":2112,"y":1280}},{"A":{"x":2112,"y":1280},"B":{"x":2112,"y":1344}},{"A":{"x":2112,"y":1472},"B":{"x":2048,"y":1472}},{"A":{"x":2048,"y":1600},"B":{"x":2112,"y":1600}},{"A":{"x":2048,"y":1664},"B":{"x":2048,"y":1600}},{"A":{"x":2112,"y":1600},"B":{"x":2112,"y":1664}},{"A":{"x":2048,"y":1984},"B":{"x":2048,"y":1920}},{"A":{"x":2112,"y":1984},"B":{"x":2048,"y":1984}},{"A":{"x":2048,"y":2048},"B":{"x":2112,"y":2048}},{"A":{"x":2112,"y":2048},"B":{"x":2112,"y":2112}},{"A":{"x":2112,"y":2560},"B":{"x":2112,"y":2624}},{"A":{"x":2112,"y":2624},"B":{"x":2048,"y":2624}},{"A":{"x":2048,"y":3392},"B":{"x":2112,"y":3392}},{"A":{"x":2112,"y":192},"B":{"x":2112,"y":128}},{"A":{"x":2176,"y":192},"B":{"x":2112,"y":192}},{"A":{"x":2112,"y":384},"B":{"x":2176,"y":384}},{"A":{"x":2112,"y":448},"B":{"x":2112,"y":384}},{"A":{"x":2176,"y":448},"B":{"x":2112,"y":448}},{"A":{"x":2112,"y":1344},"B":{"x":2176,"y":1344}},{"A":{"x":2176,"y":1472},"B":{"x":2112,"y":1472}},{"A":{"x":2112,"y":1664},"B":{"x":2176,"y":1664}},{"A":{"x":2176,"y":1664},"B":{"x":2176,"y":1728}},{"A":{"x":2176,"y":1920},"B":{"x":2176,"y":1984}},{"A":{"x":2176,"y":1984},"B":{"x":2112,"y":1984}},{"A":{"x":2112,"y":2112},"B":{"x":2176,"y":2112}},{"A":{"x":2176,"y":2112},"B":{"x":2176,"y":2176}},{"A":{"x":2176,"y":2560},"B":{"x":2112,"y":2560}},{"A":{"x":2112,"y":3328},"B":{"x":2176,"y":3328}},{"A":{"x":2112,"y":3392},"B":{"x":2112,"y":3328}},{"A":{"x":2176,"y":256},"B":{"x":2176,"y":192}},{"A":{"x":2176,"y":320},"B":{"x":2176,"y":256}},{"A":{"x":2176,"y":384},"B":{"x":2176,"y":320}},{"A":{"x":2176,"y":512},"B":{"x":2176,"y":448}},{"A":{"x":2240,"y":512},"B":{"x":2176,"y":512}},{"A":{"x":2176,"y":1344},"B":{"x":2240,"y":1344}},{"A":{"x":2240,"y":1472},"B":{"x":2176,"y":1472}},{"A":{"x":2176,"y":1728},"B":{"x":2240,"y":1728}},{"A":{"x":2240,"y":1728},"B":{"x":2240,"y":1792}},{"A":{"x":2240,"y":1792},"B":{"x":2240,"y":1856}},{"A":{"x":2240,"y":1856},"B":{"x":2240,"y":1920}},{"A":{"x":2240,"y":1920},"B":{"x":2176,"y":1920}},{"A":{"x":2176,"y":2176},"B":{"x":2240,"y":2176}},{"A":{"x":2240,"y":2176},"B":{"x":2240,"y":2240}},{"A":{"x":2240,"y":2560},"B":{"x":2176,"y":2560}},{"A":{"x":2176,"y":2880},"B":{"x":2240,"y":2880}},{"A":{"x":2176,"y":2944},"B":{"x":2176,"y":2880}},{"A":{"x":2176,"y":3008},"B":{"x":2176,"y":2944}},{"A":{"x":2240,"y":3008},"B":{"x":2176,"y":3008}},{"A":{"x":2176,"y":3200},"B":{"x":2240,"y":3200}},{"A":{"x":2176,"y":3264},"B":{"x":2176,"y":3200}},{"A":{"x":2176,"y":3328},"B":{"x":2176,"y":3264}},{"A":{"x":2304,"y":512},"B":{"x":2240,"y":512}},{"A":{"x":2240,"y":704},"B":{"x":2304,"y":704}},{"A":{"x":2240,"y":768},"B":{"x":2240,"y":704}},{"A":{"x":2240,"y":832},"B":{"x":2240,"y":768}},{"A":{"x":2240,"y":896},"B":{"x":2240,"y":832}},{"A":{"x":2240,"y":960},"B":{"x":2240,"y":896}},{"A":{"x":2240,"y":1024},"B":{"x":2240,"y":960}},{"A":{"x":2304,"y":1024},"B":{"x":2240,"y":1024}},{"A":{"x":2240,"y":1280},"B":{"x":2304,"y":1280}},{"A":{"x":2240,"y":1344},"B":{"x":2240,"y":1280}},{"A":{"x":2304,"y":1472},"B":{"x":2240,"y":1472}},{"A":{"x":2240,"y":2240},"B":{"x":2304,"y":2240}},{"A":{"x":2304,"y":2240},"B":{"x":2304,"y":2304}},{"A":{"x":2304,"y":2304},"B":{"x":2304,"y":2368}},{"A":{"x":2304,"y":2432},"B":{"x":2304,"y":2496}},{"A":{"x":2304,"y":2496},"B":{"x":2304,"y":2560}},{"A":{"x":2304,"y":2560},"B":{"x":2240,"y":2560}},{"A":{"x":2240,"y":2880},"B":{"x":2304,"y":2880}},{"A":{"x":2304,"y":3008},"B":{"x":2240,"y":3008}},{"A":{"x":2240,"y":3200},"B":{"x":2304,"y":3200}},{"A":{"x":2304,"y":3200},"B":{"x":2304,"y":3264}},{"A":{"x":2304,"y":3264},"B":{"x":2304,"y":3328}},{"A":{"x":2304,"y":576},"B":{"x":2304,"y":512}},{"A":{"x":2304,"y":640},"B":{"x":2304,"y":576}},{"A":{"x":2304,"y":704},"B":{"x":2304,"y":640}},{"A":{"x":2304,"y":1088},"B":{"x":2304,"y":1024}},{"A":{"x":2368,"y":1088},"B":{"x":2304,"y":1088}},{"A":{"x":2304,"y":1280},"B":{"x":2368,"y":1280}},{"A":{"x":2368,"y":1280},"B":{"x":2368,"y":1344}},{"A":{"x":2368,"y":1344},"B":{"x":2368,"y":1408}},{"A":{"x":2304,"y":1536},"B":{"x":2304,"y":1472}},{"A":{"x":2368,"y":1472},"B":{"x":2368,"y":1536}},{"A":{"x":2368,"y":1536},"B":{"x":2304,"y":1536}},{"A":{"x":2304,"y":2368},"B":{"x":2368,"y":2368}},{"A":{"x":2368,"y":2368},"B":{"x":2368,"y":2432}},{"A":{"x":2368,"y":2432},"B":{"x":2304,"y":2432}},{"A":{"x":2304,"y":2880},"B":{"x":2368,"y":2880}},{"A":{"x":2368,"y":3008},"B":{"x":2304,"y":3008}},{"A":{"x":2304,"y":3328},"B":{"x":2368,"y":3328}},{"A":{"x":2368,"y":3328},"B":{"x":2368,"y":3392}},{"A":{"x":2368,"y":3392},"B":{"x":2368,"y":3456}},{"A":{"x":2368,"y":3456},"B":{"x":2368,"y":3520}},{"A":{"x":2368,"y":3520},"B":{"x":2368,"y":3584}},{"A":{"x":2432,"y":1024},"B":{"x":2432,"y":1088}},{"A":{"x":2432,"y":1088},"B":{"x":2368,"y":1088}},{"A":{"x":2368,"y":1408},"B":{"x":2432,"y":1408}},{"A":{"x":2432,"y":1408},"B":{"x":2432,"y":1472}},{"A":{"x":2432,"y":1472},"B":{"x":2368,"y":1472}},{"A":{"x":2368,"y":2880},"B":{"x":2432,"y":2880}},{"A":{"x":2368,"y":3072},"B":{"x":2368,"y":3008}},{"A":{"x":2432,"y":3008},"B":{"x":2432,"y":3072}},{"A":{"x":2432,"y":3072},"B":{"x":2368,"y":3072}},{"A":{"x":2368,"y":3584},"B":{"x":2432,"y":3584}},{"A":{"x":2432,"y":3584},"B":{"x":2432,"y":3648}},{"A":{"x":2496,"y":128},"B":{"x":2496,"y":192}},{"A":{"x":2496,"y":192},"B":{"x":2496,"y":256}},{"A":{"x":2496,"y":256},"B":{"x":2496,"y":320}},{"A":{"x":2496,"y":768},"B":{"x":2496,"y":832}},{"A":{"x":2496,"y":832},"B":{"x":2496,"y":896}},{"A":{"x":2496,"y":896},"B":{"x":2496,"y":960}},{"A":{"x":2496,"y":960},"B":{"x":2496,"y":1024}},{"A":{"x":2496,"y":1024},"B":{"x":2432,"y":1024}},{"A":{"x":2432,"y":2880},"B":{"x":2496,"y":2880}},{"A":{"x":2496,"y":2880},"B":{"x":2496,"y":2944}},{"A":{"x":2496,"y":2944},"B":{"x":2496,"y":3008}},{"A":{"x":2496,"y":3008},"B":{"x":2432,"y":3008}},{"A":{"x":2432,"y":3200},"B":{"x":2496,"y":3200}},{"A":{"x":2432,"y":3264},"B":{"x":2432,"y":3200}},{"A":{"x":2496,"y":3264},"B":{"x":2432,"y":3264}},{"A":{"x":2432,"y":3648},"B":{"x":2496,"y":3648}},{"A":{"x":2560,"y":64},"B":{"x":2560,"y":128}},{"A":{"x":2560,"y":128},"B":{"x":2496,"y":128}},{"A":{"x":2496,"y":320},"B":{"x":2560,"y":320}},{"A":{"x":2560,"y":320},"B":{"x":2560,"y":384}},{"A":{"x":2560,"y":768},"B":{"x":2496,"y":768}},{"A":{"x":2496,"y":1664},"B":{"x":2560,"y":1664}},{"A":{"x":2496,"y":1728},"B":{"x":2496,"y":1664}},{"A":{"x":2560,"y":1728},"B":{"x":2496,"y":1728}},{"A":{"x":2496,"y":3136},"B":{"x":2560,"y":3136}},{"A":{"x":2496,"y":3200},"B":{"x":2496,"y":3136}},{"A":{"x":2496,"y":3328},"B":{"x":2496,"y":3264}},{"A":{"x":2560,"y":3328},"B":{"x":2496,"y":3328}},{"A":{"x":2496,"y":3648},"B":{"x":2560,"y":3648}},{"A":{"x":2624,"y":64},"B":{"x":2560,"y":64}},{"A":{"x":2560,"y":384},"B":{"x":2624,"y":384}},{"A":{"x":2624,"y":768},"B":{"x":2560,"y":768}},{"A":{"x":2560,"y":1408},"B":{"x":2624,"y":1408}},{"A":{"x":2560,"y":1472},"B":{"x":2560,"y":1408}},{"A":{"x":2560,"y":1536},"B":{"x":2560,"y":1472}},{"A":{"x":2560,"y":1600},"B":{"x":2560,"y":1536}},{"A":{"x":2560,"y":1664},"B":{"x":2560,"y":1600}},{"A":{"x":2560,"y":1792},"B":{"x":2560,"y":1728}},{"A":{"x":2560,"y":1856},"B":{"x":2560,"y":1792}},{"A":{"x":2624,"y":1856},"B":{"x":2560,"y":1856}},{"A":{"x":2560,"y":2496},"B":{"x":2624,"y":2496}},{"A":{"x":2560,"y":2560},"B":{"x":2560,"y":2496}},{"A":{"x":2560,"y":2624},"B":{"x":2560,"y":2560}},{"A":{"x":2624,"y":2624},"B":{"x":2560,"y":2624}},{"A":{"x":2560,"y":3072},"B":{"x":2624,"y":3072}},{"A":{"x":2560,"y":3136},"B":{"x":2560,"y":3072}},{"A":{"x":2560,"y":3392},"B":{"x":2560,"y":3328}},{"A":{"x":2624,"y":3328},"B":{"x":2624,"y":3392}},{"A":{"x":2624,"y":3392},"B":{"x":2560,"y":3392}},{"A":{"x":2560,"y":3584},"B":{"x":2624,"y":3584}},{"A":{"x":2560,"y":3648},"B":{"x":2560,"y":3584}},{"A":{"x":2688,"y":64},"B":{"x":2624,"y":64}},{"A":{"x":2624,"y":384},"B":{"x":2688,"y":384}},{"A":{"x":2688,"y":768},"B":{"x":2624,"y":768}},{"A":{"x":2624,"y":1344},"B":{"x":2688,"y":1344}},{"A":{"x":2624,"y":1408},"B":{"x":2624,"y":1344}},{"A":{"x":2624,"y":1920},"B":{"x":2624,"y":1856}},{"A":{"x":2624,"y":1984},"B":{"x":2624,"y":1920}},{"A":{"x":2624,"y":2048},"B":{"x":2624,"y":1984}},{"A":{"x":2624,"y":2112},"B":{"x":2624,"y":2048}},{"A":{"x":2688,"y":2112},"B":{"x":2624,"y":2112}},{"A":{"x":2624,"y":2432},"B":{"x":2688,"y":2432}},{"A":{"x":2624,"y":2496},"B":{"x":2624,"y":2432}},{"A":{"x":2624,"y":2688},"B":{"x":2624,"y":2624}},{"A":{"x":2688,"y":2688},"B":{"x":2624,"y":2688}},{"A":{"x":2624,"y":2880},"B":{"x":2688,"y":2880}},{"A":{"x":2624,"y":2944},"B":{"x":2624,"y":2880}},{"A":{"x":2624,"y":3008},"B":{"x":2624,"y":2944}},{"A":{"x":2624,"y":3072},"B":{"x":2624,"y":3008}},{"A":{"x":2688,"y":3264},"B":{"x":2688,"y":3328}},{"A":{"x":2688,"y":3328},"B":{"x":2624,"y":3328}},{"A":{"x":2624,"y":3520},"B":{"x":2688,"y":3520}},{"A":{"x":2624,"y":3584},"B":{"x":2624,"y":3520}},{"A":{"x":2752,"y":64},"B":{"x":2688,"y":64}},{"A":{"x":2688,"y":384},"B":{"x":2752,"y":384}},{"A":{"x":2752,"y":768},"B":{"x":2688,"y":768}},{"A":{"x":2688,"y":1280},"B":{"x":2752,"y":1280}},{"A":{"x":2688,"y":1344},"B":{"x":2688,"y":1280}},{"A":{"x":2752,"y":2112},"B":{"x":2688,"y":2112}},{"A":{"x":2688,"y":2432},"B":{"x":2752,"y":2432}},{"A":{"x":2688,"y":2752},"B":{"x":2688,"y":2688}},{"A":{"x":2688,"y":2816},"B":{"x":2688,"y":2752}},{"A":{"x":2688,"y":2880},"B":{"x":2688,"y":2816}},{"A":{"x":2752,"y":3200},"B":{"x":2752,"y":3264}},{"A":{"x":2752,"y":3264},"B":{"x":2688,"y":3264}},{"A":{"x":2688,"y":3520},"B":{"x":2752,"y":3520}},{"A":{"x":2752,"y":3520},"B":{"x":2752,"y":3584}},{"A":{"x":2816,"y":64},"B":{"x":2752,"y":64}},{"A":{"x":2752,"y":320},"B":{"x":2816,"y":320}},{"A":{"x":2752,"y":384},"B":{"x":2752,"y":320}},{"A":{"x":2816,"y":704},"B":{"x":2816,"y":768}},{"A":{"x":2816,"y":768},"B":{"x":2752,"y":768}},{"A":{"x":2752,"y":1280},"B":{"x":2816,"y":1280}},{"A":{"x":2816,"y":1792},"B":{"x":2816,"y":1856}},{"A":{"x":2816,"y":1856},"B":{"x":2816,"y":1920}},{"A":{"x":2816,"y":2112},"B":{"x":2752,"y":2112}},{"A":{"x":2752,"y":2432},"B":{"x":2816,"y":2432}},{"A":{"x":2816,"y":3200},"B":{"x":2752,"y":3200}},{"A":{"x":2752,"y":3584},"B":{"x":2816,"y":3584}},{"A":{"x":2816,"y":128},"B":{"x":2816,"y":64}},{"A":{"x":2880,"y":128},"B":{"x":2816,"y":128}},{"A":{"x":2816,"y":256},"B":{"x":2880,"y":256}},{"A":{"x":2816,"y":320},"B":{"x":2816,"y":256}},{"A":{"x":2880,"y":704},"B":{"x":2816,"y":704}},{"A":{"x":2816,"y":1216},"B":{"x":2880,"y":1216}},{"A":{"x":2816,"y":1280},"B":{"x":2816,"y":1216}},{"A":{"x":2880,"y":1728},"B":{"x":2880,"y":1792}},{"A":{"x":2880,"y":1792},"B":{"x":2816,"y":1792}},{"A":{"x":2816,"y":1920},"B":{"x":2880,"y":1920}},{"A":{"x":2880,"y":1920},"B":{"x":2880,"y":1984}},{"A":{"x":2880,"y":1984},"B":{"x":2880,"y":2048}},{"A":{"x":2816,"y":2176},"B":{"x":2816,"y":2112}},{"A":{"x":2880,"y":2176},"B":{"x":2816,"y":2176}},{"A":{"x":2816,"y":2432},"B":{"x":2880,"y":2432}},{"A":{"x":2880,"y":2944},"B":{"x":2880,"y":3008}},{"A":{"x":2880,"y":3008},"B":{"x":2880,"y":3072}},{"A":{"x":2880,"y":3200},"B":{"x":2816,"y":3200}},{"A":{"x":2816,"y":3584},"B":{"x":2880,"y":3584}},{"A":{"x":2880,"y":192},"B":{"x":2880,"y":128}},{"A":{"x":2880,"y":256},"B":{"x":2880,"y":192}},{"A":{"x":2944,"y":384},"B":{"x":2944,"y":448}},{"A":{"x":2944,"y":448},"B":{"x":2944,"y":512}},{"A":{"x":2944,"y":704},"B":{"x":2880,"y":704}},{"A":{"x":2880,"y":1088},"B":{"x":2944,"y":1088}},{"A":{"x":2880,"y":1152},"B":{"x":2880,"y":1088}},{"A":{"x":2880,"y":1216},"B":{"x":2880,"y":1152}},{"A":{"x":2944,"y":1344},"B":{"x":2944,"y":1408}},{"A":{"x":2944,"y":1408},"B":{"x":2944,"y":1472}},{"A":{"x":2944,"y":1472},"B":{"x":2944,"y":1536}},{"A":{"x":2944,"y":1728},"B":{"x":2880,"y":1728}},{"A":{"x":2880,"y":2048},"B":{"x":2944,"y":2048}},{"A":{"x":2944,"y":2048},"B":{"x":2944,"y":2112}},{"A":{"x":2880,"y":2240},"B":{"x":2880,"y":2176}},{"A":{"x":2944,"y":2240},"B":{"x":2880,"y":2240}},{"A":{"x":2880,"y":2432},"B":{"x":2944,"y":2432}},{"A":{"x":2944,"y":2880},"B":{"x":2944,"y":2944}},{"A":{"x":2944,"y":2944},"B":{"x":2880,"y":2944}},{"A":{"x":2880,"y":3072},"B":{"x":2944,"y":3072}},{"A":{"x":2944,"y":3072},"B":{"x":2944,"y":3136}},{"A":{"x":2880,"y":3264},"B":{"x":2880,"y":3200}},{"A":{"x":2944,"y":3264},"B":{"x":2880,"y":3264}},{"A":{"x":2880,"y":3584},"B":{"x":2944,"y":3584}},{"A":{"x":3008,"y":320},"B":{"x":3008,"y":384}},{"A":{"x":3008,"y":384},"B":{"x":2944,"y":384}},{"A":{"x":2944,"y":512},"B":{"x":3008,"y":512}},{"A":{"x":3008,"y":512},"B":{"x":3008,"y":576}},{"A":{"x":2944,"y":768},"B":{"x":2944,"y":704}},{"A":{"x":3008,"y":768},"B":{"x":2944,"y":768}},{"A":{"x":2944,"y":1088},"B":{"x":3008,"y":1088}},{"A":{"x":3008,"y":1088},"B":{"x":3008,"y":1152}},{"A":{"x":3008,"y":1280},"B":{"x":3008,"y":1344}},{"A":{"x":3008,"y":1344},"B":{"x":2944,"y":1344}},{"A":{"x":2944,"y":1536},"B":{"x":3008,"y":1536}},{"A":{"x":3008,"y":1536},"B":{"x":3008,"y":1600}},{"A":{"x":3008,"y":1728},"B":{"x":2944,"y":1728}},{"A":{"x":2944,"y":2112},"B":{"x":3008,"y":2112}},{"A":{"x":3008,"y":2112},"B":{"x":3008,"y":2176}},{"A":{"x":3008,"y":2176},"B":{"x":3008,"y":2240}},{"A":{"x":3008,"y":2240},"B":{"x":2944,"y":2240}},{"A":{"x":2944,"y":2368},"B":{"x":3008,"y":2368}},{"A":{"x":2944,"y":2432},"B":{"x":2944,"y":2368}},{"A":{"x":3008,"y":2496},"B":{"x":3008,"y":2560}},{"A":{"x":3008,"y":2560},"B":{"x":3008,"y":2624}},{"A":{"x":3008,"y":2624},"B":{"x":3008,"y":2688}},{"A":{"x":3008,"y":2816},"B":{"x":3008,"y":2880}},{"A":{"x":3008,"y":2880},"B":{"x":2944,"y":2880}},{"A":{"x":2944,"y":3136},"B":{"x":3008,"y":3136}},{"A":{"x":2944,"y":3328},"B":{"x":2944,"y":3264}},{"A":{"x":3008,"y":3328},"B":{"x":2944,"y":3328}},{"A":{"x":2944,"y":3584},"B":{"x":3008,"y":3584}},{"A":{"x":3072,"y":320},"B":{"x":3008,"y":320}},{"A":{"x":3008,"y":576},"B":{"x":3072,"y":576}},{"A":{"x":3072,"y":576},"B":{"x":3072,"y":640}},{"A":{"x":3008,"y":832},"B":{"x":3008,"y":768}},{"A":{"x":3072,"y":832},"B":{"x":3008,"y":832}},{"A":{"x":3008,"y":1152},"B":{"x":3072,"y":1152}},{"A":{"x":3072,"y":1152},"B":{"x":3072,"y":1216}},{"A":{"x":3072,"y":1216},"B":{"x":3072,"y":1280}},{"A":{"x":3072,"y":1280},"B":{"x":3008,"y":1280}},{"A":{"x":3008,"y":1600},"B":{"x":3072,"y":1600}},{"A":{"x":3072,"y":1600},"B":{"x":3072,"y":1664}},{"A":{"x":3072,"y":1664},"B":{"x":3072,"y":1728}},{"A":{"x":3072,"y":1728},"B":{"x":3008,"y":1728}},{"A":{"x":3008,"y":2048},"B":{"x":3072,"y":2048}},{"A":{"x":3008,"y":2112},"B":{"x":3008,"y":2048}},{"A":{"x":3072,"y":2112},"B":{"x":3008,"y":2112}},{"A":{"x":3008,"y":2368},"B":{"x":3072,"y":2368}},{"A":{"x":3072,"y":2432},"B":{"x":3072,"y":2496}},{"A":{"x":3072,"y":2496},"B":{"x":3008,"y":2496}},{"A":{"x":3008,"y":2688},"B":{"x":3072,"y":2688}},{"A":{"x":3072,"y":2688},"B":{"x":3072,"y":2752}},{"A":{"x":3072,"y":2752},"B":{"x":3072,"y":2816}},{"A":{"x":3072,"y":2816},"B":{"x":3008,"y":2816}},{"A":{"x":3008,"y":3136},"B":{"x":3072,"y":3136}},{"A":{"x":3072,"y":3136},"B":{"x":3072,"y":3200}},{"A":{"x":3072,"y":3200},"B":{"x":3072,"y":3264}},{"A":{"x":3072,"y":3264},"B":{"x":3072,"y":3328}},{"A":{"x":3008,"y":3392},"B":{"x":3008,"y":3328}},{"A":{"x":3008,"y":3456},"B":{"x":3008,"y":3392}},{"A":{"x":3072,"y":3456},"B":{"x":3008,"y":3456}},{"A":{"x":3008,"y":3520},"B":{"x":3072,"y":3520}},{"A":{"x":3008,"y":3584},"B":{"x":3008,"y":3520}},{"A":{"x":3136,"y":320},"B":{"x":3072,"y":320}},{"A":{"x":3072,"y":640},"B":{"x":3136,"y":640}},{"A":{"x":3072,"y":896},"B":{"x":3072,"y":832}},{"A":{"x":3136,"y":896},"B":{"x":3072,"y":896}},{"A":{"x":3072,"y":1920},"B":{"x":3136,"y":1920}},{"A":{"x":3072,"y":1984},"B":{"x":3072,"y":1920}},{"A":{"x":3072,"y":2048},"B":{"x":3072,"y":1984}},{"A":{"x":3136,"y":2048},"B":{"x":3136,"y":2112}},{"A":{"x":3136,"y":2112},"B":{"x":3072,"y":2112}},{"A":{"x":3072,"y":2304},"B":{"x":3136,"y":2304}},{"A":{"x":3072,"y":2368},"B":{"x":3072,"y":2304}},{"A":{"x":3136,"y":2432},"B":{"x":3072,"y":2432}},{"A":{"x":3072,"y":3328},"B":{"x":3136,"y":3328}},{"A":{"x":3136,"y":3328},"B":{"x":3136,"y":3392}},{"A":{"x":3072,"y":3520},"B":{"x":3072,"y":3456}},{"A":{"x":3136,"y":384},"B":{"x":3136,"y":320}},{"A":{"x":3200,"y":384},"B":{"x":3136,"y":384}},{"A":{"x":3136,"y":640},"B":{"x":3200,"y":640}},{"A":{"x":3200,"y":896},"B":{"x":3136,"y":896}},{"A":{"x":3136,"y":1856},"B":{"x":3200,"y":1856}},{"A":{"x":3136,"y":1920},"B":{"x":3136,"y":1856}},{"A":{"x":3200,"y":1984},"B":{"x":3200,"y":2048}},{"A":{"x":3200,"y":2048},"B":{"x":3136,"y":2048}},{"A":{"x":3136,"y":2240},"B":{"x":3200,"y":2240}},{"A":{"x":3136,"y":2304},"B":{"x":3136,"y":2240}},{"A":{"x":3200,"y":2432},"B":{"x":3136,"y":2432}},{"A":{"x":3136,"y":3392},"B":{"x":3200,"y":3392}},{"A":{"x":3200,"y":448},"B":{"x":3200,"y":384}},{"A":{"x":3264,"y":448},"B":{"x":3200,"y":448}},{"A":{"x":3200,"y":576},"B":{"x":3264,"y":576}},{"A":{"x":3200,"y":640},"B":{"x":3200,"y":576}},{"A":{"x":3264,"y":832},"B":{"x":3264,"y":896}},{"A":{"x":3264,"y":896},"B":{"x":3200,"y":896}},{"A":{"x":3200,"y":1856},"B":{"x":3264,"y":1856}},{"A":{"x":3264,"y":1856},"B":{"x":3264,"y":1920}},{"A":{"x":3264,"y":1920},"B":{"x":3264,"y":1984}},{"A":{"x":3264,"y":1984},"B":{"x":3200,"y":1984}},{"A":{"x":3200,"y":2240},"B":{"x":3264,"y":2240}},{"A":{"x":3200,"y":2496},"B":{"x":3200,"y":2432}},{"A":{"x":3264,"y":2496},"B":{"x":3200,"y":2496}},{"A":{"x":3200,"y":3392},"B":{"x":3264,"y":3392}},{"A":{"x":3328,"y":320},"B":{"x":3328,"y":384}},{"A":{"x":3328,"y":384},"B":{"x":3328,"y":448}},{"A":{"x":3264,"y":512},"B":{"x":3264,"y":448}},{"A":{"x":3264,"y":576},"B":{"x":3264,"y":512}},{"A":{"x":3328,"y":768},"B":{"x":3328,"y":832}},{"A":{"x":3328,"y":832},"B":{"x":3264,"y":832}},{"A":{"x":3264,"y":2176},"B":{"x":3328,"y":2176}},{"A":{"x":3264,"y":2240},"B":{"x":3264,"y":2176}},{"A":{"x":3264,"y":2560},"B":{"x":3264,"y":2496}},{"A":{"x":3264,"y":2624},"B":{"x":3264,"y":2560}},{"A":{"x":3264,"y":2688},"B":{"x":3264,"y":2624}},{"A":{"x":3328,"y":2688},"B":{"x":3264,"y":2688}},{"A":{"x":3264,"y":3392},"B":{"x":3328,"y":3392}},{"A":{"x":3392,"y":256},"B":{"x":3392,"y":320}},{"A":{"x":3392,"y":320},"B":{"x":3328,"y":320}},{"A":{"x":3328,"y":448},"B":{"x":3392,"y":448}},{"A":{"x":3392,"y":448},"B":{"x":3392,"y":512}},{"A":{"x":3392,"y":704},"B":{"x":3392,"y":768}},{"A":{"x":3392,"y":768},"B":{"x":3328,"y":768}},{"A":{"x":3328,"y":1600},"B":{"x":3392,"y":1600}},{"A":{"x":3328,"y":1664},"B":{"x":3328,"y":1600}},{"A":{"x":3328,"y":1728},"B":{"x":3328,"y":1664}},{"A":{"x":3392,"y":1728},"B":{"x":3328,"y":1728}},{"A":{"x":3328,"y":2176},"B":{"x":3392,"y":2176}},{"A":{"x":3392,"y":2432},"B":{"x":3392,"y":2496}},{"A":{"x":3392,"y":2496},"B":{"x":3392,"y":2560}},{"A":{"x":3392,"y":2688},"B":{"x":3328,"y":2688}},{"A":{"x":3328,"y":3328},"B":{"x":3392,"y":3328}},{"A":{"x":3328,"y":3392},"B":{"x":3328,"y":3328}},{"A":{"x":3456,"y":256},"B":{"x":3392,"y":256}},{"A":{"x":3392,"y":512},"B":{"x":3456,"y":512}},{"A":{"x":3456,"y":704},"B":{"x":3392,"y":704}},{"A":{"x":3392,"y":1600},"B":{"x":3456,"y":1600}},{"A":{"x":3392,"y":1792},"B":{"x":3392,"y":1728}},{"A":{"x":3392,"y":1856},"B":{"x":3392,"y":1792}},{"A":{"x":3392,"y":1920},"B":{"x":3392,"y":1856}},{"A":{"x":3456,"y":1920},"B":{"x":3392,"y":1920}},{"A":{"x":3392,"y":2176},"B":{"x":3456,"y":2176}},{"A":{"x":3456,"y":2176},"B":{"x":3456,"y":2240}},{"A":{"x":3456,"y":2240},"B":{"x":3456,"y":2304}},{"A":{"x":3456,"y":2304},"B":{"x":3456,"y":2368}},{"A":{"x":3456,"y":2368},"B":{"x":3456,"y":2432}},{"A":{"x":3456,"y":2432},"B":{"x":3392,"y":2432}},{"A":{"x":3392,"y":2560},"B":{"x":3456,"y":2560}},{"A":{"x":3456,"y":2560},"B":{"x":3456,"y":2624}},{"A":{"x":3456,"y":2624},"B":{"x":3456,"y":2688}},{"A":{"x":3456,"y":2688},"B":{"x":3392,"y":2688}},{"A":{"x":3392,"y":3328},"B":{"x":3456,"y":3328}},{"A":{"x":3520,"y":256},"B":{"x":3456,"y":256}},{"A":{"x":3456,"y":512},"B":{"x":3520,"y":512}},{"A":{"x":3520,"y":704},"B":{"x":3456,"y":704}},{"A":{"x":3456,"y":1600},"B":{"x":3520,"y":1600}},{"A":{"x":3456,"y":1984},"B":{"x":3456,"y":1920}},{"A":{"x":3520,"y":1984},"B":{"x":3456,"y":1984}},{"A":{"x":3456,"y":3328},"B":{"x":3520,"y":3328}},{"A":{"x":3520,"y":320},"B":{"x":3520,"y":256}},{"A":{"x":3584,"y":320},"B":{"x":3520,"y":320}},{"A":{"x":3520,"y":448},"B":{"x":3584,"y":448}},{"A":{"x":3520,"y":512},"B":{"x":3520,"y":448}},{"A":{"x":3520,"y":768},"B":{"x":3520,"y":704}},{"A":{"x":3584,"y":768},"B":{"x":3520,"y":768}},{"A":{"x":3520,"y":1024},"B":{"x":3584,"y":1024}},{"A":{"x":3520,"y":1088},"B":{"x":3520,"y":1024}},{"A":{"x":3520,"y":1152},"B":{"x":3520,"y":1088}},{"A":{"x":3584,"y":1152},"B":{"x":3520,"y":1152}},{"A":{"x":3520,"y":1536},"B":{"x":3584,"y":1536}},{"A":{"x":3520,"y":1600},"B":{"x":3520,"y":1536}},{"A":{"x":3520,"y":2048},"B":{"x":3520,"y":1984}},{"A":{"x":3584,"y":2048},"B":{"x":3520,"y":2048}},{"A":{"x":3520,"y":2496},"B":{"x":3584,"y":2496}},{"A":{"x":3520,"y":2560},"B":{"x":3520,"y":2496}},{"A":{"x":3584,"y":2560},"B":{"x":3520,"y":2560}},{"A":{"x":3520,"y":2880},"B":{"x":3584,"y":2880}},{"A":{"x":3520,"y":2944},"B":{"x":3520,"y":2880}},{"A":{"x":3520,"y":3008},"B":{"x":3520,"y":2944}},{"A":{"x":3520,"y":3072},"B":{"x":3520,"y":3008}},{"A":{"x":3520,"y":3136},"B":{"x":3520,"y":3072}},{"A":{"x":3584,"y":3136},"B":{"x":3520,"y":3136}},{"A":{"x":3520,"y":3328},"B":{"x":3584,"y":3328}},{"A":{"x":3584,"y":384},"B":{"x":3584,"y":320}},{"A":{"x":3584,"y":448},"B":{"x":3584,"y":384}},{"A":{"x":3584,"y":832},"B":{"x":3584,"y":768}},{"A":{"x":3584,"y":896},"B":{"x":3584,"y":832}},{"A":{"x":3584,"y":960},"B":{"x":3584,"y":896}},{"A":{"x":3584,"y":1024},"B":{"x":3584,"y":960}},{"A":{"x":3584,"y":1216},"B":{"x":3584,"y":1152}},{"A":{"x":3584,"y":1280},"B":{"x":3584,"y":1216}},{"A":{"x":3584,"y":1344},"B":{"x":3584,"y":1280}},{"A":{"x":3584,"y":1408},"B":{"x":3584,"y":1344}},{"A":{"x":3584,"y":1472},"B":{"x":3584,"y":1408}},{"A":{"x":3584,"y":1536},"B":{"x":3584,"y":1472}},{"A":{"x":3584,"y":2112},"B":{"x":3584,"y":2048}},{"A":{"x":3584,"y":2176},"B":{"x":3584,"y":2112}},{"A":{"x":3584,"y":2240},"B":{"x":3584,"y":2176}},{"A":{"x":3584,"y":2304},"B":{"x":3584,"y":2240}},{"A":{"x":3584,"y":2368},"B":{"x":3584,"y":2304}},{"A":{"x":3584,"y":2432},"B":{"x":3584,"y":2368}},{"A":{"x":3584,"y":2496},"B":{"x":3584,"y":2432}},{"A":{"x":3584,"y":2624},"B":{"x":3584,"y":2560}},{"A":{"x":3584,"y":2688},"B":{"x":3584,"y":2624}},{"A":{"x":3584,"y":2752},"B":{"x":3584,"y":2688}},{"A":{"x":3584,"y":2816},"B":{"x":3584,"y":2752}},{"A":{"x":3584,"y":2880},"B":{"x":3584,"y":2816}},{"A":{"x":3584,"y":3200},"B":{"x":3584,"y":3136}},{"A":{"x":3584,"y":3264},"B":{"x":3584,"y":3200}},{"A":{"x":3584,"y":3328},"B":{"x":3584,"y":3264}}]'