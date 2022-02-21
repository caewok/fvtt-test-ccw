/* globals

foundry

*/

'use strict';

import { compareXY, keyForPoint } from "./utilities.js";

// Intersections

function intersectLines(a, b, c, d) {
  // If either line is length 0, they cannot intersect
  //if (((a.x === b.x) && (a.y === b.y)) || ((c.x === d.x) && (c.y === d.y))) return null;

  // Check denominator - avoid parallel lines where d = 0
  // if either line is length 0, dnm == 0.
  const dnm = ((d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y));
  if (dnm === 0) return null;

  // Vector distance from a
  const t0 = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / dnm;

  // Return the point of intersection
  return {
    x: a.x + t0 * (b.x - a.x),
    y: a.y + t0 * (b.y - a.y),
    t0: t0
  }

}


function intersectSegments(a, b, c, d, epsilon = 1e-8) {

  // If either line is length 0, they cannot intersect
  //if (((a.x === b.x) && (a.y === b.y)) || ((c.x === d.x) && (c.y === d.y))) return null;

  // Check denominator - avoid parallel lines where dnm = 0
  // if either line is length 0, dnm == 0.
  const dnm = ((d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y));
  if (dnm === 0) return null;

  // Vector distance from a
  const t0 = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / dnm;
  if(t0 < 0 || t0 > 1) { return null; }
  //if ( !Number.between(t0, 0-epsilon, 1+epsilon) ) return null;

  // Vector distance from c
  const t1 = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / dnm;
  if(t1 < 0 || t1 > 1) { return null; }
  //if ( !Number.between(t1, 0-epsilon, 1+epsilon) ) return null;

  // Return the point of intersection and the vector distance from both line origins
  return {
    x: a.x + t0 * (b.x - a.x),
    y: a.y + t0 * (b.y - a.y),
    t0: Math.clamped(t0, 0, 1),
    t1: Math.clamped(t1, 0, 1)
  }
}



function intersectSegments$1(a, b) {
  // Note: this is almost the same as geom.intersectSegments()
  // The main difference is that we don't have a pre-computed
  // value for dx/dy on the segments.
  //  https://stackoverflow.com/a/1968345/125351
  var aStart = a.from, bStart = b.from;
  var p0_x = aStart.x, p0_y = aStart.y,
      p2_x = bStart.x, p2_y = bStart.y;

  var s1_x = a.from.x - a.to.x, s1_y = a.from.y - a.to.y, s2_x = b.from.x - b.to.x, s2_y = b.from.y - b.to.y;
  var div = s1_x * s2_y - s2_x * s1_y;

  var s = (s1_y * (p0_x - p2_x) - s1_x * (p0_y - p2_y)) / div;
  if (s < 0 || s > 1) { return; }

  var t = (s2_x * (p2_y - p0_y) + s2_y * (p0_x - p2_x)) / div;

  if (t >= 0 && t <= 1) {
    return {
      x: p0_x - (t * s1_x),
      y: p0_y - (t * s1_y)
    }
  }
}

// Given an array of A, B segments,




export class Intersections2 {
  constructor({ reportIntersection = Intersections2.defaultReporter,
                intersectTest = Intersections2.defaultTester } = {}) {

    this.reportIntersection = reportIntersection;
    this.intersectTest = intersectTest;
  }

  prep(segments) { return segments; }


  find(segments1, segments2, { prepped = false } = {}) {
    if(!prepped) {
      segments1 = this.prep(segments1)
      segments2 = segments2 ? this.prep(segments2) : segments2;
    }

    return Intersections2._process(segments1, segments2,
      { reportIntersection: this.reportIntersection,
        intersectTest: this.intersectTest });
  }

