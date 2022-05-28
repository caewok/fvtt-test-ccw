/* globals
game,
foundry,
ClockwiseSweepPolygon
canvas,
WallEndpoint,
CONFIG
*/

"use strict";

import { MyClockwiseSweepPolygon } from "./MyClockwiseSweepPolygon.js";

/**
 * Describe in the console.log relevant scene parameters:
 * - scene name
 * - scene size
 * - number of walls
 * - number of unique wall endpoints
 * - number of intersections (brute algorithm)
 * - number of filtered intersections (brute algorithm)
 */
export function describeSceneParameters() {
  // Determine the unique number of endpoints, which tells us something about
  // how many segments intersect at endpoints here.
  const numEndpoints = new Set();
  canvas.walls.placeables.forEach(w => {
    const c = w.data.c;
    numEndpoints.add(WallEndpoint.getKey(c[0], c[1]));
    numEndpoints.add(WallEndpoint.getKey(c[2], c[3]));
  });


  console.log(`Scene ${canvas.scene.name}
Walls: ${canvas.walls.placeables.length}
Endpoints: ${numEndpoints.size}
Canvas dimensions: ${canvas.dimensions.width}x${canvas.dimensions.height}
`);
}


/**
 * Run a pre-set group of benchmarks for ClockwiseSweep variations on a given scene.
 * Uses the selected token for origin and rotation. Alternative parameters may be
 * supplied.
 * @param {Number}  n           Number of iterations for each benchmark test.
 * Optional:
 * @param {Point}   origin      Location from which to run ClockwiseSweep.
 * @param {Number}  rotation    Direction in degrees that the token is facing.
 * @param {Number}  radius      Vision circle measure, as provided in token setup.
 * @param {Number}  angle       Degrees for limited vision angle (first test).
 * @param {Number}  angle2      Degrees for limited vision angle (second test).
 *                              Usually, angle 2 is greater than 180º and angle is < 180º.
 */
export async function benchScene(n = 100, { origin, rotation, radius = 60, angle = 80, angle2 = 280 } = {}) {
  const t = canvas.tokens.controlled[0];
  origin ||= t?.center;

  if (!origin) {
    console.log("Please select a token or use an origin point parameter.");
    return;
  }
  console.log(`Origin: ${origin.x},${origin.y}`);

  rotation ||= t.data.rotation;
  if (typeof rotation === "undefined") {
    console.log("Please select a token or use a rotation parameter.");
    return;
  }
  console.log(`Rotation: ${rotation}`);

  console.log("\n----- Full Vision");
  let config = {angle: 360, rotation: t.data.rotation, type: "sight"};
  await quantileBenchSweep(n, origin, config);

  console.log(`\n----- Limited Radius ${radius}`);
  const radius_units = radius * canvas.dimensions.size / canvas.dimensions.distance;
  config = {angle: 360, rotation, radius: radius_units, density: 12, type: "sight"};
  await quantileBenchSweep(n, origin, config);

  console.log(`\n----- Limited Angle ${angle}`);
  config = {angle, rotation, density: 12, type: "sight"};
  await quantileBenchSweep(n, origin, config);

  console.log(`\n----- Limited Angle ${angle2}`);
  config = {angle: angle2, rotation, density: 12, type: "sight"};
  await quantileBenchSweep(n, origin, config);

  console.log(`\n----- Limited Radius ${radius}  + Limited Angle ${angle}`);
  config = {angle, radius: radius_units, rotation, density: 12, type: "sight"};
  await quantileBenchSweep(n, origin, config);

  console.log(`\n----- Limited Radius ${radius}  + Limited Angle ${angle2}`);
  config = {angle: angle2, radius: radius_units, rotation, density: 12, type: "sight"};
  await quantileBenchSweep(n, origin, config);
}

/**
 * Run a set of benchmarks, one for each ClockwiseSweep alternative + default.
 * @param {Number} n    Number of iterations for each benchmark.
 * @param ...args       Arguments passed to ClockwiseSweep. Typically origin and config.
 */
export async function benchSweep(n = 100, ...args) {
  game.modules.get("testccw").api.debug = false;
  CONFIG.debug.polygons = false;

  await ClockwiseSweepPolygon.benchmark(n, ...args);
  MyClockwiseSweepPolygon.benchmark(n, ...args);
}

