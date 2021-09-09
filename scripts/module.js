import { registerCCW } from "./patching.js";

export const MODULE_ID = 'testccw';

export function log(...args) {
  try {
    const isDebugging = game.modules.get('_dev-mode')?.api?.getPackageDebugValue(MODULE_ID);
    if (isDebugging) {
      console.log(MODULE_ID, '|', ...args);
    }
  } catch (e) {}
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
  registerCCW();
});

// modules ready
// ready is called once everything is loaded up and ready to go.
Hooks.once('ready', async function() {

  if(game?.user?.isGM === undefined || game.user.isGM) {
    if(!game.modules.get('lib-wrapper')?.active) ui.notifications.error("'Test ccw' requires the 'libWrapper' module. Please install and activate this dependency.");

  }
});

// https://github.com/League-of-Foundry-Developers/foundryvtt-devMode
Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MODULE_ID);
});

