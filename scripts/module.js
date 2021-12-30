/* globals game, Hooks */
'use strict';

// import { registerCCW } from "./patching.js";
import { testCCWBenchmarkSight }  from "./benchmark.js";
import { MyClockwiseSweepPolygon } from "./MyClockwiseSweepPolygon.js";
import { LinkedPolygon } from "./LinkedPolygon.js";
import { SimplePolygon } from "./SimplePolygon.js";

import { registerPIXIPolygonMethods } from "./PIXIPolygon.js";
import { registerPIXIRectangleMethods } from "./PIXIRectangle.js";
import { registerPIXICircleMethods } from "./PIXICircle.js";
 
export const MODULE_ID = 'testccw';


/**
 * Basic log to console function for debugging.
 */
export function log(...args) {
  try {
   // const isDebugging = game.modules.get('_dev-mode')?.api?.getPackageDebugValue(MODULE_ID);
   if (game.modules.get(MODULE_ID).api.debug) {
      console.log(MODULE_ID, '|', ...args);
   }
  } catch (e) { return; }
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
  registerPIXIPolygonMethods();
  registerPIXIRectangleMethods();
  registerPIXICircleMethods();
  
 /**
  * API switches 
  * {Boolean}   debug             Toggles certain debug logging
  *
  * API methods
  * {Function}  benchmark         Method to run set of benchmarks vs Foundry base version
  * 
  * API classes
  * {Class}     MyClockwiseSweepPolygon   Extends ClockwiseSweepPolygon
  * {Class}     LinkedPolygon             Used to intersect/union polygons
  */
  
  game.modules.get(MODULE_ID).api = { 
    debug: false, 
    
    benchmark: testCCWBenchmarkSight,
    MyClockwiseSweepPolygon: MyClockwiseSweepPolygon,
    
    LinkedPolygon: LinkedPolygon,
    SimplePolygon: SimplePolygon }
});

// modules ready
// ready is called once everything is loaded up and ready to go.
// Hooks.once('ready', async function() {
// 
//   if(typeof game?.user?.isGM === "undefined" || game.user.isGM) {
//     if(!game.modules.get('lib-wrapper')?.active) ui.notifications.error("'Test ccw' requires the 'libWrapper' module. Please install and activate this dependency.");
// 
//   }
// });

// https://github.com/League-of-Foundry-Developers/foundryvtt-devMode
// Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
//   registerPackageDebugFlag(MODULE_ID);
// });

