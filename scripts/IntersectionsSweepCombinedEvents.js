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

    if(debug) { console.table(tree.data, ["_id", "_idx"]); }
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
    tree.insert(s, sweep_x);
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
    let { above, below, min_idx, max_idx } = segmentIndexSpread(segmentSet, tree);
    if(below) {
      let bottom_segment = tree.atIndex(max_idx);
      num_ixs += checkForIntersection(below, bottom_segment, e, tracker, curr.point);
    }

    if(above) {
      let top_segment = tree.atIndex(min_idx);
      num_ixs += checkForIntersection(above, top_segment, e, tracker, curr.point);
    }
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




  // find all intersecting indices and the bracketing segments
  let { above, below, min_idx, max_idx } = segmentIndexSpread(segmentSet, tree);

  // reverse (swap) indices
  tree.reverseIndices(min_idx, max_idx);


  // check for intersection between the upper segment and above
  // and between lower segment and below (after the swap/reversal)
  if(below) {
    const bottom_segment = tree.atIndex(max_idx);
    num_ixs += checkForIntersection(below, bottom_segment, e, tracker, curr.point);
  }
  if(above) {
    const top_segment = tree.atIndex(min_idx);
    num_ixs += checkForIntersection(above, top_segment, e, tracker, curr.point);
  }

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
  let { above, below } = segmentIndexSpread(segmentSet, tree);

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

// assuming the segmentSet contains adjacent segments in the tree,
// find the range of indices in the set as well as the above/below segments
// bracketing the set in the ordered array
function segmentIndexSpread(segmentSet, tree) {
  let min_idx = Number.POSITIVE_INFINITY;
  let max_idx = Number.NEGATIVE_INFINITY;
  let indices = segmentSet.forEach(s => {
    const idx = s._idx;
    min_idx = Math.min(idx, min_idx);
    max_idx = Math.max(idx, max_idx);
    return idx;
  });

  const above = tree.predecessor(min_idx);
  const below = tree.successor(max_idx);

  return { indices, above, below, min_idx, max_idx };
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
    if(compareXY(sweep_pt, ix) >= 0 ) { return num_ixs } // intersection is in the past

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

 class SegmentArray extends OrderedArray {


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

    segment._idx = this._insertAt(segment, idx);
    // only way to fix the indices of the remainder appears to be to
    // update them sequentially
    const ln = this.data.length;
    for(let i = segment._idx + 1; i < ln; i += 1) {
      this.data[i]._idx += 1;
    }

    return segment._idx;

  }

 /**
  * Swap two segments in the array.
  */
  swap(segment1, segment2) {
    if(!segment1._tmp_nw || !segment2._tmp_nw) { return -1; }

    const idx1 = segment1._idx;
    const idx2 = segment2._idx;

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

    segment1._idx = idx2;
    segment2._idx = idx1;

    return [idx2, idx1];
  }

 /**
  * Reverse all objects from idx1 to idx2.
  * Dangerous! If comparator does not accommodate the swap, binary searching may
  * return unpredictable results and insertion/deletion (binary or non-binary) may also
  * fail.
  * @param {number} idx1    Index of first object to reverse in array
  * @param {number} idx2    Index of last object to reverse in array
  */
  reverseIndices(start_idx, end_idx) {
    const arr_to_reverse = this.data.slice(start_idx, end_idx + 1);
    arr_to_reverse.reverse();
    this.data = this.data.slice(0, start_idx).concat(arr_to_reverse, this.data.slice(end_idx + 1));

    for(let i = start_idx; i <= end_idx; i += 1) {
      this.data[i]._idx = i;
    }
  }

 /**
  * Delete a segment
  */
  remove(segment) {
    const idx = segment._idx;

    if(typeof idx === "undefined") {
      console.log(`Attempted removal of segment that has no index`, segment);
      return;
    }
    this.data.splice(idx, 1);

    // only way to fix the indices of the remainder appears to be to
    // update them sequentially
    const ln = this.data.length;
    for(let i = idx; i < ln; i += 1) {
      this.data[i]._idx -= 1;
    }

    segment._tmp_nw = undefined;
    segment._idx = undefined;
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
  * Helper function transforming the comparator output to true/false; used by insert.
  * @param {Object}   obj     Object to search for
  * @param {Object}   elem    Element of the array
  * @param {number}   sweep_x Position of the sweep
  * @return {boolean} True if the element is after the segment in the ordered array.
  */
  _elemIsAfter(segment, elem, sweep_x) { return this._segmentCompare(segment, elem, sweep_x) < 0; }

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
    const next = ~idx ? this.data[idx - 1] : this.data[this.data.length - 1]
    if(next && !EventQueue.eventCmp(event, next)) {
      next.add([...event.segments]);
    } else {
      this._insertAt(event, idx);
    }
  }
}