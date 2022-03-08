// #![feature(core_intrinsics)]
#![feature(test)]

mod point;
mod segment;
mod intersections;
// mod bench_ix;


use crate::point::*;
use crate::segment::*;
use crate::intersections::{ IxResult, ix_brute_single };

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

	println!("p1 is {}", p1);
	println!("p2 is {}", p2);

	let p1: PointFloat = PointFloat::random_ceil(1000.0);
	let p2: PointFloat = PointFloat::random_ceil(1000.0);
	println!("p1 is {}", p1);
	println!("p2 is {}", p2);

// 	assert_eq!(p1 + p2, PointFloat::new(p1.x() + p2.x(), p1.y() + p2.y()));

	let p1_int: PointInt = PointInt::random_ceil(100);
	let p2_int: PointInt = PointInt::random_ceil(50);
	dbg!(p1_int);
	dbg!(p2_int);

	println!("p1_int is {}", p1);
	println!("p2_int is {}", p2);


	let p3: PointFloat = PointFloat::random();
	let p3_int: PointInt = PointInt::random_ceil(50);

	dbg!(PointFloat::orient2d(p1, p2, p3));
	dbg!(PointInt::orient2d(p1_int, p2_int, p3_int));
	dbg!(PointFloat::orient2d(p1_int.into(), p2_int.into(), p3_int.into()));

	let s1 = SegmentFloat::new(p1, p2);
	let s1_int: SegmentInt = s1.into();

	dbg!(s1);
	dbg!(s1_int);

	println!("x,y {},{}; rounded: {},{}", p1.x, p1.y, p1.x.round(), p1.y.round());

	let x: f32 = 1.543;
	let y: f32 = -0.012345;
	println!("{},{} rounded: {},{}", x, y, x.round(), y.round());
	println!("x, y: {},{}", x, y);



	let p1: Point = Point::Float(PointFloat::random_ceil(1000.0));
	let p2: Point = Point::Float(PointFloat::random_ceil(1000.0));
	let p3: Point = Point::Float(PointFloat::random_ceil(1000.0));

	let p1_int: Point = Point::Int(PointInt::random_ceil(1000));
	let p2_int: Point = Point::Int(PointInt::random_ceil(1000));
	let p3_int: Point = Point::Int(PointInt::random_ceil(1000));

	println!("p1: {}, p2: {}, p3: {}", p1, p2, p3);
	println!("Int p1: {}, p2: {}, p3: {}", p1_int, p2_int, p3_int);

	dbg!(Point::orient2d(p1, p2, p3));
	dbg!(Point::orient2d(p1_int, p2_int, p3_int));
	dbg!(Point::orient2d(p1, p2_int, p3_int));


	let s = SegmentFloat::new(PointFloat::from(p1), PointFloat::from(p2));
	println!("segment is {} with key {}", s, s.key());
	dbg!(s.key());

// 			let p0 = PointInt::new(2300, 1900);
// 		let p1 = PointInt::new(4200, 1900);
// 		let p2 = PointFloat::new(2387., 1350.);
// 		let p3 = PointFloat::new(2500., 2100.);
// 		let p4 = PointFloat::new(3200., 1900.);
// 		let p5 = PointFloat::new(2900., 2100.);
//
// 		// s0|s1 intersect
// 		// s0|s3 intersect
// 		// s0|s4 do not intersect
// 		let s0 = SegmentInt::new(p0, p1);
// 		let s0 = Segment::Int(s0);
//
// 		let s1 = SegmentFloat::new(p2, p3);
// 		let s1 = Segment::Float(s1);
//
// 		let s3 = SegmentFloat::new(p2, p4);
// 		let s3 = Segment::Float(s3);
//
// 		let s4 = SegmentFloat::new(p3, p5);
// 		let s4 = Segment::Float(s4);
//
// // 		let segments = vec![s0, s1, s4];
// // 		let res = vec![IxResult {
// // 				   	ix: PointFloat::new(2469.866666666667, 1900.),
// // 		            s1: &s0,
// // 		            s2: &s1,
// // 		            },
// // 		           IxResult {
// // 					ix: PointFloat::new(2500., 2100.),
// // 		            s1: &s1,
// // 		            s2: &s4,
// // 		           },
// // 		      ];
// // 		dbg!(res);
// //
// // 		let ixs = ix_brute_single(&segments);
// // 		dbg!(ixs);
}
