# Test CCW

Module framework for testing a new vision/lighting algorithm for [Foundry VTT](https://foundryvtt.com).

Add this [Manifest URL](https://github.com/caewok/fvtt-test-ccw/releases/latest/download/module.json) in Foundry to install.

To benchmark from console when you have a single token selected:
```js
t = canvas.tokens.controlled[0]
await game.modules.get('testccw').api.benchmark(10000, t.center, {angle: t.data.sightAngle, rotation: t.data.rotation, type: "sight", debug: false});
```

To benchmark the lighting (will pick the first light in the scene):
```js
l = [...canvas.lighting.sources][0];
await game.modules.get('testccw').api.benchmark(10000, {x: l.x, y: l.y}, {angle: l.data.angle, debug: false, density: 60, radius: l.radius, rotation: l.rotation, type: "light"});
```

To enable:
```js
old_backend = CONFIG.Canvas.losBackend;
CONFIG.Canvas.losBackend = game.modules.get('testccw').api.CCWSweepPolygon;

// Optionally, turn on the faster bezier approximation for drawing circular arcs:
game.modules.get('testccw').api.use_bezier = true;

// Optionally, turn off the robust calculation for CCW and use a faster non-robust version:
game.modules.get('testccw').api.use_robust_ccw = false;

// To revert to Foundry version:
CONFIG.Canvas.losBackend = old_backend;
```

## What does this do?

Extends the Foundry `PointSourcePolygon` class with `CCWSweepPolygon`. This class is responsible for locating endpoints, sweeping around the field-of-vision to locate walls, and run collision tests. It in turn relies on several classes:
- `CCWSightRay` extends `Ray` to include a variety of geometric measurement methods, such as a test for whether a ray intersects a circle, and whether a ray is in front of a point in relation to a vision point.
- `CCWSweepPoint` extends `PIXI.Point`. It represents wall endpoints for the sweep algorithm. 
- `CCWSweepWall` extends `CCWSightRay`. It represents walls for the sweep algorithm.
- `BinarySearchTree` sets up a basic binary search tree class.
- `PotentialWallList` extends `BinarySearchTree` to order walls by closeness to a vision point. 
- `Bezier` creates a close approximation of circular arcs.

The `CCWSweepPolygon` class is the main work-horse, and is comparable to the Foundry `RadialSweepPolygon` class. Testing suggests `CCWSweepPolygon` is 30% to 70% faster than `RadialSweepPolygon`, depending on setup. 

## How?

The module implements a version of radial sweep that relies on sweeping endpoints in clockwise order around an origin point, comparing points and walls encountered in the sweep against the currently closest wall. Instead of measuring angles, which is time-consuming and prone to numerical approximations, it measures whether a given point is clockwise or counter-clockwise to a given wall.  

Sweep works by getting each counterclockwise-most endpoint, compared to a line from the origin vision/lighting point, in turn. The goal is to create the FOV (field-of-vision) polygon from collision points. For each endpoint:
- The origin --> endpoint --> end of vision is the sight line. 
- Sight line sweeps clockwise.
- Track walls of that endpoint
- Track of the closest wall to the origin in an ordered binary search tree.
- At each endpoint, add as a collision point if it is the closest wall endpoint. If another wall is currently in front, don't add. If you have reached the end of the closest wall, find the intersection point to the next-closest wall and add that as a collision point. Update closest wall accordingly.

## Why?

Hopefully get faster or more robust vision methods incorporated into [Foundry VTT](https://foundryvtt.com). Plus, this is a good way to learn Javascript!

## Known issues

This module currently does not attempt to handle walls that overlap but do not share an endpoint. 

Numerous other bugs are likely. I am only one person, and this is a side project! My day job is not programming! 

