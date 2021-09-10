import { MODULE_ID } from "./module.js";
import { testCCWInitializeEndpoints, 
         testCCWIncludeWall,
         testCCWSweepEndpoints } from "./radial_sweep.js";

import { wallCCW, wallWhichSide } from "./wall.js";

export function registerCCW() {
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._initializeEndpoints', testCCWInitializeEndpoints, 'MIXED');
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._sweepEndpoints', testCCWSweepEndpoints, 'MIXED');
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._includeWall', testCCWIncludeWall, 'MIXED');
}

// Add new properties to existing classes

// ---------------- Wall ------------- // 

Object.defineProperty(Wall.prototype, "ccw", {
  value: wallCCW,
  writable: true,
  configurable: true
});

Object.defineProperty(Wall.prototype, "whichSide", {
  value: wallWhichSide,
  writable: true,
  configurable: true
});