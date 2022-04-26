/* globals
canvas,
game,
foundry,
*/

import { MODULE_ID } from "./module.js";
import { EventQueue, EventType, checkForIntersection } from "./IntersectionsSweep.js";
import { drawVertex, drawEdge, COLORS, clearLabels, labelVertex } from "./Drawing.js";
import { BinarySearchTree } from "./BinarySearchTree.js";
import { compareYX } from "./utilities.js";

export function findIntersectionsSweepBSTSingle(segments, reportFn = (e1, e2, ix) => {}) {
  // id the segments for testing
  const debug = game.modules.get(MODULE_ID).api.debug;

  if(debug) {
    canvas.controls.debug.clear();
    clearLabels();
    segments.forEach(s => drawEdge(s, COLORS.black));
    segments.forEach(s => labelVertex(s.nw, s.id));
  }

  let tracker = new Set(); // to note pairs for which intersection is checked already

  let cmp = segmentCompareGen();
  let tree = new BinarySearchTree(cmp.segmentCompare); // pretend this is actually a tree
  let e = new EventQueue(segments);

  let num_ixs = 0; // mainly for testing

  // traverse the queue
  let curr;
  while(curr = e.next()) {
// console.table(tree.data, ["_id"])
//     curr = e.next()
    cmp.sweep_x = curr.point.x;


    if(debug) {
      console.log(`${Object.getOwnPropertyNames(EventType)[curr.eventType]} event; Sweep at x = ${curr.point.x}.`);
      console.log(`\tEvent Queue: ${e.data.length}; Tree`, e.data, tree.inorder());
      drawEdge({A: {x: curr.point.x, y: 0}, B: { x: curr.point.x, y: canvas.dimensions.height}}, COLORS.lightblue, .5);

    }



    switch(curr.eventType) {
      case EventType.Left:
        num_ixs += handleLeftEventBST(curr, e, tree, tracker);
        break;
      case EventType.Intersection:
        num_ixs += handleIntersectionEventBST(curr, e, tree, tracker, reportFn);
        break;
      case EventType.Right:
        cmp.deletion = true;
        num_ixs += handleRightEventBST(curr, e, tree, tracker);
        cmp.deletion = false;
        break;
    }

    if(debug) { console.table(tree.inorder(), ["_id"]); }
  }

  return num_ixs;
}

function handleLeftEventBST(curr, e, tree, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;


  if(debug) {
    console.log(`\tLeft endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
    drawEdge(curr.segment);
  }

  // get the above and below points
  let node = tree.insert(curr.segment);

  // check if curr intersects with its predecessor and successor
  // if we already checked this pair, we can skip
  let { predecessor, successor } = tree.successorPredecessorForNode(node);
  if(predecessor) { num_ixs += checkForIntersection(predecessor.data, curr.segment, e, tracker); }
  if(successor) { num_ixs += checkForIntersection(successor.data, curr.segment, e, tracker); }

  return num_ixs;
}

function handleIntersectionEventBST(curr, e, tree, tracker, reportFn) {
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
  const node1 = tree.search(curr.segment1);
  const node2 = tree.search(curr.segment2);

  if(node1 && node2) {
    const cmp_res = segmentCompare(node1.data, node2.data);
    let res1 = tree.successorPredecessorForNode(node1);
    let res2 = tree.successorPredecessorForNode(node2);


    // check for after-swap intersections between now-upper segment and segment above,
    // now-lower segment and segment below
    if(cmp_res < 0) {
      // node 1 currently above node2
      // before swap: predecessor1 -- node1/predecessor2 -- successor1/node2 -- successor2
      // after swap: above -- node2 --- node1 -- below

      if(res1 && res1.predecessor) {
        num_ixs += checkForIntersection(res1.predecessor.data, node2.data, e, tracker);
      }

      if(res2 && res2.successor) {
        num_ixs += checkForIntersection(res2.successor.data, node1.data, e, tracker);
      }
    } else {
      // node 2 currently above node1
      // before swap: predecessor1 -- node2/predecessor1 -- successor2/node1 -- successor2
      // after swap: above -- node2 --- node1 -- below
      if(res2 && res2.predecessor) {
        num_ixs += checkForIntersection(res2.predecessor.data, node1.data, e, tracker);
      }

      if(res1 && res1.successor) {
        num_ixs += checkForIntersection(res1.successor.data, node2.data, e, tracker);
      }

    }

    tree.swap(node1, node2);
  }

  return num_ixs;
}

function handleRightEventBST(curr, e, tree, tracker) {
  const debug = game.modules.get(MODULE_ID).api.debug;
  let num_ixs = 0;

  if(debug) {
    console.log(`\tRight endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
  }

  // curr point is right of its segment
  // check if predecessor and successor intersect with each other
  let node = tree.search(curr.segment);
  let res = tree.successorPredecessorForNode(node);
  if(res && res.predecessor && res.successor) { num_ixs += checkForIntersection(res.predecessor.data, res.successor.data, e, tracker); }

  if(debug) {
    console.log(`\tDeleting ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
    drawEdge(curr.segment, COLORS.red);
  }

  tree.removeNode(node);

  return num_ixs;
}

function pointForSegmentGivenX(s, x) {
    const denom = s.B.x - s.A.x;
    if(!denom) return undefined;
    return { x: x, y: ((s.B.y - s.A.y) / denom * (x - s.A.x)) + s.A.y };
  }

function segmentCompare(segment, elem) {
  segment._tmp_nw = pointForSegmentGivenX(segment, this.sweep_x) || segment.nw;
  elem._tmp_nw = pointForSegmentGivenX(elem, this.sweep_x) || elem.nw;
  return compareYX(segment._tmp_nw, elem._tmp_nw) ||
     foundry.utils.orient2dFast(elem.se, elem.nw, segment.nw) ||
     foundry.utils.orient2dFast(elem.nw, elem.se, segment.se);
}

function segmentCompareGen(segment, elem) {
  return {
    sweep_x: 0,
    segmentCompare
  };
}


