/* globals

*/

"use strict";

/*
Change ClockwiseSweep so that it no longer treats limited radius as a special case.
Instead, after the sweep polygon is constructed, intersect that polygon against a circle
to get the final polygon when there is a limited radius.

Changes:
- Config sets one or more shapes that should be intersected with the sweep.
  (Here, the circle is currently the only shape used.)
- Trim walls by an encompassing boundary box.
- Drop all limited radius special code
- Use clipper at end to intersect a polygon approximation of the circle

The boundary box is the intersection of each boundary shape bounding box. This means
each shape object must provide a getBounds() method and the rectangle object
must have a method to intersect against other rectangles.

*/
export class MyClockwiseSweepPolygon extends ClockwiseSweepPolygon {

  /**
   * Changes to initialize:
   * - Use maximum rays throughout to ensure we always hit the bounding box
   * - add intersecting shapes array to the config
   * - round origin
   * - construct a bounding box from the shapes config
   */
  initialize(origin, config) {
    super.initialize(origin, {...config}); // For benchmark & debugging, it can be problematic if the original config object is modified
    const cfg = this.config;

    // Round the origin. Reasons:
    // 1. Consistent angle when calculating the limited angle polygon
    // 2. Consistent straight ray from origin to the bounding box edges.
    // TO-DO: Rounding origin implies that ClockwiseSweep should only be called when the
    // origin has moved 1+ pixels in either x or y direction.

    // Other modules (such as those adding elevation properties to origin) need
    // the origin point to not be overridden. So override the x and y here separately.
    // Use faster rounding method: https://gist.github.com/Olical/1162452
    this.origin.x = this.origin.x + .5 << 0; // Math.round(this.origin.x)
    this.origin.y = this.origin.y + .5 << 0; // Math.round(this.origin.y)

    // Use maximum rays throughout to ensure we always hit the bounding box.
    cfg.radiusMax = canvas.dimensions.maxR;
    cfg.radiusMax2 = Math.pow(cfg.radiusMax, 2);

    // For now, the boundary array will only have a circle.
    // Eventually, it could contain many shapes, including shapes passed through config
    // or through config.source
    cfg.boundaryShapes = [];

    // Represent the limited radius boundary by a circle.
    if ( cfg.hasLimitedRadius ) {
      cfg.boundaryShapes.push(new PIXI.Circle(this.origin.x, this.origin.y, cfg.radius));
    }

    // Construct the bounding box from the boundaryShapes
    cfg.bbox = this._constructBoundingBox();


  }

  /**
   * New method
   * Construct a bounding box from one or more boundary shapes.
   * The bounding box is passed to quadtree to limit the walls considered for the sweep.
   * @return {NormalizedRectangle|undefined}
   * @private
   */
   _constructBoundingBox() {
     const { boundaryShapes } = this.config;

     if ( !boundaryShapes.length ) return undefined;

     // Start with the canvas box
     let bbox = canvas.dimensions.rect;

     // Intersect against each shape in turn.
     for ( const shape of boundaryShapes ) {
       bbox = bbox.intersection(shape.getBounds());
     }

     // Convert to NormalizedRectangle, which is expected by _getWalls method.
     // Use '~~' like Math.floor, to force the box to integer coordinates
     // Expand by 1 to ensure origin will not fall on a boundary edge
     // Note: At least one shape must include the origin for sweep to work as expected
     bbox = new NormalizedRectangle(~~bbox.x, ~~bbox.y, ~~bbox.width, ~~bbox.height);

     // Expand by 1 to ensure origin will not fall on a boundary edge
     // Note: At least one shape must include the origin for sweep to work as expected
     bbox.pad(1);

     return bbox;
   }

  /**
   * Changes to compute:
   * - Add intersectBoundary step
   */
  _compute() {
    super();

    // *** NEW *** //
    // Step 5 - Intersect boundary
    this._intersectBoundary();
  }

  /**
   * New method
   * Given the computed sweep polygon, intersect against each boundary shape.
   */
  _intersectBoundary() {
    const { boundaryShapes } = this.config;

    // Jump early if nothing to intersect
    // Need three points to form a polygon
    if (this.points.length < 6) return;

    // TO-DO: Require each shape to have an intersectPolygon method.
    // Call that instead of calling toPolygon on each shape.
    // This allows for certain shapes, like circle, to use a faster specialized
    // intersection method.
    let poly = this;
    for ( const shape of boundaryShapes ) {
      const poly_shape = shape instanceof PIXI.Polygon ? shape : shape.toPolygon();
      poly = poly.intersectPolygon(poly_shape); // See PIXI.Polygon: uses ClipperLib
    }

    this.points = poly.points;
  }

  /**
   * Changes to _identifyEdges:
   * - Do not constrain edges to a limited radius (handled by _getWalls + intersectBoundary)
   */
  _identifyEdges() {
    const {type, hasLimitedAngle} = this.config;

    // Add edges for placed Wall objects
    const walls = this._getWalls();
    for ( let wall of walls ) {
      if ( !this.constructor.testWallInclusion(wall, this.origin, type) ) continue;
      const edge = PolygonEdge.fromWall(wall, type);
      this.edges.add(edge);
    }

    // Add edges for the canvas boundary
    for ( let boundary of canvas.walls.boundaries ) {
      this.edges.add(PolygonEdge.fromWall(boundary, type));
    }

    // Restrict edges to a limited angle
    if ( hasLimitedAngle ) {
      this._restrictEdgesByAngle();
    }

    // *** NEW: No constrain by limited radius ***
  }

  /**
   * Changes to _getWalls:
   * - Use the custom bbox to limit walls instead of constructing one here
   */
  _getWalls() {
    if ( !this.config.bbox ) return canvas.walls.placeables;
    return Array.from(canvas.walls.quadtree.getObjects(this.config.bbox).values());
  }

  /**
   * Deprecated method
   */
  _constrainEdgesByRadius() {
    console.warn("MyClockwiseSweepPolygon does not use _constrainEdgesByRadius.");
    super._constrainEdgesByRadius();
  }






}
