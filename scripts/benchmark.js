'use strict';

import { MODULE_ID } from "./module.js";

/* 
 * Test w/ and w/o CCW 
 *
 * Compare sight performance between different algorithms
 * @param {number} n      The number of iterations
 * @param {...any} args   Arguments passed to the polygon compute function
 */
export async function testCCWBenchmarkSight(n=1000, ...args) {
  const stored_use_ccw = game.modules.get(MODULE_ID).api.use_ccw;
  const stored_use_bezier = game.modules.get(MODULE_ID).api.use_bezier;
  const use_fast_ccw = game.modules.get(MODULE_ID).api.use_robust_ccw;

  // count number of unique endpoints
  const num_endpoints = new Set();
  canvas.walls.placeables.forEach(w => {
    const c = w.data.c;
    num_endpoints.add(WallEndpoint.getKey(c[0], c[1]));
    num_endpoints.add(WallEndpoint.getKey(c[2], c[3]));
  });

  console.log(`${canvas.scene.name}\nWalls: ${canvas.walls.placeables.length}\nEndpoints: ${num_endpoints.size}\nLights: ${canvas.lighting?.placeables.length}\nCanvas dimensions: ${canvas.dimensions.width}x${canvas.dimensions.height}`);

  game.modules.get(MODULE_ID).api.use_ccw = false;
  console.log("Testing non-CCW version");
  await benchmarkSight(n, ...args);

  game.modules.get(MODULE_ID).api.use_ccw = true;
  game.modules.get(MODULE_ID).api.use_bezier = false;
  game.modules.get(MODULE_ID).api.use_robust_ccw = true;
  console.log("Testing CCW version");
  await benchmarkSight(n, ...args);
  
  game.modules.get(MODULE_ID).api.use_ccw = true;
  game.modules.get(MODULE_ID).api.use_bezier = true;
  game.modules.get(MODULE_ID).api.use_robust_ccw = true;
  console.log("Testing CCW using bezier");
  await benchmarkSight(n, ...args);
  
  game.modules.get(MODULE_ID).api.use_ccw = true;
  game.modules.get(MODULE_ID).api.use_bezier = true;
  game.modules.get(MODULE_ID).api.use_robust_ccw = false;
  console.log("Testing CCW using bezier and fast non-robust ccw");
  await benchmarkSight(n, ...args);

  game.modules.get(MODULE_ID).api.use_ccw = stored_use_ccw;
  game.modules.get(MODULE_ID).api.use_bezier = stored_use_bezier;
  game.modules.get(MODULE_ID).api.use_fast_ccw = use_robust_ccw;
}
