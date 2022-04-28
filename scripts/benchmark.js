/* globals
game,
foundry,
ClockwiseSweepPolygon
canvas,
WallEndpoint,
CONFIG
*/

'use strict';

import { MODULE_ID } from "./module.js";
import { findIntersectionsBruteSingle, findIntersectionsBruteRedBlack,  } from "./IntersectionsBrute.js";
import { findIntersectionsSortSingle, findIntersectionsSortRedBlack } from "./IntersectionsSort.js";
import { findIntersectionsMyersSingle, findIntersectionsMyersRedBlack } from "./IntersectionsSweepMyers.js";
import { describeSceneParameters, pointsEqual, generateBisectingCanvasSegments } from "./utilities.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";

export async function benchSceneIntersections(n = 100) {
  describeSceneParameters();

  const walls = [...canvas.walls.placeables];
  const segments = walls.map(w => SimplePolygonEdge.fromWall(w));

  // relatively realistic benchmark should include getting the ix point
  // but cannot push to an outside array b/c it would likely grow rather large
  // during benchmark repetitions.
  const reportFn = (s1, s2) => {
    return foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  };

  const reportFilteredFn = (s1, s2) => {
    if(s1.wallKeys.has(s2.A.key) || s1.wallKeys.has(s2.B.key)) return;
    return foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B);
  };

  await QBenchmarkLoopFn(n, findIntersectionsBruteSingle, "brute", segments, reportFn);
  await QBenchmarkLoopFn(n, findIntersectionsSortSingle, "sort", segments, reportFn);
  await QBenchmarkLoopFn(n, findIntersectionsMyersSingle, "myers", segments, reportFn);

  console.log("\nFiltered endpoints");
  await QBenchmarkLoopFn(n, findIntersectionsBruteSingle, "brute filtered", segments, reportFilteredFn);
  await QBenchmarkLoopFn(n, findIntersectionsSortSingle, "sort filtered", segments, reportFilteredFn);
  await QBenchmarkLoopFn(n, findIntersectionsMyersSingle, "myers filtered", segments, reportFilteredFn);

  console.log("\n\nRed/Black tests")
  console.log("\nAdding a single short segment (20% diagonal nw/se at center)");
  // diagonal from 40% x/y to 60% x/y in the center
  const { height, width } = canvas.dimensions;
  const short_segment = new SimplePolygonEdge({ x: width * 0.4, y: height * 0.4 },
                                          { x: width * 0.6, y: height * 0.6 });
  await QBenchmarkLoopFn(n, findIntersectionsBruteRedBlack, "brute", segments, [short_segment], reportFn);
  await QBenchmarkLoopFn(n, findIntersectionsSortRedBlack, "sort", segments, [short_segment], reportFn);
  await QBenchmarkLoopFn(n, findIntersectionsMyersRedBlack, "myers", segments, [short_segment], reportFn);
  await QBenchmarkLoopFn(n, findIntersectionsBruteRedBlack, "brute filtered", segments, [short_segment], reportFilteredFn);
  await QBenchmarkLoopFn(n, findIntersectionsSortRedBlack, "sort filtered", segments, [short_segment], reportFilteredFn);
  await QBenchmarkLoopFn(n, findIntersectionsMyersRedBlack, "myers filtered", segments, [short_segment], reportFilteredFn);

  console.log("\nAdding four long segments bisecting canvas");
  const long_segments = generateBisectingCanvasSegments();
  await QBenchmarkLoopFn(n, findIntersectionsBruteRedBlack, "brute", segments, long_segments, reportFn);
  await QBenchmarkLoopFn(n, findIntersectionsSortRedBlack, "sort", segments, long_segments, reportFn);
  await QBenchmarkLoopFn(n, findIntersectionsMyersRedBlack, "myers", segments, long_segments, reportFn);
  await QBenchmarkLoopFn(n, findIntersectionsBruteRedBlack, "brute filtered", segments, long_segments, reportFilteredFn);
  await QBenchmarkLoopFn(n, findIntersectionsSortRedBlack, "sort filtered", segments, long_segments, reportFilteredFn);
  await QBenchmarkLoopFn(n, findIntersectionsMyersRedBlack, "myers filtered", segments, long_segments, reportFilteredFn);

  console.log("\nAdding a randomly generated segment");
  const setupFn = (segments, reportFn) => [segments, [randomSegment()], reportFn];
  await QBenchmarkLoopWithSetupFn(n, setupFn, findIntersectionsBruteRedBlack, "brute", segments, reportFn);
  await QBenchmarkLoopWithSetupFn(n, setupFn, findIntersectionsSortRedBlack, "sort", segments, reportFn);
  await QBenchmarkLoopWithSetupFn(n, setupFn, findIntersectionsMyersRedBlack, "myers", segments, reportFn);
  await QBenchmarkLoopWithSetupFn(n, setupFn, findIntersectionsBruteRedBlack, "brute filtered", segments, reportFilteredFn);
  await QBenchmarkLoopWithSetupFn(n, setupFn, findIntersectionsSortRedBlack, "sort filtered", segments, reportFilteredFn);
  await QBenchmarkLoopWithSetupFn(n, setupFn, findIntersectionsMyersRedBlack, "myers filtered", segments, reportFilteredFn);
}



