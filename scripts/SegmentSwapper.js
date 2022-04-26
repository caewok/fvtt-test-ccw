/* globals
game,
canvas,
foundry
*/

// Sweep algorithm but combine separate events where the points are equal

import { compareXY, compareYX } from "./utilities.js";
import { PriorityQueueArray } from "./PriorityQueueArray.js";
import { MODULE_ID, UseBinary } from "./module.js";
import { OrderedArray } from "./OrderedArray.js";
import { binaryFindIndex, binaryIndexOf } from "./BinarySearch.js";
import { drawVertex, drawEdge, COLORS, clearLabels, labelVertex } from "./Drawing.js";
import { EventType, hashSegments } from "./IntersectionsSweep.js";


export function findIntersectionsSweepCombinedSwapSingle(segments, reportFn = (e1, e2, ix) => {}) {
  // id the segments for testing
  const debug = game.modules.get(MODULE_ID).api.debug;

  if(debug) {
    canvas.controls.debug.clear();
    clearLabels();
    segments.forEach(s => drawEdge(s, COLORS.black));
    segments.forEach(s => labelVertex(s.nw, s.id));
  }

  let tracker = new Set(); // to note pairs for which intersection is checked already
  let tree = new SegmentSwapper(); // pretend this is actually a tree
  let e = new EventQueue(segments);

  let num_ixs = 0; // mainly for testing

  // traverse the queue
  let curr;
  while(curr = e.next()) {
// console.table(tree.data, ["_id"])
//     curr = e.next()

    if(debug) {
      console.log(`${Object.getOwnPropertyNames(EventType)[curr.eventType]} event; Sweep at x = ${curr.point.x}.`);
      console.log(`\tEvent Queue: ${e.data.length}; Tree: ${tree.data.length}`, e.data, tree.inorder());
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

    if(debug) { console.table(tree.inorder(), ["_id", "_idx"]); }
    if(debug) { console.table(e.data, ["type", "segments"]); }

  }

  return num_ixs;
}

function handleLeftEvent(curr, e, tree, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;
  let sweep_x = curr.point.x;

  // insert each left segment
  let segmentSet = curr.segments;
  segmentSet.forEach(s => {
    tree.insert(s);
    if(debug) {
      console.log(`\tAdding ${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`);
      drawEdge(s);
    }
  });

  if(segmentSet.size > 1) {
    // if there is more than one segment to add, we know they all intersect at this point.
    // add an intersection event that will be called next
    // (it will also swap/reverse these segments and then test the above/below)
    // (if not doing this, then need to handle the above/below ix test)
    const event_ix = new EventTypeClass(curr.point, EventType.Intersection, [...segmentSet]);
    e.insert(event_ix);
  } else {
    // find the above/below values for the single segment added
    let [s0] = segmentSet;
    let below = tree.below(s0);
    let above = tree.above(s0);

    if(below) { num_ixs += checkForIntersection(below, s0, e, tracker, curr.point); }
    if(above) { num_ixs += checkForIntersection(above, s0, e, tracker, curr.point); }
  }

  return num_ixs;
}

function handleIntersectionEvent(curr, e, tree, tracker, reportFn) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;
  let segmentSet = curr.segments;

  if(debug) {
    console.log(`\tIntersection event ${curr.point.x},${curr.point.y}`);
    drawVertex(curr.point);

  }

  // report intersection
  // for now, if multiple segments, report every combination

  let segmentArr = [...segmentSet];
  let ln = segmentArr.length;
  for(let i = 0; i < ln; i += 1) {
    const si = segmentArr[i];
    for(let j = (i + 1); j < ln; j += 1) {
      const sj = segmentArr[j];
      if(debug) { console.log(`\tReporting ${si.nw.x},${si.nw.y}|${si.se.x},${si.se.y} x ${sj.nw.x},${sj.nw.y}|${sj.se.x},${sj.se.y}`); }
      reportFn(si, sj, curr.point);
    }
  }

  // reverse or swap the segments
  if(debug) { console.log(`\tSwapping ${segmentSet.size} segments.`); }
  let res;
  if(segmentArr.length === 2) {
    tree.swap(segmentArr[0], segmentArr[1]);
    res = segmentSpread(segmentSet, tree);
  } else {
    res = reverseSegments(segmentSet, tree);
  }
  let { above, below, top, bottom } = res;

  // check for intersection between the upper segment and above
  // and between lower segment and below (after the swap/reversal)
  if(below) { num_ixs += checkForIntersection(below, bottom, e, tracker, curr.point); }
  if(above) { num_ixs += checkForIntersection(above, top, e, tracker, curr.point); }

  return num_ixs;
}

