/* globals
foundry
*/

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

"use strict";

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
  segments.sort((a, b) => compare(a.nw, b.nw));
  const ln = segments.length;
  for ( let i = 0; i < ln; i++ ) {
    const si = segments[i];
    for ( let j = i + 1; j < ln; j++ ) {
      const sj = segments[j];
      if ( sj.nw.x > si.se.x ) break; // The sj segments are all entirely to the right of si
      foundry.utils.lineSegmentIntersects(si.A, si.B, sj.A, sj.B) && reportFn(si, sj); // eslint-disable-line no-unused-expressions
    }
  }
}


/**
 * Comparison function for Sort algorithm
 * This is the faster but potentially less safe version in that x coordinates very
 * close to one another may be sorted differently when they should be considered the
 * same. For example, { 1.00001, 2} and { 1.00000, 3} should probably be sorted by
 * y-coordinates, not their x-coordinates. Thus, this version is best used with integer
 * coordinates.
 * @param {Point} a
 * @param {Point} b
 * @return {Number} Negative, positive, or 0. Lexigraphically sorts x values before y,
 *                  so can be used to sort nw points before se points.
 */
const compare = (a, b) => { return (a.x - b.x) || a.y - b.y }

/**
 * Identify intersections between two arrays of segments.
 * Segments within a single array are not checked for intersections.
 * (If you want intra-array, see findIntersectionsSortSingle.)
 * Very fast in practice assuming segments are distribute in space and do not all
 * intersect each other.
 * Sorts the segments by endpoints to facilitate skipping unnecessary checks.
 * - Counts shared endpoints.
 * - Passes pairs of intersecting segments to a reporting function but does not
 *   calculate the intersection point.
 * @param {Segments[]} red   Array of objects that contain points A.x, A.y, B.x, B.y
 * @param {Segments[]} black   Array of objects that contain points A.x, A.y, B.x, B.y
 * @param {Function} reportFn     Callback function that is passed pairs of
 *                                segment objects that intersect.
 */
export function findIntersectionsSortRedBlack(red, black, reportFn = (_s1, _s2) => {}) {
  black.sort((a, b) => compare(a.nw, b.nw));
  const red_ln = red.length;
  const black_ln = black.length;
  for ( let i = 0; i < red_ln; i++ ) {
    const si = red[i];
    for ( let j = 0; j < black_ln; j++ ) {
      const sj = black[j];
      if ( sj.nw.x > si.se.x ) break; // The sj segments are all entirely to the right of si
      if ( sj.se.x < si.nw.x ) continue; // This segment is entirely to the left of si
      foundry.utils.lineSegmentIntersects(si.A, si.B, sj.A, sj.B) && reportFn(si, sj); // eslint-disable-line no-unused-expressions
    }
  }
}
// Testing:
// reportFn = (_s1, _s2) => { console.log(`${_s1.id} x ${_s2.id}`) }

// TO-DO: Version of RedBlack that uses an existing sorted endpoint list,
// adds to it (using insertion sort?) and returns the updated list.
// Could be used to add wall segments or just store a sorted list
// for use with temp walls.