/*
 * Compare sight performance between different algorithms
 * Tests w/ and w/o CCW switches: use_bezier, use_robust_ccw
 * @param {number} n      The number of iterations
 * @param {...any} args   Arguments passed to the polygon compute function
 */
export async function quantileBenchSweep(n=100, ...args) {
  game.modules.get("testccw").api.debug = false;
  CONFIG.debug.polygons = false;

  await QBenchmarkLoop(n, ClockwiseSweepPolygon, "create", ...args);
  await QBenchmarkLoop(n, MyClockwiseSweepPolygon, "create", ...args);
}


/**
 * For a given numeric array, calculate one or more quantiles.
 * @param {Number[]}  arr  Array of numeric values to calculate.
 * @param {Number[]}  q    Array of quantiles, each between 0 and 1.
 * @return {Object} Object with each quantile number as a property.
 *                  E.g., { ".1": 100, ".5": 150, ".9": 190 }
 */
function quantile(arr, q) {
  arr.sort((a, b) => a - b);
  if (!q.length) { return q_sorted(arr, q); }

  const out = {};
  for (let i = 0; i < q.length; i += 1) {
    const q_i = q[i];
    out[q_i] = q_sorted(arr, q_i);
  }

  return out;
}

/**
 * Re-arrange an array based on a given quantile.
 * Used by quantile function to identify locations of elements at specified quantiles.
 * @param {Number[]}  arr  Array of numeric values to calculate.
 * @param {Number}    q    Quantile to locate. E.g., .1, or .5 (median).
 */
function q_sorted(arr, q) {
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) {
    return arr[base] + (rest * (arr[base + 1] - arr[base]));
  }
  return arr[base];
}

/**
 * Round a decimal number to a specified number of digits.
 * @param {Number}  n       Number to round.
 * @param {Number}  digits  Digits to round to.
 */
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

  for (let i = -num_warmups; i < iterations; i += 1) {
    const t0 = performance.now();
    fn(...args);
    const t1 = performance.now();
    if (i >= 0) { timings.push(t1 - t0); }
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

  for (let i = -num_warmups; i < iterations; i += 1) {
    const args = setupFn(...setupArgs);
    const t0 = performance.now();
    fn(...args);
    const t1 = performance.now();
    if (i >= 0) { timings.push(t1 - t0); }
  }

  const sum = timings.reduce((prev, curr) => prev + curr);
  const q = quantile(timings, [.1, .5, .9]);

  console.log(`${name} | ${iterations} iterations | ${precision(sum, 4)}ms | ${precision(sum / iterations, 4)}ms per | 10/50/90: ${precision(q[.1], 6)} / ${precision(q[.5], 6)} / ${precision(q[.9], 6)}`);

  return timings;
}

/**
 * Helper function to run foundry.utils.benchmark a specified number of iterations
 * for a specified function, printing the results along with the specified name.
 * @param {Number}    iterations  Number of iterations to run the benchmark.
 * @param {Function}  fn          Function to test
 * @param ...args                 Arguments passed to fn.
 */
export async function benchmarkLoopFn(iterations, fn, name, ...args) {
  const f = () => fn(...args);
  Object.defineProperty(f, "name", {value: `${name}`, configurable: true});
  await foundry.utils.benchmark(f, iterations, ...args);
}

/**
 * Helper function to run foundry.utils.benchmark a specified number of iterations
 * for a specified function in a class, printing the results along with the specified name.
 * A class object must be passed to call the function and is used as the label.
 * Otherwise, this is identical to benchmarkLoopFn.
 * @param {Number}    iterations  Number of iterations to run the benchmark.
 * @param {Object}    thisArg     Instantiated class object that has the specified fn.
 * @param {Function}  fn          Function to test
 * @param ...args                 Arguments passed to fn.
 */
export async function benchmarkLoop(iterations, thisArg, fn, ...args) {
  const f = () => thisArg[fn](...args);
  Object.defineProperty(f, "name", {value: `${thisArg.name || thisArg.constructor.name}.${fn}`, configurable: true});
  await foundry.utils.benchmark(f, iterations, ...args);
}
