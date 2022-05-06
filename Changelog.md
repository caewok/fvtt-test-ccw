# 0.3.1:
Do not check vertices for whether they lie outside a boundary. Instead, remove edges that lie outside but if the edge crosses a boundary, keep the edge for the sweep. This fixes issus with an incorrect sweep result with bounded lights or limited angles.

# 0.3.0:
Key changes:
1. Segment array intersection algorithms: brute, sort, Myers.
2. Three algorithms for ClockwiseSweep focused on eliminating limited radius and limited angle calculations from the main sweep.
3. Adding clipper library for intersecting random polygons.

# 0.2.0
Key changes:
1. Visualize the sweep algorithm.
2. New class inheritance: CCWSweepPoint --> CCWPixelPoint --> CCWPoint --> PIXI.Point
3. New class inheritance: CCWSweepRay --> CCWPixelRay --> CCWRay --> Ray
4. Re-factor sweep based on two foundational methods:
   - `_processEndpointInFrontOfWall`
   - `_processEndOfWall`
5. Use a Priority Queue instead of a Binary Search Tree for storing walls during the sweep.


CCWSweepPoint --> CCWPixelPoint --> CCWPoint --> PIXI.Point
- CCWPoint contains methods for testing near equality and orientation of points.
- CCWPixelPoint forces points to have integer (pixel) coordinates.
- CCWSweepPoint represents a wall endpoint, and stores connected walls.

CCWSweepRay --> CCWPixelRay --> CCWRay --> Ray:
- CCWRay contains methods for testing orientation of points to the ray as well as calculating intersections and line-circle intersections.
- CCWPixelRay considers the ray to be the width of a pixel with CCWPixelPoints at either end.
- CCWSweepRay represents a wall.


# 0.1.4
Key changes:
1. Toggle to treat lights as triangle or square shape.
2. New line-circle geometric algorithm.
3. Fixes for various edge cases seen when a wall very nearly touches the light radius.

CCWSightRay class:
- New line-circle intersection test using geometry rather than quadratic equation.
- New algorithm to adjust line-circle intersection points to be consistently on or within the circle according to robust incircle test.
- Distance squared property and related methods.

CCWSweepPoint class:
- Handle radius tests using new line-circle algorithm.
- Add rounding method.

CCWSweepPolygon class:
- Toggle to treat lights as triangle or square shape. See API light_shape property.
- Toggle to pre-process wall intersections, creating a set of walls that do not overlap
- Improve testing for wall-circle intersections.
- Round wall endpoints when initializing endpoints.
- Skip walls that are basically points.
- Minor fixes to catch edge cases in sweep algorithms.

CCWSweepWall class:
- Use CCWSweepPoints for endpoints.
- Improve treatment of radius intersections; add intersectsRadius property.
- Add test for whether the wall is tangent to a circle.
- Minor fixes to treatment of wall ids.

IntersectionSweep and related classes:
- Consistently use CCWSweepWalls.
- Fixes to treatment of underlying base wall ids.

Add incircle robust function and related tests. Let more functions pass through EPSILON to almostEqual tests.

# 0.1.3
Pre-process walls to detect intersections of overlapping walls.
Add API hook to toggle intersection detection on/off.
Create intersection processing classes with three algorithms:
- Brute force
- Simple sweep that runs brute force but only for walls within the x values for the left and right endpoints of each wall.
- Bentley-Ottoman sweep

Modify BinarySearchTree to accept a comparison function.

# 0.1.2
Bug fixes for terrain walls with lighting.

# 0.1.1
Account for terrain walls. Address edge case where two terrain walls form a triangular point. Add drawing methods for debugging use.

# 0.1.0
Refactor to not rely on libWrapper. Instead, use classes:
- `CCWSweepPolygon` extends `PointSourcePolygon`
- `CCWSightRay` extends `Ray`
- `CCWSweepPoint` extends `PIXI.Point`
- `CCWSweepWall` extends `CCWSightRay`

Benchmark function calls each `PointSourcePolygon` type's benchmark directly. Various improvements to speed and simplification of code.

# 0.0.1
Initial release. Working with no obvious errors in Foundry v9 Prototype 1 (v. 9.220).

Changes too many to list here, but these are the major additions:
- `patching.js` uses libWrapper to wrap Foundry `RadialSweep` vision methods and add new ones.
- `orient2d.js` code from https://github.com/mourner/robust-predicates. MIT licensed.
- `ray.js` containing methods added to the Ray class.
- `wall.js` containing methods added to the Wall class.
- `util.js` containing helper methods like `orient2d` and related measurement tools.
- `class_BinarySearchTree.js` implementing a basic recursive binary search tree.
- `class_PotentialWallList.js` extending the binary search tree to store walls by nearness to an origin point
- `radial_sweep.js`, which does most of the work of implementing a sweep, visiting each endpoint clockwise around an origin point and checking against the current closest wall.
- `benchmark.js` to run benchmarks using Foundry `benchmarkSight` function.

# 0.0.1-alpha
Initial release for testing.
