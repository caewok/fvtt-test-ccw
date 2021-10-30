/* globals game, canvas, WallEndpoint, QuadtreeExpansionPolygon, RadialSweepPolygon */
'use strict';

import { MODULE_ID } from "./module.js";
import { CCWSweepPolygon } from "./class_CCWSweepPolygon.js";

/* 
 * Compare sight performance between different algorithms
 * Tests w/ and w/o CCW switches: use_bezier, use_robust_ccw
 * @param {number} n      The number of iterations
 * @param {...any} args   Arguments passed to the polygon compute function
 */
export async function testCCWBenchmarkSight(n=1000, ...args) {
  const { use_bezier, use_robust_ccw, debug } = game.modules.get(MODULE_ID).api;
  game.modules.get(MODULE_ID).api.debug = false;
  
  // count number of unique endpoints
  const num_endpoints = new Set();
  canvas.walls.placeables.forEach(w => {
    const c = w.data.c;
    num_endpoints.add(WallEndpoint.getKey(c[0], c[1]));
    num_endpoints.add(WallEndpoint.getKey(c[2], c[3]));
  });

  console.log(`${canvas.scene.name}\nWalls: ${canvas.walls.placeables.length}\nEndpoints: ${num_endpoints.size}\nLights: ${canvas.lighting?.placeables.length}\nCanvas dimensions: ${canvas.dimensions.width}x${canvas.dimensions.height}`);
  
  await QuadtreeExpansionPolygon.benchmark(n, ...args);
  await RadialSweepPolygon.benchmark(n, ...args);
  
  if(ClockwiseSweepPolygon) await ClockwiseSweepPolygon.benchmark(n, ...args);
  
  // game.modules.get(MODULE_ID).api.use_bezier = false;
//   game.modules.get(MODULE_ID).api.use_robust_ccw = true;
//   console.log("Testing CCW version");
//   await CCWSweepPolygon.benchmark(n, ...args);
  
  // game.modules.get(MODULE_ID).api.use_bezier = true;
//   game.modules.get(MODULE_ID).api.use_robust_ccw = true;
//   console.log("Testing CCW using bezier");
//   await CCWSweepPolygon.benchmark(n, ...args);
  
  game.modules.get(MODULE_ID).api.use_bezier = true;
  game.modules.get(MODULE_ID).api.use_robust_ccw = false;
  console.log("Testing CCW using bezier and fast non-robust ccw");
  await CCWSweepPolygon.benchmark(n, ...args);

  game.modules.get(MODULE_ID).api.use_bezier = use_bezier;
  game.modules.get(MODULE_ID).api.use_robust_ccw = use_robust_ccw;
  game.modules.get(MODULE_ID).api.debug = debug;
}
