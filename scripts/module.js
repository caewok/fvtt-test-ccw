/* globals game, Hooks */
'use strict';

// import { registerCCW } from "./patching.js";
import { testCCWBenchmarkSight }  from "./benchmark.js";
import { MyClockwiseSweepPolygon } from "./MyClockwiseSweepPolygon.js";
// import { MyClockwiseSweepPolygon2 } from "./MyClockwiseSweepPolygon2.js";
// import { MyClockwiseSweepPolygon3 } from "./MyClockwiseSweepPolygon3.js";

import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import { LimitedAngleSweepObject } from "./LimitedAngle.js";

import { registerPIXIPolygonMethods } from "./PIXIPolygon.js";
import { registerPIXIRectangleMethods } from "./PIXIRectangle.js";
import { registerPIXICircleMethods } from "./PIXICircle.js";

import * as ClipperLib from "./lib/clipper_unminified.js";
import {sweep, brute, bush} from "./lib/isect.js";

import * as WASM_exports from "./Intersections.js";
import { findIntersectionsSingle, findIntersectionsDouble } from "./Intersections.js";
import initWASMLine, * as WASMLine from "../wasm_line/intersections_line.js";
import initWASMCircle, * as WASMCircle from "../wasm_circle/intersections_circle.js";
import initWASMPolygon, * as WASMPolygon from "../wasm_polygon/intersections_polygon.js";

// https://sean.cm/a/polygon-clipping-pt2
// import * as Martinez from "./lib/martinez.min.js";
// https://github.com/w8r/martinez
import * as Martinez from "./lib/martinez.umd.js";

// https://github.com/mfogel/polygon-clipping
import * as PolyClipping from "./lib/polygon-clipping.umd.js";

// https://github.com/velipso/polybooljs
import {PolyBool} from "./lib/polybool.js";
// var PolyBool = import("./lib/polybool.mjs");



// async function sourceUMD(url, module = {exports:{}})
// {
//     const response = await fetch(url);
//     const script = await response.text();
//     const func = Function("module", "exports", script)
//     func.call(module, module, module.exports);
//     return module.exports;
// };
//
// const ConcaveMan = await sourceUMD("./Data/modules/testccw/scripts/lib/concaveman.bundle.js");
// import * as ConcaveMan from "./lib/concaveman_lib.js";
// import("./lib/concaveman.bundle.js")
// const ConcaveMan = (await import("./lib/concaveman_lib.js"));
// import("./lib/concaveman_lib.js");
// console.log(window.lib);
//
// import('./lib/concaveman_lib.js').then({default: myUmdModule} => {
// 	console.log(myUmdModule);
//  });

import * as ConcaveMan from "./lib/concave_bundle.js";

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
	initWASMLine();
	initWASMCircle();
	initWASMPolygon();

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
    MyClockwiseSweepPolygon,
//     MyClockwiseSweepPolygon2,
//     MyClockwiseSweepPolygon3,

    SimplePolygonEdge,
    LimitedAngleSweepObject,

    findIntersectionsSingle,
    findIntersectionsDouble,

    sweep,
    brute,
    bush,

    WASMLine,
    WASMCircle,
    WASMPolygon,
    WASM_exports,

    Martinez,
    PolyBool,
    PolyClipping,

    ConcaveMan,

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

