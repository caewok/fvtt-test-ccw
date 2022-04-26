/* globals

foundry

*/

'use strict';

import { compareXY } from "./utilities.js";


/*
Testing

// Generate a set of random segments; compare intersection reporting between versions
// use a custom reporting function to capture the ix

reporting_arr_brute = []
reporting_arr_sort = []
reporting_arr_sweep = []

function randomPoint(max_coord) {
  return { x: Math.floor(Math.random() * max_coord),
           y: Math.floor(Math.random() * max_coord) };
}
function randomSegment(max_coord = 5000) {
    return new SimplePolygonEdge(randomPoint(max_coord), randomPoint(max_coord));
}
function pointsEqual(p1, p2) { return (p1.x.almostEqual(p2.x) && p1.y.almostEqual(p2.y)) }


reportFnBrute = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  reporting_arr_brute.push(x);
}

reportFnSort = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  reporting_arr_sort.push(x);
}

reportFnSweep = (s1, s2, ix) => {
  reporting_arr_sweep.push(ix);
}

reporting_arr_brute = []
reporting_arr_sort = []
reporting_arr_sweep = []

segments = Array.fromRange(10).map(i => randomSegment(5000))
canvas.controls.debug.clear()
segments.forEach(s => drawEdge(s, COLORS.black))

findIntersectionsBruteSingle(segments, reportFnBrute)
findIntersectionsSortSingle(segments, reportFnSort)
processIntersections(segments, reportFnSweep)

reporting_arr_brute.sort(compareXY)
reporting_arr_sort.sort(compareXY)
reporting_arr_sweep.sort(compareXY)

reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sort[idx]))
reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep[idx]))

segments = [];
for(let i = 0; i < 1000; i += 1) {
  reporting_arr_brute = []
  reporting_arr_sort = []
  reporting_arr_sweep = []

  segments = Array.fromRange(100).map(i => randomSegment(5000))

  findIntersectionsBruteSingle(segments, reportFnBrute)
  findIntersectionsSortSingle(segments, reportFnSort)
  processIntersections(segments, reportFnSweep)

  reporting_arr_brute.sort(compareXY)
  reporting_arr_sort.sort(compareXY)
  reporting_arr_sweep.sort(compareXY)

  const brute_sort_test = reporting_arr_brute.length === reporting_arr_sort.length &&
    reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sort[idx]))
  const brute_sweep_test = reporting_arr_brute.length === reporting_arr_sweep.length &&
    reporting_arr_brute.every((pt, idx) => pointsEqual(pt, reporting_arr_sweep[idx]))

  if(!brute_sort_test) {
    console.error(`Failed brute sort`)
  } else if (!brute_sweep_test) {
    console.error(`Failed brute sweep`)
  }

}


*/




export function identifyIntersectionsWith(s1, s2) {
  if(s1 === s2) return; // probably unnecessary

  const {a: a1, b: b1} = s1.vertices;
  const {a: a2, b: b2} = s2.vertices;

  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(!x) return; // may not be necessary but may eliminate colinear lines
  s1.intersectsWith.set(s2, x);
  s2.intersectsWith.set(s1, x);
}

export function identifyIntersectionsWithNoEndpoint(s1, s2) {
  if(s1.wallKeys.intersects(s2.wallKeys)) return;

  return identifyIntersectionsWith(s1, s2);
}


/**
 * Given an array of either walls or SimplePolygonEdges, identify all intersections.
 * Shared endpoints do not count.
 * Intersections marked in edge.intersectsWith map
 * Comparable to identifyWallIntersections method from WallsLayer Class
 *
 */
export function findIntersectionsBruteSingle(edges, reportFn = (e1, e2) => {}) {
  const ln = edges.length;
  if(!ln) return;

  for(let i = 0; i < ln; i += 1) {
    const edge1 = edges[i];
    const start_j = i + 1;
    for(let j = start_j; j < ln; j += 1) {
      const edge2 = edges[j];
      if(foundry.utils.lineSegmentIntersects(edge1.A, edge1.B, edge2.A, edge2.B)) {
        reportFn(edge1, edge2);
      }
    }
  }

}

/**
 * Given two arrays of either walls or SimplePolygonEdges, identify all intersections
 * between the two arrays. Only inter-array intersections, not intra-array.
 * (If you also want intra-array, see findIntersectionsSingle)
 * Shared endpoints do not count.
 * Intersections marked in the set
 * Comparable to identifyWallIntersections method from WallsLayer Class
 */
export function findIntersectionsBruteRedBlack(edges1, edges2k, reportFn = (e1, e2) => {}) {
  const ln1 = edges1.length;
  const ln2 = edges2.length;
  if(!ln1 || !ln2) return;

  for(let i = 0; i < ln1; i += 1) {
    const edge1 = edges1[i]
    for(let j = 0; j < ln2; j += 1) {
      const edge2 = edges2[j];

      if(foundry.utils.lineSegmentIntersects(edge1.A, edge1.B, edge2.A, edge2.B)) {
        reportFn(edge1, edge2);
      }
    }
  }
}


