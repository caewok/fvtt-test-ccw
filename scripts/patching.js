import { MODULE_ID } from "./module.js";
import { testCCWInitializeEndpoints, 
         testCCWIncludeWall,
         testCCWSweepEndpoints,
         testCCWConstructPoints } from "./radial_sweep.js";

import { wallCCW, 
         wallWhichSide, 
         wallEffectSide,
         wallA,
         wallB  } from "./wall.js";
         
import { rayProjectDistance,
         rayIntersects,
         rayInFrontOfPoint,
         rayInFrontOfSegment,
         rayProjectB } from "./ray.js";

export function registerCCW() {
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._initializeEndpoints', testCCWInitializeEndpoints, 'MIXED');
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._sweepEndpoints', testCCWSweepEndpoints, 'MIXED');
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._includeWall', testCCWIncludeWall, 'MIXED');
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._constructPoints', testCCWConstructPoints, 'MIXED');
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

Object.defineProperty(Wall.prototype, "effectSide", {
  value: wallEffectSide,
  writable: true,
  configurable: true
});

Object.defineProperty(Wall.prototype, "A", {
  get: wallA,
  writable: true,
  configurable: true
});

Object.defineProperty(Wall.prototype, "B", {
  get: wallB,
  writable: true,
  configurable: true
});

// ---------------- Ray ------------- // 

Object.defineProperty(Ray.prototype, "projectDistance", {
  value: rayProjectDistance,
  writable: true,
  configurable: true
});

Object.defineProperty(Ray.prototype, "intersects", {
  value: rayIntersects,
  writable: true,
  configurable: true
});

Object.defineProperty(Ray.prototype, "inFrontOfPoint", {
  value: rayInFrontOfPoint,
  writable: true,
  configurable: true
});

Object.defineProperty(Ray.prototype, "inFrontOfSegment", {
  value: rayInFrontOfSegment,
  writable: true,
  configurable: true
});

Object.defineProperty(Ray.prototype, "projectB", {
  value: rayProjectB,
  writable: true,
  configurable: true
});