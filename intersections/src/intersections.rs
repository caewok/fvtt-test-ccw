// extern crate test;

use crate::geometry::{Point, Segment};
use crate::geometry;
use serde::{Serialize, Deserialize};
use serde_json;
use std::fs;
use std::cmp::Ordering;
use std::cmp;
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize, PartialEq, PartialOrd)]
pub struct IntersectionResult {
  pub ix: Point,
  pub s1_id: String,
  pub s2_id: String,
}

impl IntersectionResult {
	pub fn order_ids(&mut self) {
		let order = self.s1_id.cmp(&self.s2_id);//.unwrap();
		if order == Ordering::Less {
			println!("String ids {} {} less!", self.s1_id, self.s2_id);

		} else if order == Ordering::Greater {
			println!("String ids {} {} greater!", self.s1_id, self.s2_id);
			let s1_id = self.s1_id.clone();
			self.s1_id = self.s2_id.clone();
			self.s2_id = s1_id;

		} else if order == Ordering::Equal {
			println!("String ids {} {} equal!", self.s1_id, self.s2_id);
		}
	}
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
		let segments_slice = &segments[(i + 1)..]; // faster than if i <= j { continue; }
	    for (j, sj) in segments_slice.iter().enumerate() {
	      	// if i <= j { continue; } // don't need to compare the same segments twice
	      	if !geometry::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }

	      	let ix = geometry::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
          	ixs.push(IntersectionResult {
              	ix,
              	s1_id: si.id.clone(),
              	s2_id: sj.id.clone(),
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
	      	//if ix.x.is_nan() || ix.y.is_nan() { continue; } // likely the same segment

          	ixs.push(IntersectionResult {
              	ix,
              	s1_id: si.id.clone(),
              	s2_id: sj.id.clone(),
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
pub fn brute_sort_single(segments: &mut Vec<Segment>) -> Vec<IntersectionResult> {
	let mut ixs: Vec<IntersectionResult> = Vec::new();

	// sort the segments by the a point (ne or min_xy)
	segments.sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());
	let ln = segments.len();

	for (i, si) in segments.iter().enumerate() {
		let segments_slice = &segments[(i + 1)..];

	    for (j, sj) in segments_slice.iter().enumerate() {
// 	    	if i <= j { continue; }

	    	// if we have not yet reached the left end of this segment, we can skip
	    	let left_res = sj.b.partial_cmp(&si.a).unwrap(); // Segment::compare_xy(&sj.b, &si.a);
	    	if left_res == Ordering::Less { continue; }

	    	// if we reach the right end of this segment, we can skip the rest
	    	let right_res = sj.a.partial_cmp(&si.b).unwrap(); // Segment::compare_xy(&sj.a, &si.b);
	    	if right_res == Ordering::Greater { break; }

	      	if !geometry::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }

	      	let ix = geometry::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
          	ixs.push(IntersectionResult {
              	ix,
              	s1_id: si.id.clone(),
              	s2_id: sj.id.clone(),
         	});
	  	}
	}

   	ixs
}

// slower when tracking skipped with HashSet
// faster to use slice than to use for j in start_j..ln!
// Using HashSet appears slower for most cases
pub fn brute_sort_single2(segments: &mut Vec<Segment>) -> Vec<IntersectionResult> {
	let mut ixs: Vec<IntersectionResult> = Vec::new();

	// sort the segments by the a point (ne or min_xy)
	segments.sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());

	let mut skipped = HashSet::new();

	for (i, si) in segments.iter().enumerate() {
		let start_j = i + 1;
		let segments_slice = &segments[start_j..];

	    for (j, sj) in segments_slice.iter().enumerate() {
	    	//if i <= j { continue; }

	    	if skipped.contains(&(start_j + j)) { continue; }

	    	// if we have not yet reached the left end of this segment, we can skip
	    	let left_res = sj.b.partial_cmp(&si.a).unwrap(); // Segment::compare_xy(&sj.b, &si.a);
	    	if left_res == Ordering::Less {
	    		skipped.insert(start_j + j);
	    		continue;
	    	}

	    	// if we reach the right end of this segment, we can skip the rest
	    	let right_res = sj.a.partial_cmp(&si.b).unwrap(); // Segment::compare_xy(&sj.a, &si.b);
	    	if right_res == Ordering::Greater { break; }

	      	if !geometry::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }

	      	let ix = geometry::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
          	ixs.push(IntersectionResult {
              	ix,
              	s1_id: si.id.clone(),
              	s2_id: sj.id.clone(),
         	});
	  	}
	}

   	ixs
}



/// Detect intersections between two array of segments.
/// Sort the segments based on the left point
/// Only test segments that fall within the x value of the current segment being tested.
///
/// ## Arguments
/// *segments1* Array of Segments to test.
/// *segments2* Array of Segments to compare against the first array.
///
/// ## Returns
/// Array of intersections and segment indices.
pub fn brute_sort_double(segments1: &mut Vec<Segment>, segments2: &mut Vec<Segment>) -> Vec<IntersectionResult> {
	let mut ixs: Vec<IntersectionResult> = Vec::new();

	// sort the segments by the a point (ne or min_xy)
	segments1.sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());
	segments2.sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());
