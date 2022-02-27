// extern crate test;

use crate::geometry::{Point, Segment};
use crate::geometry;
use serde_json;
use std::fs;

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

/// Detect intersections between two array of segments.
/// Uses a brute-force algorithm, comparing each segment to every other segment.
///
/// ## Arguments
/// *segments1* Array of Segments to test.
/// *segments2* Array of Segments to compare against the first array.
///
/// ## Returns
/// Array of intersections and segment indices.
pub fn brute_double(segments1: &Vec<Segment>, segments2: &Vec<Segment>) -> Vec<IntersectionResult> {
    let mut ixs: Vec<IntersectionResult> = Vec::new();

	for (i, si) in segments1.iter().enumerate() {
	    for (j, sj) in segments2.iter().enumerate() {
	      	if !geometry::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }

	      	let ix = geometry::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
	      	if ix.x.is_nan() || ix.y.is_nan() { continue; } // likely the same segment

          	ixs.push(IntersectionResult {
              	ix,
              	i: i.try_into().unwrap(),
              	j: j.try_into().unwrap(),
         	});
	  	}
	}

   	ixs
}

/// Detect intersections in a set of segments.
/// Sort the segments based on the left point
/// Only test segments that fall within the x value of the current segment being tested.
///
/// ## Arguments
/// *segments* Array of segments to test. Each should be a Segment made up of 2 Points.
///
/// ## Returns
/// Array of intersections and segment indices.

// Use impl Segment fn new to identify ne/sw points?
// Use a fast sort mechanism?



struct TestSetup {
	segments_10_1: Vec<Segment>,
	segments_10_2: Vec<Segment>,
	segments_100_1: Vec<Segment>,
	segments_100_2: Vec<Segment>,
	segments_1000_1: Vec<Segment>,
	segments_1000_2: Vec<Segment>,
}

impl TestSetup {
	fn new() -> Self {
	   	let str2 = fs::read_to_string("segments_random_10_1000_neg1.json").unwrap();
	  	let str3 = fs::read_to_string("segments_random_10_1000_neg2.json").unwrap();
	   	let str4 = fs::read_to_string("segments_random_100_2000_neg1.json").unwrap();
	   	let str5 = fs::read_to_string("segments_random_100_2000_neg2.json").unwrap();
	   	let str6 = fs::read_to_string("segments_random_1000_4000_neg1.json").unwrap();
	   	let str7 = fs::read_to_string("segments_random_1000_4000_neg2.json").unwrap();

		Self {
			segments_10_1: serde_json::from_str(&str2).unwrap(),
			segments_10_2: serde_json::from_str(&str3).unwrap(),
			segments_100_1: serde_json::from_str(&str4).unwrap(),
			segments_100_2: serde_json::from_str(&str5).unwrap(),
			segments_1000_1: serde_json::from_str(&str6).unwrap(),
			segments_1000_2: serde_json::from_str(&str7).unwrap(),
		}
	}
}


// run test using cargo +nightly bench
// must first install nightly: rustup install nightly

#[cfg(test)]
mod tests {
	use super::*;
	use test::Bencher;

	#[bench]
	fn test_10_single(b: &mut Bencher) {
		let setup = TestSetup::new();
		b.iter(|| brute_single(&setup.segments_10_1));
	}

	#[bench]
	fn test_10_double(b: &mut Bencher) {
		let setup = TestSetup::new();
		b.iter(|| brute_double(&setup.segments_10_1, &setup.segments_10_2));
	}

	#[bench]
	fn test_100_single(b: &mut Bencher) {
		let setup = TestSetup::new();
		b.iter(|| brute_single(&setup.segments_100_1));
	}

	#[bench]
	fn test_100_double(b: &mut Bencher) {
		let setup = TestSetup::new();
		b.iter(|| brute_double(&setup.segments_100_1, &setup.segments_100_2));
	}

	#[bench]
	fn test_1000_single(b: &mut Bencher) {
		let setup = TestSetup::new();
		b.iter(|| brute_single(&setup.segments_1000_1));
	}

	#[bench]
	fn test_1000_double(b: &mut Bencher) {
		let setup = TestSetup::new();
		b.iter(|| brute_double(&setup.segments_1000_1, &setup.segments_1000_2));
	}
}
