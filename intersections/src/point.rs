/*
Represent a 2-D point without using geo crate

*/

// #![feature(core_intrinsics)]
use std::fmt;
use std::ops::{Add, Sub};
use rand::Rng;
// use rand::distributions::Standard;
// use rand::distributions::Distribution;
use geo::algorithm::kernels::Orientation;
// use geo::{Coordinate};
// use num_traits::Zero;

use serde::{Serialize, Deserialize};

// TO-DO: Use key as id
// For segments, store i64 with the a, b keys?
// Or store m, y as key for segment?

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, PartialOrd)]
pub enum Point {
	Float(PointFloat),
	Int(PointInt),
}


#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, PartialOrd)]
pub struct PointFloat {
	pub x: f64,
	pub y: f64,
}

#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, PartialOrd)]
pub struct PointInt {
	pub x: i64,
	pub y: i64,
}

/*
In Javascript, can use different keys with or without BigInt.
1. Without
function dec2bin(dec) {
  return (dec >>> 0).toString(2);
}

x = 100
y = 666
key = (x << 16) ^ y // 6554266
dec2bin(x) //   '1100100'
dec2bin(y) //                '1010011010'
dec2bin(key) // '11001000000001010011010'

2. With BigInt
function dec2binBig(dec) {
  return (dec >> 0n).toString(2);
}
x = 100n
y = 666n
key32 = (x << 16n) ^ y // 6554266n
dec2binBig(x) //   '1100100'
dec2binBig(y) //                                '1010011010'
dec2binBig(key) // '110010000000000000000000000001010011010'

key64 = (x << 32n) ^ y // 429496730266n
dec2binBig(key64)//'110010000000000000000000000001010011010'


*/

impl PointFloat {
	pub fn new(x: f64, y: f64) -> Self { PointFloat { x, y }}

	pub fn x_y(&self) -> (f64, f64) { (self.x, self.y) }

	pub fn key(&self) -> i64 { ((self.x.round() as i64) << 32) ^ (self.y.round() as i64) }
}

impl PointInt {
	pub fn new(x: i64, y: i64) -> Self { PointInt { x, y }}

	pub fn x_y(&self) -> (i64, i64) { (self.x, self.y) }

	pub fn key(&self) -> i64 { (self.x << 32) ^ self.y }
}

impl From<PointInt> for PointFloat {
	fn from(item: PointInt) -> Self {
		Self { x: item.x as f64, y: item.y as f64 }
	}
}

impl From<PointFloat> for PointInt {
	fn from(item: PointFloat) -> Self {
		// round to nearest integer coordinates
		Self { x: item.x.round() as i64, y: item.y.round() as i64 }
	}
}

impl From<Point> for PointInt {
	fn from(item: Point) -> Self {
		match item {
			Point::Int(p) => p,
			Point::Float(p) => p.into(),
		}
	}
}

impl From<Point> for PointFloat {
	fn from(item: Point) -> Self {
		match item {
			Point::Int(p) => p.into(),
			Point::Float(p) => p,
		}
	}
}

impl fmt::Display for PointFloat {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		// Point x,y
        write!(f, "{:.5},{:.5}", self.x, self.y)
    }
}

impl fmt::Display for PointInt {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		// Point x,y
        write!(f, "{},{}", self.x, self.y)
    }
}

impl fmt::Display for Point {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		match self {
			Point::Int(p) => p.fmt(f),
			Point::Float(p) => p.fmt(f),
		}
    }
}

impl Add<PointFloat> for PointFloat {
	type Output = PointFloat;

	fn add(self, other: Self) -> Self {
		Self {
			x: self.x + other.x,
			y: self.y + other.y,
		}
	}
}

impl Add<PointInt> for PointInt {
	type Output = PointInt;

	fn add(self, other: Self) -> Self {
		Self {
			x: self.x + other.x,
			y: self.y + other.y,
		}
	}
}

impl Add<Point> for Point {
	type Output = Point;

	fn add(self, other: Self) -> Self {
		match (self, other) {
			(Point::Int(a), Point::Int(b)) => Point::Int(a + b),
			(Point::Float(a), Point::Float(b)) => Point::Float(a + b),
			(Point::Int(a), Point::Float(b)) => Point::Float(PointFloat::from(a) + b),
			(Point::Float(a), Point::Int(b)) => Point::Float(a + PointFloat::from(b)),
		}
	}
}

impl Sub<PointFloat> for PointFloat {
	type Output = PointFloat;

	fn sub(self, other: Self) -> Self {
		Self {
			x: self.x - other.x,
			y: self.y - other.y,
		}
	}
}

impl Sub<PointInt> for PointInt {
	type Output = PointInt;

	fn sub(self, other: Self) -> Self {
		Self {
			x: self.x - other.x,
			y: self.y - other.y,
		}
	}
}

impl Sub<Point> for Point {
	type Output = Point;

	fn sub(self, other: Self) -> Self {
		match (self, other) {
			(Point::Int(a), Point::Int(b)) => Point::Int(a - b),
			(Point::Float(a), Point::Float(b)) => Point::Float(a - b),
			(Point::Int(a), Point::Float(b)) => Point::Float(PointFloat::from(a) - b),
			(Point::Float(a), Point::Int(b)) => Point::Float(a - PointFloat::from(b)),
		}
	}
}

pub trait GenerateRandom {
	type MaxType;

	fn random() -> Self;

	fn random_ceil(max: Self::MaxType) -> Self;

	fn random_pos(max: Self::MaxType) -> Self;
}

impl GenerateRandom for PointFloat {
	type MaxType = f64;

