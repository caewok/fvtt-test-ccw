/* globals game, Hooks */
'use strict';

// import { registerCCW } from "./patching.js";
import { testCCWBenchmarkSight }  from "./benchmark.js";
import { orient2d }               from "./lib/orient2d.min.js";
import { incircle }               from "./lib/incircle.min.js";
import { BinarySearchTree }       from "./class_BinarySearchTree.js";
import { PriorityQueueMap }       from "./class_PriorityQueueMap.js";
import { PotentialWallList }      from "./class_PotentialWallList.js";
import { Bezier }                 from "./class_Bezier.js";
import { CCWSweepWall }           from "./class_CCWSweepWall.js";
import { CCWSweepPoint }          from "./class_CCWSweepPoint.js";
import { CCWSweepPolygon }        from "./class_CCWSweepPolygon.js";
import { CCWPoint }               from "./class_CCWPoint.js";
import { CCWPixelPoint }          from "./class_CCWPixelPoint.js";
import { CCWRay }                 from "./class_CCWRay.js";
import { CCWPixelRay }            from "./class_CCWPixelRay.js";
import { IdentifyIntersections, 
         BruteForceIntersections,
         SimpleSweepIntersections,
         BentleyOttomanSweepIntersections,
         IntersectionSweepWallEvent,
         IntersectionSweepEvent } from "./class_IntersectionSweep.js";     

export const MODULE_ID = 'testccw';


/**
 * Basic log to console function for debugging.
 */
export function log(...args) {
  try {
   // const isDebugging = game.modules.get('_dev-mode')?.api?.getPackageDebugValue(MODULE_ID);
   if (game.modules.get(MODULE_ID).api.debug) {
      console.log(MODULE_ID, '|', ...args);
   }
  } catch (e) { return; }
}



// Hooks.once('init', async function() {
//   log('Initializing.');
// });

// setup is after init; before ready. 
// setup is called after settings and localization have been initialized, 
// but before entities, packs, UI, canvas, etc. has been initialized
// Hooks.once('setup', async function() {
//   log("Setup.");
// });

Hooks.once('init', async function() {
//  registerCCW();
  
 /**
  * API switches 
  * {Boolean}   debug           Toggles certain debug logging
  * {Boolean}   use_bezier      Use Bezier approximation of Circle (faster)
  * {Boolean}   use_robust_ccw  Use orient2d with checks for approximations and 
  *                               numerical overrides or if false, a faster version 
  *                               without such checks.
  * {Boolean}   detect_intersections Pre-process to detect and fix overlapping walls.
  * {"circle"|"triangle"|"square"}    light_shape       Shape of light. 
  * API methods
  * {Function}  benchmark         Method to run set of benchmarks vs Foundry base version
  * {Class}     CCWSweepPoint     Sweep point class, extends PIXI.Point
  * {Class}     CCWSweepWall      Sweep wall class, extends CCWSightRay
  * {Class}     CCWSightRay       Extension to the Ray class
  * {Class}     CCWSweepPolygon   Class for the sweep method
  * {Function}  orient2d          Method to check for CCW or CW relationship of 3 points
  * {Class}     PotentialWallList BST for storing sorted wall list
  * {Class}     Bezier            Class for approximating circle arcs using bezier curves
  */
  
  game.modules.get(MODULE_ID).api = { 
    debug: false, 
    use_bezier: false, 
    use_robust_ccw: true, 
    detect_intersections: true,
    light_shape: "circle",
    
    benchmark: testCCWBenchmarkSight,
    CCWSweepPoint: CCWSweepPoint,
    CCWSweepWall: CCWSweepWall,
    CCWSweepPolygon: CCWSweepPolygon,
    
    CCWPoint: CCWPoint,
    CCWPixelPoint: CCWPixelPoint,
    CCWRay: CCWRay,
    CCWPixelRay: CCWPixelRay,
    
    orient2d: orient2d,
    incircle: incircle,
    BinarySearchTree: BinarySearchTree,
    PriorityQueueMap: PriorityQueueMap,
    PotentialWallList: PotentialWallList,
    Bezier: Bezier,
    IdentifyIntersections: IdentifyIntersections,
    BruteForceIntersections: BruteForceIntersections,
    SimpleSweepIntersections: SimpleSweepIntersections,
    BentleyOttomanSweepIntersections: BentleyOttomanSweepIntersections,
    IntersectionSweepWallEvent: IntersectionSweepWallEvent,
    IntersectionSweepEvent: IntersectionSweepEvent }
});

// modules ready
// ready is called once everything is loaded up and ready to go.
// Hooks.once('ready', async function() {
// 
//   if(game?.user?.isGM === undefined || game.user.isGM) {
//     if(!game.modules.get('lib-wrapper')?.active) ui.notifications.error("'Test ccw' requires the 'libWrapper' module. Please install and activate this dependency.");
// 
//   }
// });

// https://github.com/League-of-Foundry-Developers/foundryvtt-devMode
// Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
//   registerPackageDebugFlag(MODULE_ID);
// });

