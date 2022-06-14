/* globals
game,
foundry,
ClockwiseSweepPolygon
canvas,
WallEndpoint,
CONFIG
*/

"use strict";

import { generateBisectingCanvasSegments } from "./utilities.js";
import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import {
  randomSegment,
  randomPolygon,
  randomCircle,
  randomRectangle,
  randomLimitedAngle,
  randomUniform } from "./random.js";

import { tracePolygon } from "./trace_polygon.js";

import { SETTINGS } from "./module.js";

function randomInteger(min, max) {
  return Math.roundFast((Math.random() + min) * max)
}

/**
 * Benchmark token visibility.
 * For each token in the scene:
 * - control the token
 * - test visibility of all other tokens
 */


export async function benchTokenVisibility(n = 100) {
  const default_setting = SETTINGS.useTestVisibility;
  const default_percent_area = SETTINGS.percentArea;

  console.log(`Benching token visibility for ${canvas.tokens.placeables.length - 1} tokens.`);

  const tokens = canvas.tokens.placeables.filter(t => !t.controlled);
  const testFn = function(tokens) {
    const out = [];
    for ( const token of tokens ) {
       const tolerance = token.document.iconSize / 4;

       // randomize a bit to try to limit caching
       const center = {
         x: token.center.x + Math.roundFast(randomUniform(-10, 10)),
         y: token.center.y + Math.roundFast(randomUniform(-10, 10))
       };

       out.push(canvas.effects.visibility.testVisibility(center, { tolerance, object: token }));
    }
    return out;
  }

  const reset = function() {
    // Reset
    SETTINGS.testCenterPoint = true;
    SETTINGS.testWalls = true;
    SETTINGS.finalTest = true;
  }

  const testCenter = async function() {
    console.log("\tTest Center Point");
    SETTINGS.testCenterPoint = true;
    SETTINGS.testWalls = false;
    SETTINGS.finalTest = false;
    await QBenchmarkLoopFn(n, testFn, "PixelPerfect", tokens);
  }

  const testWalls = async function() {
    console.log("\tTest Walls ");
    SETTINGS.testCenterPoint = false;
    SETTINGS.testWalls = true;
    SETTINGS.finalTest = false;
    await QBenchmarkLoopFn(n, testFn, "PixelPerfect", tokens);
  }

  const testFinal = async function() {
    console.log("\tFinal test only");
    SETTINGS.testCenterPoint = false;
    SETTINGS.testWalls = false;
    SETTINGS.finalTest = true;
    await QBenchmarkLoopFn(n, testFn, "PixelPerfect", tokens);
  }
  reset();

  SETTINGS.useTestVisibility = false;
  await QBenchmarkLoopFn(n, testFn, "Original", tokens);
  SETTINGS.useTestVisibility = true;

  // ***** Fast Test
  console.log("Fast test")
  SETTINGS.fastTestOnly = true;
  await QBenchmarkLoopFn(n, testFn, "PixelPerfect", tokens);
  SETTINGS.fastTestOnly = false;

  // ***** Area Percentage = 0 ***********
  console.log("Area percentage 0")
  SETTINGS.percentArea = 0;
  await QBenchmarkLoopFn(n, testFn, "PixelPerfect", tokens);

  // ********** Area Test Only
  console.log("\tArea test only");
  SETTINGS.areaTestOnly = true;
  await QBenchmarkLoopFn(n, testFn, "PixelPerfect", tokens);
  await testFinal();
  SETTINGS.areaTestOnly = false;

  await testCenter();
  await testWalls();
  await testFinal();
  reset();

  // ***** Area Percentage = .25 ***********
  console.log("\nArea percentage .25")
  SETTINGS.percentArea = 0.25;
  await QBenchmarkLoopFn(n, testFn, "PixelPerfect", tokens);

  await testCenter();
  await testWalls();
  await testFinal();
  reset();

  // ***** Area Percentage = .75 ***********
  console.log("\nArea percentage .75")
  SETTINGS.percentArea = .75;
  await QBenchmarkLoopFn(n, testFn, "PixelPerfect", tokens);

  await testCenter();
  await testWalls();
  await testFinal();
  reset();

  // ***** Area Percentage = 1 ***********
  console.log("\nArea percentage 1")
  SETTINGS.percentArea = 1;
  await QBenchmarkLoopFn(n, testFn, "PixelPerfect", tokens);

  await testCenter();
  await testWalls();
  await testFinal();
  reset();

  // One more original to finish it off
  SETTINGS.useTestVisibility = false;
  await QBenchmarkLoopFn(n, testFn, "Original", tokens);

  // Reset settings
  SETTINGS.useTestVisibility = default_setting;
  SETTINGS.percentArea = default_percent_area;
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
  await QBenchmarkLoop(n, MyClockwiseSweepPolygon2, "create", ...args);
  await QBenchmarkLoop(n, MyClockwiseSweepPolygon3, "create", ...args);
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
