/* globals
foundry
*/

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

"use strict";

export function findIntersectionsSortOriginalSingle(segments, reportFn = (_s1, _s2) => {}) {
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

const compare = (a, b) => {
  if ( a.x === b.x ) return a.y - b.y;
  else return a.x - b.x;
};


export function findIntersectionsSortOriginalRedBlack(red, black, reportFn = (_s1, _s2) => {}) {
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
