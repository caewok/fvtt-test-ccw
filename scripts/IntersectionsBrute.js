/* globals
foundry
*/

'use strict';

import { compareXY } from "./utilities.js";








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
export function findIntersectionsBruteRedBlack(edges1, edges2, reportFn = (e1, e2) => {}) {
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


