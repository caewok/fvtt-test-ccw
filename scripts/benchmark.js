import { MODULE_ID } from "./module.js";

/* 
 * Test w/ and w/o CCW 
 *
 * Compare sight performance between different algorithms
 * @param {number} n      The number of iterations
 * @param {...any} args   Arguments passed to the polygon compute function
 */
export async function testCCWBenchmarkSight(n=1000, ...args) {
  const stored_setting = window[MODULE_ID].use_ccw;

  window[MODULE_ID].use_ccw = false;
  console.log("Testing non-CCW version");
  await benchmarkSight(n, ...args);
  
  window[MODULE_ID].use_ccw = true;
  console.log("Testing CCW version");
  await benchmarkSight(n, ...args);

  window[MODULE_ID].use_ccw = stored_setting;
}