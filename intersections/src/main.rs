// #![feature(core_intrinsics)]

mod point;

use point::*;

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

	let p1: PointFloat = PointFloat::random();
	let p2: PointFloat = PointFloat::random();
	dbg!(p1);
	dbg!(p2);
// 	assert_eq!(p1 + p2, PointFloat::new(p1.x() + p2.x(), p1.y() + p2.y()));

	let p1_int: PointInt = PointInt::random_ceil(100);
	let p2_int: PointInt = PointInt::random_ceil(50);
	dbg!(p1_int);
	dbg!(p2_int);

	let p3: PointFloat = PointFloat::random();
	let p3_int: PointInt = PointInt::random_ceil(50);

	dbg!(PointFloat::orient2d(p1, p2, p3));
	dbg!(PointInt::orient2d(p1_int, p2_int, p3_int));
	dbg!(PointFloat::orient2d(p1_int.into(), p2_int.into(), p3_int.into()));

}