	fn random() -> Self {
		let (base_x, base_y) = rand::random::<(f64, f64)>();
		Self::new(base_x, base_y)
	}

	fn random_ceil(max: Self::MaxType) -> Self {
		let mut rng = rand::thread_rng();
		let min = -max;
		Self::new(rng.gen_range(min..=max), rng.gen_range(min..=max))
	}

	fn random_pos(max: Self::MaxType) -> Self {
		let mut rng = rand::thread_rng();
		let min = num_traits::zero();
		Self::new(rng.gen_range(min..=max), rng.gen_range(min..=max))
	}
}

impl GenerateRandom for PointInt {
	type MaxType = i64;

	fn random() -> Self {
		let (x, y) = rand::random::<(i64, i64)>();
		Self::new(x, y)
	}

	fn random_ceil(max: Self::MaxType) -> Self {
		let mut rng = rand::thread_rng();
		let min = -max;
		Self::new(rng.gen_range(min..=max), rng.gen_range(min..=max))
	}

	fn random_pos(max: Self::MaxType) -> Self {
		let mut rng = rand::thread_rng();
		let min = num_traits::zero();
		Self::new(rng.gen_range(min..=max), rng.gen_range(min..=max))
	}
}


pub trait SimpleOrient<A = Self, B = Self, C = Self> {
	fn orient2d(a: A, b: B, c: C) -> Orientation;
}

impl SimpleOrient for Point {
	fn orient2d(a: Point, b: Point, c: Point) -> Orientation {
		// if any are floats, convert all to float
// 		match (a, b, c) {
// 			(Point::Int(p1), Point::Int(p2), Point::Int(p3)) => PointInt::orient2d(p1, p2, p3),
// 			(Point::Float(p1), Point::Int(p2), Point::Int(p3)) => PointFloat::orient2d(p1, p2.into(), p3.into()),
// 			(Point::Int(p1), Point::Float(p2), Point::Int(p3)) => PointFloat::orient2d(p1.into(), p2, p3.into()),
// 			(Point::Int(p1), Point::Int(p2), Point::Float(p3)) => PointFloat::orient2d(p1.into(), p2.into(), p3),
// 			(Point::Float(p1), Point::Float(p2), Point::Int(p3)) => PointFloat::orient2d(p1, p2, p3.into()),
// 			(Point::Float(p1), Point::Int(p2), Point::Float(p3)) => PointFloat::orient2d(p1, p2.into(), p3),
// 			(Point::Int(p1), Point::Float(p2), Point::Float(p3)) => PointFloat::orient2d(p1.into(), p2, p3),
// 			(Point::Float(p1), Point::Float(p2), Point::Float(p3)) => PointFloat::orient2d(p1, p2, p3),
// 		}
// 		if let (Point::Int(p1) = a & Point::Int(p2) = b & Point::Int(p3) = c) {
// 			PointInt::orient2d(p1, p2, p3)
// 		} else {
// 			PointFloat::orient2d(p1.into(), p2.into(), p3.into())
// 		}
// 		match (a, b, c) {
// 			(Point::Int(p1), Point::Int(p2), Point::Int(p3)) => PointInt::orient2d(p1, p2, p3),
// 			(_,_,_) => PointFloat::orient2d(PointFloat::from(a), PointFloat::from(b), PointFloat::from(c)),
// 		}
		match (a, b, c) {
			(Point::Int(p1), Point::Int(p2), Point::Int(p3)) => PointInt::orient2d(p1, p2, p3),
			(p1,p2,p3) => PointFloat::orient2d(PointFloat::from(p1), PointFloat::from(p2), PointFloat::from(p3)),
		}
	}
}

// see https://docs.rs/geo/0.19.0/src/geo/algorithm/kernels/robust.rs.html#12
impl SimpleOrient for PointFloat {
	fn orient2d(a: PointFloat, b: PointFloat, c: PointFloat) -> Orientation {
// 		use robust::{orient2d, Coord};
// 		let orientation = robust::orient2d(
// 			Coord {
// 				x: a.x,
// 				y: a.y,
// 			},
// 			Coord {
// 				x: b.x,
// 				y: b.y,
// 			},
// 			Coord {
// 				x: c.x,
// 				y: c.y,
// 			},
// 		);
//
// 		// robust orientation flipped b/c y-axis is flipped
//
// 		if orientation > 0. {
// 			Orientation::Clockwise
// 		} else if orientation < 0. {
// 			Orientation::CounterClockwise
// 		} else {
// 			Orientation::Collinear
// 		}

	// non-robust version

		let dac = a - c;
		let dbc = b - c;
		let res = dac.y * dbc.x - dac.x * dbc.y;

		if res > 0. {
			Orientation::CounterClockwise
		} else if res < 0. {
			Orientation::Clockwise
		} else {
			Orientation::Collinear
		}

	}
}