  static _process(segments1, segments2,
    { reportIntersection = Intersections2.defaultReporter,
      intersectTest = Intersections2.defaultTester } = {}) {

    const results = [];

    // handle case where we have a single array of segments versus two arrays
    const incr_j = segments2 ? 0 : 1;
    segments2 = segments2 ? segments2 : segments1;

    const ln1 = segments1.length;
    const ln2 = segments2.length;
    for(let i = 0; i < ln1; ++i) {
      const test = segments1[i];
      const j_start = (i + 1) * incr_j;

      for (let j = j_start; j < ln2; ++j) {
        const other = segments2[j];
        const pt = intersectTest(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }


  }

  _singlePool(segments) {
    const reportIntersection = this.reportIntersection;
    const intersectTest = this.intersectTest;
    const results = [];

    const ln = segments.length;
    for(let i = 0; i < ln; ++i) {
      const test = segments[i];
      for (let j = i + 1; j < ln; ++j) {
        const other = segments[j];
        const pt = intersectTest(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;
  }

  _doublePool(segments1, segments2) {
    const reportIntersection = this.reportIntersection;
    const intersectTest = this.intersectTest;
    const results = [];

    const ln1 = segments1.length;
    const ln2 = segments2.length;
    for(let i = 0; i < ln1; ++i) {
      const test = segments1[i];
      for (let j = 0; j < ln2; ++j) {
        const other = segments2[j];
        const pt = intersectTest(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;
  }


  static defaultTester(test, other) {
    return intersectSegments$1(test, other);
  }

  static defaultReporter(results, p, interior, indices) {
    results.push({
      point: p,
      segments: interior,
      indices: indices
    });
  }

  static run(segments1, segments2, { reportIntersection = Intersections2.defaultReporter } = {}) {
    if(!segments2) return Intersections2.singlePool(segments1, { reportIntersection });
    return Intersections2.doublePool(segments1, segments2, { reportIntersection });
  }

  static singlePool(segments,
           { reportIntersection = Intersections2.defaultReporter } = {}) {
    const results = [];
    const ln = segments.length;
    for(let i = 0; i < ln; ++i) {
      const test = segments[i];
      for (let j = i + 1; j < ln; ++j) {
        const other = segments[j];
        const pt = intersectSegments$1(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;
  }

  static doublePool(segments1, segments2,
    { reportIntersection = Intersections2.defaultReporter } = {}) {
    const results = [];
    const ln1 = segments1.length;
    const ln2 = segments2.length;
    for(let i = 0; i < ln1; ++i) {
      const test = segments1[i];
      for (let j = 0; j < ln2; ++j) {
        const other = segments2[j];
        const pt = intersectSegments$1(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;
  }

}


export class BruteSortIntersections extends Intersections2 {
  prep(segments) {
    // set up min/max properties if not already
    segments.forEach(l => {
      if(typeof l.min_x === "undefined") {
        const first_is_min = (l.from.x - l.to.x) < 0;
        l.min_x = first_is_min ? l.from.x : l.to.x;
        l.max_x = !first_is_min ? l.from.x : l.to.x; // will use later
      }
    });

    segments.sort((a, b) => {
      return a.min_x - b.min_x;
    });

    return segments;
  }

 static _process(segments1, segments2,
    { reportIntersection = Intersections2.defaultReporter,
      intersectTest = Intersections2.defaultTester } = {}) {

    const results = [];

    // handle case where we have a single array of segments versus two arrays
    const incr_j = segments2 ? 0 : 1;
    segments2 = segments2 ? segments2 : segments1;

    const ln1 = segments1.length;
    const ln2 = segments2.length;
    for(let i = 0; i < ln1; ++i) {
      const test = segments1[i];
      const test_min_x = test.min_x;
      const test_max_x = test.max_x;
      const j_start = (i + 1) * incr_j;

      for (let j = j_start; j < ln2; ++j) {
        const other = segments2[j];

        // if we have not yet reached the left end of this segment, we can skip
        if(other.max_x < test_min_x) continue;

        // if we reach the right end of this segment, we can skip the rest
        if(other.min_x > test_max_x) break;

        const pt = intersectTest(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;
 }
  _singlePool(segments) {
    const reportIntersection = this.reportIntersection;
    const intersectTest = this.intersectTest;
    const results = [];

    const ln = segments.length;
    for(let i = 0; i < ln; ++i) {
      const test = segments[i];
      const test_min_x = test.min_x;
      const test_max_x = test.max_x;

      for (let j = i + 1; j < ln; ++j) {
        const other = segments[j];

        // if we have not yet reached the left end of this segment, we can skip
        if(other.max_x < test_min_x) continue;

        // if we reach the right end of this segment, we can skip the rest
        if(other.min_x > test_max_x) break;

        const pt = intersectTest(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;

  }

  _doublePool(segments1, segments2) {
    const reportIntersection = this.reportIntersection;
    const intersectTest = this.intersectTest;
    const results = [];

    const ln1 = segments1.length;
    const ln2 = segments2.length;
    for(let i = 0; i < ln1; ++i) {
      const test = segments1[i];
      const test_min_x = test.min_x;
      const test_max_x = test.max_x;

      for (let j = 0; j < ln2; ++j) {
        const other = segments2[j];

        // if we have not yet reached the left end of this segment, we can skip
        if(other.max_x < test_min_x) continue;

        // if we reach the right end of this segment, we can skip the rest
        if(other.min_x > test_max_x) break;

        const pt = intersectTest(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;
  }

}

export class BruteSortXYIntersections extends Intersections2 {
  prep(segments) {
    // set up min/max properties if not already
    segments.forEach(l => {
      if(typeof l.min_xy === "undefined") {
        const first_is_min = compareXY(l.from, l.to) < 0;
        l.min_xy = first_is_min ? l.from : l.to;
        l.max_xy = !first_is_min ? l.from : l.to; // will use later
      }
    });

    segments.sort((a, b) => {
      return compareXY(a.min_xy, b.min_xy);
    });

    return segments;
  }

  static _process(segments1, segments2,
    { reportIntersection = Intersections2.defaultReporter,
      intersectTest = Intersections2.defaultTester } = {}) {

    const results = [];

    // handle case where we have a single array of segments versus two arrays
    const incr_j = segments2 ? 0 : 1;
    segments2 = segments2 ? segments2 : segments1;

    const ln1 = segments1.length;
    const ln2 = segments2.length;
    for(let i = 0; i < ln1; ++i) {
      const test = segments1[i];
      const test_min_xy = test.min_xy;
      const test_max_xy = test.max_xy;
      const j_start = (i + 1) * incr_j;

      for (let j = j_start; j < ln2; ++j) {
        const other = segments2[j];

        // if we have not yet reached the left end of this segment, we can skip
        if(compareXY(other.max_xy, test_min_xy) < 0) continue;

        // if we reach the right end of this segment, we can skip the rest
        if(compareXY(other.min_xy, test_max_xy) > 0) break;

        const pt = intersectTest(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;
  }


  _singlePool(segments) {
    const reportIntersection = this.reportIntersection;
    const intersectTest = this.intersectTest;
    const results = [];

    const ln = segments.length;
    for(let i = 0; i < ln; ++i) {
      const test = segments[i];
      const test_min_xy = test.min_xy;
      const test_max_xy = test.max_xy;

      for (let j = i + 1; j < ln; ++j) {
        const other = segments[j];

        // if we have not yet reached the left end of this segment, we can skip
        if(compareXY(other.max_xy, test_min_xy) < 0) continue;

        // if we reach the right end of this segment, we can skip the rest
        if(compareXY(other.min_xy, test_max_xy) > 0) break;

        const pt = intersectTest(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;

  }

  _doublePool(segments1, segments2) {
    const reportIntersection = this.reportIntersection;
    const intersectTest = this.intersectTest;
    const results = [];

    const ln1 = segments1.length;
    const ln2 = segments2.length;
    for(let i = 0; i < ln1; ++i) {
      const test = segments1[i];
      const test_min_xy = test.min_xy;
      const test_max_xy = test.max_xy;

      for (let j = 0; j < ln2; ++j) {
        const other = segments2[j];

        // if we have not yet reached the left end of this segment, we can skip
        if(compareXY(other.max_xy, test_min_xy) < 0) continue;

        // if we reach the right end of this segment, we can skip the rest
        if(compareXY(other.min_xy, test_max_xy) > 0) break;

        const pt = intersectTest(test, other);
        if (pt) {
          reportIntersection(results, pt, [test, other], { i: i, j: j });
        }
      }
    }
    return results;
  }

}




export class Intersections {

  static defaultIntersectionReporter(results, p, interior) {
      results.push({
        point: p,
        segments: interior
      });
    }

  static brute(lines, options) {
    let results = [];
    let reportIntersection = (options && options.onFound) ||
                              Intersections.defaultIntersectionReporter;

    return {
      /**
       * Execute brute force of the segment intersection search
       */
      run: run,
      /**
       * Access to results array. Works only when you use default onFound() handler
       */
      results: results,
    }



    function run() {
      for(let i = 0; i < lines.length; ++i) {
        const test = lines[i];
        for (let j = i + 1; j < lines.length; ++j) {
          const other = lines[j];
          const pt = intersectSegments$1(test, other);
          if (pt) {
            reportIntersection(results, pt, [test, other]);
          }
        }
      }
      return results;
    }

//     function defaultIntersectionReporter(p, interior) {
//       results.push({
//         point: p,
//         segments: interior
//       });
//     }
  }



  static bruteSort(lines, options) {
    let results = [];
    let reportIntersection = (options && options.onFound) || defaultIntersectionReporter;
    let asyncState;

    // need to sort by (min x)

    // set up min/max properties if not already
    lines.forEach(l => {
      if(typeof l.min_x === "undefined") {
        const first_is_min = (l.from.x - l.to.x) < 0;
        l.min_x = first_is_min ? l.from.x : l.to.x;
        l.max_x = !first_is_min ? l.from.x : l.to.x; // will use later
      }
    });

    lines.sort((a, b) => {
      return a.min_x - b.min_x;
    });

    return {
      /**
       * Execute brute force segment intersection search after sorting the lines
       */
      run: run,

      /**
       * Access to results array. Works only when you use default onFound()
       */
      results: results,

      /**
       * Peforms a single step in the brute force algorithm()
       */
      step: step

    }

    function step() {
      if (!asyncState) {
        asyncState = {
          i: 0
        };
      }
      const test = lines[asyncState.i];

//       const cmp_res = compareXY(test.from, test.to) < 0;
//       const test_min_x = cmp_res ? test.from.x : test.to.x; // nw
//       const test_max_x = !cmp_res ? test.from.x : test.to.x; // se


     const test_min_x = test.min_x;
     const test_max_x = test.max_x;

      for (let j = asyncState.i + 1; j < lines.length; ++j) {
        const other = lines[j];

//         const cmp_res = compareXY(other.from, other.to) < 0;
//         const other_min_x = cmp_res ? test.from.x : test.to.x; // nw
//         const other_max_x = !cmp_res ? test.from.x : test.to.x; // se

        // const other_min_x = Math.min(other.from.x, other.to.x);
//         const other_max_x = Math.max(other.from.x, other.to.x);

        // if we have not yet reached the left end of this segment, we can skip
        if(other.max_x < test_min_x) continue;

        // if we reach the right end of this segment, we can skip the rest
        if(other.min_x > test_max_x) break;


        const pt = intersectSegments$1(test, other);
        if (pt) {
          if (reportIntersection(pt, [test, other])) {
            return;
          }
        }
      }
      asyncState.i += 1;
      return asyncState.i < lines.length;
    }

    function run() {
      for(let i = 0; i < lines.length; ++i) {
        const test = lines[i];

//       const cmp_res = compareXY(test.from, test.to) < 0;
//       const test_min_x = cmp_res ? test.from.x : test.to.x; // nw
//       const test_max_x = !cmp_res ? test.from.x : test.to.x; // se


     const test_min_x = test.min_x;
     const test_max_x = test.max_x;


        for (var j = i + 1; j < lines.length; ++j) {
          const other = lines[j];

//         const cmp_res = compareXY(other.from, other.to) < 0;
//         const other_min_x = cmp_res ? test.from.x : test.to.x; // nw
//         const other_max_x = !cmp_res ? test.from.x : test.to.x; // se

        // const other_min_x = Math.min(other.from.x, other.to.x);
//         const other_max_x = Math.max(other.from.x, other.to.x);

        // if we have not yet reached the left end of this segment, we can skip
        if(other.max_x < test_min_x) continue;

        // if we reach the right end of this segment, we can skip the rest
        if(other.min_x > test_max_x) break;

          const pt = intersectSegments$1(test, other);
          if(pt) {
            if (reportIntersection(pt, [test, other])) {
              return;
            }
          }
        }
      }
      return results;
    }

    function defaultIntersectionReporter(p, interior) {
      results.push({
        point: p,
        segments: interior
      });
    }

  }
  static bruteSortFast(lines, options) {
    let results = [];
    let reportIntersection = (options && options.onFound) || defaultIntersectionReporter;
    let asyncState;

    // need to sort by (min x)

    // set up min/max properties if not already
    lines.forEach(l => {
      if(typeof l.min_x === "undefined") {
        const first_is_min = (l.from.x - l.to.x) < 0;
        l.min_x = first_is_min ? l.from.x : l.to.x;
        l.max_x = !first_is_min ? l.from.x : l.to.x; // will use later
      }
    });

    lines.sort((a, b) => {
      return a.min_x - b.min_x;
    });

    return {
      /**
       * Execute brute force segment intersection search after sorting the lines
       */
      run: run,

      /**
       * Access to results array. Works only when you use default onFound()
       */
      results: results,

      /**
       * Peforms a single step in the brute force algorithm()
       */
      step: step

    }

    function step() {
      if (!asyncState) {
        asyncState = {
          i: 0
        };
      }
      const test = lines[asyncState.i];

//       const cmp_res = compareXY(test.from, test.to) < 0;
//       const test_min_x = cmp_res ? test.from.x : test.to.x; // nw
//       const test_max_x = !cmp_res ? test.from.x : test.to.x; // se


     const test_min_x = test.min_x;
     const test_max_x = test.max_x;

      for (let j = asyncState.i + 1; j < lines.length; ++j) {
        const other = lines[j];

//         const cmp_res = compareXY(other.from, other.to) < 0;
//         const other_min_x = cmp_res ? test.from.x : test.to.x; // nw
//         const other_max_x = !cmp_res ? test.from.x : test.to.x; // se

        // const other_min_x = Math.min(other.from.x, other.to.x);
//         const other_max_x = Math.max(other.from.x, other.to.x);

        // if we have not yet reached the left end of this segment, we can skip
        if(other.max_x < test_min_x) continue;

        // if we reach the right end of this segment, we can skip the rest
        if(other.min_x > test_max_x) break;


          //const pt = intersectSegments$1(test, other);
          //const pt = foundry.utils.lineSegmentIntersection(test.from, test.to, other.from, other.to);
          //const pt = intersectSegments(test.from, test.to, other.from, other.to);
          if(!foundry.utils.lineSegmentIntersects(test.from, test.to, other.from, other.to)) continue;

          const pt = intersectLines(test.from, test.to, other.from, other.to);

        if (pt) {
          if (reportIntersection(pt, [test, other])) {
            return;
          }
        }
      }
      asyncState.i += 1;
      return asyncState.i < lines.length;
    }

    function run() {
      for(let i = 0; i < lines.length; ++i) {
        const test = lines[i];



        const test_min_x = test.min_x;
        const test_max_x = test.max_x;


        for (let j = i + 1; j < lines.length; ++j) {
          const other = lines[j];


//           const other_min_x = Math.min(other.from.x, other.to.x);
//           const other_max_x = Math.max(other.from.x, other.to.x);

          // if we have not yet reached the left end of this segment, we can skip
          if(other.max_x < test_min_x) continue;

          // if we reach the right end of this segment, we can skip the rest
          if(other.min_x > test_max_x) break;

          //const pt = intersectSegments$1(test, other);
          //const pt = foundry.utils.lineSegmentIntersection(test.from, test.to, other.from, other.to);
          //const pt = intersectSegments(test.from, test.to, other.from, other.to);
           if(!foundry.utils.lineSegmentIntersects(test.from, test.to, other.from, other.to)) continue;

          const pt = intersectLines(test.from, test.to, other.from, other.to);

          if(pt) {
            if (reportIntersection(pt, [test, other])) { return; }
          }
        }
      }
      return results;
    }

    function defaultIntersectionReporter(p, interior) {
      results.push({
        point: p,
        segments: interior
      });
    }

  }

  static find(segments1, segments2,
                           processing_fn = Intersections.processIntersectionOnly,
                           { sort = true } = {}) {
    if(sort) {
      segments1.sort((a, b) => { return a.A.x - b.A.x; })
      segments2.sort((a, b) => { return a.A.x - b.A.x; })
    }


    const intersections = [];
    const ln = segments1.length;
    for(let i = 0; i < ln; i += 1) {
      const segment = segments1[i];

      const res = Intersections.findForSegment(segment, segments2,
                    processing_fn, { sort: false, i: i });
      intersections.push(...res);
    }

    return intersections;
  }

  static findForSegment(segment, segments,
         processing_fn = Intersections.processIntersectionOnly,
         { sort = true, i = 0 } = {}) {
    if(sort) segments.sort((a, b) => { return a.A.x - b.A.x; });

    const s_min_x = segment.min_x ?? Math.min(segment.A.x, segment.B.x);
    const s_max_x = segment.max_x ?? Math.max(segment.A.x, segment.B.x);
    const s_edgeKeys = segment.edgeKeys ?? new Set(keyForPoint(segment.A), keyForPoint(segment.B))

    const intersections = [];
    const ln = segments.length;
    for(let j = 0; j < ln; j += 1) {
      const other = segments[j];
      if(segment === other) continue;

      const o_edgeKeys = other.edgeKeys ??
                         new Set(keyForPoint(other.A), keyForPoint(other.B));

      // If edges share 1 or 2 endpoints, skip
      if(s_edgeKeys.intersects(o_edgeKeys)) continue;

      // if we have not yet reached the left end of this segment, we can skip
      const o_max_x = other.max_x ?? Math.max(other.A.x, other.B.x);
      if(o_max_x < s_min_x) continue;


      // if we reach the right end of this segment, we can skip the rest
      const o_min_x = other.min_x ?? Math.min(other.A.x, other.B.x);
      if(o_min_x > s_max_x) break;

      const wa = segment.A;
      const wb = segment.B;
      const oa = other.A;
      const ob = other.B;

      // Record any intersections
      if ( !foundry.utils.lineSegmentIntersects(wa, wb, oa, ob) ) continue;
      const x = foundry.utils.lineLineIntersection(wa, wb, oa, ob);
      if ( !x ) continue;

      intersections.push(processing_fn(x, segment, other, i, j));
    }

    return intersections;
  }



  static processIntersectionOnly(x) { return x; }

  static processWithIndices(x, segment, segment2, i, j) {
    return { x: x, i: i, j: j};
  }

}