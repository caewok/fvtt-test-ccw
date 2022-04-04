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

walls = [...canvas.walls.placeables]
segments = walls.map(w => SimplePolygonEdge.fromWall(w));

*/




import { compareXY, compareYX } from "./utilities.js";

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
  above(segment) { return this.aboveIndex(this.indexOf(segment)); }

  aboveIndex(idx) { return this.data[idx - 1]; }

  // something below the segment has a higher index
  below(segment) { return this.belowIndex(this.indexOf(segment)); }

  belowIndex(idx) { return this.data[idx + 1]; }

  atIndex(idx) { return this.data[idx]; }

  // index
  indexOf(segment) { return this.data.indexOf(segment); }

  // insert
  // return index of the insertion
  insert(segment) {
    // must use a temporary index flag, because we may be switching
    // segments and therefore switching their "y" values temporarily.
    // need the x value for
    segment._tmp_nw = segment.nw;

    // find first element that has larger y than the segment
    const idx = this.data.findIndex(elem => compareYX(segment._tmp_nw, elem._tmp_nw) < 0);

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
      console.warn("swap segments not found.");
      return;
    }

    // change their temporary values (only *after* finding their current index)
    [ segment2._tmp_nw, segment1._tmp_nw ] = [ segment1._tmp_nw, segment2._tmp_nw ];

    // change their position
    this.data[idx1] = segment2;
    this.data[idx2] = segment1;

    return [idx2, idx1];
  }

  // delete
  delete(segment) {
    const idx = this.indexOf(segment);

    // remove temporary index (only *after* finding the index)
    segment._tmp_nw = undefined;
    if(~idx) { this.data.splice(idx, 1); }
  }

  deleteAtIndex(idx) { this.data.splice(idx, 1); }
}

class EventQueue {
  constructor(segments) {
    // push all points to a vector of events
    const data = [];
    segments.map(s => {
      data.push({ point: s.nw, isLeft: true, segment: s });
      data.push({ point: s.se, isLeft: false, segment: s });
    })

    // sort all events according to x then y coordinate
    data.sort((a, b) => compareXY(a.point, b.point));

    this.data = data;
    this.position = 0;
  }

  next() {
    const out = this.data[this.position];
    this.position += 1;
    return out;
  }

  insert(event) {
    const idx = this.data.findIndex(elem => compareXY(event.point, elem.point) < 0);
    if(idx < this.position) {
      // if inserting just in front of this.position, we can simply back up
      if(idx === (this.position - 1)) {
        this.position -= 1;
      } else {
        console.warn("Inserting e before current position");
      }
    }

    if(~idx) {
      this.data.splice(idx, undefined, event);
      return idx;

    } else {
      // e has the largest x
      this.data.push(event)
      return this.data.length - 1;
    }
  }
}


/**
 * Construct numeric index to represent unique pairing
 * digits_multiplier is Math.pow(10, numDigits(n));
 */
function hashSegments(s1, s2) {
  return "" + s1.nw.key + s1.se.key + s2.nw.key + s2.se.key
}

export function processIntersections(segments) {
  let tracker = new Set(); // to note pairs for which intersection is checked already
  let tree = new NotATree(); // pretend this is actually a tree
  let e = new EventQueue(segments);

  let num_ixs = 0; // mainly for testing

  // traverse the queue
  let curr;
  while(curr = e.next()) {
    console.log(`Sweep at x = ${curr.point.x}`);

    // draw vertical sweep line
    drawEdge({A: {x: curr.point.x, y: 0}, B: { x: curr.point.x, y: canvas.dimensions.height}}, COLORS.lightblue, alpha = .5)

    if(curr.isIx) {
      console.log(`\tIntersection event ${ix.x},${ix.y}`)
      // report intersection
//           curr.segment1._identifyIntersectionsWith(curr.segment2);
      drawVertex(curr.point)

      // swap A, B
      console.log(`\tSwapping ${curr.segment1.nw.x},${curr.segment1.nw.y}|${curr.segment1.se.x},${curr.segment1.se.y} and ${curr.segment2.nw.x},${curr.segment2.nw.y}|${curr.segment2.se.x},${curr.segment2.se.y}`)
      let [new_idx1, new_idx2] = tree.swap(curr.segment1, curr.segment2);

      // check for intersection between the upper segment and above
      // and between lower segment and below
      let [bottom_segment, top_segment] = new_idx1 > new_idx2 ?
          [curr.segment1, curr.segment2] :
          [curr.segment2, curr.segment1];

      let below = tree.belowIndex(Math.max(new_idx1, new_idx2));
      let above = tree.aboveIndex(Math.min(new_idx1, new_idx2));

      if(below) { num_ixs += checkForIntersection(below, bottom_segment, e, tracker); }
      if(above) { num_ixs += checkForIntersection(above, top_segment, e, tracker); }


    } else if (curr.isLeft) {
      console.log(`\tLeft endpoint event for ${curr.segment.nw.x},${curr.segment.nw.y}|${curr.segment.se.x},${curr.segment.se.y}`);
      drawEdge(curr.segment)
      // get the above and below points
      let idx = tree.insert(curr.segment);

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
      tree.deleteAtIndex(idx);
      drawEdge(curr.segment, COLORS.red)

      // do we need to delete associated ix events? (Hopefully not; that may be hard.)

    }

  }

  return num_ixs;
}

function checkForIntersection(s1, s2, e, tracker) {
  let num_ixs = 0
  let hash = hashSegments(s1, s2);
  let hash_rev = hashSegments(s2, s1);
  if(!(tracker.has(hash) || tracker.has(hash_rev)) &&
    foundry.utils.lineSegmentIntersects(s1.A, s1.B, s2.A, s2.B)) {
    num_ixs += 1;
  //           s1.segment._identifyIntersectionsWith(s2);

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



