/* globals
libWrapper
*/
"use strict";

import { testVisibility, tokenUpdateVisionSource } from "./token_visibility.js";
import { MODULE_ID, log } from "./module.js";

export function registerLibWrapperMethods() {
  libWrapper.register(MODULE_ID, "CanvasVisibility.prototype.testVisibility", testVisibility, libWrapper.MIXED, {perf_mode: libWrapper.PERF_FAST});
  libWrapper.register(MODULE_ID, "Token.prototype.updateVisionSource", tokenUpdateVisionSource, libWrapper.WRAPPER);
}

export function patchHelperMethods() {
  function setUnion(b) { return new Set([...this, ...a]); }
  function setIntersect(b) { return  new Set([...this].filter(x => b.has(x))); }

  Object.defineProperty(Set.prototype, "union", {
    value: setUnion,
    writable: true,
    configurable: true
  });

  Object.defineProperty(Set.prototype, "intersect", {
    value: setIntersect,
    writable: true,
    configurable: true
  });
}

