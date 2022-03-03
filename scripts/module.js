/* globals game, Hooks */
'use strict';

// import { registerCCW } from "./patching.js";
import { testCCWBenchmarkSight }  from "./benchmark.js";
import { MyClockwiseSweepPolygon } from "./MyClockwiseSweepPolygon.js";
import { MyClockwiseSweepPolygon2 } from "./MyClockwiseSweepPolygon2.js";
import { MyClockwiseSweepPolygon3 } from "./MyClockwiseSweepPolygon3.js";
import { LinkedPolygon, LinkedPolygonVertex, LinkedPolygonEdge } from "./LinkedPolygon.js";
import { SimplePolygon, SimplePolygonEdge } from "./SimplePolygon.js";
import { SimplePolygon2, SimplePolygonEdge2 } from "./SimplePolygon2.js";

import { registerPIXIPolygonMethods } from "./PIXIPolygon.js";
import { registerPIXIRectangleMethods } from "./PIXIRectangle.js";
import { registerPIXICircleMethods } from "./PIXICircle.js";

import * as ClipperLib from "./lib/clipper_unminified.js";
import {sweep, brute, bush} from "./lib/isect.js";

import { Intersections, Intersections2, BruteSortIntersections, BruteSortXYIntersections,  } from "./Intersections.js";

import initWASM, * as WASM from "../wasm/intersections.js";

initWASM();


// require("../wasm/intersections.js");

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


function orient2dWASM(ax, ay, bx, by, cx, cy) {
	return WASM.orient2d_basic(ax, ay, bx, by, cx, cy);
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
    MyClockwiseSweepPolygon2: MyClockwiseSweepPolygon2,
    MyClockwiseSweepPolygon3: MyClockwiseSweepPolygon3,

    LinkedPolygon: LinkedPolygon,
    LinkedPolygonVertex: LinkedPolygonVertex,
    LinkedPolygonEdge: LinkedPolygonEdge,

    SimplePolygon: SimplePolygon,
    SimplePolygonVertex: PolygonVertex,
    SimplePolygonEdge: SimplePolygonEdge,

    SimplePolygon2: SimplePolygon2,
    SimplePolygonVertex2: PolygonVertex,
    SimplePolygonEdge2: SimplePolygonEdge2,

    Intersections: Intersections,
    Intersections2: Intersections2,
    BruteSortIntersections: BruteSortIntersections,
    BruteSortXYIntersections: BruteSortXYIntersections,

    sweep: sweep,
    brute: brute,
    bush: bush,

    WASM: WASM,
    orient2d: orient2dWASM
    }
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

