/* globals
foundry,
canvas,
PIXI
*/
"use strict";

/* Functions to run tests of functionality
1. Test intersections
   A. testIntersections: Construct a series of pre-determined segments and
                         test against various intersection algorithms.
   B. testSceneIntersections: Use a scene's walls to test intersection algorithms.

2. ClockwiseSweep?
*/

import { findIntersectionsBruteSingle, findIntersectionsBruteRedBlack } from "./IntersectionsBrute.js";
import { findIntersectionsSortSingle, findIntersectionsSortRedBlack } from "./IntersectionsSort.js";
import { findIntersectionsMyersSingle, findIntersectionsMyersRedBlack } from "./IntersectionsSweepMyers.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import { pointsEqual, compareXY, generateBisectingCanvasSegments } from "./utilities.js";
import * as drawing from "./drawing.js";
import * as random from "./random.js";
import { tracePolygon } from "./trace_polygon.js";

/**
 * Test difficult, overlapping shapes for union and intersect trace algorithm
 */
export function testPolygonUnionIntersectDifficultShapes() {
  const square = new PIXI.Polygon([
    1000, 1000,
    2000, 1000,
    2000, 2000,
    1000, 2000
  ]);

  const triangle = new PIXI.Polygon([
    0, 1000,
    2000, 1000,
    2000, 3000
  ]);

  const expected_poly_union = new PIXI.Polygon([
    2000, 1000,
    2000, 2000, // technically not needed for union (collinear)
    2000, 3000,
    0, 1000,
    1000, 1000, // technically not needed for union (collinear)
    2000, 1000
  ]);

  const expected_poly_intersect = new PIXI.Polygon([
    1000, 1000,
    2000, 1000,
    2000, 2000,
    1000, 2000,
    1000, 1000
  ]);

  const poly_union = tracePolygon(square, triangle, { union: true });
  const poly_intersect = tracePolygon(square, triangle, { union: false });

  drawing.drawShape(square, { color: drawing.COLORS.black });
  drawing.drawShape(triangle, { color: drawing.COLORS.black })
  drawing.drawShape(poly_union, { color: drawing.COLORS.blue, width: 2 })
  drawing.drawShape(poly_intersect, { color: drawing.COLORS.red, width: 2 })

  if ( !polygonsEquivalent(expected_poly_union, poly_union) ) {
    console.warn("Polygon x Polygon union failed.", poly_union);
  }

  if ( !polygonsEquivalent(expected_poly_intersect, poly_intersect) ) {
    console.warn("Polygon x Polygon intersect failed.", poly_intersect);
  }

  // Null shapes
  const triangle_t = triangle.translate(2000, 2000);
  const null_poly_union = tracePolygon(square, triangle_t, { union: true });
  const null_poly_intersect = tracePolygon(square, triangle_t, { union: false });

  if ( null_poly_union !== null ) {
    console.warn("Polygon x Polygon null union failed.", null_poly_union);
  }

  if ( null_poly_intersect !== null ) {
    console.warn("Polygon x Polygon null intersect failed.", null_poly_intersect);
  }

  // Rectangle
  const rect = new PIXI.Rectangle(3000, 500, 500, 1000);
  const square_t = square.translate(2000,0);
  const rect_union = tracePolygon(square_t, rect, { union: true });
  const rect_intersect = tracePolygon(square_t, rect, { union: false });

  drawing.drawShape(square_t, { color: drawing.COLORS.black });
  drawing.drawShape(rect, { color: drawing.COLORS.black })
  drawing.drawShape(rect_union, { color: drawing.COLORS.blue, width: 2 })
  drawing.drawShape(rect_intersect, { color: drawing.COLORS.red, width: 2 })

  const expected_rect_union = new PIXI.Polygon([
    3500, 1000,
    4000, 1000,
    4000, 2000,
    3000, 2000,
    3000, 1500, // technically not needed for union (collinear)
    3000, 500,
    3500, 500,
    3500, 1000
  ]);

  const expected_rect_ix = new PIXI.Polygon([
    3500, 1000,
    3500, 1500,
    3000, 1500,
//     3000, 1500,  // unnecessarily duplicated but difficult to avoid
    3000, 1000,
    3500, 1000
  ]);

  if ( !polygonsEquivalent(rect_union, expected_rect_union) ) {
    console.warn("Polygon x Rectangle union failed.", rect_union);
  }
  if ( !polygonsEquivalent(rect_intersect, expected_rect_ix) ) {
    console.warn("Polygon x Rectangle intersect failed.", rect_intersect);
  }

  // Null shapes
  const rect_t = new PIXI.Rectangle(3000, 3500, 500, 1000);
  const null_rect_union = tracePolygon(square, rect_t, { union: true });
  const null_rect_intersect = tracePolygon(square, rect_t, { union: false });

  if ( null_rect_union !== null ) {
    console.warn("Polygon x Rectangle null union failed.", null_rect_union);
  }

  if ( null_rect_intersect !== null ) {
    console.warn("Polygon x Rectangle null intersect failed.", null_rect_intersect);
  }


}