// 	dbg!(&segments1);
// 	dbg!(&segments2);

	for (i, si) in segments1.iter().enumerate() {
	    for (j, sj) in segments2.iter().enumerate() {
// 	    	println!("i {}, j {}", i, j);
// 	    	println!("si: {}", si);
// 	    	println!("sj: {}", sj);

	    	// if we have not yet reached the left end of this segment, we can skip
	    	let left_res = sj.b.partial_cmp(&si.a).unwrap(); // Segment::compare_xy(&sj.b, &si.a);
	    	if left_res == Ordering::Less {
// 	    		println!("skipping i {}, j {}", i, j);
// 	    		println!("");
	    		continue;
	    	}

	    	// if we reach the right end of this segment, we can skip the rest
	    	let right_res = sj.a.partial_cmp(&si.b).unwrap(); // Segment::compare_xy(&sj.a, &si.b);
	    	if right_res == Ordering::Greater {
// 	    		println!("breaking right at i {}, j {}", i, j);
// 	    		println!("");
	    		break;
	    	}

	      	if !geometry::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) {
// 	      		println!("No intersection.");
// 	      		println!("");
	      		continue;
	      	}

	      	let ix = geometry::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
          	ixs.push(IntersectionResult {
              	ix,
              	s1_id: si.id.clone(),
              	s2_id: sj.id.clone(),
         	});
//          	println!("Intersection {}!", ix);
//          	println!("");
	  	}
	}

   	ixs
}

pub fn brute_sort_double2(segments1: &mut Vec<Segment>, segments2: &mut Vec<Segment>) -> Vec<IntersectionResult> {
	let mut ixs: Vec<IntersectionResult> = Vec::new();

	// sort the segments by the a point (ne or min_xy)
	segments1.sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());
	segments2.sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());

	let mut skipped = HashSet::new();

	for (i, si) in segments1.iter().enumerate() {
	    for (j, sj) in segments2.iter().enumerate() {
	    	if skipped.contains(&j) { continue; }

	    	// if we have not yet reached the left end of this segment, we can skip
	    	let left_res = sj.b.partial_cmp(&si.a).unwrap(); // Segment::compare_xy(&sj.b, &si.a);
	    	if left_res == Ordering::Less {
	    		skipped.insert(j);
	    		continue;
	    	}

	    	// if we reach the right end of this segment, we can skip the rest
	    	let right_res = sj.a.partial_cmp(&si.b).unwrap(); // Segment::compare_xy(&sj.a, &si.b);
	    	if right_res == Ordering::Greater { break; }

	      	if !geometry::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }

	      	let ix = geometry::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
          	ixs.push(IntersectionResult {
              	ix,
              	s1_id: si.id.clone(),
              	s2_id: sj.id.clone(),
         	});
	  	}
	}

   	ixs
}


