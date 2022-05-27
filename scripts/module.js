/* globals game, Hooks */
"use strict";

import * as tests from "./tests.js";
import * as bench from "./benchmark.js";
import * as drawing from "./drawing.js";
import * as random from "./random.js";

import { MyClockwiseSweepPolygon } from "./MyClockwiseSweepPolygon.js";
import { MyClockwiseSweepPolygon2 } from "./MyClockwiseSweepPolygon2.js";
import { MyClockwiseSweepPolygon3 } from "./MyClockwiseSweepPolygon3.js";

import { SimplePolygonEdge } from "./SimplePolygonEdge.js";
import { LimitedAngleSweepPolygon } from "./LimitedAngle.js";

import { registerPIXIPolygonMethods } from "./PIXIPolygon.js";
import { registerPIXIRectangleMethods } from "./PIXIRectangle.js";
import { registerPIXICircleMethods } from "./PIXICircle.js";

import { ClipperLib } from "./clipper_unminified.js"; // eslint-disable-line no-unused-vars

import { findIntersectionsBruteSingle, findIntersectionsBruteRedBlack } from "./IntersectionsBrute.js";
import { findIntersectionsSortSingle, findIntersectionsSortRedBlack } from "./IntersectionsSort.js";
import { findIntersectionsMyersSingle, findIntersectionsMyersRedBlack } from "./IntersectionsSweepMyers.js";

import { tracePolygon } from "./trace_polygon.js";

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

    tracePolygon,
    bench,
    tests,
    drawing,
    random,
    ClipperLib,
    intersections: {
      findIntersectionsBruteSingle,
      findIntersectionsBruteRedBlack,
      findIntersectionsSortSingle,
      findIntersectionsSortRedBlack,
      findIntersectionsMyersSingle,
      findIntersectionsMyersRedBlack
    },

    MyClockwiseSweepPolygon,
    MyClockwiseSweepPolygon2,
    MyClockwiseSweepPolygon3,

    SimplePolygonEdge,
    LimitedAngleSweepPolygon
  };
});
