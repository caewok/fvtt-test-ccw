/* globals
foundry,
canvas,
*/
"use strict";

/* Functions to run tests of functionality
1. Test intersections
   A. testIntersections: Construct a series of pre-determined segments and
                         test against various intersection algorithms.
   B. testSceneIntersections: Use a scene's walls to test intersection algorithms.

2. ClockwiseSweep?
*/

import { findIntersectionsSortOriginalSingle, findIntersectionsSortOriginalRedBlack } from "./IntersectionsSortOriginal.js";
import { findIntersectionsSortAtroposSingle, findIntersectionsSortAtroposRedBlack } from "./IntersectionsSortAtropos.js";
import { findIntersectionsBruteSingle, findIntersectionsBruteRedBlack } from "./IntersectionsBrute.js";
import { findIntersectionsSortSingle, findIntersectionsSortRedBlack } from "./IntersectionsSort.js";
import { findIntersectionsMyersSingle, findIntersectionsMyersRedBlack } from "./IntersectionsSweepMyers.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import { pointsEqual, compareXY, generateBisectingCanvasSegments } from "./utilities.js";

/**
 * Test intersections algorithms against a map of pre-set segment arrays.
 * For each array of segments, compare to brute algorithm and report whether equivalent.
 */
export function testIntersections() {
  const testStrings = testSegmentStrings();

  let passed = true;
  for (const [key, str] of testStrings) {
    console.log(`\nTesting ${key}`);

    // Store the results of the reporting callback in array
    reporting_arr_brute.length = 0;
    reporting_arr_sort.length = 0;
    reporting_arr_myers.length = 0;
    reporting_arr_sort_original.length = 0;
    reporting_arr_sort_atropos.length = 0;
    reporting_arr_brute_filtered.length = 0;
    reporting_arr_sort_filtered.length = 0;
    reporting_arr_myers_filtered.length = 0;
    reporting_arr_sort_original_filtered.length = 0;
    reporting_arr_sort_atropos_filtered.length = 0;


    const segments = JSON.parse(str).map(s => new SimplePolygonEdge(s.A, s.B));

    findIntersectionsBruteSingle(segments, reportFnBrute);
    findIntersectionsSortSingle(segments, reportFnSort);
    findIntersectionsMyersSingle(segments, reportFnMyers);
    findIntersectionsSortOriginalSingle(segments, reportFnSortOriginal);
    findIntersectionsSortAtroposSingle(segments, reportFnSortAtropos);

    findIntersectionsBruteSingle(segments, reportFnBruteFilterEndpoints);
    findIntersectionsSortSingle(segments, reportFnSortFilterEndpoints);
    findIntersectionsMyersSingle(segments, reportFnMyersFilteredEndpoints);
    findIntersectionsSortOriginalSingle(segments, reportFnSortOriginalFilteredEndpoints);
    findIntersectionsSortAtroposSingle(segments, reportFnSortAtroposFilteredEndpoints);

    reporting_arr_brute.sort(compareXY);
    reporting_arr_sort.sort(compareXY);
    reporting_arr_myers.sort(compareXY);
    reporting_arr_sort_original.sort(compareXY);
    reporting_arr_sort_atropos.sort(compareXY);

    reporting_arr_brute_filtered.sort(compareXY);
    reporting_arr_sort_filtered.sort(compareXY);
    reporting_arr_myers_filtered.sort(compareXY);
    reporting_arr_sort_original_filtered.sort(compareXY);
    reporting_arr_sort_atropos_filtered.sort(compareXY);

    const res1 = checkIntersectionResults(reporting_arr_brute, reporting_arr_sort, "Sort");
    const res2 = checkIntersectionResults(reporting_arr_brute, reporting_arr_myers, "Myers");
    const res1b = checkIntersectionResults(reporting_arr_brute, reporting_arr_sort_original, "Sort Original");
    const res1c = checkIntersectionResults(reporting_arr_brute, reporting_arr_sort_atropos, "Sort Atropos");

    console.log("\n\tFiltered endpoints");
    const res3 = checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_filtered, "Sort");
    const res4 = checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_myers_filtered, "Myers");
    const res3b = checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_original_filtered, "Sort Original");
    const res3c = checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_atropos_filtered, "Sort Atropos");

    passed = passed && res1 && res2 && res3 && res4 && res1b && res1c && res3b && res3c;

    if (!passed) break;
  }
  return passed;
}

/**
 * Test intersection algorithms against the current scene's wall segments.
 * Compare each result to the brute algorithm results.
 */
