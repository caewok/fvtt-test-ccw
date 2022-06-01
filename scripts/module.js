/* globals game, Hooks */
"use strict";

import * as bench from "./benchmark.js";
import * as drawing from "./drawing.js";

import { MyClockwiseSweepPolygon } from "./MyClockwiseSweepPolygon.js";
import { ClockwiseSweepPolygonNew } from "./clockwise-sweep.js";

import { registerPIXIPolygonMethods } from "./PIXIPolygon.js";
import { registerPIXIRectangleMethods } from "./PIXIRectangle.js";
import { registerPIXICircleMethods } from "./PIXICircle.js";

export const MODULE_ID = "testccw";

/**
 * Basic log to console function for debugging.
 */
export function log(...args) {
  try {
    // If using DevMode: const isDebugging = game.modules.get('_dev-mode')?.api?.getPackageDebugValue(MODULE_ID);
    if (game.modules.get(MODULE_ID).api.debug) {
      console.log(MODULE_ID, "|", ...args);
    }
  } catch(e) { }
}

Hooks.once("init", async function() {
  registerPIXIPolygonMethods();
  registerPIXIRectangleMethods();
  registerPIXICircleMethods();

  /**
   * API switches
   * {Boolean}   debug             Toggles certain debug logging.
   *
   * API methods
   * Group       bench             Methods used for benchmarking.
   * Group       tests             Methods used to test functionality.
   * Group       drawing           Methods used for drawing points and lines for debugging.
   * Group       intersections     Methods used to intersect arrays of line segments.
   *
   * API classes
   * {Class}     MyClockwiseSweepPolygon   Extends ClockwiseSweepPolygon.
   * {Class}     SimplePolygonEdge         Extends PolygonEdge.
   * {Class}     LimitedAngleSweepPolygon  Represents a limited angle in the sweep.
   */
  game.modules.get(MODULE_ID).api = {
    debug: false, // See also CONFIG.debug.polygons = true

    bench,
    drawing,

    MyClockwiseSweepPolygon,
    ClockwiseSweepPolygonNew
  };
});
