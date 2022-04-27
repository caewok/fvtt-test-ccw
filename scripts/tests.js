/* globals
foundry,
canvas,
*/
'use strict';

/* Functions to run tests of functionality
1. Test intersections
   A. testIntersections: Construct a series of pre-determined segments and
                         test against various intersection algorithms.
   B. testSceneIntersections: Use a scene's walls to test intersection algorithms.

2. ClockwiseSweep?
*/

import { findIntersectionsBruteSingle, findIntersectionsBruteRedBlack,  } from "./IntersectionsBrute.js";
import { findIntersectionsSortSingle, findIntersectionsSortRedBlack } from "./IntersectionsSort.js";
import { findIntersectionsMyersSingle } from "./IntersectionsSweepMyers.js";
import { clearDrawings, clearLabels, drawEdge, COLORS } from "./drawing.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import { pointsEqual, compareXY, describeSceneParameters } from "./utilities.js";

/**
 * Test intersections algorithms against a map of pre-set segment arrays.
 * For each array of segments, compare to brute algorithm and report whether equivalent.
 */
export function testIntersections() {
  const testStrings = testSegmentStrings();

  let passed = true;
  for(const [key, str] of testStrings) {
    console.log(`\nTesting ${key}`);

    // store the results of the reporting callback in array
    reporting_arr_brute.length = 0;
    reporting_arr_sort.length = 0;
    reporting_arr_myers.length = 0;
    reporting_arr_brute_filtered.length = 0;
    reporting_arr_sort_filtered.length = 0;
    reporting_arr_myers_filtered.length = 0;

    const segments = JSON.parse(str).map(s => new SimplePolygonEdge(s.A, s.B));

    //  for debugging
//     clearDrawings();
//     clearLabels();
//     segments.forEach(s => drawEdge(s, COLORS.black));

    findIntersectionsBruteSingle(segments, reportFnBrute);
    findIntersectionsSortSingle(segments, reportFnSort);
    findIntersectionsMyersSingle(segments, reportFnMyers);

    findIntersectionsBruteSingle(segments, reportFnBruteFilterEndpoints);
    findIntersectionsSortSingle(segments, reportFnSortFilterEndpoints);
    findIntersectionsMyersSingle(segments, reportFnMyersFilteredEndpoints);

    reporting_arr_brute.sort(compareXY);
    reporting_arr_sort.sort(compareXY);
    reporting_arr_myers.sort(compareXY);
    reporting_arr_brute_filtered.sort(compareXY);
    reporting_arr_sort_filtered.sort(compareXY);
    reporting_arr_myers_filtered.sort(compareXY);

    const res1 = checkIntersectionResults(reporting_arr_brute, reporting_arr_sort, "Sort");
    const res2 = checkIntersectionResults(reporting_arr_brute, reporting_arr_myers, "Myers");

    console.log("\n\tFiltered endpoints");
    const res3 = checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_filtered, "Sort");
    const res4 = checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_myers_filtered, "Myers");

    passed = passed && res1 && res2 && res3 && res4;

    if(!passed) break;
  }
  return passed;
}

/**
 * Test intersection algorithms against the current scene's wall segments.
 * Compare each result to the brute algorithm results.
 */
export function testSceneIntersections() {
  describeSceneParameters();

  const walls = [...canvas.walls.placeables];
  const segments = walls.map(w => SimplePolygonEdge.fromWall(w));

  //  for debugging
//   clearDrawings();
//   clearLabels();
//   segments.forEach(s => drawEdge(s, COLORS.red));

  // store the results of the reporting callback in array
  reporting_arr_brute.length = 0;
  reporting_arr_sort.length = 0;
  reporting_arr_myers.length = 0;
  reporting_arr_brute_filtered.length = 0;
  reporting_arr_sort_filtered.length = 0;
  reporting_arr_myers_filtered.length = 0;

  findIntersectionsBruteSingle(segments, reportFnBrute);
  findIntersectionsSortSingle(segments, reportFnSort);
  findIntersectionsMyersSingle(segments, reportFnMyers);

  findIntersectionsBruteSingle(segments, reportFnBruteFilterEndpoints);
  findIntersectionsSortSingle(segments, reportFnSortFilterEndpoints);
  findIntersectionsMyersSingle(segments, reportFnMyersFilteredEndpoints);


  reporting_arr_brute.sort(compareXY);
  reporting_arr_sort.sort(compareXY);
  reporting_arr_myers.sort(compareXY);
  reporting_arr_brute_filtered.sort(compareXY);
  reporting_arr_sort_filtered.sort(compareXY);
  reporting_arr_myers_filtered.sort(compareXY);

  checkIntersectionResults(reporting_arr_brute, reporting_arr_sort, "Sort");
  checkIntersectionResults(reporting_arr_brute, reporting_arr_myers, "Myers");

  console.log("\n\tFiltered endpoints");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_filtered, "Sort");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_myers_filtered, "Myers");

  // Check red/black by intersecting the entire scene diagonally, horizontally, vertically
  console.log("\n\nRed/Black (4 segments added)");
  const black = generateBisectingCanvasSegments();
