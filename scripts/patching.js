import { MODULE_ID } from "./module.js";
import { testCCWInitializeEndpoints, 
         testCCWIncludeWall,
         testCCWSweepEndpoints,
         testCCWConstructPoints,
         testCCWPadRays } from "./radial_sweep.js";

import { wallCCW, 
         wallWhichSide, 
         wallEffectSide,
         wallA,
         wallB  } from "./wall.js";
         
import { rayProjectDistance,
         rayIntersects,
         rayInFrontOfPoint,
         rayInFrontOfSegment,
         rayProjectB,
         rayPotentialIntersectionsCircle,
         rayContains } from "./ray.js";

export function registerCCW() {
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._initializeEndpoints', testCCWInitializeEndpoints, 'MIXED', {perf_mode:  libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._sweepEndpoints', testCCWSweepEndpoints, 'MIXED', {perf_mode:  libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._includeWall', testCCWIncludeWall, 'MIXED', {perf_mode: libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._constructPoints', testCCWConstructPoints, 'MIXED', {perf_mode: libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, 'RadialSweepPolygon.prototype._padRays', testCCWPadRays, 'MIXED', {perf_mode: libWrapper.PERF_FAST});
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
  configurable: true
});

Object.defineProperty(Wall.prototype, "B", {
  get: wallB,
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

Object.defineProperty(Ray.prototype, "potentialIntersectionsCircle", {
  value: rayPotentialIntersectionsCircle,
  writable: true,
  configurable: true
});

Object.defineProperty(Ray.prototype, "contains", {
  value: rayContains,
  writable: true,
  configurable: true
});