// // using j_done alone, incrementing +1 (probably same as using max, might be better at small end)
// test intersections::tests::test_1000_double      ... bench:   6,832,479 ns/iter (+/- 334,995)
// test intersections::tests::test_1000_single      ... bench:   6,573,012 ns/iter (+/- 332,609)
// test intersections::tests::test_1000_sort_double ... bench:   5,621,283 ns/iter (+/- 271,983)
// test intersections::tests::test_1000_sort_single ... bench:   3,112,295 ns/iter (+/- 213,510)
// test intersections::tests::test_100_double       ... bench:      31,627 ns/iter (+/- 2,469)
// test intersections::tests::test_100_single       ... bench:      42,084 ns/iter (+/- 5,219)
// test intersections::tests::test_100_sort_double  ... bench:      35,609 ns/iter (+/- 5,609)
// test intersections::tests::test_100_sort_single  ... bench:      17,941 ns/iter (+/- 2,869)
// test intersections::tests::test_10_double        ... bench:         415 ns/iter (+/- 14)
// test intersections::tests::test_10_single        ... bench:         379 ns/iter (+/- 17)
// test intersections::tests::test_10_sort_double   ... bench:         345 ns/iter (+/- 17)
// test intersections::tests::test_10_sort_single   ... bench:         252 ns/iter (+/- 7)
//
// // using j_done and max(i+1, j_done)
// test intersections::tests::test_1000_double      ... bench:   6,863,879 ns/iter (+/- 450,158)
// test intersections::tests::test_1000_single      ... bench:   6,689,633 ns/iter (+/- 502,524)
// test intersections::tests::test_1000_sort_double ... bench:   5,599,604 ns/iter (+/- 124,314)
// test intersections::tests::test_1000_sort_single ... bench:   3,109,184 ns/iter (+/- 141,403)
// test intersections::tests::test_100_double       ... bench:      31,582 ns/iter (+/- 237)
// test intersections::tests::test_100_single       ... bench:      45,000 ns/iter (+/- 1,161)
// test intersections::tests::test_100_sort_double  ... bench:      37,516 ns/iter (+/- 1,291)
// test intersections::tests::test_100_sort_single  ... bench:      16,835 ns/iter (+/- 199)
// test intersections::tests::test_10_double        ... bench:         439 ns/iter (+/- 14)
// test intersections::tests::test_10_single        ... bench:         387 ns/iter (+/- 9)
// test intersections::tests::test_10_sort_double   ... bench:         355 ns/iter (+/- 7)
// test intersections::tests::test_10_sort_single   ... bench:         263 ns/iter (+/- 7)
//
// // no use of j_done
// test intersections::tests::test_1000_double      ... bench:   7,269,924 ns/iter (+/- 145,187)
// test intersections::tests::test_1000_single      ... bench:   6,504,945 ns/iter (+/- 101,959)
// test intersections::tests::test_1000_sort_double ... bench:   7,364,033 ns/iter (+/- 130,160)
// test intersections::tests::test_1000_sort_single ... bench:   3,148,268 ns/iter (+/- 47,163)
// test intersections::tests::test_100_double       ... bench:      31,736 ns/iter (+/- 791)
// test intersections::tests::test_100_single       ... bench:      41,778 ns/iter (+/- 8,292)
// test intersections::tests::test_100_sort_double  ... bench:      41,775 ns/iter (+/- 1,590)
// test intersections::tests::test_100_sort_single  ... bench:      15,894 ns/iter (+/- 1,752)
// test intersections::tests::test_10_double        ... bench:         409 ns/iter (+/- 10)
// test intersections::tests::test_10_single        ... bench:         375 ns/iter (+/- 14)
// test intersections::tests::test_10_sort_double   ... bench:         393 ns/iter (+/- 24)
// test intersections::tests::test_10_sort_single   ... bench:         263 ns/iter (+/- 4)


struct BenchSetup {
	segments_10_1: Vec<Segment>,
	segments_10_2: Vec<Segment>,
	segments_100_1: Vec<Segment>,
	segments_100_2: Vec<Segment>,
	segments_1000_1: Vec<Segment>,
	segments_1000_2: Vec<Segment>,

}

impl BenchSetup {
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

struct TestSetup {
	segments: Vec<Segment>,
	results_single: Vec<IntersectionResult>,
	results_double: Vec<IntersectionResult>,
}

impl TestSetup {
	fn new() -> Self {
		let test_str = fs::read_to_string("segments_intersection_test.json").unwrap();
		let results_single_str = fs::read_to_string("segments_intersection_results_brute_single.json").unwrap();
		let results_double_str = fs::read_to_string("segments_intersection_results_brute_double.json").unwrap();

		// sort the segments so that the intersection algorithms
		// report the data in the same order
		let mut segments: Vec<Segment> = serde_json::from_str(&test_str).unwrap();
		segments.sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());

		Self {
			segments,
			results_single: serde_json::from_str(&results_single_str).unwrap(),
			results_double: serde_json::from_str(&results_double_str).unwrap(),
		}
	}
}


// run test using cargo +nightly bench
// must first install nightly: rustup install nightly

#[cfg(test)]
mod tests {
	use super::*;
	use test::Bencher;

	/* ----------- TESTS -------------- */

	#[test]
	fn brute_single_works() {
	    let setup = TestSetup::new();
	    let mut ixs = brute_single(&setup.segments);
    	ixs.iter_mut().for_each(|i| i.order_ids());
    	ixs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    	assert_eq!(ixs, setup.results_single);
	}