//   black.forEach(s => drawEdge(s, COLORS.black));

  reporting_arr_brute.length = 0;
  reporting_arr_sort.length = 0;
//   reporting_arr_myers.length = 0;
  reporting_arr_brute_filtered.length = 0;
  reporting_arr_sort_filtered.length = 0;
//   reporting_arr_myers_filtered.length = 0;

  findIntersectionsBruteRedBlack(segments, black, reportFnBrute);
  findIntersectionsSortRedBlack(segments, black, reportFnSort);
//   findIntersectionsMyersRedBlack(segments, reportFnMyers);

  findIntersectionsBruteRedBlack(segments, black, reportFnBruteFilterEndpoints);
  findIntersectionsSortRedBlack(segments, black, reportFnSortFilterEndpoints);
//   findIntersectionsMyersRedBlack(segments, reportFnMyersFilteredEndpoints);


  reporting_arr_brute.sort(compareXY);
  reporting_arr_sort.sort(compareXY);
//   reporting_arr_myers.sort(compareXY);
  reporting_arr_brute_filtered.sort(compareXY);
  reporting_arr_sort_filtered.sort(compareXY);
//   reporting_arr_myers_filtered.sort(compareXY);

  checkIntersectionResults(reporting_arr_brute, reporting_arr_sort, "Sort");
//   checkIntersectionResults(reporting_arr_brute, reporting_arr_myers, "Myers");

  console.log("\n\tFiltered endpoints");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_filtered, "Sort");
//   checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_myers_filtered, "Myers");

}

/**
 * Report whether a set of segment intersections generated by one algorithm is
 * equivalent to another and report success/failure.
 * @param {Object[]}  base    Segment array to use as the base case
 * @param {Object[]}  test    Segment array to test against the base case
 * @param {String}    label   Identifier to display in the console.log or console.error.
 * @return {Boolean} True if equal.
 */
function checkIntersectionResults(base, test, label) {
  if(base.length !== test.length ||
     !base.every((pt, idx) => pointsEqual(pt, test[idx]))) {

     console.error(`\tx ${label} (${base.length} ixs expected; ${test.length} ixs found)`);
     return false;
//      console.table(base);
//      console.table(test);
  } else {
     console.log(`\t√ ${label} (${base.length} ixs)`);
     return true;
  }
}


/**
 * Return a set of 4 segments that bisect the canvas horizontally, vertically, diagonally.
 * For testing red-black intersections.
 * @return {Segments[]}
 */
function generateBisectingCanvasSegments() {
  const { height, width } = canvas.dimensions;
  const segments = [];
  segments.push(new SimplePolygonEdge({ x: 0, y: 0 }, { x: width, y: height })); // nw to se
  segments.push(new SimplePolygonEdge({ x: 0, y: height }, { x: width, y: 0 })); // sw to ne
  segments.push(new SimplePolygonEdge({ x: 0, y: height / 2 }, { x: width, y: height / 2 })); // horizontal
  segments.push(new SimplePolygonEdge({ x: width / 2, y: height }, { x: width / 2, y: 0 })); // vertical

  return segments;
}




// ----- Reporting callbacks for testIntersections
var reporting_arr_brute = [];
var reporting_arr_sort = [];
var reporting_arr_myers = [];
var reporting_arr_brute_filtered = [];
var reporting_arr_sort_filtered = [];
var reporting_arr_myers_filtered = [];

let reportFnBrute = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_brute.push(x); // avoid pushing null
};

let reportFnSort = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_sort.push(x);
};

let reportFnMyers = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_myers.push(x); // avoid pushing null
};