impl SimpleOrient for PointInt {
	fn orient2d(a: PointInt, b: PointInt, c: PointInt) -> Orientation {
// 		let (ax, ay) = a.x_y();
// 		let (bx, by) = b.x_y();
// 		let (cx, cy) = c.x_y();
// 		let res = (ay - cy) * (bx - cx) - (ax - cx) * (by - cy);

		let dac = a - c;
		let dbc = b - c;
		let res = dac.y * dbc.x - dac.x * dbc.y;

		if res > 0 {
			Orientation::CounterClockwise
		} else if res < 0 {
			Orientation::Clockwise
		} else {
			Orientation::Collinear
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use geo::algorithm::kernels::Orientation;

// ---------------- POINT CREATION
 	#[test]
	fn create_float_works() {
		let p = PointFloat::random();

		assert!(p.x <= 1.);
		assert!(p.y <= 1.);
		assert!(p.x >= 0.);
		assert!(p.y >= 0.);

		let (x, y) = p.x_y();
		let p_dupe = PointFloat { x, y };
		assert_eq!(p, p_dupe);
	}

 	#[test]
	fn create_int_works() {
		let p = PointInt::random();
		let (x, y) = p.x_y();
		let p_dupe = PointInt { x, y };
		assert_eq!(p, p_dupe);
	}

// ---------------- POINT COERCION
	#[test]
	fn coerce_works() {
		let p_float = PointFloat::random_ceil(100.);

		assert!(p_float.x <= 100.);
		assert!(p_float.y <= 100.);
		assert!(p_float.x >= -100.);
		assert!(p_float.y >= -100.);

		let p_int: PointInt = p_float.into();
		assert_eq!(p_float.x.round() as i64, p_int.x);
		assert_eq!(p_float.y.round() as i64, p_int.y);

		let p_float: PointFloat = p_int.into();
		assert_eq!(p_int.x as f64, p_float.x);
		assert_eq!(p_int.y as f64, p_float.y);
	}


// ---------------- ORIENTATION
	#[test]
	fn orient_int_works() {
		let p1 = PointInt::new(0, 0);
		let p2 = PointInt::new(1, 1);
		let p3 = PointInt::new(0, 1); // cw
		let p4 = PointInt::new(1, 0); // ccw
		let p5 = PointInt::new(2, 2); // collinear

		assert_eq!(PointInt::orient2d(p1, p2, p3), Orientation::Clockwise);
		assert_eq!(PointInt::orient2d(p1, p2, p4), Orientation::CounterClockwise);
		assert_eq!(PointInt::orient2d(p1, p2, p5), Orientation::Collinear);
	}

	#[test]
	fn orient_float_works() {
		let p1 = PointFloat::new(0., 0.);
		let p2 = PointFloat::new(1., 1.);
		let p3 = PointFloat::new(0., 1.); // cw
		let p4 = PointFloat::new(1., 0.); // ccw
		let p5 = PointFloat::new(2., 2.); // collinear

		assert_eq!(PointFloat::orient2d(p1, p2, p3), Orientation::Clockwise);
		assert_eq!(PointFloat::orient2d(p1, p2, p4), Orientation::CounterClockwise);
		assert_eq!(PointFloat::orient2d(p1, p2, p5), Orientation::Collinear);
	}

// ---------------- USING POINT ENUM
	#[test]
	fn orient_point_int_works() {
		let p1 = PointInt::new(0, 0);
		let p2 = PointInt::new(1, 1);
		let p3 = PointInt::new(0, 1); // cw
		let p4 = PointInt::new(1, 0); // ccw
		let p5 = PointInt::new(2, 2); // collinear

		let p1 = Point::Int(p1);
		let p2 = Point::Int(p2);
		let p3 = Point::Int(p3);
		let p4 = Point::Int(p4);
		let p5 = Point::Int(p5);

		assert_eq!(Point::orient2d(p1, p2, p3), Orientation::Clockwise);
		assert_eq!(Point::orient2d(p1, p2, p4), Orientation::CounterClockwise);
		assert_eq!(Point::orient2d(p1, p2, p5), Orientation::Collinear);
	}

	#[test]
	fn orient_point_float_works() {
		let p1 = PointFloat::new(0., 0.);
		let p2 = PointFloat::new(1., 1.);
		let p3 = PointFloat::new(0., 1.); // cw
		let p4 = PointFloat::new(1., 0.); // ccw
		let p5 = PointFloat::new(2., 2.); // collinear

		let p1 = Point::Float(p1);
		let p2 = Point::Float(p2);
		let p3 = Point::Float(p3);
		let p4 = Point::Float(p4);
		let p5 = Point::Float(p5);

		assert_eq!(Point::orient2d(p1, p2, p3), Orientation::Clockwise);
		assert_eq!(Point::orient2d(p1, p2, p4), Orientation::CounterClockwise);
		assert_eq!(Point::orient2d(p1, p2, p5), Orientation::Collinear);
	}

	#[test]
	fn orient_point_mixed_works() {
		let p1 = PointFloat::new(0., 0.);
		let p2 = PointInt::new(1, 1);
		let p3 = PointInt::new(0, 1); // cw
		let p4 = PointInt::new(1, 0); // ccw
		let p5 = PointFloat::new(2., 2.); // collinear

		let p1 = Point::Float(p1);
		let p2 = Point::Int(p2);
		let p3 = Point::Int(p3);
		let p4 = Point::Int(p4);
		let p5 = Point::Float(p5);

		assert_eq!(Point::orient2d(p1, p2, p3), Orientation::Clockwise);
		assert_eq!(Point::orient2d(p1, p2, p4), Orientation::CounterClockwise);
		assert_eq!(Point::orient2d(p1, p2, p5), Orientation::Collinear);
	}

// ---------------- ADDITION
	#[test]
	fn add_int_works() {
		let p1 = PointInt::new(1, 2);
		let p2 = PointInt::new(3, 4);
		assert_eq!(p1 + p2, PointInt::new(1 + 3, 2 + 4));
	}

	#[test]
	fn add_float_works() {
		let p1 = PointFloat::new(1., 2.);
		let p2 = PointFloat::new(3., 4.);
		assert_eq!(p1 + p2, PointFloat::new(1. + 3., 2. + 4.));
	}

	#[test]
	fn add_point_works() {
		let p1 = PointInt::new(1, 2);
		let p1 = Point::Int(p1);

		let p2 = PointInt::new(3, 4);
		let p2 = Point::Int(p2);

		let p3 = PointFloat::new(1., 2.);
		let p3 = Point::Float(p3);

		let p4 = PointFloat::new(3., 4.);
		let p4 = Point::Float(p4);

		assert_eq!(p1 + p2, Point::Int(PointInt::new(1 + 3, 2 + 4)));
		assert_eq!(p3 + p4, Point::Float(PointFloat::new(1. + 3., 2. + 4.)));
		assert_eq!(p1 + p4, Point::Float(PointFloat::new(1. + 3., 2. + 4.)));
		assert_eq!(p3 + p2, Point::Float(PointFloat::new(1. + 3., 2. + 4.)));
	}

// ---------------- SUBTRACTION
	#[test]
	fn sub_int_works() {
		let p1 = PointInt::new(1, 2);
		let p2 = PointInt::new(3, 4);
		assert_eq!(p1 - p2, PointInt::new(1 - 3, 2 - 4));
	}

	#[test]
	fn sub_float_works() {
		let p1 = PointFloat::new(1., 2.);
		let p2 = PointFloat::new(3., 4.);
		assert_eq!(p1 - p2, PointFloat::new(1. - 3., 2. - 4.));
	}

	#[test]
	fn sub_point_works() {
		let p1 = PointInt::new(1, 2);
		let p1 = Point::Int(p1);

		let p2 = PointInt::new(3, 4);
		let p2 = Point::Int(p2);

		let p3 = PointFloat::new(1., 2.);
		let p3 = Point::Float(p3);

		let p4 = PointFloat::new(3., 4.);
		let p4 = Point::Float(p4);

		assert_eq!(p1 - p2, Point::Int(PointInt::new(1 - 3, 2 - 4)));
		assert_eq!(p3 - p4, Point::Float(PointFloat::new(1. - 3., 2. - 4.)));
		assert_eq!(p1 - p4, Point::Float(PointFloat::new(1. - 3., 2. - 4.)));
		assert_eq!(p3 - p2, Point::Float(PointFloat::new(1. - 3., 2. - 4.)));
	}

}


// trait Orientable<B=Self, C=Self> {
// 	fn orient2d(a: Self, b: B, c: C) -> Orientation {
// 		(a.y - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y)
// 	}
// }







// use serde::{Serialize, Deserialize};
// use serde::de::{self, Deserializer, Visitor, SeqAccess, MapAccess};
//
// //use serde_json;
// // use std::fs;
// use rand::Rng;
// use rand::distributions::uniform::SampleUniform;
//
// //use std::cmp::Ordering;
// use std::fmt;
// use std::ops::{Add, Sub};
//
// // use num_traits::{Float, PrimInt, Num};
// // use num::Num; // https://stackoverflow.com/questions/37296351/is-there-any-trait-that-specifies-numeric-functionality
//
// // use wasm_bindgen::prelude::*;
// //
// // #[wasm_bindgen]
// // extern "C" {
// // 	pub type JsPoint;
// //
// // 	#[wasm_bindgen(method, getter)]
// // 	fn x(this: &JsPoint) -> f64;
// //
// // 	#[wasm_bindgen(method, getter)]
// // 	fn y(this: &JsPoint) -> f64;
// // }
//
// // #[wasm_bindgen]
// // extern "C" {
// // 	pub type JsPoint;
// //
// // 	#[wasm_bindgen(method, getter)]
// // 	fn x(this: &JsPoint) -> f64;
// //
// // 	#[wasm_bindgen(method, getter)]
// // 	fn y(this: &JsPoint) -> f64;
// // }
//
//
// /// Represent a point on a 2-D plane with x,y coordinates.
// /// Accepts any numeric value for x, y point, but requires they be the same type
// /// for simplicity. (So either two floats, or two integers.)
// // Cannot use Point<T> with wasm_bindgen: structs with #[wasm_bindgen] cannot have lifetime or type parameters currently
// #[derive(Debug)]
// pub enum Point {
// 	Float(PointFloat),
// 	Int(PointInt),
// 	Uint(PointUint),
// }
//
// impl fmt::Display for Point {
// 	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
// 		match self {
// 			Point::Float(pt) => pt.fmt(f),
// 			Point::Int(pt) => pt.fmt(f),
// 			Point::Uint(pt) => pt.fmt(f),
// 		}
// 	}
// }
//
// trait RandomPoint:  {
// 	type CoordType;
// 	fn random() -> Self::CoordType
// 	{
// 		let mut rng = rand::thread_rng();
// 	  	Self: Point {
// 	    	x: rng.gen(),
// 			y: rng.gen(),
// 	  	}
// 	}
//
// 	fn random_ceil(max: Self::CoordType) -> Self::CoordType
// 		where <Self as RandomPoint>::CoordType: SampleUniform
// 	{
// 		let mut rng = rand::thread_rng();
// 		Self {
// 		 		x: rng.gen_range(-max..=max),
// 		 		y: rng.gen_range(-max..=max),
// 		 	}
// 	}
// }
//
// // #[wasm_bindgen]
// #[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, PartialOrd)]
// pub struct PointFloat {
// 	pub x: f64,
//   	pub y: f64,
// }
//
// // #[wasm_bindgen]
// #[derive(Serialize, Debug, Default, Copy, Clone, PartialEq, PartialOrd)]
// pub struct PointInt {
// 	pub x: i64, // avoid i64 to avoid dealing with JS BigInt() problems/ max coord 2,147,483,647.
//   	pub y: i64,
// }
//
// // #[wasm_bindgen]
// #[derive(Serialize, Debug, Default, Copy, Clone, PartialEq, PartialOrd)]
// pub struct PointUint {
// 	pub x: u64, // avoid i64 to avoid dealing with JS BigInt() problems/ max coord 2,147,483,647.
//   	pub y: u64,
// }
//
// impl RandomPoint for PointFloat {
// 	type CoordType = f64;
// }
//
// impl RandomPoint for PointInt {
// 	type CoordType = i64;
// }
//
// impl RandomPoint for PointUint {
// 	type CoordType = u64;
// }
//
//
// // Don't use trait bound in struct definition above.
// // See https://stackoverflow.com/questions/49229332/should-trait-bounds-be-duplicated-in-struct-and-impl
// // #[wasm_bindgen]
// impl PointFloat {
// // 	#[wasm_bindgen(constructor)]
// 	pub fn new(x: f64, y: f64) -> Self { Self { x, y } }
//
// // 	/ Construct a random point with an optional maximum amount.
// // 	/ If negative is true, the max will also serve as the floor.
// // 	/ Otherwise, floor is 0.
// // 	/ Useful for testing intersections where you need segments that could possibly
// // 	/ overlap with greater frequency than using random alone.
// // 	pub fn random_ceil(max: f64, negative: bool) -> Self {
// // 		let mut rng = rand::thread_rng();
// //
// // 		if negative {
// // 		  	Self {
// // 		 		x: rng.gen_range(-max..max),
// // 		 		y: rng.gen_range(-max..max),
// // 		 	}
// // 		} else {
// // 			Self {
// // 		 		x: rng.gen_range(0.0..max),
// // 		 		y: rng.gen_range(0.0..max),
// // 		 	}
// // 		}
// // 	}
// //
// // 	/// Construct a random point
// // 	pub fn random() -> Self {
// // 	  	let mut rng = rand::thread_rng();
// // 	  	Self {
// // 	    	x: rng.gen(),
// // 			y: rng.gen(),
// // 	  	}
// // 	}
// //
// // 	// so this can be done from JS
// // 	pub fn into_point_int(&self) -> PointInt {
// // 		let s = self.clone();
// // 		s.into()
// // 	}
//
// }
//
//
//
//
//
// // #[wasm_bindgen]
// impl PointInt {
// // 	#[wasm_bindgen(constructor)]
// 	pub fn new(x: i64, y: i64) -> Self {
// 		Self { x, y }
// 	}
//
// 	/// Construct a random point with an optional maximum amount.
// 	/// If negative is true, the max will also serve as the floor.
// 	/// Otherwise, floor is 0.
// 	/// Useful for testing intersections where you need segments that could possibly
// 	/// overlap with greater frequency than using random alone.
// 	pub fn random_ceil(max: i32, negative: bool) -> Self {
// 		let mut rng = rand::thread_rng();
//
// 		if negative {
// 		  	Self {
// 		 		x: rng.gen_range(-max..max),
// 		 		y: rng.gen_range(-max..max),
// 		 	}
// 		} else {
// 			Self {
// 		 		x: rng.gen_range(0..max),
// 		 		y: rng.gen_range(0..max),
// 		 	}
// 		}
// 	}
//
// 	/// Construct a random point
// 	pub fn random() -> Self {
// 	  	let mut rng = rand::thread_rng();
// 	  	Self {
// 	    	x: rng.gen(),
// 			y: rng.gen(),
// 	  	}
// 	}
//
// 	// so this can be done from JS
// 	pub fn into_point_float(&self) -> PointFloat {
// 		let s = self.clone();
// 		s.into()
// 	}
//
// }
//
// // See https://serde.rs/deserialize-struct.html
// // Need to specially handle converting number strings to int
// impl<'de> Deserialize<'de> for PointInt {
//     fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
//     where
//         D: Deserializer<'de>,
//     {
// 		#[derive(Deserialize)]
// 		#[serde(field_identifier, rename_all = "lowercase")]
//         enum Field { X, Y }
//
//         struct PointIntVisitor;
//
//         impl<'de> Visitor<'de> for PointIntVisitor {
//             type Value = PointInt;
//
//             fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
//                 formatter.write_str("struct PointInt")
//             }
//
//             fn visit_seq<V>(self, mut seq: V) -> Result<PointInt, V::Error>
//             where
//                 V: SeqAccess<'de>,
//             {
//                 let x = seq.next_element()?
//                     .ok_or_else(|| de::Error::invalid_length(0, &self))?;
//                 let y = seq.next_element()?
//                     .ok_or_else(|| de::Error::invalid_length(1, &self))?;
//                 Ok(PointInt::from(PointFloat::new(x, y)))
//             }
//
//             fn visit_map<V>(self, mut map: V) -> Result<PointInt, V::Error>
//             where
//                 V: MapAccess<'de>,
//             {
//                 let mut x = None;
//                 let mut y = None;
//                 while let Some(key) = map.next_key()? {
//                     match key {
//                         Field::X => {
//                             if x.is_some() {
//                                 return Err(de::Error::duplicate_field("x"));
//                             }
//                             x = Some(map.next_value()?);
//                         }
//                         Field::Y => {
//                             if y.is_some() {
//                                 return Err(de::Error::duplicate_field("y"));
//                             }
//                             y = Some(map.next_value()?);
//                         }
//                     }
//                 }
//                 let x = x.ok_or_else(|| de::Error::missing_field("x"))?;
//                 let y = y.ok_or_else(|| de::Error::missing_field("y"))?;
//                 Ok(PointInt::from(PointFloat::new(x, y )))
//             }
//         }
//
//         const FIELDS: &'static [&'static str] = &["secs", "nanos"];
//         deserializer.deserialize_struct("PointInt", FIELDS, PointIntVisitor)
//     }
// }
//
// impl<'de> Deserialize<'de> for PointUint {
//     fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
//     where
//         D: Deserializer<'de>,
//     {
// 		#[derive(Deserialize)]
// 		#[serde(field_identifier, rename_all = "lowercase")]
//         enum Field { X, Y }
//
//         struct PointIntVisitor;
//
//         impl<'de> Visitor<'de> for PointIntVisitor {
//             type Value = PointInt;
//
//             fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
//                 formatter.write_str("struct PointInt")
//             }
//
//             fn visit_seq<V>(self, mut seq: V) -> Result<PointInt, V::Error>
//             where
//                 V: SeqAccess<'de>,
//             {
//                 let x = seq.next_element()?
//                     .ok_or_else(|| de::Error::invalid_length(0, &self))?;
//                 let y = seq.next_element()?
//                     .ok_or_else(|| de::Error::invalid_length(1, &self))?;
//                 Ok(PointUint::from(PointFloat::new(x, y)))
//             }
//
//             fn visit_map<V>(self, mut map: V) -> Result<PointInt, V::Error>
//             where
//                 V: MapAccess<'de>,
//             {
//                 let mut x = None;
//                 let mut y = None;
//                 while let Some(key) = map.next_key()? {
//                     match key {
//                         Field::X => {
//                             if x.is_some() {
//                                 return Err(de::Error::duplicate_field("x"));
//                             }
//                             x = Some(map.next_value()?);
//                         }
//                         Field::Y => {
//                             if y.is_some() {
//                                 return Err(de::Error::duplicate_field("y"));
//                             }
//                             y = Some(map.next_value()?);
//                         }
//                     }
//                 }
//                 let x = x.ok_or_else(|| de::Error::missing_field("x"))?;
//                 let y = y.ok_or_else(|| de::Error::missing_field("y"))?;
//                 Ok(PointUint::from(PointFloat::new(x, y )))
//             }
//         }
//
//         const FIELDS: &'static [&'static str] = &["secs", "nanos"];
//         deserializer.deserialize_struct("PointInt", FIELDS, PointIntVisitor)
//     }
// }
//
// impl From<PointInt> for PointFloat {
// 	fn from(item: PointInt) -> Self {
// 		Self { x: item.x as f64, y: item.y as f64 }
// 	}
// }
//
// impl From<PointUint> for PointFloat {
// 	fn from(item: PointUint) -> Self {
// 		Self { x: item.x as f64, y: item.y as f64 }
// 	}
// }
//
// impl From<PointFloat> for PointInt {
// 	fn from(item: PointFloat) -> Self {
// 		// round to nearest integer coordinates
// 		Self { x: item.x.round() as i64, y: item.y.round() as i64 }
// 	}
// }
//
// impl From<PointUint> for PointInt {
// 	fn from(item: PointUint) -> Self {
// 		Self { x: item.x as i64, y: item.y as i64 }
// 	}
// }
//
// impl From<PointFloat> for PointUint {
// 	fn from(item: PointFloat) -> Self {
// 		Self { x: item.x.round() as u64, y: item.y.round() as u64 }
// 	}
// }
//
// impl From<PointInt> for PointUint {
// 	fn from(item: PointInt) -> Self {
// 		Self  { x: item.x as u64, y: item.y as u64 }
// 	}
// }
//
//
//
// // impl From<&JsPoint> for PointFloat {
// // 	fn from(point: &JsPoint) -> Self {
// // 		Self::new(point.x(), point.y())
// // 	}
// // }
// //
// // impl From<JsPoint> for PointFloat {
// // 	fn from(point: JsPoint) -> Self {
// // 		Self::new(point.x(), point.y())
// // 	}
// // }
// //
// // impl From<&JsPoint> for PointInt {
// // 	fn from(point: &JsPoint) -> Self {
// // 		Self::from(PointFloat::new(point.x(), point.y()))
// // 	}
// // }
// //
// // impl From<JsPoint> for PointInt {
// // 	fn from(point: JsPoint) -> Self {
// // 		Self::from(PointFloat::new(point.x(), point.y()))
// // 	}
// // }
// //
// // impl From<&JsPoint> for PointUint {
// // 	fn from(point: &JsPoint) -> Self {
// // 		Self::from(PointFloat::new(point.x(), point.y()))
// // 	}
// // }
// //
// // impl From<JsPoint> for PointUint {
// // 	fn from(point: JsPoint) -> Self {
// // 		Self::from(PointFloat::new(point.x(), point.y()))
// // 	}
// // }
//
//
//
// impl fmt::Display for PointFloat {
// 	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
// 		// Point x,y
//         write!(f, "{},{}", self.x, self.y)
//     }
// }
//
// impl fmt::Display for PointInt {
// 	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
// 		// Point x,y
//         write!(f, "{},{}", self.x, self.y)
//     }
// }
//
// impl fmt::Display for PointUint {
// 	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
// 		// Point x,y
//         write!(f, "{},{}", self.x, self.y)
//     }
// }
//
// impl Add<PointFloat> for PointFloat {
// 	type Output = PointFloat;
//
// 	fn add(self, other: Self) -> Self {
// 		Self {
// 			x: self.x + other.x,
// 			y: self.y + other.y,
// 		}
// 	}
// }
//
// impl Add<PointInt> for PointFloat {
// 	type Output = PointFloat;
//
// 	fn add(self, other: PointInt) -> Self {
// 		let other: PointFloat = other.into();
// 		self + other
// 	}
// }
//
// impl Add<PointInt> for PointInt {
// 	type Output = PointInt;
//
// 	fn add(self, other: Self) -> Self {
// 		Self {
// 			x: self.x + other.x,
// 			y: self.y + other.y,
// 		}
// 	}
// }
//
// impl Add<PointUint> for PointUint {
// 	type Output = PointUint;
//
// 	fn add(self, other: Self) -> Self {
// 		Self {
// 			x: self.x + other.x,
// 			y: self.y + other.y,
// 		}
// 	}
// }
//
// impl Sub<PointFloat> for PointFloat {
// 	type Output = PointFloat;
//
// 	fn sub(self, other: Self) -> Self {
// 		Self {
// 			x: self.x - other.x,
// 			y: self.y - other.y,
// 		}
// 	}
// }

// pub enum Orientation {
// 	Counterclockwise,
// 	Clockwise,
// 	Collinear,
// }
//
// trait Orientable<B=Self, C=Self> {
// 	fn orient2d(a: Self, b: B, c: C) -> Orientation {
// 		(a.y - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y)
// 	}
// }
//
//
// /// Determine the relative orientation of three points in two-dimensional space.
// /// The result is also an approximation of twice the signed area of the triangle
// /// defined by the three points. This method is fast but not robust against issues
// /// of floating point precision. Best used with integer coordinates.
// /// Adapted from https://github.com/mourner/robust-predicates
// ///
// /// ## Arguments
// /// *a* An endpoint of segment AB, relative to which point C is tested.
// /// *b* An endpoint of segment AB, relative to which point C is tested.
// /// *c* A point is tested compared to A --> B --> C.
// ///
// /// ## Returns
// /// Positive value if the points are in counter-clockwise order.
// /// Negative value if the points are in clockwise order.
// /// Zero if the points are collinear.
// #[wasm_bindgen]
// pub fn orient2d(a: &PointFloat, b: &PointFloat, c: &PointFloat) -> Orientation {
//   (a.y - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y)
// }
//
// // Cannot return i128
// // https://github.com/rustwasm/wasm-bindgen/issues/2822
//
// #[wasm_bindgen]
// pub fn orient2d_int(a: &PointInt, b: &PointInt, c: &PointInt) -> i64 {
// 	// i32 is insufficient here
// 	let mult1: i64 = ((a.y - c.y) * (b.x - c.x)).into();
// 	let mult2: i64 = ((a.x - c.x) * (b.y - c.y)).into();
// 	mult1 - mult2
//
//   // (a.y - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y)
// }
//
//
// /// Quickly test if two line segments, AB and CD, intersect.
// /// This method does not determine the point of intersection.
// ///
// /// ## Arguments
// /// *a* First endpoint of AB
// /// *b* Second endpoint of AB
// /// *c* First endpoint of CD
// /// *d* Second endpoint of CD
// ///
// /// ## Returns
// /// True if the lines segments intersect.
// #[wasm_bindgen]
// pub fn line_segment_intersects(a: &PointFloat, b: &PointFloat, c: &PointFloat, d: &PointFloat) -> bool {
// 	let xa = orient2d(a, b, c);
// 	let xb = orient2d(a, b, d);
//
// 	if xa == 0.0 && xb == 0.0 { return false; }
//
// 	let xab = (xa * xb) <= 0.0;
// 	let xcd = (orient2d(c, d, a) * orient2d(c, d, b)) <= 0.0;
// 	return xab && xcd
// }
//
// #[wasm_bindgen]
// pub fn line_segment_intersects_int(a: &PointInt, b: &PointInt, c: &PointInt, d: &PointInt) -> bool {
// 	let xa = orient2d_int(a, b, c);
// 	let xb = orient2d_int(a, b, d);
//
// 	if xa == 0 && xb == 0 { return false; }
//
// 	let xab = (xa * xb) <= 0;
// 	let xcd = (orient2d_int(c, d, a) * orient2d_int(c, d, b)) <= 0;
// 	return xab && xcd
// }
//
// /// Compute the intersection between two infinite lines.
// /// Does not check for parallel lines; will return Infinite, NaN coordinates in that case
// ///
// /// ## Arguments
// /// *a* First endpoint of AB
// /// *b* Second endpoint of AB
// /// *c* First endpoint of CD
// /// *d* Second endpoint of CD
// ///
// /// ## Returns
// /// Coordinates of the intersection.
// #[wasm_bindgen]
// pub fn line_line_intersection(a: &PointFloat, b: &PointFloat, c: &PointFloat, d: &PointFloat) -> PointFloat {
// 	let dx1 = b.x - a.x;
//   	let dx2 = d.x - c.x;
//   	let dy1 = b.y - a.y;
//   	let dy2 = d.y - c.y;
//
//   	let x_num = a.x * dy1 * dx2 - c.x * dy2 * dx1 + c.y * dx1 * dx2 - a.y * dx1 * dx2;
//   	let y_num = a.y * dx1 * dy2 - c.y * dx2 * dy1 + c.x * dy1 * dy2 - a.x * dy1 * dy2;
//
//   	let x_dnm = dy1 * dx2 - dy2 * dx1;
//   	let y_dnm = dx1 * dy2 - dx2 * dy1;
//
//   	PointFloat { x: x_num / x_dnm, y: y_num / y_dnm }
// }
//
// #[wasm_bindgen]
// pub fn line_line_intersection_int(a: &PointInt, b: &PointInt, c: &PointInt, d: &PointInt) -> PointFloat {
// 	let dx1:i64 = (b.x - a.x).into();
//   	let dx2:i64 = (d.x - c.x).into();
//   	let dy1:i64 = (b.y - a.y).into();
//   	let dy2:i64 = (d.y - c.y).into();
//
//   	let x_num = (a.x as i64) * dy1 * dx2 - (c.x as i64) * dy2 * dx1 + (c.y as i64) * dx1 * dx2 - (a.y as i64) * dx1 * dx2;
//   	let y_num = (a.y as i64) * dx1 * dy2 - (c.y as i64) * dx2 * dy1 + (c.x as i64)* dy1 * dy2 - (a.x as i64) * dy1 * dy2;
//
//   	let x_dnm = dy1 * dx2 - dy2 * dx1;
//   	let y_dnm = dx1 * dy2 - dx2 * dy1;
//
//   	PointFloat { x: x_num as f64 / x_dnm as f64, y: y_num as f64 / y_dnm as f64 }
// }
//
// struct TestSetup {
// 	points_float: Vec<PointFloat>,
// 	points_int: Vec<PointInt>,
// }
//
// impl TestSetup {
// 	fn new() -> Self {
// 	   	let str1 = fs::read_to_string("points_test.json").unwrap();
//
// 		Self {
// 			points_float: serde_json::from_str(&str1).unwrap(),
// 			points_int: serde_json::from_str(&str1).unwrap(),
// 		}
// 	}
// }
//
//
// #[cfg(test)]
// mod tests {
// 		use super::*;
//
// 		// a|b is horizontal
// 		// c is to left of a|b
// 		// d is to right of a|b
// 		// e is collinear with a|b
// 		// c|d intersects a|b
// 		// d|f parallel to a|b, c|d does not intersect as a segment but does as infinite line
//
// 		#[test]
// 		fn ccw_orientation_works() {
// 			let setup = TestSetup::new();
// 			let a = &setup.points_float[0];
// 			let b = &setup.points_float[1];
// 			let c = &setup.points_float[2];
//
// 			let o = orient2d(a, b, c);
// 			assert_eq!(o, 1045000.0);
//
// 			let a = &setup.points_int[0];
// 			let b = &setup.points_int[1];
// 			let c = &setup.points_int[2];
//
// 			let o = orient2d_int(a, b, c);
// 			assert_eq!(o, 1045000);
// 		}
//
// 		#[test]
// 		fn cw_orientation_works() {
// 			let setup = TestSetup::new();
// 			let a = &setup.points_float[0];
// 			let b = &setup.points_float[1];
// 			let d = &setup.points_float[3];
//
// 			let o = orient2d(a, b, d);
// 			assert_eq!(o, -380000.0);
//
// 			let a = &setup.points_int[0];
// 			let b = &setup.points_int[1];
// 			let d = &setup.points_int[3];
//
// 			let o = orient2d_int(a, b, d);
// 			assert_eq!(o, -380000);
// 		}
//
// 		#[test]
// 		fn collinear_orientation_works() {
// 			let setup = TestSetup::new();
// 			let a = &setup.points_float[0];
// 			let b = &setup.points_float[1];
// 			let e = &setup.points_float[4];
//
// 			let o = orient2d(a, b, e);
// 			assert_eq!(o, 0.0);
//
// 			let a = &setup.points_int[0];
// 			let b = &setup.points_int[1];
// 			let e = &setup.points_int[4];
//
// 			let o = orient2d_int(a, b, e);
// 			assert_eq!(o, 0);
// 		}
//
// 		#[test]
// 		fn intersection_found() {
// 			let setup = TestSetup::new();
// 			let a = &setup.points_float[0];
// 			let b = &setup.points_float[1];
// 			let c = &setup.points_float[2];
// 			let d = &setup.points_float[3];
//
// 			let is_ix = line_segment_intersects(a, b, c, d);
// 			assert!(is_ix);
//
// 			let a = &setup.points_int[0];
// 			let b = &setup.points_int[1];
// 			let c = &setup.points_int[2];
// 			let d = &setup.points_int[3];
//
// 			let is_ix = line_segment_intersects_int(a, b, c, d);
// 			assert!(is_ix);
// 		}
//
// 		#[test]
// 		fn intersection_not_found() {
// 			let setup = TestSetup::new();
// 			let a = &setup.points_float[0];
// 			let b = &setup.points_float[1];
// 			let d = &setup.points_float[3];
// 			let f = &setup.points_float[5];
//
// 			let is_ix = line_segment_intersects(a, b, d, f);
// 			assert!(!is_ix);
//
// 			let a = &setup.points_int[0];
// 			let b = &setup.points_int[1];
// 			let d = &setup.points_int[3];
// 			let f = &setup.points_int[5];
//
// 			let is_ix = line_segment_intersects_int(a, b, d, f);
// 			assert!(!is_ix);
// 		}
//
// 		#[test]
// 		fn intersection() {
// 			let setup = TestSetup::new();
// 			let a = &setup.points_float[0];
// 			let b = &setup.points_float[1];
// 			let c = &setup.points_float[2];
// 			let e = &setup.points_float[4];
//
// 			let ix = line_line_intersection(a, b, c, e);
// 			assert_eq!(ix.x, 3200.0);
// 			assert_eq!(ix.y, 1900.0);
//
// 			let a = &setup.points_int[0];
// 			let b = &setup.points_int[1];
// 			let c = &setup.points_int[2];
// 			let e = &setup.points_int[4];
//
// 			let ix = line_line_intersection_int(a, b, c, e);
// 			assert_eq!(ix.x, 3200.0); // line_line returns float
// 			assert_eq!(ix.y, 1900.0);
// 		}
// }