	#[test]
	fn brute_double_works() {
	    let setup = TestSetup::new();
	    let segments2 = setup.segments.clone();

	    let mut ixs = brute_double(&setup.segments, &segments2);
    	ixs.iter_mut().for_each(|i| i.order_ids());
    	ixs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    	assert_eq!(ixs, setup.results_double);
	}

	#[test]
	fn brute_sort_single_works() {
	    let mut setup = TestSetup::new();
	    let mut ixs = brute_sort_single(&mut setup.segments);
    	ixs.iter_mut().for_each(|i| i.order_ids());
    	ixs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    	assert_eq!(ixs, setup.results_single);
	}

	#[test]
	fn brute_sort_single2_works() {
	    let mut setup = TestSetup::new();
	    let mut ixs = brute_sort_single2(&mut setup.segments);
    	ixs.iter_mut().for_each(|i| i.order_ids());
    	ixs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    	assert_eq!(ixs, setup.results_single);
	}

	#[test]
	fn brute_sort_double_works() {
	    let mut setup = TestSetup::new();
	    let mut segments2 = setup.segments.clone();

	    let mut ixs = brute_sort_double(&mut setup.segments, &mut segments2);
    	ixs.iter_mut().for_each(|i| i.order_ids());
    	ixs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    	assert_eq!(ixs, setup.results_double);
	}

	#[test]
	fn brute_sort_double2_works() {
	    let mut setup = TestSetup::new();
	    let mut segments2 = setup.segments.clone();

	    let mut ixs = brute_sort_double2(&mut setup.segments, &mut segments2);
    	ixs.iter_mut().for_each(|i| i.order_ids());
    	ixs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    	assert_eq!(ixs, setup.results_double);
	}

	/* ----------- BENCHMARKS --------- */
	#[bench]
	fn test_10_single(b: &mut Bencher) {
		let setup = BenchSetup::new();
		b.iter(|| brute_single(&setup.segments_10_1));
	}

	#[bench]
	fn test_10_sort_single(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_single(&mut setup.segments_10_1));
	}

	#[bench]
	fn test_10_sort_single2(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_single2(&mut setup.segments_10_1));
	}

	#[bench]
	fn test_10_double(b: &mut Bencher) {
		let setup = BenchSetup::new();
		b.iter(|| brute_double(&setup.segments_10_1, &setup.segments_10_2));
	}

	#[bench]
	fn test_10_sort_double(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_double(&mut setup.segments_10_1, &mut setup.segments_10_2));
	}

	#[bench]
	fn test_10_sort_double2(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_double2(&mut setup.segments_10_1, &mut setup.segments_10_2));
	}

	#[bench]
	fn test_100_single(b: &mut Bencher) {
		let setup = BenchSetup::new();
		b.iter(|| brute_single(&setup.segments_100_1));
	}

	#[bench]
	fn test_100_sort_single(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_single(&mut setup.segments_100_1));
	}

	#[bench]
	fn test_100_sort_single2(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_single2(&mut setup.segments_100_1));
	}

	#[bench]
	fn test_100_double(b: &mut Bencher) {
		let setup = BenchSetup::new();
		b.iter(|| brute_double(&setup.segments_100_1, &setup.segments_100_2));
	}

	#[bench]
	fn test_100_sort_double(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_double(&mut setup.segments_100_1, &mut setup.segments_100_2));
	}

	#[bench]
	fn test_100_sort_double2(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_double2(&mut setup.segments_100_1, &mut setup.segments_100_2));
	}

	#[bench]
	fn test_1000_single(b: &mut Bencher) {
		let setup = BenchSetup::new();
		b.iter(|| brute_single(&setup.segments_1000_1));
	}

	#[bench]
	fn test_1000_sort_single(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_single(&mut setup.segments_1000_1));
	}

	#[bench]
	fn test_1000_sort_single2(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_single2(&mut setup.segments_1000_1));
	}

	#[bench]
	fn test_1000_double(b: &mut Bencher) {
		let setup = BenchSetup::new();
		b.iter(|| brute_double(&setup.segments_1000_1, &setup.segments_1000_2));
	}

	#[bench]
	fn test_1000_sort_double(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_double(&mut setup.segments_1000_1, &mut setup.segments_1000_2));
	}

	#[bench]
	fn test_1000_sort_double2(b: &mut Bencher) {
		let mut setup = BenchSetup::new();
		b.iter(|| brute_sort_double2(&mut setup.segments_1000_1, &mut setup.segments_1000_2));
	}

}