let reportFnBruteFilterEndpoints = (s1, s2) => {
  if(s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_brute_filtered.push(x); // avoid pushing null
};

let reportFnSortFilterEndpoints = (s1, s2) => {
  if(s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_sort_filtered.push(x); // avoid pushing null
};

let reportFnMyersFilteredEndpoints = (s1, s2) => {
  if(s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if(x) reporting_arr_myers_filtered.push(x); // avoid pushing null
};

// ----- Test segments for testIntersections
// To build new string from walls:
/*
walls = [...canvas.walls.placeables]
segments = walls.map(w => SimplePolygonEdge.fromWall(w));

// store coordinates for testing
s_coords = segments.map(s => {
  return { A: { x: s.A.x, y: s.A.y}, B: {x: s.B.x, y: s.B.y} }
});

// change to string
str = JSON.stringify(s_coords);
*/

function testSegmentStrings() {
  const testStrings = new Map();
  let str;

  str = '[{"A":{"x":1900,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":2100}}]';
  testStrings.set(">", str);

  // <
  str = '[{"A":{"x":2800,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":2800,"y":2100}}]';
  testStrings.set("<", str);

  // V
  str = '[{"A":{"x":2000,"y":1200},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":2800,"y":1200}}]';
  testStrings.set("V", str);

  // upside down V
  str = '[{"A":{"x":2400,"y":1600},"B":{"x":2800,"y":2100}},{"A":{"x":2000,"y":2100},"B":{"x":2400,"y":1600}}]';
  testStrings.set("upside down V", str);

  // +
  str = '[{"A":{"x":1912,"y":2000},"B":{"x":3300,"y":2000}},{"A":{"x":2600,"y":1300},"B":{"x":2600,"y":2812}}]';
  testStrings.set("+", str);

  // vertical line, multiple lines cross (the "TV antenna")
  str = '[{"A":{"x":2600,"y":1300},"B":{"x":2600,"y":2812}},{"A":{"x":2037,"y":1450},"B":{"x":3137,"y":1700}},{"A":{"x":2162,"y":2325},"B":{"x":3925,"y":2350}},{"A":{"x":1675,"y":2650},"B":{"x":2875,"y":2612}},{"A":{"x":1912,"y":2000},"B":{"x":3300,"y":2000}}]';
  testStrings.set("TV antenna", str);

  // Vertical line with endpoints intersecting
  str = '[{"A":{"x":2037,"y":1450},"B":{"x":2600,"y":1600}},{"A":{"x":2600,"y":2000},"B":{"x":3300,"y":2000}},{"A":{"x":1675,"y":2650},"B":{"x":2600,"y":2500}},{"A":{"x":2600,"y":1300},"B":{"x":2600,"y":2812}},{"A":{"x":2600,"y":2600},"B":{"x":2100,"y":2700}},{"A":{"x":2600,"y":2300},"B":{"x":3925,"y":2350}}]';
  testStrings.set("TV antenna endpoints", str);

  // horizontal line, multiple lines cross
  str = '[{"A":{"x":1675,"y":2650},"B":{"x":2200,"y":2000}},{"A":{"x":2200,"y":2100},"B":{"x":2500,"y":2600}},{"A":{"x":2037,"y":1450},"B":{"x":2700,"y":2500}},{"A":{"x":3700,"y":2300},"B":{"x":3300,"y":2000}},{"A":{"x":1700,"y":2200},"B":{"x":3700,"y":2200}},{"A":{"x":2600,"y":2100},"B":{"x":3900,"y":2400}}]';
  testStrings.set("horizontal with crossing", str);

  // horizontal line, endpoints intersecting
  str = '[{"A":{"x":1675,"y":2650},"B":{"x":2000,"y":2200}},{"A":{"x":2300,"y":2200},"B":{"x":2500,"y":2600}},{"A":{"x":2500,"y":2200},"B":{"x":2700,"y":2500}},{"A":{"x":2600,"y":2100},"B":{"x":3000,"y":2200}},{"A":{"x":1700,"y":2200},"B":{"x":3700,"y":2200}},{"A":{"x":3600,"y":2200},"B":{"x":3300,"y":2000}}]';
  testStrings.set("horizontal with intersecting", str);

  // Asterix *, center is endpoint
  str = '[{"A":{"x":1900,"y":1600},"B":{"x":2400,"y":1600}},{"A":{"x":1900,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":1900,"y":2200},"B":{"x":2400,"y":1600}},{"A":{"x":2900,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":1100},"B":{"x":2400,"y":1600}},{"A":{"x":2900,"y":2200},"B":{"x":2400,"y":1600}},{"A":{"x":2400,"y":2200},"B":{"x":2400,"y":1600}},{"A":{"x":2900,"y":1600},"B":{"x":2400,"y":1600}}]';
  testStrings.set("* with endpoint", str);

  // Asterix *, overlap at center point
  str = '[{"A":{"x":1900,"y":1100},"B":{"x":2900,"y":2100}},{"A":{"x":1900,"y":2100},"B":{"x":2900,"y":1100}},{"A":{"x":1900,"y":1600},"B":{"x":2900,"y":1600}},{"A":{"x":2400,"y":1100},"B":{"x":2400,"y":2100}}]';
  testStrings.set("* with overlap", str);

  // Near asterix. > plus * on the right; shared endpoint at center
  str = '[{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":2200}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":2400,"y":2200}}]';
  testStrings.set("Near *", str);

  // evil near asterix. Like near asterix, but has intersecting lines on the right side.
  str = '[{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":2200}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":2400,"y":2200}},{"A":{"x":2312,"y":1300},"B":{"x":3325,"y":1237}},{"A":{"x":2475,"y":1925},"B":{"x":3350,"y":1862}},{"A":{"x":2637,"y":1687},"B":{"x":3087,"y":1400}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1600}},{"A":{"x":2712,"y":1437},"B":{"x":3262,"y":2100}}]';
  testStrings.set("Evil *", str);

  return testStrings;
}