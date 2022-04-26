/* globals

foundry

*/

'use strict';

import { compareXY, compareYX, compareXYSortKeysInt } from "./utilities.js";
import { binaryFindIndex } from "./BinarySearch.js";

/**
 * Return true if edge1 is entirely northwest of edge2.
 */
function isLeft(edge1, edge2) {
  compareXY(edge1.se, edge2.nw) < 0;
}

/**
 * Return true if edge1 is entirely southeast of edge2
 */
function isRight(edge1, edge2) {
  compareXY(edge1.nw, edge2.se) > 0;
}

/**
 * Return true if edge1 is entirely above/below edge2
 */
function isAboveOrBelow(edge1, edge2) {
  let a1_is_above = compareYX(edge1.A, edge1.B) < 0; // > 0: b is before a
  let a2_is_above = compareYX(edge2.A, edge2.B) < 0;
  let [ top1, bottom1 ] = a1_is_above ? [ edge1.A, edge1.B] : [ edge1.B, edge1.A ];
  let [ top2, bottom2 ] = a2_is_above ? [ edge2.A, edge2.B] : [ edge2.B, edge2.A ];

  if (compareYX(bottom1, top2) < 0) { return true; } // edge1 totally above
  return compareYX(top1, bottom2) > 0; // edge1 totally below if true
}

/**
 * Given an array of either walls or SimplePolygonEdges, identify all intersections.
 * Shared endpoints do not count.
 * Intersections marked in edge.intersectsWith map
 * Comparable to identifyWallIntersections method from WallsLayer Class
 */
export function findIntersectionsSortSingle(edges, reportFn = (e1, e2) => {}) {
  const ln = edges.length;
  if(!ln) return;

  edges.sort((a, b) => compareXY(a.nw, b.nw));
  for(let i = 0; i < ln; i += 1) {
    const edge1 = edges[i];
    const start_j = i + 1;
    for(let j = start_j; j < ln; j += 1) {
      const edge2 = edges[j];

      // if we have not yet reached the left end of this edge, we can skip
      if(isLeft(edge1, edge2)) continue;

      // if we reach the right end of this edge, we can skip the rest
      if(isRight(edge2, edge1)) break;

      if(foundry.utils.lineSegmentIntersects(edge1.A, edge1.B, edge2.A, edge2.B)) {
        reportFn(edge1, edge2);
      }
    }
  }
}

/**
 * Return true if edge1 is entirely northwest of edge2.
 */
function isLeftKey(edge1, edge2) {
  compareXYSortKeysInt(edge1.seByKey, edge2.nwByKey) < 0;
}

/**
 * Return true if edge1 is entirely southeast of edge2
 */
function isRightKey(edge1, edge2) {
  compareXYSortKeysInt(edge1.nwByKey, edge2.seByKey) > 0;
}


export function findIntersectionsSort2Single(edges, reportFn = (e1, e2) => {}) {
  const ln = edges.length;
  if(!ln) return;

  edges.sort((a, b) => compareXYSortKeysInt(a.nwByKey, b.nwByKey));
  for(let i = 0; i < ln; i += 1) {
    const edge1 = edges[i];
    const start_j = i + 1;
    for(let j = start_j; j < ln; j += 1) {
      const edge2 = edges[j];

      // if we have not yet reached the left end of this edge, we can skip
      if(isLeftKey(edge1, edge2)) continue;

      // if we reach the right end of this edge, we can skip the rest
      if(isRightKey(edge2, edge1)) break;

      if(foundry.utils.lineSegmentIntersects(edge1.A, edge1.B, edge2.A, edge2.B)) {
        reportFn(edge1, edge2);
      }
    }
  }

}

// findIntersectionsSort3Single
// sort by endpoint and for ties, sort se first
function compareXYSortEndpoints(e1, e2) {
  return e1.e.sortKey - e2.e.sortKey ||
         (e1.se ? -1 : 1);

  // if e1.se then we want e1 first or they are equal. So return -
  // if e2.se then we want e2 first or they are equal. So return +
}

// avoid endpoints
export function findIntersectionsSort3Single(edges, reportFn = (e1, e2) => {}) {
  const ln = edges.length;
  if(!ln) return;

  // construct an array of segments that can be sorted by nw and se endpoints
  // for each segment i, use binarySearch to find the start index and end index

  const endpoints = [];
  for(let i = 0; i < ln; i += 1) {
    endpoints.push({e: edges[i].nw, s: edges[i], se: false}, {e: edges[i].se, s: edges[i], se: true})
  }
  const ln2 = ln * 2;

  endpoints.sort((a, b) => compareXYSortEndpoints(a, b));

  for(let i = 0; i < ln2; i += 1) {
    const endpoint1 = endpoints[i];
    if(endpoint1.se) continue; // alt would be to sort edges array and use that for the i loop

    // starting j is always i + 1 b/c any segment with an se endpoint after edge1
    // would be after edge1 or already processed b/c its ne endpoint was before.
    const start_j = i + 1;
    const edge1 = endpoint1.s;
    for(let j = start_j; j < ln2; j += 1) {
      const endpoint2 = endpoints[j];

      // do break first b/c it has the most impact
      // then test se b/c it is easy
      if(endpoint2.e.x >= endpoint1.s.se.x) break; // >= to avoid endpoints (as opposed to ">")
      if(endpoint2.se) continue;
      if(endpoint2.e.x === endpoint1.s.nw.x) continue; // to avoid endpoints

      const edge2 = endpoints[j].s;
      if(foundry.utils.lineSegmentIntersects(edge1.A, edge1.B, edge2.A, edge2.B)) {
        reportFn(edge1, edge2);
      }
    }
  }
}