export function testSceneIntersections() {
  const walls = [...canvas.walls.placeables];
  const segments = walls.map(w => SimplePolygonEdge.fromWall(w));

  // Store the results of the reporting callback in array
  reporting_arr_brute.length = 0;
  reporting_arr_sort.length = 0;
  reporting_arr_myers.length = 0;
  reporting_arr_sort_original.length = 0;
  reporting_arr_sort_atropos.length = 0;

  reporting_arr_brute_filtered.length = 0;
  reporting_arr_sort_filtered.length = 0;
  reporting_arr_myers_filtered.length = 0;
  reporting_arr_sort_original_filtered.length = 0;
  reporting_arr_sort_atropos_filtered.length = 0;

  findIntersectionsBruteSingle(segments, reportFnBrute);
  findIntersectionsSortSingle(segments, reportFnSort);
  findIntersectionsMyersSingle(segments, reportFnMyers);
  findIntersectionsSortOriginalSingle(segments, reportFnSortOriginal);
  findIntersectionsSortAtroposSingle(segments, reportFnSortAtropos);

  findIntersectionsBruteSingle(segments, reportFnBruteFilterEndpoints);
  findIntersectionsSortSingle(segments, reportFnSortFilterEndpoints);
  findIntersectionsMyersSingle(segments, reportFnMyersFilteredEndpoints);
  findIntersectionsSortOriginalSingle(segments, reportFnSortOriginalFilteredEndpoints);
  findIntersectionsSortAtroposSingle(segments, reportFnSortAtroposFilteredEndpoints);

  reporting_arr_brute.sort(compareXY);
  reporting_arr_sort.sort(compareXY);
  reporting_arr_myers.sort(compareXY);
  reporting_arr_sort_original.sort(compareXY);
  reporting_arr_sort_atropos.sort(compareXY);

  reporting_arr_brute_filtered.sort(compareXY);
  reporting_arr_sort_filtered.sort(compareXY);
  reporting_arr_myers_filtered.sort(compareXY);
  reporting_arr_sort_original_filtered.sort(compareXY);
  reporting_arr_sort_atropos_filtered.sort(compareXY);

  checkIntersectionResults(reporting_arr_brute, reporting_arr_sort, "Sort");
  checkIntersectionResults(reporting_arr_brute, reporting_arr_myers, "Myers");
  checkIntersectionResults(reporting_arr_brute, reporting_arr_sort_original, "Sort Original");
  checkIntersectionResults(reporting_arr_brute, reporting_arr_sort_atropos, "Sort Atropos");

  console.log("\n\tFiltered endpoints");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_filtered, "Sort");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_myers_filtered, "Myers");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_original_filtered, "Sort Original");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_atropos_filtered, "Sort Atropos");

  // Check red/black by intersecting the entire scene diagonally, horizontally, vertically
  console.log("\n\nRed/Black (4 segments added)");
  const black = generateBisectingCanvasSegments();

  reporting_arr_brute.length = 0;
  reporting_arr_sort.length = 0;
  reporting_arr_myers.length = 0;
  reporting_arr_sort_original.length = 0;
  reporting_arr_sort_atropos.length = 0;

  reporting_arr_brute_filtered.length = 0;
  reporting_arr_sort_filtered.length = 0;
  reporting_arr_myers_filtered.length = 0;
  reporting_arr_sort_original_filtered.length = 0;
  reporting_arr_sort_atropos_filtered.length = 0;

  findIntersectionsBruteRedBlack(segments, black, reportFnBrute);
  findIntersectionsSortRedBlack(segments, black, reportFnSort);
  findIntersectionsMyersRedBlack(segments, black, reportFnMyers);
  findIntersectionsSortOriginalRedBlack(segments, black, reportFnSortOriginal);
  findIntersectionsSortAtroposRedBlack(segments, black, reportFnSortAtropos);

  findIntersectionsBruteRedBlack(segments, black, reportFnBruteFilterEndpoints);
  findIntersectionsSortRedBlack(segments, black, reportFnSortFilterEndpoints);
  findIntersectionsMyersRedBlack(segments, black, reportFnMyersFilteredEndpoints);
  findIntersectionsSortOriginalRedBlack(segments, black, reportFnSortOriginalFilteredEndpoints);
  findIntersectionsSortAtroposRedBlack(segments, black, reportFnSortAtroposFilteredEndpoints);

  reporting_arr_brute.sort(compareXY);
  reporting_arr_sort.sort(compareXY);
  reporting_arr_myers.sort(compareXY);
  reporting_arr_sort_original.sort(compareXY);
  reporting_arr_sort_atropos.sort(compareXY);

  reporting_arr_brute_filtered.sort(compareXY);
  reporting_arr_sort_filtered.sort(compareXY);
  reporting_arr_myers_filtered.sort(compareXY);
  reporting_arr_sort_original_filtered.sort(compareXY);
  reporting_arr_sort_atropos_filtered.sort(compareXY);

  checkIntersectionResults(reporting_arr_brute, reporting_arr_sort, "Sort");
  checkIntersectionResults(reporting_arr_brute, reporting_arr_myers, "Myers");
  checkIntersectionResults(reporting_arr_brute, reporting_arr_sort_original, "Sort Original");
  checkIntersectionResults(reporting_arr_brute, reporting_arr_sort_atropos, "Sort Atropos");

  console.log("\n\tFiltered endpoints");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_filtered, "Sort");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_myers_filtered, "Myers");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_original_filtered, "Sort Original");
  checkIntersectionResults(reporting_arr_brute_filtered, reporting_arr_sort_atropos_filtered, "Sort Atropos");
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
  if (base.length !== test.length
      || !base.every((pt, idx) => pointsEqual(pt, test[idx]))) {

    console.error(`\tx ${label} (${base.length} ixs expected; ${test.length} ixs found)`);
    return false;

  } else {
    console.log(`\t√ ${label} (${base.length} ixs)`);
    return true;
  }
}


