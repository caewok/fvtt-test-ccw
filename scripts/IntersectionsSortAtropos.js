/* globals
foundry
*/

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

"use strict";

export function findIntersectionsSortAtroposSingle(segments, reportFn = (_s1, _s2) => {}) {
  segments.sort((s1, s2) => (s1.nw.x - s2.nw.x) || (s1.se.x - s2.se.x));
  const ln = segments.length;
  for ( let i = 0; i < ln; i++ ) {
    const si = segments[i];
    for ( let j = i + 1; j < ln; j++ ) {
      const sj = segments[j];
      if ( sj.nw.x > si.se.x ) break;
      foundry.utils.lineSegmentIntersects(si.A, si.B, sj.A, sj.B) && reportFn(si, sj); // eslint-disable-line no-unused-expressions
    }
  }
}
