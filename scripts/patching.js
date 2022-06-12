/* globals
libWrapper
*/
"use strict";

import { testVisibility } from "./token_visibility.js";
import { MODULE_ID } from "./module.js";

export function registerLibWrapperMethods() {
  libWrapper.register(MODULE_ID, "CanvasVisibility.prototype.testVisibility", testVisibility, "MIXED");
}
