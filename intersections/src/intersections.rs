use crate::geometry::{Point, Segment};
use crate::geometry;

#[derive(Debug)]
pub struct IntersectionResult {
  pub ix: Point,
  pub i: u32,
  pub j: u32,
}


/// Detect intersections in a single array of segments.
/// Uses a brute-force algorithm, comparing each segment to every other segment.
///
/// ## Arguments
/// *segments* Array of segments to test. Each should be a Segment made up of 2 Points.
///
/// ## Returns
/// Array of intersections and segment indices.
pub fn brute_single(segments: &Vec<Segment>) -> Vec<IntersectionResult> {
    let mut ixs: Vec<IntersectionResult> = Vec::new();

	for (i, si) in segments.iter().enumerate() {
	    for (j, sj) in segments.iter().enumerate() {
	      	if i == j { continue; }
	      	if !geometry::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }

	      	let ix = geometry::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
          	ixs.push(IntersectionResult {
              	ix,
              	i: i.try_into().unwrap(),
              	j: j.try_into().unwrap()
         	});
	  	}
	}

   	ixs
}