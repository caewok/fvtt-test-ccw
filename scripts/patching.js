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


