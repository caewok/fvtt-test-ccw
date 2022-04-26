/* globals
foundry

*/

// https://www.geeksforgeeks.org/given-a-set-of-line-segments-find-if-any-two-segments-intersect/
// Intersect lines using sweep

// Event object:
// pt, isLeft, index

/* testing
api = game.modules.get(`testccw`).api;
SimplePolygonEdge = api.SimplePolygonEdge;
findIntersectionsSingle = api.findIntersectionsSingle;
benchmarkLoopFn = api.benchmarkLoopFn


canvas.controls.debug.clear()
walls = [...canvas.walls.placeables]
segments = walls.map(w => SimplePolygonEdge.fromWall(w));

N = 100
await benchmarkLoopFn(N, findIntersectionsSingle, "brute sort", segments)
await benchmarkLoopFn(N, processIntersections, "sweep", segments)

Bench

function randomPoint(max_coord) {
  return { x: Math.floor(Math.random() * max_coord),
           y: Math.floor(Math.random() * max_coord) };
}
function randomSegment(max_coord = 5000) {
    return new SimplePolygonEdge(randomPoint(max_coord), randomPoint(max_coord));
}

function applyFn(fn, num_segments, max_coord) {
  segments = Array.fromRange(num_segments).map(i => randomSegment(max_coord))
  return fn(segments);
}

N = 100
num_segments = 1000
max_coord = Math.pow(2, 13)
await benchmarkLoopFn(N, applyFn, "brute sort", findIntersectionsSingle, num_segments, max_coord)
await benchmarkLoopFn(N, applyFn, "sweep", processIntersections, num_segments, max_coord)

num_segments = 10, 100, 1000
brute sort | 100 iterations | 4.2ms | 0.042ms per
sweep      | 100 iterations | 7.2ms | 0.07200000000000001ms per

brute sort | 100 iterations | 67ms | 0.67ms per
sweep      | 100 iterations | 183.6ms | 1.8359999999999999ms per

brute sort | 100 iterations | 5698.5ms | 56.985ms per
sweep      | 100 iterations | 67360.9ms | 673.6089999999999ms per

// with binaryFindIndex for EventQueue
brute sort | 100 iterations | 1.4ms | 0.013999999999999999ms per
sweep      | 100 iterations | 6ms | 0.06ms per

brute sort | 100 iterations | 58.2ms | 0.5820000000000001ms per
sweep      | 100 iterations | 83.2ms | 0.8320000000000001ms per

brute sort | 100 iterations | 5803.6ms | 58.036ms per
sweep      | 100 iterations | 2318.7ms | 23.186999999999998ms per

// with binaryFindIndex for EventQueue & NotATree
brute sort | 100 iterations | 1.2ms | 0.012ms per
sweep      | 100 iterations | 5.9ms | 0.059000000000000004ms per

brute sort | 100 iterations | 76.2ms | 0.762ms per
sweep      | 100 iterations | 60.5ms | 0.605ms per

brute sort | 100 iterations | 5670ms  | 56.7ms per
sweep      | 100 iterations | 836.2ms | 8.362ms per

// with binaryFindIndex and actually recording the intersections
brute sort | 100 iterations | 1.3ms | 0.013000000000000001ms per
sweep      | 100 iterations | 4ms   | 0.04ms per

brute sort | 100 iterations | 59.2ms | 0.5920000000000001ms per
sweep      | 100 iterations | 68.9ms | 0.6890000000000001ms per

brute sort | 100 iterations | 5668.5ms | 56.685ms per
sweep      | 100 iterations | 890.2ms  | 8.902000000000001ms per


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


export function processIntersections(segments, reportFn = (e1, e2, ix) => {}) {
  // id the segments for testing
 //  segments.forEach(s => drawEdge(s, COLORS.black))
//   segments.forEach(s => labelVertex(s.nw, s.id))

  let tracker = new Set(); // to note pairs for which intersection is checked already
  let tree = new NotATree(); // pretend this is actually a tree
  let e = new EventQueue(segments);

  let num_ixs = 0; // mainly for testing

  // traverse the queue
  let curr;
  while(curr = e.next()) {
// console.table(tree.data, ["_id"])
//     curr = e.next()
    console.log(`Sweep at x = ${curr.point.x}`);
    drawEdge({A: {x: curr.point.x, y: 0}, B: { x: curr.point.x, y: canvas.dimensions.height}}, COLORS.lightblue, alpha = .5)

    if(curr.isIx) {

      // report intersection
      reportFn(curr.segment1, curr.segment2, curr.point)
//       curr.segment1._identifyIntersectionsWith(curr.segment2);
            console.log(`\tIntersection event ${curr.point.x},${curr.point.y}`)
      drawVertex(curr.point)

      // swap A, B
        console.log(`\tSwapping ${curr.segment1.nw.x},${curr.segment1.nw.y}|${curr.segment1.se.x},${curr.segment1.se.y} and ${curr.segment2.nw.x},${curr.segment2.nw.y}|${curr.segment2.se.x},${curr.segment2.se.y}`)
        let [new_idx1, new_idx2] = tree.swap(curr.segment1, curr.segment2);
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

    } else if (curr.isLeft) {
      console.log(`\tLeft endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
      drawEdge(curr.segment)
      // get the above and below points
      let idx = tree.insert(curr.segment, curr.point.x);

      // check if curr intersects with its predecessor and successor
      // if we already checked this pair, we can skip
      let below = tree.belowIndex(idx);
      if(below) { num_ixs += checkForIntersection(below, curr.segment, e, tracker); }

      let above = tree.aboveIndex(idx);
      if(above) { num_ixs += checkForIntersection(above, curr.segment, e, tracker); }

    } else {
      console.log(`\tRight endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);

      // curr point is right of its segment
      // check if predecessor and successor intersect with each other
      let idx = tree.indexOf(curr.segment);
      if(!~idx) console.error("Segment not found", curr);
      let below = tree.belowIndex(idx);
      let above = tree.aboveIndex(idx);
      if(below && above) { num_ixs += checkForIntersection(below, above, e, tracker); }

      console.log(`\tDeleting ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
      drawEdge(curr.segment, COLORS.red)
      tree.deleteAtIndex(idx);
      // do we need to delete associated ix events? (Hopefully not; that may be hard.)

    }

  }

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
//   indexOf(segment) {
//     // trick: if segment._tmp_nw is undefined, it either has not been
//     // added or has already been removed. See insert and delete
//     // Must catch this case to avoid throwing error on _segmentIndexCompareYX
//     // which would otherwise try to access the undefined ._tmp_nw to compare
//     if(!segment._tmp_nw) { return -1; }
//     return binaryIndexOf(this.data, segment, this._segmentIndexCompareYX);
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
    segment._tmp_se = segment.se;

    // find first element that has larger y than the segment
    // note that segmentCompareYX is using the current sweep location to calculate
    // points of comparison
//     const idx = this.data.findIndex(elem => this._segmentCompareYX(segment, elem, sweep_x));
    const idx = binaryFindIndex(this.data, elem => this._segmentCompareYX(segment, elem, sweep_x));

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

  swap(segment1, segment2) {
    // find their indices
    const idx1 = this.indexOf(segment1);
    const idx2 = this.indexOf(segment2);

    if(!~idx1 || !~idx2) {
//       console.warn("swap segments not found.");
      return [undefined, undefined];
    }

    // change their temporary values (only *after* finding their current index)
    [ segment2._tmp_nw, segment1._tmp_nw ] = [ segment1._tmp_nw, segment2._tmp_nw ];
    [ segment2._tmp_se, segment1._tmp_se ] = [ segment1._tmp_se, segment2._tmp_se ];

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
      console.log(`Attempted deleteAtIndex ${idx} with data length ${this.data.length}`, this.data)
      return;
    }

    this.data[idx]._tmp_nw = undefined;
    this.data[idx]._tmp_se = undefined
    this.data.splice(idx, 1);
  }

  _segmentIndexCompareYX(s1, s2) {
    return -compareYX(s1._tmp_nw, s2._tmp_nw) || compareYX(s1._tmp_se, s2._tmp_se);
  }

  _segmentCompareYX(segment, elem, sweep_x) {
    // must use the current sweep location to set nw for each existing element
    const new_pt_e = pointForSegmentGivenX(elem, sweep_x);
    if(new_pt_e) elem._tmp_nw = new_pt_e;

    const cmp_nw = compareYX(segment._tmp_nw, elem._tmp_nw);
    if(cmp_nw) return cmp_nw < 0;

    // segments share nw endpoint. Compare using se endpoint, but
    // it must be arranged opposite. So more nw means sorted later.
    // (as if we extended the segments in the nw direction past their endpoints---
    //  how would they sort given those new nw extended endpoints?)
    const cmp_se = compareYX(segment._tmp_se, elem._tmp_se);
    return cmp_se > 0;
  }
}

function pointForSegmentGivenX(s, x) {
  const denom = s.B.x - s.A.x;
  if(!denom) return undefined;

  return { x: x, y: ((s.B.y - s.A.y) / denom * (x - s.A.x)) + s.A.y };
}


// Needs to approximate a priority queue.
// In particular, it is possible for an intersection event to be added that would be
// the very next event, possibly several jumps in front of the current segment event
// had they been all sorted with the intersection event.
class EventQueue {
  constructor(segments) {
    // push all points to a vector of events
    const data = [];
    segments.map(s => {
      data.push({ point: s.nw, isLeft: true, segment: s });
      data.push({ point: s.se, isLeft: false, segment: s });
    })

    // sort all events according to x then y coordinate
    // reverse so that we can pop
    data.sort((a, b) => -compareXY(a.point, b.point));

    this.data = data;
  }

  next() {
    return this.data.pop()
  }

  insert(event) {
//     const idx = this.data.findIndex(elem => compareXY(event.point, elem.point) > 0);
    const idx = binaryFindIndex(this.data, elem => compareXY(event.point, elem.point) > 0);
    // if index is -1, then e is the smallest x and is appended to end (will be first)
    // (this is different than how splice works for -1)
    ~idx ? this.data.splice(idx, undefined, event) : this.data.push(event);
  }
}


/**
 * Construct numeric index to represent unique pairing
 * digits_multiplier is Math.pow(10, numDigits(n));
 */
