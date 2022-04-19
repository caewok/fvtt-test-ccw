/* globals
game,
canvas,
foundry
*/

// Sweep algorithm but combine separate events where the points are equal

import { compareXY, compareYX } from "./utilities.js";
import { PriorityQueueArray } from "./PriorityQueueArray.js";
import { MODULE_ID, UseBinary } from "./module.js";
import { SkipList } from "./SkipList.js";
import { binaryFindIndex } from "./BinarySearch.js";
import { drawVertex, drawEdge, COLORS, clearLabels, labelVertex } from "./Drawing.js";
import { EventType, pointForSegmentGivenX } from "./IntersectionsSweep.js";


export function findIntersectionsSweepCombinedSkipSingle(segments, reportFn = (e1, e2, ix) => {}) {
  // id the segments for testing
  const debug = game.modules.get(MODULE_ID).api.debug;

  if(debug) {
    canvas.controls.debug.clear();
    clearLabels();
    segments.forEach(s => drawEdge(s, COLORS.black));
    segments.forEach(s => labelVertex(s.nw, s.id));
  }

  let tracker = new Set(); // to note pairs for which intersection is checked already
  let cmp = segmentCompareLinkedGen();
  let ll = new SkipList(cmp.segmentCompare); // pretend this is actually a tree
  let e = new EventQueue(segments);

  let num_ixs = 0; // mainly for testing

  // traverse the queue
  let curr;
  while(curr = e.next()) {
// console.table(tree.data, ["_id"])
//     curr = e.next()
    cmp.sweep_x(curr.point.x);

    if(debug) {
      console.log(`${Object.getOwnPropertyNames(EventType)[curr.eventType]} event; Sweep at x = ${curr.point.x}.`);
      console.log(`\tEvent Queue: ${e.data.length}; Tree: ${ll.length}`, e.data, ll.inorder());
      drawEdge({A: {x: curr.point.x, y: 0}, B: { x: curr.point.x, y: canvas.dimensions.height}}, COLORS.lightblue, .5);
//       console.table(tree.data, ["_id"])
    }

    switch(curr.eventType) {
      case EventType.Left:
        num_ixs += handleLeftEvent(curr, e, ll, tracker);
        break;
      case EventType.Intersection:
        num_ixs += handleIntersectionEvent(curr, e, ll, tracker, reportFn);
        break;
      case EventType.Right:
        num_ixs += handleRightEvent(curr, e, ll, tracker);
        break;
    }

    if(debug) { console.table(ll.inorder(), ["_id"]); }
    if(debug) { console.table(e.data, ["type", "segments"]); }

  }

  return num_ixs;
}

function handleLeftEvent(curr, e, ll, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;

  // insert each left segment
  // store the node in the segment so we can use it later
  // (a bit circular, but EventType uses Set to eliminate duplicate segments by
  //  memory location, so don't pass it a node --- it must get a segment)

  let segmentSet = curr.segments;
  segmentSet.forEach(s => {
    s._node = ll.insert(s);
    if(debug) {
      console.log(`\tAdding ${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`);
      drawEdge(s);
    }

    // insert the right endpoint for this segment into the event queue
    let event_right = new EventTypeClass(s.se, EventType.Right, [s]);
    e.insert(event_right);
  });


  if(segmentSet.size > 1) {
    // if there is more than one segment to add, we know they all intersect at this point.
    // add an intersection event that will be called next
    // (it will also swap/reverse these segments and then test the above/below)
    // (if not doing this, then need to handle the above/below ix test)
    const event_ix = new EventTypeClass(curr.point, EventType.Intersection, [...segmentSet]);
    e.insert(event_ix);
  } else {
    // test above/below the segment inserted for intersection
    let [s0] = segmentSet;
    let pred_node = s0._node.prev;
    let succ_node = s0._node.next;

    // If prev or next are Sentinels, skip
    // pred_node and succ_node are likely
    if(pred_node && !pred_node.isSentinel) { num_ixs += checkForIntersection(pred_node.data, s0, e, tracker, curr.point); }
    if(succ_node && !succ_node.isSentinel) { num_ixs += checkForIntersection(succ_node.data, s0, e, tracker, curr.point); }
  }

  return num_ixs;
}

