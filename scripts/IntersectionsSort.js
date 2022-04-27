/* globals
foundry
*/

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }]*/

'use strict';

/*
Report intersections between segments using a near-brute force algorithm that
sorts the segment array to skip checks for segments that definitely cannot intersect.
"Single": Check each segment in an array against every other segment in that array.
"RedBlack": Check each segment in one array ("red") against every segment in a
            second array ("black").

Both functions take a callback function that reports intersecting segment pairs.

The sort functions require that the segment objects have "nw" and "se" properties
identifying the endpoints.
*/

import { compareXY } from "./utilities.js";

/**
 * Identify intersections between segments in an Array.
 * Less than O(n^2) using a modified brute force method.
 * Very fast in practice assuming segments are distribute in space and do not all
 * intersect each other.
 * Sorts the segments by endpoints to facilitate skipping unnecessary checks.
 * - Counts shared endpoints.
 * - Passes pairs of intersecting segments to a reporting function but does not
 *   calculate the intersection point.
 * @param {Segments[]} segments   Array of objects that contain points A.x, A.y, B.x, B.y
 * @param {Function} reportFn     Callback function that is passed pairs of
 *                                segment objects that intersect.
 */
export function findIntersectionsSortSingle(segments, reportFn = (_s1, _s2) => {}) {
  const ln = segments.length;
  if(!ln) { return; }

  // In a single pass through the array, build an array of endpoint objects.
  // Each object contains an endpoint, a link to the underlying segment, and a boolean
  // indicator for whether it is the nw or se endpoint.
  // Sort the new array by the x values, breaking ties by sorting the se point first.
  // (it is fine if two segments are otherwise equivalent in the sort)

  const endpoints = [];
  for(let i = 0; i < ln; i += 1) {
    const s = segments[i];
    endpoints.push({e: s.nw, s, se: -1},
                   {e: s.se, s, se: 1});
  }
  endpoints.sort(sortEndpoints);

  const ln2 = endpoints.length;
  for(let i = 0; i < ln2; i += 1) {
    const endpoint1 = endpoints[i];
    if(~endpoint1.se) continue; // avoid duplicating the check

    // starting j is always i + 1 b/c any segment with an se endpoint after si
    // would be after si or already processed b/c its ne endpoint was before.
    const start_j = i + 1;
    const si = endpoint1.s;
    for(let j = start_j; j < ln2; j += 1) {
      const endpoint2 = endpoints[j];

      if(~endpoint2.se) continue;
      if(endpoint2.e.x > si.se.x) break; // segments past here are entirely right of si

      const sj = endpoint2.s;
      foundry.utils.lineSegmentIntersects(si.A, si.B, sj.A, sj.B) && reportFn(si, sj);
    }
  }
}

/**
 * Comparison function for SortSingle
 * Sort each endpoint object by the endpoint x coordinate then sort se first.
 * @param {Object} e1   Endpoint object containing:
 *                      e (endpoint), s (segment), and se (boolean)
 * @param {Object} e2   Endpoint object containing:
 *                      e (endpoint), s (segment), and se (boolean)
 * @return {Number} Number indicating whether to sort e1 before e2 or vice-versa.
 *                  > 0: sort e2 before e1
 *                  < 0: sort e1 before e2
 */
function sortEndpoints(e1, e2) {
  return e1.e.x - e2.e.x ||
         e2.se - e1.se;

  // if e1.se then we want e1 first or they are equal. So return -
  // if e2.se then we want e2 first or they are equal. So return +
  // e2.se - e1.se
  // e1.se: -1, e2.se: 1. 1 - - 1 = 2; e2 first
  // e1.se: 1, e2.se: -1. -1 - 1 = -2:; e1 first
}



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
 * Given two arrays of either walls or SimplePolygonEdges, identify all intersections
 * between the two arrays. Only inter-array intersections, not intra-array.
 * (If you also want intra-array, see findIntersectionsSingle)
 * Shared endpoints do not count.
 * Intersections marked in the set
 * Comparable to identifyWallIntersections method from WallsLayer Class
 */
export function findIntersectionsSortRedBlack(edges1, edges2, reportFn = (_s1, _s2) => {}) {
  const ln1 = edges1.length;
  const ln2 = edges2.length;
  if(!ln1 || !ln2) return;

  edges1.sort((a, b) => compareXY(a.nw, b.nw));
  edges2.sort((a, b) => compareXY(a.nw, b.nw));

  for(let i = 0; i < ln1; i += 1) {
    const edge1 = edges1[i];
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