export async function benchSweep(n = 1000, ...args) {
  const num_endpoints = new Set();
  canvas.walls.placeables.forEach(w => {
    const c = w.data.c;
    num_endpoints.add(WallEndpoint.getKey(c[0], c[1]));
    num_endpoints.add(WallEndpoint.getKey(c[2], c[3]));
  });

  console.log(`${canvas.scene.name}\nWalls: ${canvas.walls.placeables.length}\nEndpoints: ${num_endpoints.size}\nLights: ${canvas.lighting?.placeables.length}\nCanvas dimensions: ${canvas.dimensions.width}x${canvas.dimensions.height}`);
  console.log(`Angle: ${args[1].angle}, Radius: ${args[1].radius}`);

  game.modules.get('testccw').api.debug = false;
  CONFIG.debug.polygons = false;

  const MyClockwiseSweepPolygon = game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon;

//   await RadialSweepPolygon.benchmark(n, ...args);
  await ClockwiseSweepPolygon.benchmark(n, ...args);
  await MyClockwiseSweepPolygon.benchmark(n, ...args);
}

/*
 * Compare sight performance between different algorithms
 * Tests w/ and w/o CCW switches: use_bezier, use_robust_ccw
 * @param {number} n      The number of iterations
 * @param {...any} args   Arguments passed to the polygon compute function
 */
export function quantileBenchSweep(n=1000, ...args) {
  // count number of unique endpoints
  const num_endpoints = new Set();
  canvas.walls.placeables.forEach(w => {
    const c = w.data.c;
    num_endpoints.add(WallEndpoint.getKey(c[0], c[1]));
    num_endpoints.add(WallEndpoint.getKey(c[2], c[3]));
  });

  console.log(`${canvas.scene.name}\nWalls: ${canvas.walls.placeables.length}\nEndpoints: ${num_endpoints.size}\nLights: ${canvas.lighting?.placeables.length}\nCanvas dimensions: ${canvas.dimensions.width}x${canvas.dimensions.height}`);
  console.log(`Angle: ${args[1].angle}, Radius: ${args[1].radius}`);

  game.modules.get('testccw').api.debug = false;
  CONFIG.debug.polygons = false;

  const MyClockwiseSweepPolygon = game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon;

//   QBenchmarkLoop(n, RadialSweepPolygon, "create", ...args);
  QBenchmarkLoop(n, ClockwiseSweepPolygon, "create", ...args);
  QBenchmarkLoop(n, MyClockwiseSweepPolygon, "create", ...args);
}


function quantile(arr, q) {
    arr.sort((a, b) => a - b);
    if(!q.length) { return q_sorted(arr, q); }

    const out = {};
    for(let i = 0; i < q.length; i += 1){
      const q_i = q[i];
      out[q_i] = q_sorted(arr, q_i);
    }

    return out;
}

function q_sorted(arr, q) {
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) {
     return arr[base] + rest * (arr[base + 1] - arr[base]);
  }
  return arr[base];
}


function precision(n, digits = 2) {
  return Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);
}


 /**
  * Benchmark a method of a class.
  * Includes a 5% warmup (at least 1 iteration) and prints 10%/50%/90% quantiles along
  * with the mean timing.
  * @param {number} iterations    Number of repetitions. Will add an additional 5% warmup.
  * @param {Object} thisArg       Class or other object that contains the method.
  * @param {string} name          Function name to benchmark
  * @param {Object} ...args       Additional arguments to pass to function
  * @return {Number[]}            Array with the time elapsed for each iteration.
  */