function polygonsEquivalent(poly1, poly2) {
  const ln = poly1.points.length;
  if ( ln !== poly2.points.length ) { return false; }
  for ( let i = 0; i < ln; i += 1 ) {
    if ( !poly1.points[i].almostEqual(poly2.points[i]) ) { return false; }
  }
  return true;
}

/**
 * Test trace algorithm for union/intersect polygon against various shapes.
 * Not easy to test automatically, so these functions draw a random polygon and
 * shape to let the user verify.
 * First uses trace algorithm, then uses clipper.
 * Blue is union; red is intersect.
 */
export function testPolygonPolygonUnionIntersect() {
  drawing.clearDrawings();
  drawing.clearLabels();

  // Offset origins so the polygons are easier to distinguish
  const origin = { x: 1000, y: 1000 };

  const poly1 = random.randomPolygon({ origin, minPts: 50, maxPts: 75, minRadius: 500});
  const poly2 = random.randomPolygon({ origin, minPts: 50, maxPts: 75, minRadius: 500});

  const poly_union = tracePolygon(poly1, poly2, { union: true });
  const poly_intersect = tracePolygon(poly1, poly2, { union: false });

  const clipper_union = poly1.unionPolygon(poly2);
  const clipper_intersect = poly1.intersectPolygon(poly2);

  drawing.drawShape(poly1, { color: drawing.COLORS.black });
  drawing.drawShape(poly2, { color: drawing.COLORS.black });
  drawing.drawShape(poly_union, { color: drawing.COLORS.blue, width: 2 });
  drawing.drawShape(poly_intersect, { color: drawing.COLORS.red, width: 2 });
  drawing.labelPoint(origin, "Trace algorithm");

  // Shift and draw again using clipper
  const poly1_t = poly1.translate(2000, 0);
  const poly2_t = poly2.translate(2000, 0);
  const clipper_union_t = clipper_union.translate(2000, 0);
  const clipper_intersect_t = clipper_intersect.translate(2000, 0);

  drawing.drawShape(poly1_t, { color: drawing.COLORS.black });
  drawing.drawShape(poly2_t, { color: drawing.COLORS.black });
  drawing.drawShape(clipper_union_t, { color: drawing.COLORS.blue, width: 2 });
  drawing.drawShape(clipper_intersect_t, { color: drawing.COLORS.red, width: 2 });
  drawing.labelPoint({x: 3000, y: 1000}, "Clipper algorithm");

  return [poly1, poly2];
}

export function testPolygonCircleUnionIntersect() {
  drawing.clearDrawings();
  drawing.clearLabels();

  // Offset origins so the polygons are easier to distinguish
  const origin = { x: 1000, y: 1000 };
  const origin2 = { x: 1100, y: 1100 };

  const poly = random.randomPolygon({ origin, minPts: 50, maxPts: 75, minRadius: 500});
  const circle = random.randomCircle({ origin: origin2, minRadius: 500 });

  const poly_union = circle.unionPolygon(poly);
  const poly_intersect = circle.intersectPolygon(poly);

  const clipper_union = poly.unionPolygon(circle.toPolygon());
  const clipper_intersect = poly.intersectPolygon(circle.toPolygon());

  drawing.drawShape(poly, { color: drawing.COLORS.black });
  drawing.drawShape(circle, { color: drawing.COLORS.black });
  drawing.drawShape(poly_union, { color: drawing.COLORS.blue, width: 2 });
  drawing.drawShape(poly_intersect, { color: drawing.COLORS.red, width: 2 });
  drawing.labelPoint(origin, "Trace algorithm");

  // Shift and draw again using clipper
  const poly_t = poly.translate(2000, 0);
  const circle_t = circle.translate(2000, 0);
  const clipper_union_t = clipper_union.translate(2000, 0);
  const clipper_intersect_t = clipper_intersect.translate(2000, 0);

  drawing.drawShape(poly_t, { color: drawing.COLORS.black });
  drawing.drawShape(circle_t, { color: drawing.COLORS.black });
  drawing.drawShape(clipper_union_t, { color: drawing.COLORS.blue, width: 2 });
  drawing.drawShape(clipper_intersect_t, { color: drawing.COLORS.red, width: 2 });
  drawing.labelPoint({x: 3000, y: 1000}, "Clipper algorithm");

  return [poly, circle];
}