export function findIntersectionsSort4Single(edges, reportFn = (e1, e2) => {}) {
  const ln = edges.length;
  if(!ln) return;

  // construct an array of segments that can be sorted by nw and se endpoints
  // for each segment i, use binarySearch to find the start index and end index

  const endpoints = [];
  for(let i = 0; i < ln; i += 1) {
    endpoints.push({e: edges[i].nw, s: edges[i], se: false}, {e: edges[i].se, s: edges[i], se: true})
  }
  const ln2 = ln * 2;

  endpoints.sort((a, b) => compareXYSortEndpoints(a, b));

  for(let i = 0; i < ln2; i += 1) {
    const endpoint1 = endpoints[i];
    if(endpoint1.se) continue; // alt would be to sort edges array and use that for the i loop

    // starting j is always i + 1 b/c any segment with an se endpoint after edge1
    // would be after edge1 or already processed b/c its ne endpoint was before.
    const start_j = i + 1;

    // Need to determine where to end.
    // ej is entirely se of ei. So ei.se < ej.nw.
    // Find the index for ej.
    // binaryFindIndex: substitute end_j for ln2 below.
    // Testing suggests this is comparable, but slightly slower
//     let end_j = binaryFindIndex(endpoints, (elem, idx) =>  elem.e.x > endpoint1.s.se.x ) // >= to avoid endpoints
//     ~end_j || (end_j = ln2);


    const edge1 = endpoint1.s;
    for(let j = start_j; j < ln2; j += 1) {
      const endpoint2 = endpoints[j];

      if(endpoint2.se) continue;
      if(endpoint2.e.x > endpoint1.s.se.x) break; // >= to avoid endpoints

      const edge2 = endpoint2.s;

      if(foundry.utils.lineSegmentIntersects(edge1.A, edge1.B, edge2.A, edge2.B)) {
        reportFn(edge1, edge2);
      }
    }
  }
}

// findIntersectionsSort3Single(edges, (e1, e2) => console.log(`${e1.id} x ${e2.id}`))
// reporting_arr_sort = []
// reporting_arr_sort2 = []
// reporting_arr_sort3 = []
// reporting_arr_sort4 = []
//
// reportFnSort = (s1, s2) => {
//   const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
//   if(x) reporting_arr_sort.push(x);
// }
// reportFnSort2 = (s1, s2) => {
//   const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
//   if(x) reporting_arr_sort2.push(x);
// }
// reportFnSort3 = (s1, s2) => {
//   const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
//   if(x) reporting_arr_sort3.push(x);
// }
// reportFnSort4 = (s1, s2) => {
//   const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
//   if(x) reporting_arr_sort4.push(x);
// }
//
// findIntersectionsSortSingle(segments, reportFnSort)
// findIntersectionsSort2Single(segments, reportFnSort2)
// findIntersectionsSort3Single(segments, reportFnSort3)
// findIntersectionsSort4Single(segments, reportFnSort4)
//



/**
 * Given two arrays of either walls or SimplePolygonEdges, identify all intersections
 * between the two arrays. Only inter-array intersections, not intra-array.
 * (If you also want intra-array, see findIntersectionsSingle)
 * Shared endpoints do not count.
 * Intersections marked in the set
 * Comparable to identifyWallIntersections method from WallsLayer Class
 */
export function findIntersectionsSortRedBlack(edges1, edges2, reportFn = (e1, e2) => {}) {
  const ln1 = edges1.length;
  const ln2 = edges2.length;
  if(!ln1 || !ln2) return;

  edges1.sort((a, b) => compareXY(a.nw, b.nw));
  edges2.sort((a, b) => compareXY(a.nw, b.nw));

  for(let i = 0; i < ln1; i += 1) {
    const edge1 = edges1[i]
    for(let j = 0; j < ln2; j += 1) {
      const edge2 = edges2[j];

      // if we have not yet reached the left end of this edge, we can skip
      if(isLeft(edge1, edge2)) continue;

      // if we reach the right end of this edge, we can skip the rest
      if(isRight(edge2, edge1)) break;

      if(foundry.utils.lineSegmentIntersects(edge1.A, edge1.B, edge2.A, edge2.B)) {
        reportFn(edge1, edge2);
      }
    }
  }
}