function handleRightEvent(curr, e, tree, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;

  let num_ixs = 0;

  // curr point is right of its segment
  // check if predecessor and successor intersect with each other

  // for each segment ending at this point:
  // 1. Get the index of one of the segments
  // 2. For each index less than that, it is either another ending segment or the predecessor
  // 3. For each index greater than that, it is either another ending segment or the successor
  // 4. check successor and predecessor for ix
  // 5. delete all ending segments

  let segmentSet = curr.segments;
  if(debug) { console.log(`\tRight endpoint event for ${segmentSet.size} segments.`); }
  let { above, below } = segmentSpread(segmentSet, tree);

  if(below && above) { num_ixs += checkForIntersection(below, above, e, tracker, curr.point); }
  for(const s of segmentSet) {
    if(debug) {
      console.log(`\tDeleting ${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`);
      drawEdge(s, COLORS.red);
    }

    tree.remove(s);
  }

  // do we need to delete associated ix events? (Hopefully not; that may be hard.)
  // probably handled by the tracker eliminating ix overlap

  return num_ixs;
}

// assume the segmentSet contains adjacent segments in the list
// reverse by repeatedly calling swap from outside in on sorted set of segments
function reverseSegments(segmentSet, tree) {
  // sort in a stupidly simple way -- walk the array from a given segment
  sortedArr = [];
  let [above] = segmentSet;

  let max_iterations = 10_000;
  let iter = 0;
  iter = 0;
  while(segmentSet.has(below) && iter < max_iterations) {
    iter += 1;
    sortedArr.below.push()
    below = tree.below(below);
  }
  sortedArr.reverse();

  while(segmentSet.has(above) && iter < max_iterations) {
    iter += 1
    sortedArr.push(above);
    above = tree.above(above);
  }
  if(iter >= max_iterations) { console.error("segmentSpread: max iterations exceeded."); }

  // process outside in
  let ln = segmentsArr.length;
  for(let i = 0, j = ln - 1; i < j; i += 1, j -= 1) {
    ll.swap(sortedArr[i], sortedArr[j]);
  }

  let top = sortedArr[0];
  let bottom = sortedArr[ln - 1];

  return { above, below, top, bottom };
}


// assume the segmentSet contains adjacent segments in the list,
// find the above/below segments
// bracketing the set in the list by simple walk
function segmentSpread(segmentSet, tree) {
  let [above] = segmentSet;
  let below = above;
  let top = below;
  let bottom = below;

  let max_iterations = 10_000;
  let iter = 0;

  while(segmentSet.has(above) && iter < max_iterations) {
    iter += 1;
    top = above;
    above = tree.above(above);
  }

  while(segmentSet.has(below) && iter < max_iterations) {
    iter += 1;
    bottom = below;
    below = tree.below(below);
  }
  if(iter >= max_iterations) { console.error("segmentSpread: max iterations exceeded."); }


  return { above, below, top, bottom };

}


function checkForIntersection(s1, s2, e, tracker, sweep_pt) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;
//   const hash = hashSegments(s1, s2);
//   const hash_rev = hashSegments(s2, s1);
  if(//!tracker.has(hash) &&
    foundry.utils.lineSegmentIntersects(s1.A, s1.B, s2.A, s2.B)) {
    num_ixs += 1;

    // for testing

    const ix = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
    if(!ix) return num_ixs; // likely collinear lines

    // check if intersection is in the past and thus already found
    // past meaning the sweep has already past the intersection
    if(compareXY(sweep_pt, ix) > 0 ) { return num_ixs; } // intersection is in the past

    if(debug) {
      console.log(`\tIntersection found at ${ix.x},${ix.y}`);
      drawVertex(ix, COLORS.lightred, .5);
    }

    const event_ix = new EventTypeClass(ix, EventType.Intersection, [s1, s2]);
    e.insert(event_ix);
//     tracker.add(hash);
//     tracker.add(hash_rev);
  } //else {
//     if(debug) {
//       const ix = foundry.utils.lineSegmentIntersection(s1.A, s1.B, s2.A, s2.B);
//       if(ix) { console.log(`Would have added duplicate ix event for ${ix.x},${ix.y}`); }
//     }
//  }

  return num_ixs;
}



// Imagine the nw endpoint of each segment creates a horizontal line
// across the canvas.
// Now, a point between those two lines must be between the segments, unless and until
// the segments cross.
// Segment swapper mimics this, by storing an array of active segments and
// tracking swaps, next, and prev of each segment using pointers on the segment.
class SegmentSwapper extends OrderedArray {
  constructor() {
    super(compareYX);
  }

  above(s) { return s._above; }
  below(s) { return s._below; }


  inorder() {
    if(tree.data.length === 0) { return []; }

    let orderedArr = [];
    let s = this.data[0];
    let max_iterations = 10_000;
    let iter = 0;
    while(s && iter < max_iterations) {
      iter += 1;
      orderedArr.push(s);
      s = this.above(s);
    }
    if(iter >= max_iterations) { console.error("Max iterations hit for inorder."); }
    orderedArr.reverse();

    s = tree.below(this.data[0]); // already added data[0] above
    iter = 0;
    while(s && iter < max_iterations) {
      iter += 1;
      orderedArr.push(s);
      s = this.below(s);
    }
    if(iter >= max_iterations) { console.error("Max iterations hit for inorder."); }
    return orderedArr;
  }


