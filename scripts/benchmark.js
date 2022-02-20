/* globals game, RadialSweepPolygon, ClockwiseSweepPolygon */
'use strict';

import { MODULE_ID } from "./module.js";

/* 
 * Compare sight performance between different algorithms
 * Tests w/ and w/o CCW switches: use_bezier, use_robust_ccw
 * @param {number} n      The number of iterations
 * @param {...any} args   Arguments passed to the polygon compute function
 */
export async function testCCWBenchmarkSight(n=1000, ...args) {
  // count number of unique endpoints
 //  const num_endpoints = new Set();
//   canvas.walls.placeables.forEach(w => {
//     const c = w.data.c;
//     num_endpoints.add(WallEndpoint.getKey(c[0], c[1]));
//     num_endpoints.add(WallEndpoint.getKey(c[2], c[3]));
//   });
// 
//   console.log(`${canvas.scene.name}\nWalls: ${canvas.walls.placeables.length}\nEndpoints: ${num_endpoints.size}\nLights: ${canvas.lighting?.placeables.length}\nCanvas dimensions: ${canvas.dimensions.width}x${canvas.dimensions.height}`);
  game.modules.get('testccw').api.debug = false;

  
  //await QuadtreeExpansionPolygon.benchmark(n, ...args);
  await RadialSweepPolygon.benchmark(n, ...args);
  
  console.log(`ClockwiseSweep iteration 1`, args);  
  await ClockwiseSweepPolygon.benchmark(n, ...args);
  await game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon.benchmark(n, ...args);
  await game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon2.benchmark(n, ...args);
  await game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon3.benchmark(n, ...args);
  
  // Run ClockwiseSweep repeatedly and in different orders
  // To avoid caching and other timing issues
  console.log(`ClockwiseSweep iteration 2`);
  await game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon3.benchmark(n, ...args);
  await game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon2.benchmark(n, ...args);
  await ClockwiseSweepPolygon.benchmark(n, ...args);
  await game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon.benchmark(n, ...args);
  
  console.log(`ClockwiseSweep iteration 3`);
  await game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon.benchmark(n, ...args);
  await game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon2.benchmark(n, ...args);
  await game.modules.get(MODULE_ID).api.MyClockwiseSweepPolygon3.benchmark(n, ...args);
  await ClockwiseSweepPolygon.benchmark(n, ...args);
  console.log(`Angle: ${args[1].angle}, Radius: ${args[1].radius}`)
}