function handleIntersectionEvent(curr, e, ll, tracker, reportFn) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;
  let segmentSet = curr.segments;

  if(debug) {
    console.log(`\tIntersection event ${curr.point.x},${curr.point.y}`);
    drawVertex(curr.point);
    console.log(`\tSwapping ${segmentSet.size} segments.`);
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

  // reverse (swap) the nodes
  if(debug) { console.log(`\tSwapping ${segmentSet.size} segments.`); }
  let res;
  if(segmentArr.length === 2) {
    ll.swapNodes(segmentArr[0]._node, segmentArr[1]._node);
    res = segmentSpread(segmentSet);
  } else {
    res = reverseNodes(segmentArr, ll);
  }
  let { above, below, top, bottom } = res;


  // check for intersection between the upper segment and above
  // and between lower segment and below (after the swap/reversal)
  if(below && !below.isSentinel) {
    num_ixs += checkForIntersection(below.data, bottom.data, e, tracker, curr.point);
  }
  if(above && !above.isSentinel) {
    num_ixs += checkForIntersection(above.data, top.data, e, tracker, curr.point);
  }

  return num_ixs;
}

function handleRightEvent(curr, e, ll, tracker) {
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
  let { above, below } = segmentSpread(segmentSet);

  if(below && !below.isSentinel && above && !above.isSentinel) {
    num_ixs += checkForIntersection(below.data, above.data, e, tracker, curr.point);
  }

  for(const s of segmentSet) {
    if(debug) {
      console.log(`\tDeleting ${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`);
      drawEdge(s, COLORS.red);
    }

    ll.removeNode(s._node);
    s._node = undefined;
  }

  // do we need to delete associated ix events? (Hopefully not; that may be hard.)
  // probably handled by the tracker eliminating ix overlap

  return num_ixs;
}


// assume the segmentSet contains adjacent segments in the list
// reverse by repeatedly calling swap from outside in on sorted set of segments
function reverseNodes(segmentArr, ll) {
  segmentArr.sort((a, b) => ll._cmp(a._node.data, b._node.data));

  // process outside in
  let ln = segmentArr.length;
  for(let i = 0, j = ln - 1; i < j; i += 1, j -= 1) {
    ll.swapNodes(segmentArr[i]._node, segmentArr[j]._node);
  }

  let top = segmentArr[ln - 1]._node;
  let bottom = segmentArr[0]._node;

  return { above: top?.prev, below: bottom?.next,
           top, bottom };
}

// assume the segmentSet contains mostly adjacent segments in the list,
// find the above/below segments
// find by getting the min/max for the set
//
function segmentSpread(segmentSet) {
  let [above] = segmentSet;
  above = above._node;
  let below = above;
  let top = above;
  let bottom = above;

  let max_iterations = 10_000;
  let iter = 0;
  while(segmentSet.has(above.data) && iter < max_iterations) {
    top = above;
    above = above.prev;
  }
  if(iter >= max_iterations) { console.error("segmentSpread: max iterations exceeded."); }

  iter = 0;
  while(segmentSet.has(below.data) && iter < max_iterations) {
    bottom = below;
    below = below.next;
  }

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
    if(compareXY(sweep_pt, ix) >= 0 ) { return num_ixs; } // intersection is in the past or we are at a shared endpoint

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
      data.push(e1);
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


function segmentCompareLinkedGen() {
  let _sweep_x = 0;
  return {
    sweep_x(value) { _sweep_x = value; },
    segmentCompare(segment, elem) {
      if(game.modules.get(MODULE_ID).api.debug) { console.log(`Sweep x currently set to ${_sweep_x}.`); }
      segment._tmp_nw = pointForSegmentGivenX(segment, _sweep_x) || segment.nw;
      elem._tmp_nw = pointForSegmentGivenX(elem, _sweep_x) || elem.nw;
      return compareYX(segment._tmp_nw, elem._tmp_nw) ||
         foundry.utils.orient2dFast(elem.se, elem.nw, segment.nw) ||
         foundry.utils.orient2dFast(elem.nw, elem.se, segment.se);
    }
  };
}