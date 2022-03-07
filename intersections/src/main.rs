#![feature(core_intrinsics)]

mod point;

use point::*;

use geo::{Point};
// use std::fs;
//
// struct TestSetup {
// 	points_float: Vec<Point<f64>>,
// // 	points_int: Vec<Point<i32>>,
// }
//
// impl TestSetup {
// 	fn new() -> Self {
// 	   	let str1 = fs::read_to_string("points_test.json").unwrap();
//
// 		Self {
// 			points_float: serde_json::from_str(&str1).unwrap(),
// // 			points_int: serde_json::from_str(&str1).unwrap(),
// 		}
// 	}
// }

fn main() {
    println!("Hello, world!");

	let p1: Point<f32> = Point::random();
	let p2: Point<f32> = Point::random();
	assert_eq!(p1 + p2, Point::new(p1.x() + p2.x(), p1.y() + p2.y()));

	let p1_int: Point<i32> = Point::random_ceil(100);
	let p2_int: Point<i32> = Point::random_ceil(50);
	dbg!(p1_int);
	dbg!(p2_int);

	let p3: Point<f32> = Point::random();
	let p3_int: Point<i32> = Point::random_ceil(50);

// 	dbg!(Point::orient2d(p1, p2, p3));
	dbg!(Point::orient2d(p1_int, p2_int, p3_int));

}