export async function QBenchmarkLoop(iterations, thisArg, fn_name, ...args) {
  const name = `${thisArg.name || thisArg.constructor.name}.${fn_name}`;
  const fn = (...args) => thisArg[fn_name](...args);
  return await QBenchmarkLoopFn(iterations, fn, name, ...args);
}

 /**
  * Benchmark a function
  * Includes a 5% warmup (at least 1 iteration) and prints 10%/50%/90% quantiles along
  * with the mean timing.
  * @param {number} iterations    Number of repetitions. Will add an additional 5% warmup.
  * @param {Function} fn            Function to benchmark
  * @param {string} name          Description to print to console
  * @param {Object} ...args       Additional arguments to pass to function
  * @return {Number[]}            Array with the time elapsed for each iteration.
  */
export async function QBenchmarkLoopFn(iterations, fn, name, ...args) {
  const timings = [];
  const num_warmups = Math.ceil(iterations * .05);

  for(let i = -num_warmups; i < iterations; i += 1) {
//     if(i % (iterations / 10) === 0) { console.log("..."); } // useful for long loops but kindof annoying otherwise
    const t0 = performance.now();
    fn.apply(null, [...args]);
    const t1 = performance.now();
    if(i >= 0) { timings.push(t1 - t0); }
  }

  const sum = timings.reduce((prev, curr) => prev + curr);
  const q = quantile(timings, [.1, .5, .9]);

  console.log(`${name} | ${iterations} iterations | ${precision(sum, 4)}ms | ${precision(sum / iterations, 4)}ms per | 10/50/90: ${precision(q[.1], 6)} / ${precision(q[.5], 6)} / ${precision(q[.9], 6)}`);

  return timings;
}

/**
 * Benchmark a function using a setup function called outside the timing loop.
 * The setup function must pass any arguments needed to the function to be timed.
 * @param {number} iterations     Number of repetitions. Will add an additional 5% warmup.
 * @param {Function} setupFn      Function to call prior to each loop of the benchmark.
 * @param {Function} fn             Function to benchmark
 * @param {string} name           Description to print to console
 * @param {Object} ...args        Additional arguments to pass to setup function
 * @return {Number[]}             Array with the time elapsed for each iteration.
 */
export async function QBenchmarkLoopWithSetupFn(iterations, setupFn, fn, name, ...setupArgs) {
  const timings = [];
  const num_warmups = Math.ceil(iterations * .05);

  for(let i = -num_warmups; i < iterations; i += 1) {
//     if(i % (iterations / 10) === 0) { console.log("..."); } // useful for long loops but kindof annoying otherwise
    const args = setupFn.apply(null, [...setupArgs]);
    const t0 = performance.now();
    fn.apply(null, [...args]);
    const t1 = performance.now();
    if(i >= 0) { timings.push(t1 - t0); }
  }

  const sum = timings.reduce((prev, curr) => prev + curr);
  const q = quantile(timings, [.1, .5, .9]);

  console.log(`${name} | ${iterations} iterations | ${precision(sum, 4)}ms | ${precision(sum / iterations, 4)}ms per | 10/50/90: ${precision(q[.1], 6)} / ${precision(q[.5], 6)} / ${precision(q[.9], 6)}`);

  return timings;
}



export async function benchmarkLoopFn(iterations, fn, name, ...args) {
  const f = () => fn(...args);
  Object.defineProperty(f, "name", {value: `${name}`, configurable: true});
  await foundry.utils.benchmark(f, iterations, ...args);
}

export async function benchmarkLoop(iterations, thisArg, fn, ...args) {
  const f = () => thisArg[fn](...args);
  Object.defineProperty(f, "name", {value: `${thisArg.name || thisArg.constructor.name}.${fn}`, configurable: true});
  await foundry.utils.benchmark(f, iterations, ...args);
}


function randomPoint(max_coord) {
  return { x: Math.floor(Math.random() * max_coord),
           y: Math.floor(Math.random() * max_coord) };
}
function randomSegment(max_x = canvas.dimensions.width, max_y = canvas.dimensions.height) {
  let a = randomPoint(max_x);
  let b = randomPoint(max_y);
  while(pointsEqual(a, b)) {
    // don't create lines of zero length
    a = randomPoint(max_x);
    b = randomPoint(max_y);
  }
  return new SimplePolygonEdge(a, b);
}
