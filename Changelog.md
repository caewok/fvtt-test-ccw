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
