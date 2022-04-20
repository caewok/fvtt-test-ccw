/* globals
canvas,
game,
foundry,

*/

import { MODULE_ID, UseBinary } from "./module.js";
import { SkipList } from "./SkipList.js";
import { PriorityQueueArray } from "./PriorityQueueArray.js";
import { drawVertex, drawEdge, COLORS, clearLabels, labelVertex } from "./Drawing.js";
import { compareXY, compareYX } from "./utilities.js";
import { binaryFindIndex } from "./BinarySearch.js";
import { EventType, hashSegments, pointForSegmentGivenX } from "./IntersectionsSweep.js";


export function findIntersectionsSweepSkipListSingle(segments, reportFn = (e1, e2, ix) => {}) {
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
  let ll = new SkipList({ comparator: cmp.segmentCompare,
    minObject: { A: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY },
                 B: { x: Number.POSITIVE_INFINITY, y: Number.NEGATIVE_INFINITY }},
    maxObject: { A: { x: Number.NEGATIVE_INFINITY, y: Number.POSITIVE_INFINITY },
                 B: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }}});

  // push the left endpoints into the event queue
  // right endpoints left for later when encountering each left event
  let e = new LinkedEventQueue(segments);

  let num_ixs = 0; // mainly for testing

  // traverse the queue
  let curr;
  while(curr = e.next()) {
// console.table(tree.data, ["_id"])
//     curr = e.next()
    cmp.sweep_x(curr.point.x);


    if(debug) {
      console.log(`${Object.getOwnPropertyNames(EventType)[curr.eventType]} event; Sweep at x = ${curr.point.x}.`);
      console.log(`\tEvent Queue: ${e.data.length}; Tree`, e.data, ll.inorder());
      drawEdge({A: {x: curr.point.x, y: 0}, B: { x: curr.point.x, y: canvas.dimensions.height}}, COLORS.lightblue, .5);
    }

    switch(curr.eventType) {
      case EventType.Left:
        num_ixs += handleLeftEventLinked(curr, e, ll, tracker);
        break;
      case EventType.Intersection:
        num_ixs += handleIntersectionEventLinked(curr, e, ll, tracker, reportFn);
        break;
      case EventType.Right:
        num_ixs += handleRightEventLinked(curr, e, ll, tracker);
        break;
    }

    if(debug) { console.table(ll.inorder(), ["_id"]); }
    if(debug) { console.table(e.data, ["eventType"]); }
  }

  return num_ixs;
}