function hashSegments(s1, s2) {
  return "" + s1.nw.key + s1.se.key + s2.nw.key + s2.se.key
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

function binaryFindIndex(arr, callbackFn) {
  let start = 0, end = arr.length - 1, mid = -1;

  // need first index for which callbackFn returns true
  // progressively check until we have no items left.

  // Iterate, halving the search each time
  while (start <= end){
    // find the mid index
    mid = Math.floor((start + end) / 2);

    // determine if this index returns true
    const res = callbackFn(arr[mid], mid);

    if(res) {
      // if we found a true value, we can ignore everything after mid
      end = mid - 1;
    } else {
      // otherwise, the first true value must be after mid
      start = mid + 1;
    }
  }

  return mid;
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

function binaryIndexOf(arr, obj, cmpFn) {
  let start = 0; end = arr.length - 1;

  // iterate, halving the search each time
  while (start <= end) {
    const mid = Math.floor((start + end) / 2);
    const res = cmpFn(obj, arr[mid]);
    if(!res) return mid;

    if(res > 0) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return -1;
}



function checkForIntersection(s1, s2, e, tracker) {
  let num_ixs = 0
  const hash = hashSegments(s1, s2);
  const hash_rev = hashSegments(s2, s1);
  if(!(tracker.has(hash) || tracker.has(hash_rev)) &&
    foundry.utils.lineSegmentIntersects(s1.A, s1.B, s2.A, s2.B)) {
    num_ixs += 1;
//     s1._identifyIntersectionsWith(s2);

    // for testing

    const ix = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
    console.log(`\tIntersection found at ${ix.x},${ix.y}`)
    drawVertex(ix, COLORS.lightred, .5);

    const event_ix = {
      point: ix,
      isIx: true,
      segment1: s1,
      segment2: s2
    }
    e.insert(event_ix);

  }
  tracker.add(hash);
  return num_ixs;
}



