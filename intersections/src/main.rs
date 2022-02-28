// TO-DO: Possibly switch to geo crate to handle points, lines.
// For now, create from scratch to learn rust.
// for nightly:
// cargo +nightly build
// cargo +nightly test
// cargo +nightly benchmark
// cargo +nightly run

#![feature(test)]
extern crate test;

pub mod geometry;
pub mod intersections;

use geometry::{Point, Segment};
use serde_json;
use std::fs;

fn random_segments(n: u32, max: f64, negative: bool) -> Vec<Segment> {
	let mut segments: Vec<Segment> = Vec::new();
	for _ in 1..n {
		segments.push(Segment::random_ceil(max, negative));
	}
	segments
}

// Construct sets of segments for benchmark testing.
fn build_random_for_tests() {
	let segments = random_segments(10, 1000.0, true);

	let serialized = serde_json::to_string(&segments).unwrap();
    //println!("serialized = {}", serialized);

	fs::write("segments_random_10_1000_neg.json", &serialized).unwrap();
	println!("Saved segments_random_10_1000_neg.json.");

	let segments = random_segments(100, 2000.0, true);

	let serialized = serde_json::to_string(&segments).unwrap();
    //println!("serialized = {}", serialized);

	fs::write("segments_random_100_2000_neg.json", &serialized).unwrap();
	println!("Saved segments_random_100_2000_neg.json.");

	let segments = random_segments(1000, 4000.0, true);

	let serialized = serde_json::to_string(&segments).unwrap();
    //println!("serialized = {}", serialized);

	fs::write("segments_random_1000_4000_neg.json", &serialized).unwrap();
	println!("Saved segments_random_1000_4000_neg.json.");
}


// construct points for basic testing
fn build_test_points() {
	let points = vec![
		Point {
			x: 2300.0,
			y: 1900.0,
		},

		Point {
			x: 4200.0,
			y: 1900.0,
		},

		Point {
			x: 2387.0,
			y: 1350.0,
		},

		Point {
			x: 2500.0,
			y: 2100.0,
		},

		Point {
			x: 3200.0,
			y: 1900.0,
		},

		Point {
			x: 2900.0,
			y: 2100.0,
		}];

	let serialized = serde_json::to_string_pretty(&points).unwrap();
	fs::write("points_test.json", &serialized).unwrap();
	println!("Saved points_test.json.")
}



fn main() {
    println!("Hello, world!");


	// Create serialized output
//     build_random_for_tests();
//     build_test_points();

	// create intersection results file
	let str = fs::read_to_string("segments_intersection_test.json").unwrap();
	let mut segments: Vec<Segment> = serde_json::from_str(&str).unwrap();

	// sort the segments so that the intersection algorithms
	// report the data in the same order
	segments.sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());

	let mut segments2 = segments.clone();
//
//     let mut ixs = intersections::brute_single(&segments);
//     ixs.iter_mut().for_each(|i| i.order_ids());
//     ixs.sort_by(|a, b| a.partial_cmp(b).unwrap());
//     dbg!(&ixs);
//
//     // just use the same array for now
//     let mut ixs2 = intersections::brute_double(&segments, &segments);
//     ixs2.iter_mut().for_each(|i| i.order_ids());
//     ixs2.sort_by(|a, b| a.partial_cmp(b).unwrap());
//     dbg!(&ixs2);
//
    let mut ixs3 = intersections::brute_sort_single2(&mut segments);
    ixs3.iter_mut().for_each(|i| i.order_ids());
    ixs3.sort_by(|a, b| a.partial_cmp(b).unwrap());
    dbg!(&ixs3);
