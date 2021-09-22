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


function arraysEqual(a1,a2) {
    /* WARNING: arrays must not contain {objects} or behavior may be undefined */
    return JSON.stringify(a1)==JSON.stringify(a2);
}

function bezierCircle(t) {
    // const BezierCache = game.modules.get(MODULE_ID).api.BezierCache;
//     if(BezierCache.has(t)) { return BezierCache.get(t); }
  
    const paren = 1 - t;
    const paren2 = paren * paren;
    const paren3 = paren2 * paren;
    const t2 = t * t;
    const t3 = t * t * t;
    const c_times_3 = 3 * 0.551915024494;
  
    const x = c_times_3 * paren2 * t + 3 * paren * t2 + t3;
    const y = c_times_3 * t2 * paren + 3 * t * paren2 + paren3;  
    
//     BezierCache.set(t, {x: x, y: y});
    
    return { x: x, y: y };
  }
  
Q1 = 1;
Q2 = 2;
Q3 = 3;
Q4 = 4;
  
function bezierCircleForQuadrant(t, quadrant) {  
    // recall that y is reversed: -y is at the top, +y is at the bottom
    // bezierCircle: for t 0 -> 1, returns {0,1} to {1, 0}
    let pt;
    switch(quadrant) {
      case Q1:
        pt = bezierCircle(1 - t);
        pt.x = -pt.x;
        pt.y = -pt.y;
        return pt;
      case Q2:
        pt = bezierCircle(t);
        pt.y = -pt.y;
        return pt;
      case Q3:
        return bezierCircle(1 - t);
      case Q4: 
        pt = bezierCircle(t);
        pt.x = -pt.x;
        return pt;
    } 
  }

iterations = 10000
t0 = performance.now();
res = [];

for(let iter = 0; iter < iterations; iter += 1) {
  for(let q = 1; q < 5; q += 1) {
    for(let i = 0; i <= 1; i += 0.1) {
      res.push(bezierCircleForQuadrant(i, q));
    }
  }
}
t1 = performance.now();
console.log(`Total: ${(t1 - t0).toPrecision(2)}ms.\nAverage: ${((t1 - t0) / iterations).toPrecision(2)}ms`);


bezierCache = new Map();
t0 = performance.now();
res2 = [];
for(let iter = 0; iter < iterations; iter += 1) {
  for(let q = 1; q < 5; q += 1) {
    for(let i = 0; i <= 1; i += .1) {
      tmp = bezierCache.get(i);
      if(!tmp) {
        tmp = bezierCircleForQuadrant(i, q);
        bezierCache.set(q.toString() + i.toString(), tmp);
      }
      res2.push(tmp);
    }
  }
}
t1 = performance.now();
console.log(`Total: ${(t1 - t0).toPrecision(2)}ms.\nAverage: ${((t1 - t0) / iterations).toPrecision(2)}ms`);

arraysEqual(res, res2);




