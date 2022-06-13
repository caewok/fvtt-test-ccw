/* globals game, Hooks */
"use strict";

import * as bench from "./benchmark.js";
import * as drawing from "./drawing.js";
import * as random from "./random.js";

import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import { LimitedAngleSweepPolygon } from "./LimitedAngle.js";

import { registerPIXIPolygonMethods } from "./PIXIPolygon.js";
import { registerPIXIRectangleMethods } from "./PIXIRectangle.js";
import { registerPIXICircleMethods } from "./PIXICircle.js";

import { registerLibWrapperMethods } from "./patching.js";

import { tracePolygon } from "./trace_polygon.js";

export const MODULE_ID = "testccw";

// Toggle settings
export const SETTINGS = {
  debug: false,
  useTestVisibility: true,
  boundsScale: 1,
  percentArea: 0,
  areaTestOnly: false
};

/**
 * Log message only when debug flag is enabled from DevMode module.
 * @param {Object[]} args  Arguments passed to console.log.
 */
export function log(...args) {
  try {
    const isDebugging = game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);
    if ( isDebugging ) {
      console.log(MODULE_ID, "|", ...args);
    }
  } catch(e) {
    // Empty
  }
}

/**
 * Tell DevMode that we want a flag for debugging this module.
 * https://github.com/League-of-Foundry-Developers/foundryvtt-devMode
 */
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MODULE_ID);
});

Hooks.once("init", async function() {
  registerPIXIPolygonMethods();
  registerPIXIRectangleMethods();
  registerPIXICircleMethods();

  registerLibWrapperMethods();

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
    SETTINGS, // See also CONFIG.debug.polygons = true

    tracePolygon,
    bench,
    drawing,
    random,


    SimplePolygonEdge,
    LimitedAngleSweepPolygon
  };
});
