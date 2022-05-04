# Test CCW

Module framework for testing a vision/lighting improvements [Foundry VTT](https://foundryvtt.com).

Add this [Manifest URL](https://github.com/caewok/fvtt-test-ccw/releases/latest/download/module.json) in Foundry to install.

## Overview

At present (and subject to change), there are several algorithms explored related to sweep
and intersecting arrays of segments.

## Intersections
Brute, sort, and [Myers sweep](https://publications.mpi-cbg.de/Myers_1985_5441.pdf) algorithms are provided. Each have two forms:
- "Single": The function takes a single array of segments and compares every segment against every other segment for intersections.
- "Red/Black": The function takes two arrays of segments ("red" and "black") and compares one set to the other for intersections.

In both cases, the function takes a reporting callback function that can vary what is done when the intersecting segments are identified.

To test from the console in Foundry VTT:
```js
let api = game.modules.get('testccw').api;
api.bench.describeSceneParameters(); // Basic information regarding the scene.
api.tests.testSceneIntersections(); // Test for walls in the scene
await api.bench.benchSceneIntersections(); // Benchmark using wallsin the scene
```

To call a specific function, you can pass an array of segments to the respective function. For sort and Myers sweep, the segments must have nw and se endpoints identified. Converting to `PolygonEdge` (Foundry) or `SimplePolygonEdge` (this package) will suffice. Note that segments with intersecting endpoints are reported unless filtered out by the reporting callback function. For example:
```js
let api = game.modules.get('testccw').api;
let segments = canvas.walls.placeables.map(w => api.SimplePolygonEdge.fromWall(w));
let reportFn = (s1, s2) => console.log(`${s1.id} x ${s2.id}`);
api.intersections.findIntersectionsBruteSingle(segments, reportFn);
api.intersections.findIntersectionsSortSingle(segments, reportFn);
api.intersections.findIntersectionsMyersSingle(segments, reportFn);
```

## Clockwise Sweep
Clockwise sweep is modified to accept:
1. A bounding polygon of any shape.
2. One or more temporary walls.

Three variations of the Foundry ClockwiseSweep are provided. Each represents an incremental change to make it easier to work with bounding polygons and temporary walls, and simplifying the underlying sweep algorithm.
1. The first variation removes all limited radius and limited angle calculations. Temporary walls are used to represent the limited angle. A bounding box is used to trim unneeded walls from the sweep. After the sweep completes, the resulting polygon is intersected with the limited radius circle if necessary.

2. The second variation modifies (1) by not using temporary walls to represent the limited angle. Instead, the limited angle is intersected against the resulting sweep algorithm at the end, similar to how the limited radius circle is intersected in (1) and (2).

3. The third variation modifies (2) by stripping out unnecessary code in the sweep algorithm due to no longer having to consider limited angle (or limited radius circle) at all during the sweep. Consequently, (3) is usually faster than (2).

To run a benchmark of the different algorithms for a given scene, select a token in the scene and run the provided function, which will cycle through variations of limited angle and limited radius:
```js
let api = game.modules.get('testccw').api;
api.bench.describeSceneParameters(); // Basic information regarding the scene.
await api.bench.benchScene();

// options:
// benchScene(n = 100, { origin, rotation, radius = 60, angle = 80, angle2 = 280 }
```

Each of the three variations have strengths and weaknesses depending on the scene and the specific vision/lighting parameters. And all show comparable performance to ClockwiseSweep. In general, (3) is is comparable to or faster than the default ClockwiseSweep and the other algorithms when processing unrestricted vision or when dealing with small limited angles and limited radius vision/lighting. (1) has some advantage in processing limited angles, and so does better when the limited angle is large.

## Additional Details

### Circle - Polygon Intersection
It is assumed that the circle and sweep polygon both encompass a shared origin point. Because of this, and because the circle is convex, it is possible to walk the sweep polygon clockwise, noting where the circle intersects a polygon edge. At each intersection, turn clockwise to intersect the shapes (counter-clockwise would form a union of the two shapes). This means at every intersection, you choose to walk clockwise around the polygon or clockwise around the circle, marking endpoints along the way. The resulting points form the intersecting polygon of the polygon and circle. When tracing the circle, padding points are used to approximate a circle with a polygon shape.

This turns out to be a fairly quick way to intersect a circle with a polygon, because it takes less than two passes around the polygon and the circle has known properties that do not change regardless of which polygon edge you are testing.

### Limited Radius - Polygon Intersection
As above, it is assumed that the limited radius and sweep polygon both encompass (or at least are on) a shared origin point. Because of this and the nature of the limited radius, it is possible to apply the circle-polygon intersection algorithm described above, with only minor variations.

### Sort key for segments
The sort intersection algorithm and the Myers sweep algorithm requires that segments endpoints be identified as northwest and southeast and sorted accordingly. It is therefore useful to use a simple numeric key instead of constantly comparing x and y coordinates: `xN + y = key`, where `N` is the maximum coordinate that can be encountered.

## Known issues

Bugs and issues are likely but not known. I am only one person, and this is a side project! My day job is not programming!

