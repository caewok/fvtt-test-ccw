Module framework for testing new Foundry features.

Add this [Manifest URL](https://github.com/caewok/fvtt-test-ccw/releases/latest/download/module.json) in Foundry to install.

To test from console when you have a single token selected:
```js
t = canvas.tokens.controlled[0]
await game.modules.get('testccw').api.benchmark(1000, t.center)
```

To test the lighting (will pick the first light in the scene):
```js
l = [...canvas.lighting.sources][0];
await game.modules.get('testccw').api.benchmark(1000, {x: l.x, y: l.y}, {angle: l.data.angle, debug: false, density: 60, radius: l.radius, rotation: l.rotation, type: "light"})

```

To enable:
```js
game.modules.get('testccw').api.use_ccw = true

// Optionally, turn on the faster bezier approximation for drawing circular arcs:
game.modules.get('testccw').api.use_bezier = true

// Optionally, turn off the robust calculation for CCW, using a faster version:
game.modules.get('testccw').api.use_robust_ccw = false
```

*What does this do?*

Wraps 5 `RadialSweepPolygon` methods using [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper):
- `RadialSweepPolygon.prototype._initializeEndpoints`
- `RadialSweepPolygon.prototype._sweepEndpoints`
- `RadialSweepPolygon.prototype._includeWall`
- `RadialSweepPolygon.prototype._constructPoints`
- `RadialSweepPolygon.prototype._padRays`

This module replaces these methods with a version that is faster in many cases, and may also be more numerically stable.  

*How?*

The module implements a version of radial sweep that relies on sweeping endpoints in clockwise order around an origin point, comparing points and walls encountered in the sweep against the currently closest wall. Instead of measuring angles, which is time-consuming and prone to numerical approximations, it measures whether a given point is clockwise or counter-clockwise to a given wall.  

Sweep works by getting each counterclockwise-most endpoint, compared to a line from the origin vision/lighting point, in turn. The goal is to create the FOV (field-of-vision) polygon from collision points. For each endpoint:
- The origin --> endpoint --> end of vision is the sight line. 
- Sight line sweeps clockwise.
- Track walls of that endpoint
- Track of the closest wall to the origin in an ordered binary search tree.
- At each endpoint, add as a collision point if it is the closest wall endpoint. If another wall is currently in front, don't add. If you have reached the end of the closest wall, find the intersection point to the next-closest wall and add that as a collision point. Update closest wall accordingly.

*Why?*

Hopefully get faster or more robust vision methods incorporated into [Foundry VTT](https://foundryvtt.com). Plus, this is a good way to learn Javascript!

*Known issues*

This module currently does not attempt to handle walls that overlap but do not share an endpoint. 

Numerous other bugs are likely. I am only one person, and this is a side project! My day job is not programming! 

