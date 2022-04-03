/* globals

foundry

*/

'use strict';

import { compareXY } from "./utilities.js";

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
 * Given an array of either walls or SimplePolygonEdges, identify all intersections.
 * Shared endpoints do not count.
 * Intersections marked in edge.intersectsWith map
 * Comparable to identifyWallIntersections method from WallsLayer Class
 */
export function findIntersectionsSingle(edges) {
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

      edge1.identifyIntersectionsWith(edge2)
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
export function findIntersectionsDouble(edges1, edges2) {
  const ln1 = edges1.length;
  const ln2 = edges2.length;
  if(!ln1 || !ln2) return;

  edges1.sort((a, b) => compareXY(a.nw, b.nw));
  edges2.sort((a, b) => compareXY(a.nw, b.nw));

  for(let i = 0; i < ln1; i += 1) {
    const edge1 = edges1[i]
    for(let j = 0; j < ln; j += 1) {
      const edge2 = edges[j];

      // if we have not yet reached the left end of this edge, we can skip
      if(isLeft(edge1, edge2)) continue;

      // if we reach the right end of this edge, we can skip the rest
      if(isRight(edge2, edge1)) break;

      edge1.identifyIntersectionsWith(edge2);
    }
  }
}