//
//     let mut ixs4 = intersections::brute_sort_double(&mut segments, &mut segments2);
//     ixs4.iter_mut().for_each(|i| i.order_ids());
//     ixs4.sort_by(|a, b| a.partial_cmp(b).unwrap());
//     dbg!(&ixs4);
//
//     let serialized = serde_json::to_string_pretty(&ixs).unwrap();
//     fs::write("segments_intersection_results_brute_single.json", &serialized).unwrap();
// 	println!("Saved segments_intersection_results_brute_single.json.");
//
// 	let serialized = serde_json::to_string_pretty(&ixs2).unwrap();
//     fs::write("segments_intersection_results_brute_double.json", &serialized).unwrap();
// 	println!("Saved segments_intersection_results_brute_double.json.");
//
// 	let serialized = serde_json::to_string_pretty(&ixs3).unwrap();
//     fs::write("segments_intersection_results_brute_sort_single.json", &serialized).unwrap();
// 	println!("Saved segments_intersection_results_brute_sort_single.json.");
//
// 	let serialized = serde_json::to_string_pretty(&ixs4).unwrap();
//     fs::write("segments_intersection_results_brute_sort_double.json", &serialized).unwrap();
// 	println!("Saved segments_intersection_results_brute_sort_double.json.");

	let mut ixs5 = intersections::brute_sort_double2(&mut segments, &mut segments2);
	dbg!(&ixs5);

//     let a = Point::random();
//     let b = Point::random_ceil(2000.0, false);

    // horizontal line 2300,1900|4200,1900
    // point to left: 2387, 1350
    // point on line: 3200, 1900
    // point to right: 2500, 2100
//     let a = Point {
//       x: 2300.0,
//       y: 1900.0,
//     };
//
//
//
//     let b = Point {
//       x: 4200.0,
//       y: 1900.0,
//     };
//
//     let c = Point {
//       x: 3200.0,
//       y: 1350.0,
//     };
//
//     let d = Point {
//       x: 3200.0,
//       y: 1900.0,
//     };
//
//     let e = Point {
//       x: 2500.0,
//       y: 2100.0,
//     };
//
//     let f = Point {
//       x: 4300.0,
//       y: 2100.0,
//     };
//
//     let g = Point {
//       x: 2500.0,
//       y: 2100.0,
//     };
//
//     let o = geometry::orient2d(&a, &b, &c);
//     dbg!(&a);
//     dbg!(&b);
//     dbg!(&c);
//
//     println!("Point orientation is {}", o);
//
//     let s1 = Segment::new( Point { ..a }, Point { ..b }, String::from("1") );
//     let s2 = Segment::new( Point { ..c }, Point { ..d }, String::from("2") );
//     let s3 = Segment::new( Point { ..d }, Point { ..e }, String::from("3") );
//     let s4 = Segment::new( Point { ..f }, Point { ..g }, String::from("4") );
//
//     let cmp1 = Segment::compare_xy(&a, &b);
//     let cmp2 = a.partial_cmp(&b).unwrap();
//     dbg!(&cmp1);
//     dbg!(&cmp2);
//
//
//     let serialized = serde_json::to_string(&s1).unwrap();
//     println!("serialized = {}", serialized);
//
//     let deserialized: Segment = serde_json::from_str(&serialized).unwrap();
//     println!("deserialized = {:?}", deserialized);
//
//     let mut segments = vec![s1, s2, s3, s4];
//     let mut segments2 = segments.clone();
//     let ixs = intersections::brute_single(&segments);
//     dbg!(&ixs);
//
//     // just use the same array for now
//     let ixs2 = intersections::brute_double(&segments, &segments);
//     dbg!(&ixs2);
//
//     let ixs3 = intersections::brute_sort_single(&mut segments);
//     dbg!(&ixs3);
//
//     let ixs4 = intersections::brute_sort_double(&mut segments, &mut segments2);
//     dbg!(&ixs4);
//
//     let serialized = serde_json::to_string_pretty(&segments).unwrap();
//     println!("serialized = {}", serialized);
//
//     let deserialized: Vec<Segment> = serde_json::from_str(&serialized).unwrap();
//     println!("deserialized = {:?}", deserialized);


}
