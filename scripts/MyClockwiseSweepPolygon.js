export class MyClockwiseSweepPolygon extends ClockwiseSweepPolygon {

  _restrictEdgesByAngle() {
    console.log(`MyClockwiseSweepPolygon`);
  
    const {rMin, rMax} = this.config;
    for ( let edge of this.edges ) {

      // If either vertex is inside, keep the edge
      edge.A._inLimitedAngle = this.constructor.pointBetweenRays(edge.A, rMin, rMax);
      edge.B._inLimitedAngle = this.constructor.pointBetweenRays(edge.B, rMin, rMax);
      if ( edge.A._inLimitedAngle || edge.B._inLimitedAngle ) {
        continue;
      }

      // If both vertices are outside, test whether the edge collides with one (either) of the limiting rays
      if ( !(foundry.utils.lineSegmentIntersects(rMin.A, rMin.B, edge.A, edge.B) ||
        foundry.utils.lineSegmentIntersects(rMax.A, rMax.B, edge.A, edge.B)) ) {
        this.edges.delete(edge);
      }
    }
  }
  
}