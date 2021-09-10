import { MODULE_ID } from "./module.js";
import { testCCWInitializeEndpoints, 
         testCCWIncludeWall,
         testCCWSweepEndpoints } from "./radial_sweep.js";

export function registerCCW() {
  libWrapper.register(MODULE_ID, 'RadialSweep.prototype._initializeEndpoints', testCCWInitializeEndpoints, 'MIXED');
  libWrapper.register(MODULE_ID, 'RadialSweep.prototype._sweepEndpoints', testCCWSweepEndpoints, 'MIXED');
}