function handleLeftEventLinked(curr, e, ll, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;

  let num_ixs = 0;

  if(debug) {
    console.log(`\tLeft endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
    drawEdge(curr.segment);
  }

  // insert the current segment into the y-axis ordered list
  let segment_node = ll.insert(curr.segment);

  let event_right = {
    point: curr.segment.se,
    eventType: EventType.Right,
    segmentNode: segment_node
  };

  e.insert(event_right);

  // check if curr intersects with its predecessor and successor
  // if we already checked this pair, we can skip
  let pred_node = segment_node.prev;
  let succ_node = segment_node.next;

  // Avoid testing sentinel nodes as prev or next
  if(pred_node && !pred_node.isSentinel) { num_ixs += checkForIntersectionLinked(pred_node, segment_node, e, tracker); }
  if(succ_node && !succ_node.isSentinel) { num_ixs += checkForIntersectionLinked(succ_node, segment_node, e, tracker); }

  return num_ixs;
}

function handleIntersectionEventLinked(curr, e, ll, tracker, reportFn) {
  const debug = game.modules.get(MODULE_ID).api.debug;

  let num_ixs = 0;

  let segment_node1 = curr.segmentNode1;
  let segment_node2 = curr.segmentNode2;
  let s1 = segment_node1.data;
  let s2 = segment_node2.data;

  // report intersection
  reportFn(s1, s2, curr.point);

  if(debug) {
    console.log(`\tIntersection event ${curr.point.x},${curr.point.y}`);
    drawVertex(curr.point);
    console.log(`\tSwapping \n\t${s1._id} (${s1.nw.x},${s1.nw.y}|${s1.se.x},${s1.se.y}) and \n\t${s2._id} (${s2.nw.x},${s2.nw.y}|${s2.se.x},${s2.se.y})`);
  }

  // swap A, B
  ll.swapNodes(segment_node1, segment_node2);

  let pred_node1 = segment_node1.prev;
  let pred_node2 = segment_node2.prev;

  let succ_node1 = segment_node1.next;
  let succ_node2 = segment_node2.next;

  // Avoid testing sentinel nodes as prev or next
  if(pred_node1 && !pred_node1.isSentinel && pred_node1 !== segment_node2) {
    num_ixs += checkForIntersectionLinked(pred_node1, segment_node1, e, tracker);
  } else if(pred_node2 && !pred_node2.isSentinel && pred_node2 !== segment_node1) {
    num_ixs += checkForIntersectionLinked(pred_node2, segment_node2, e, tracker);
  }

  if(succ_node1 && !succ_node1.isSentinel && succ_node1 !== segment_node2) {
    num_ixs += checkForIntersectionLinked(succ_node1, segment_node1, e, tracker);
  } else if(succ_node2 && !succ_node2.isSentinel && succ_node2 !== segment_node1) {
    num_ixs += checkForIntersectionLinked(succ_node2, segment_node2, e, tracker);
  }

  return num_ixs;
}

function handleRightEventLinked(curr, e, ll, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;

  let num_ixs = 0;

  let s_node = curr.segmentNode;
  let s = s_node.data;

  if(debug) {
    console.log(`\tRight endpoint event for ${s._id} (${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y})`);
  }

  // curr point is right of its segment
  // check if predecessor and successor intersect with each other


  let pred_node = s_node.prev;
  let succ_node = s_node.next;

  if(pred_node && succ_node && !pred_node.isSentinel && !succ_node.isSentinel) {
    num_ixs += checkForIntersectionLinked(pred_node, succ_node, e, tracker);
  }

  if(debug) {
    console.log(`\tDeleting ${s.nw.x},${s.nw.y}|${s.se.x},${s.se.y}`);
    drawEdge(s, COLORS.red);
  }

  ll.removeNode(s_node);

  return num_ixs;
}

function checkForIntersectionLinked(segment_node1, segment_node2, e, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;

  let num_ixs = 0;
  const s1 = segment_node1.data;
  const s2 = segment_node2.data;

  const hash = hashSegments(s1, s2);
//   const hash_rev = hashSegments(s2, s1);
  if(tracker.has(hash)) return num_ixs;

  // TO-DO: Likely faster to handle the wall keys individually rather than apply lineLineIntersection
  if(s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key) ||
    foundry.utils.lineSegmentIntersects(s1.A, s1.B, s2.A, s2.B)) {

    num_ixs += 1;
    const ix = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
    if(!ix) return num_ixs; // likely collinear lines

    if(debug) {
      console.log(`\tIntersection found at ${ix.x},${ix.y}`);
      drawVertex(ix, COLORS.lightred, .5);
    }

    const event_ix = {
      point: ix,
      eventType: EventType.Intersection,
      segmentNode1: segment_node1,
      segmentNode2: segment_node2,
    };

    e.insert(event_ix);
    tracker.add(hash);
  }
  return num_ixs;
}

class LinkedEventQueue extends PriorityQueueArray {
  constructor(arr,  { comparator = (a, b) => a - b,
                      sort = (arr, cmp) => arr.sort(cmp) } = {}) {
    // push all left points to a vector of events
    const data = [];
    arr.forEach(s => {
      data.push({ point: s.nw, eventType: EventType.Left, segment: s });
    });
    comparator = LinkedEventQueue.eventCmp;
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


