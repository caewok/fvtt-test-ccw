/* globals game, canvas, WallEndpoint, QuadtreeExpansionPolygon, RadialSweepPolygon */
'use strict';

import { MODULE_ID } from "./module.js";
import { MyClockwiseSweepPolygon } from "./MyClockwiseSweepPolygon.js";
import { MyClockwiseSweepPolygon2 } from "./MyClockwiseSweepPolygon2.js";
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
  await ClockwiseSweepPolygon.benchmark(n, ...args);
  await game.modules.get('testccw').api.MyClockwiseSweepPolygon.benchmark(n, ...args);
  await game.modules.get('testccw').api.MyClockwiseSweepPolygon2.benchmark(n, ...args);
  await TestSweep.benchmark(n, ...args);

}

// test if there is much overhead on the class extension

class TestSweep extends ClockwiseSweepPolygon {

}