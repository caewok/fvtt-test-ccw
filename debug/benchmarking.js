// Benchmarking
t = canvas.tokens.controlled[0]
await game.modules.get('testccw').api.benchmark(10000, t.center, {angle: t.data.sightAngle, rotation: t.data.rotation, type: "sight", debug: false});

l = [...canvas.lighting.sources][0];
await game.modules.get('testccw').api.benchmark(10000, {x: l.x, y: l.y}, {angle: l.data.angle, debug: false, density: 60, radius: l.radius, rotation: l.rotation, type: "light"});


/*
Potential improvements:
- Sweep should add at beginning endpoint, remove at end endpoint
  - start/end point can be found using CCW. Cache in wall class
- Move starting walls identification to earlier wall loop
- inFrontOf speed improvements. Compare to web descriptions
- split out scene items and scene wall config items.
- simplify SweepWall class to not copy all the wall stuff
  - maybe just have endpoints? 


wall methods used in sweep:
- PotentialWallList takes walls
- inFrontOfPoint (CCWSightRay)
- id


endpoint methods used in sweep:
- almostEqual
- walls set for PotentialWallList

Wall could be SightRay with:
- id
- cache starting endpoint / ending endpoint
- use key to link endpoints

*/

function benchmarkLoopFoundry(iterations, name = "benchmark", fn, ...args) {
  const f = () => fn(...args);

  Object.defineProperty(f, "name", {
    value: name,
    configurable: true
  });
  return foundry.utils.benchmark(f, iterations)
}

function benchmarkLoop(iterations, thisArg, fn, ...args) {
  const t0 = performance.now();
  for(i = 0; i < iterations; i += 1) {
    fn.call(thisArg, ...args);
  }
  const t1 = performance.now();
  console.log(`Total: ${(t1 - t0).toPrecision(2)}ms.\nAverage: ${((t1 - t0) / iterations).toPrecision(2)}ms`);
}

CCWSweepPolygon = game.modules.get('testccw').api.CCWSweepPolygon;
CCWSweepWall = game.modules.get('testccw').api.CCWSweepWall;
CCWSweepPoint = game.modules.get('testccw').api.CCWSweepPoint;
Bezier = game.modules.get('testccw').api.Bezier;

t = canvas.tokens.controlled[0]
Poly = new CCWSweepPolygon();
Poly.initialize(t.center, {angle: t.data.sightAngle, rotation: t.data.rotation})

RadialPoly = new RadialSweepPolygon();
RadialPoly.initialize(t.center, {angle: t.data.sightAngle, rotation: t.data.rotation})

benchmarkLoop(10000, Poly, CCWSweepPolygon.prototype._addCanvasEdges) // 0.26 ms; .017 ms w/o duplicate!

benchmarkLoop(10000, Poly, CCWSweepPolygon.prototype._initializeEndpoints, Poly.config.type) // .21 ms; 0.05 without duplicate!

benchmarkLoop(10000, RadialPoly, RadialSweepPolygon.prototype._initializeEndpoints, Poly.config.type) // .077 ms