  insert(s) {
    let self = this;
    s._swap = s;

    // Base case
    if(self.data.length === 0) {
      self.data.push(s);
      s._above = null;
      s._below = null;
      s._idx = 0;
      return;
    }

    // insert the segment into the array based on Y position
    // then determine its above/below partners
    let idx = self.binaryInsert(s);
    let above = self.predecessor(idx);
    let below = self.successor(idx);

    above && (above._swap._below = s);
    below && (below._swap._above = s);
    s._above = above && above._swap;
    s._below = below && below._swap;

    // TO-DO: adjust for when s.nw is before the adjacent segment has crossed s
    // When can this happen? Only after a swap?
  }

  swap(s1, s2) {
    // Cannot swap the indices because that would make it impossible to binary search
    // the data array without overly complicating the search.
    // Instead, track links for what has been swapped from the original.

    // update adjacent segments to point back to the correct segment after the swap
    if(s1._below === s2._swap) {
      // below -- s2 -- s1 -- above
      s2._below && (s2._below._above = s1._swap);
      s1._above && (s1._above._below = s2._swap);

      [s1._above, s2._above] = [s2._swap, s1._above];
      [s1._below, s2._below] = [s2._below, s1._swap];

    } else if(s1._above === s2._swap) {
      // below -- s1 -- s2 -- above
      s1._below && (s1._below._above = s2._swap);
      s2._above && (s2._above._below = s1._swap);

      [s1._above, s2._above] = [s2._above, s1._swap];
      [s1._below, s2._below] = [s2._swap, s1._below];


    } else {
      // below -- s1 -- above ... below -- s2 -- above or vice-versa
      s1._below && (s1._below._above = s2._swap);
      s1._above && (s1._above._below = s2._swap);

      s2._below && (s2._below._above = s1._swap);
      s2._above && (s2._above._below = s1._swap);

      [s1._above, s2._above] = [s2._above, s1._above];
      [s1._below, s2._below] = [s2._below, s1._below];
    }

    [s1._swap, s2._swap] = [s2._swap, s1._swap];
  }

  remove(s) {
    // adjust pointers
    s._above && (s._above._below = s._below);
    s._below && (s._below._above = s._above);

    // either:
    // 1. this.data contains every segment and when we insert, we identify the segment
    //    But when inserting, getting next, getting prev, we would need to skip over
    //    inactive segments. Could spend O(n) walking the list, which we are trying to
    //    avoid
    // 2. Do an O(log(n)) binary search for the index to remove
//     let idx = this.binaryIndexOf(s);
    this.removeAtIndex(s._idx);
    s._above = undefined;
    s._below = undefined;
    s._swap = undefined;
  }
}


class EventTypeClass {
  constructor(point, type, segments) {
    this.point = point;
    this.type = type;
    this.segments = new Set(segments);
  }

  get eventType() { return this.type; } // for backward compatibility

  add(segments) {
    segments.forEach(s => this.segments.add(s));
  }
}


// Needs to approximate a priority queue.
// In particular, it is possible for an intersection event to be added that would be
// the very next event, possibly several jumps in front of the current segment event
// had they been all sorted with the intersection event.

class EventQueue extends PriorityQueueArray {
  constructor(arr, { comparator = EventQueue.eventCmp,
                     sort = (arr, cmp) => arr.sort(cmp) } = {}) {

    // push all points to a vector of events
    const data = [];
    arr.forEach(s => {
      const e1 = new EventTypeClass(s.nw, EventType.Left, [s]);
      const e2 = new EventTypeClass(s.se, EventType.Right, [s]);
      data.push(e1, e2);
    });

    super(data, { comparator, sort });

    // combine events that share the same point
    let ln = this.data.length;
    let prev = this.data[0];
    let new_data = [];

    for(let i = 1; i < ln; i += 1) {
      const curr = this.data[i];
      const cmp_res = EventQueue.eventCmp(prev, curr);
      if(!cmp_res) {
        // points are equal; combine
        // curr.segments[curr.type] only works b/c we know curr type ≠ Combined
        // and must have a single segment
        prev.add([...curr.segments]);

      } else {
        new_data.push(prev);
        prev = curr;
      }
    }
    new_data.push(prev);
    this.data = new_data;
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

    // if the next event is the same point and type, combine
    const next = ~idx ? this.data[idx - 1] : this.data[this.data.length - 1];
    if(next && !EventQueue.eventCmp(event, next)) {
      next.add([...event.segments]);
    } else {
      this._insertAt(event, idx);
    }
  }
}