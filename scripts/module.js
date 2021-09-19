'use strict';

import { registerCCW } from "./patching.js";
import { testCCWBenchmarkSight } from "./benchmark.js";
import { orient2d } from "./lib/orient2d.min.js";
import { PotentialWallList } from "./class_PotentialWallList.js";
import { Bezier } from "./class_Bezier.js";
import { CCWSweepWall }       from "./class_CCWSweepWall.js";
import { CCWSweepPoint }      from "./class_CCWSweepPoint.js";
import { CCWSightRay }        from "./class_CCWSightRay.js";
import { CCWSweepPolygon }        from "./class_CCWSweepPolygon.js";

export const MODULE_ID = 'testccw';


/**
 * Basic log to console function for debugging.
 */
export function log(...args) {
  try {
   // const isDebugging = game.modules.get('_dev-mode')?.api?.getPackageDebugValue(MODULE_ID);
   if (window[MODULE_ID].debug) {
      console.log(MODULE_ID, '|', ...args);
   }
  } catch (e) {}
}



// Hooks.once('init', async function() {
//   log('Initializing.');
// });

// setup is after init; before ready. 
// setup is called after settings and localization have been initialized, 
// but before entities, packs, UI, canvas, etc. has been initialized
// Hooks.once('setup', async function() {
//   log("Setup.");
// });

Hooks.once('init', async function() {
//  registerCCW();
  
 /**
  * API switches 
  * {Boolean}   use_ccw         Use this module's functions in lieu of base Foundry
  * {Boolean}   debug           Toggles certain debug logging
  * {Boolean}   use_bezier      Use Bezier approximation of Circle (faster)
  * {Boolean}   use_robust_ccw  Use orient2d with checks for approximations and 
  *                               numerical overrides or if false, a faster version 
  *                               without such checks.
  * API methods
  * {Function}  benchmark         Method to run set of benchmarks vs Foundry base version
  * {Function}  orient2d          Method to check for CCW or CW relationship of 3 points
  * {Class}     PotentialWallList BST for storing sorted wall list
  * {Class}     Bezier            Class for approximating circle arcs using bezier curves
  */
  
  game.modules.get(MODULE_ID).api = { use_ccw: false, 
                                      debug: false, 
                                      use_bezier: false, 
                                      use_robust_ccw: true, 
                                      benchmark: testCCWBenchmarkSight,
                                      CCWSweepPoint: CCWSweepPoint,
                                      CCWSweepWall: CCWSweepWall,
                                      CCWSightRay: CCWSightRay,
                                      CCWSweepPolygon: CCWSweepPolygon,
                                      orient2d: orient2d,
                                      PotentialWallList: PotentialWallList,
                                      Bezier: Bezier }
});

// modules ready
// ready is called once everything is loaded up and ready to go.
// Hooks.once('ready', async function() {
// 
//   if(game?.user?.isGM === undefined || game.user.isGM) {
//     if(!game.modules.get('lib-wrapper')?.active) ui.notifications.error("'Test ccw' requires the 'libWrapper' module. Please install and activate this dependency.");
// 
//   }
// });

// https://github.com/League-of-Foundry-Developers/foundryvtt-devMode
// Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
//   registerPackageDebugFlag(MODULE_ID);
// });

