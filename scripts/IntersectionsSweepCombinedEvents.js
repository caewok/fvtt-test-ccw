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
import { EventType, hashSegments, pointForSegmentGivenX, SegmentArray } from "./IntersectionsSweep.js";


export function findIntersectionsSweepCombinedSingle(segments, reportFn = (e1, e2, ix) => {}) {
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

  // insert each left segment and get their indices
  // then get above/below the min/max indices
  let max_idx = Number.NEGATIVE_INFINITY;
  let min_idx = Number.POSITIVE_INFINITY;
  for(const s of curr.segments) {
    if(debug) {
      console.log(`\tLeft endpoint event for ${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`);
      drawEdge(s);
    }

    const idx = tree.insert(s, curr.point.x);
    max_idx = Math.max(max_idx, idx);
    min_idx = Math.min(min_idx, idx);
  }

  // check if curr intersects with its predecessor and successor
  // if we already checked this pair, we can skip
  let below = tree.successor(max_idx); // below means higher index, so successor
  let bottom_segment = tree.atIndex(max_idx);
  if(below) { num_ixs += checkForIntersection(below, bottom_segment, e, tracker); }

  let above = tree.predecessor(min_idx);
  let top_segment = tree.atIndex(max_idx);
  if(above) { num_ixs += checkForIntersection(above, top_segment, e, tracker); }

  return num_ixs;
}

function handleIntersectionEvent(curr, e, tree, tracker, reportFn) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;

  // report intersection
  // for now, if multiple segments, report every combination
  let segmentSet = curr.segments;
  let segmentArr = [...segmentSet];
  let ln = segmentArr.length;
  for(let i = 0; i < ln; i += 1) {
    const si = segmentArr[i];
    for(let j = (i + 1); j < ln; j += 1) {
      const sj = segmentArr[j];
      reportFn(si, sj, curr.point);
    }
  }

  // find all intersecting indices and the bracketing segments
  let [s0] = segmentSet;
  let idx = sweepIndex(s0, curr.point.x, tree);
  let { above, below, min_idx, max_idx } = segmentIndexSpread(segmentSet, idx, tree);


  if(debug) {
    console.log(`\tIntersection event ${curr.point.x},${curr.point.y}`);
    drawVertex(curr.point);
    console.log(`\tSwapping ${segmentSet.size} segments. First is ${s0.nw.x},${s0.nw.y}|${s0.se.x},${s0.se.y}`);
  }

  // reverse (swap) indices
  tree.reverseIndices(min_idx, max_idx);

  // check for intersection between the upper segment and above
  // and between lower segment and below (after the swap/reversal)
  const bottom_segment = tree.atIndex(max_idx);
  const top_segment = tree.atIndex(min_idx);
  if(below) { num_ixs += checkForIntersection(below, bottom_segment, e, tracker); }
  if(above) { num_ixs += checkForIntersection(above, top_segment, e, tracker); }

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
  let [s0] = segmentSet;
  let idx = sweepDeletionIndex(s0, curr.point.x, tree);
  let { indices, above, below } = segmentIndexSpread(segmentSet, idx, tree);

  if(debug) {
    console.log(`\tRight endpoint event for ${segmentSet.size} segments. First is ${s0.nw.x},${s0.nw.y}|${s0.se.x},${s0.se.y}`);

    for(const s of segmentSet) {
      console.log(`\tDeleting ${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`);
      drawEdge(s, COLORS.red);
    }
  }

  if(below && above) { num_ixs += checkForIntersection(below, above, e, tracker); }
  indices.forEach(idx => tree.deleteAtIndex(idx));

  // do we need to delete associated ix events? (Hopefully not; that may be hard.)
  // probably handled by the tracker eliminating ix overlap

  return num_ixs;
}

// assuming the segmentSet contains adjacent segments in the tree,
// find the range of indices in the set as well as the above/below segments
// bracketing the set in the ordered array
function segmentIndexSpread(segmentSet, startIndex, tree) {
  let indices = [startIndex];
  let min_idx = startIndex;
  let max_idx = startIndex;
  let above = tree.predecessor(startIndex);
  let below = tree.successor(startIndex);
  if(segmentSet.size > 1) {
    let above_incr = 1;
    let below_incr = 1;
    while(segmentSet.has(above)) {
      indices.push(startIndex - above_incr);
      min_idx = startIndex - above_incr;
      above_incr += 1;
      above = tree.predecessor(startIndex - above_incr);
    }

    while(segmentSet.has(below)) {
      indices.push(startIndex + below_incr);
      max_idx = startIndex + below_incr;
      below_incr += 1;
      below = tree.successor(startIndex + below_incr);
    }
  }

  return { indices, above, below, min_idx, max_idx };
}

function sweepIndex(s, sweep_x, tree) {
  const debug_binary = game.modules.get(MODULE_ID).api.debug_binary;
  let idx, idx_bin;
  switch(debug_binary) {
    case UseBinary.Yes:
      idx = tree.binaryIndexOf(s, sweep_x);
      break;

    case UseBinary.Test:
      idx = tree.indexOf(s);
      idx_bin = tree.binaryIndexOf(s, sweep_x);
      if(idx !== idx_bin) { console.warn(`index segment: idx bin ${idx_bin} ≠ ${idx} at sweep ${sweep_x}`); }
      break;

    case UseBinary.No:
      idx = tree.indexOf(s);
      break;
  }
  if(!~idx) console.error("Segment not found", s);
  return idx;
}

function sweepDeletionIndex(s, sweep_x, tree) {
  const debug_binary = game.modules.get(MODULE_ID).api.debug_binary;
  let idx, idx_bin;
  switch(debug_binary) {
    case UseBinary.Yes:
      idx = tree.deletionBinaryIndexOf(s, sweep_x);
      break;

    case UseBinary.Test:
      idx = tree.indexOf(s);
      idx_bin = tree.deletionBinaryIndexOf(s, sweep_x);
      if(idx !== idx_bin) { console.warn(`delete segment: idx bin ${idx_bin} ≠ ${idx} at sweep ${sweep_x}`); }
      break;

    case UseBinary.No:
      idx = tree.indexOf(s);
      break;
  }
  if(!~idx) console.error("Segment not found", s);
  return idx;
}




function checkForIntersection(s1, s2, e, tracker) {
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

    const event_ix = new EventTypeClass(ix, EventType.Intersection, [s1, s2]);
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
    const next = this.data[idx];
    if(next && !EventQueue.eventCmp(event, next)) {
      next.add([...event.segments]);
    } else {
      this._insertAt(event, idx);
    }
  }
}