// ----- Reporting callbacks for testIntersections
/* eslint-disable no-var */
var reporting_arr_brute = [];
var reporting_arr_sort = [];
var reporting_arr_myers = [];
var reporting_arr_sort_original = [];
var reporting_arr_sort_atropos = [];
var reporting_arr_brute_filtered = [];
var reporting_arr_sort_filtered = [];
var reporting_arr_myers_filtered = [];
var reporting_arr_sort_original_filtered = [];
var reporting_arr_sort_atropos_filtered = [];

/* eslint-enable no-var */

const reportFnBrute = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_brute.push(x); // Avoid pushing null
};

const reportFnSort = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_sort.push(x);
};

const reportFnMyers = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_myers.push(x); // Avoid pushing null
};

const reportFnSortOriginal = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_sort_original.push(x);
};

const reportFnSortAtropos = (s1, s2) => {
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_sort_atropos.push(x);
};

const reportFnBruteFilterEndpoints = (s1, s2) => {
  if (s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_brute_filtered.push(x); // Avoid pushing null
};

const reportFnSortFilterEndpoints = (s1, s2) => {
  if (s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_sort_filtered.push(x); // Avoid pushing null
};

const reportFnMyersFilteredEndpoints = (s1, s2) => {
  if (s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_myers_filtered.push(x); // Avoid pushing null
};

const reportFnSortOriginalFilteredEndpoints = (s1, s2) => {
  if (s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_sort_original_filtered.push(x);
};

const reportFnSortAtroposFilteredEndpoints = (s1, s2) => {
  if (s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
  const x = foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  if (x) reporting_arr_sort_atropos_filtered.push(x);
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

  // Upside down V
  str = '[{"A":{"x":2400,"y":1600},"B":{"x":2800,"y":2100}},{"A":{"x":2000,"y":2100},"B":{"x":2400,"y":1600}}]';
  testStrings.set("upside down V", str);

  // +
  str = '[{"A":{"x":1912,"y":2000},"B":{"x":3300,"y":2000}},{"A":{"x":2600,"y":1300},"B":{"x":2600,"y":2812}}]';
  testStrings.set("+", str);

  // Vertical line, multiple lines cross (the "TV antenna")
  str = '[{"A":{"x":2600,"y":1300},"B":{"x":2600,"y":2812}},{"A":{"x":2037,"y":1450},"B":{"x":3137,"y":1700}},{"A":{"x":2162,"y":2325},"B":{"x":3925,"y":2350}},{"A":{"x":1675,"y":2650},"B":{"x":2875,"y":2612}},{"A":{"x":1912,"y":2000},"B":{"x":3300,"y":2000}}]';
  testStrings.set("TV antenna", str);

  // Vertical line with endpoints intersecting
  str = '[{"A":{"x":2037,"y":1450},"B":{"x":2600,"y":1600}},{"A":{"x":2600,"y":2000},"B":{"x":3300,"y":2000}},{"A":{"x":1675,"y":2650},"B":{"x":2600,"y":2500}},{"A":{"x":2600,"y":1300},"B":{"x":2600,"y":2812}},{"A":{"x":2600,"y":2600},"B":{"x":2100,"y":2700}},{"A":{"x":2600,"y":2300},"B":{"x":3925,"y":2350}}]';
  testStrings.set("TV antenna endpoints", str);

  // Horizontal line, multiple lines cross
  str = '[{"A":{"x":1675,"y":2650},"B":{"x":2200,"y":2000}},{"A":{"x":2200,"y":2100},"B":{"x":2500,"y":2600}},{"A":{"x":2037,"y":1450},"B":{"x":2700,"y":2500}},{"A":{"x":3700,"y":2300},"B":{"x":3300,"y":2000}},{"A":{"x":1700,"y":2200},"B":{"x":3700,"y":2200}},{"A":{"x":2600,"y":2100},"B":{"x":3900,"y":2400}}]';
  testStrings.set("horizontal with crossing", str);

  // Horizontal line, endpoints intersecting
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

  // Evil near asterix. Like near asterix, but has intersecting lines on the right side.
  str = '[{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1100}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":2200}},{"A":{"x":2400,"y":1600},"B":{"x":1900,"y":1600}},{"A":{"x":2400,"y":1600},"B":{"x":2400,"y":2200}},{"A":{"x":2312,"y":1300},"B":{"x":3325,"y":1237}},{"A":{"x":2475,"y":1925},"B":{"x":3350,"y":1862}},{"A":{"x":2637,"y":1687},"B":{"x":3087,"y":1400}},{"A":{"x":2400,"y":1600},"B":{"x":2900,"y":1600}},{"A":{"x":2712,"y":1437},"B":{"x":3262,"y":2100}}]';
  testStrings.set("Evil *", str);

  return testStrings;
}