export function testPolygonRectangleUnionIntersect() {
  drawing.clearDrawings();
  drawing.clearLabels();

  // Offset origins so the polygons are easier to distinguish
  const origin = { x: 1000, y: 1000 };
  const origin2 = { x: 1100, y: 1100 };

  const poly = random.randomPolygon({ origin, minPts: 50, maxPts: 75, minRadius: 500});
  const rect = random.randomRectangle({ origin: origin2, minWidth: 500, minHeight: 500 });

  const poly_union = rect.unionPolygon(poly);
  const poly_intersect = rect.intersectPolygon(poly);

  const clipper_union = poly.unionPolygon(rect.toPolygon());
  const clipper_intersect = poly.intersectPolygon(rect.toPolygon());

  drawing.drawShape(poly, { color: drawing.COLORS.black });
  drawing.drawShape(rect, { color: drawing.COLORS.black });
  drawing.drawShape(poly_union, { color: drawing.COLORS.blue, width: 2 });
  drawing.drawShape(poly_intersect, { color: drawing.COLORS.red, width: 2 });
  drawing.labelPoint(origin, "Trace algorithm");

  // Shift and draw again using clipper
  const poly_t = poly.translate(2000, 0);
  const rect_t = rect.translate(2000, 0);
  const clipper_union_t = clipper_union.translate(2000, 0);
  const clipper_intersect_t = clipper_intersect.translate(2000, 0);

  drawing.drawShape(poly_t, { color: drawing.COLORS.black });
  drawing.drawShape(rect_t, { color: drawing.COLORS.black });
  drawing.drawShape(clipper_union_t, { color: drawing.COLORS.blue, width: 2 });
  drawing.drawShape(clipper_intersect_t, { color: drawing.COLORS.red, width: 2 });
  drawing.labelPoint({x: 3000, y: 1000}, "Clipper algorithm");

  return [poly, rect];
}

export function testPolygonLimitedAngleUnionIntersect() {
  drawing.clearDrawings();
  drawing.clearLabels();

  // Offset origins so the polygons are easier to distinguish
  const origin = { x: 1000, y: 1000 };

  const poly = random.randomPolygon({ origin, minPts: 50, maxPts: 75, minRadius: 500});
  const la = random.randomLimitedAngle({ origin });

  const poly_union = la.unionPolygon(poly);
  const poly_intersect = la.intersectPolygon(poly);

  const clipper_union = poly.unionPolygon(la);
  const clipper_intersect = poly.intersectPolygon(la);

  drawing.drawShape(poly, { color: drawing.COLORS.black });
  drawing.drawShape(la, { color: drawing.COLORS.black });
  drawing.drawShape(poly_union, { color: drawing.COLORS.blue, width: 2 });
  drawing.drawShape(poly_intersect, { color: drawing.COLORS.red, width: 2 });
  drawing.labelPoint(origin, "Trace algorithm");

  // Shift and draw again using clipper
  const poly_t = poly.translate(2000, 0);
  const la_t = la.translate(2000, 0);
  const clipper_union_t = clipper_union.translate(2000, 0);
  const clipper_intersect_t = clipper_intersect.translate(2000, 0);

  drawing.drawShape(poly_t, { color: drawing.COLORS.black });
  drawing.drawShape(la_t, { color: drawing.COLORS.black });
  drawing.drawShape(clipper_union_t, { color: drawing.COLORS.blue, width: 2 });
  drawing.drawShape(clipper_intersect_t, { color: drawing.COLORS.red, width: 2 });
  drawing.labelPoint({x: 3000, y: 1000}, "Clipper algorithm");

  return [poly, la];
}

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

    reporting_arr_brute_filtered.length = 0;
    reporting_arr_sort_filtered.length = 0;
    reporting_arr_myers_filtered.length = 0;


    const segments = JSON.parse(str).map(s => new SimplePolygonEdge(s.A, s.B));

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

  reporting_arr_brute.length = 0;
  reporting_arr_sort.length = 0;
  reporting_arr_myers.length = 0;

  reporting_arr_brute_filtered.length = 0;
  reporting_arr_sort_filtered.length = 0;
  reporting_arr_myers_filtered.length = 0;

  findIntersectionsBruteRedBlack(segments, black, reportFnBrute);
  findIntersectionsSortRedBlack(segments, black, reportFnSort);
  findIntersectionsMyersRedBlack(segments, black, reportFnMyers);

  findIntersectionsBruteRedBlack(segments, black, reportFnBruteFilterEndpoints);
  findIntersectionsSortRedBlack(segments, black, reportFnSortFilterEndpoints);
  findIntersectionsMyersRedBlack(segments, black, reportFnMyersFilteredEndpoints);

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

var reporting_arr_brute_filtered = [];
var reporting_arr_sort_filtered = [];
var reporting_arr_myers_filtered = [];


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
