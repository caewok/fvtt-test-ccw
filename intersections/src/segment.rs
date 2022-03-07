use crate::point::*;
use std::fmt;
use geo::algorithm::kernels::Orientation;

pub enum Segment {
	Float(SegmentFloat),
	Int(SegmentInt),
}

#[derive(Debug, Default, Copy, Clone, PartialEq, PartialOrd)]
pub struct SegmentFloat {
	pub a: PointFloat,
	pub b: PointFloat,
}

#[derive(Debug, Default, Copy, Clone, PartialEq, PartialOrd)]
pub struct SegmentInt {
	pub a: PointInt,
	pub b: PointInt,
}

impl SegmentFloat {
	pub fn new(a: PointFloat, b: PointFloat) -> Self { SegmentFloat { a, b }}

	pub fn a_b(&self) -> (PointFloat, PointFloat) { (self.a, self.b) }

	pub fn orient2d(&self, c: PointFloat) -> Orientation {
		let (a, b) = self.a_b();
		PointFloat::orient2d(a, b, c)
	}

	pub fn delta(&self) -> PointFloat { self.b - self.a }
	pub fn dx(&self) -> f64 { self.b.x - self.a.x }
	pub fn dy(&self) -> f64 { self.b.y - self.a.y }
	pub fn slope(&self) -> f64 { self.dy() / self.dx() }
}

impl SegmentInt {
	pub fn new(a: PointInt, b: PointInt) -> Self { SegmentInt { a, b }}

	pub fn a_b(&self) -> (PointInt, PointInt) { (self.a, self.b) }

	pub fn orient2d(&self, c: PointInt) -> Orientation {
		let (a, b) = self.a_b();
		PointInt::orient2d(a, b, c)
	}

	pub fn delta(&self) -> PointInt { self.b - self.a }
	pub fn dx(&self) -> i64 { self.b.x - self.a.x }
	pub fn dy(&self) -> i64 { self.b.y - self.a.y }
	pub fn slope(&self) -> f64 { self.dy() as f64 / self.dx() as f64 }
}


impl From<SegmentInt> for SegmentFloat {
	fn from(item: SegmentInt) -> Self {
		Self { a: PointFloat::from(item.a), b: PointFloat::from(item.b) }
	}
}

impl From<SegmentFloat> for SegmentInt {
	fn from(item: SegmentFloat) -> Self {
		// round to nearest integer coordinates
		Self { a: PointInt::from(item.a), b: PointInt::from(item.b) }
	}
}

impl From<Segment> for SegmentFloat {
	fn from(item: Segment) -> Self {
		match item {
			Segment::Int(s) => s.into(),
			Segment::Float(s) => s,
		}
	}
}

impl From<Segment> for SegmentInt {
	fn from(item: Segment) -> Self {
		match item {
			Segment::Int(s) => s,
			Segment::Float(s) => s.into(),
		}
	}
}

impl fmt::Display for SegmentFloat {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		// Segment ax,ay|bx,by
        write!(f, "{}|{}", self.a, self.b)
    }
}

impl fmt::Display for SegmentInt {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		// Segment ax,ay|bx,by
        write!(f, "{}|{}", self.a, self.b)
    }
}

impl fmt::Display for Segment {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		match self {
			Segment::Int(s) => s.fmt(f),
			Segment::Float(s) => s.fmt(f),
		}
    }
}

impl GenerateRandom for SegmentFloat {
	type MaxType = f64;

	fn random() -> Self {
		let a = PointFloat::random();
		let b = PointFloat::random();
		Self::new(a, b)
	}

	fn random_ceil(max: Self::MaxType) -> Self {
		let a = PointFloat::random_ceil(max);
		let b = PointFloat::random_ceil(max);
		Self::new(a, b)
	}

	fn random_pos(max: Self::MaxType) -> Self {
		let a = PointFloat::random_pos(max);
		let b = PointFloat::random_pos(max);
		Self::new(a, b)
	}
}

impl GenerateRandom for SegmentInt {
	type MaxType = i64;

	fn random() -> Self {
		let a = PointInt::random();
		let b = PointInt::random();
		Self::new(a, b)
	}

	fn random_ceil(max: Self::MaxType) -> Self {
		let a = PointInt::random_ceil(max);
		let b = PointInt::random_ceil(max);
		Self::new(a, b)
	}

	fn random_pos(max: Self::MaxType) -> Self {
		let a = PointInt::random_pos(max);
		let b = PointInt::random_pos(max);
		Self::new(a, b)
	}
}

pub trait SimpleIntersect<B = Self> {
	fn intersects(&self, other: B) -> bool;
	fn line_intersection(&self, other: B) -> PointFloat;
}

impl SimpleIntersect for SegmentFloat {
	fn intersects(&self, other: SegmentFloat) -> bool {
		let (a, b) = self.a_b();
		let (c, d) = other.a_b();

		let xa = PointFloat::orient2d(a, b, c);
		let xb = PointFloat::orient2d(a, b, d);

		// may intersect in an overlapping line or not intersect at all
		if xa == Orientation::Collinear && xb == Orientation::Collinear { return false; }

		let xc = PointFloat::orient2d(c, d, a);
		let xd = PointFloat::orient2d(c, d, b);

		if xa != xb && xc != xd { return true; }

		return false;
	}

	fn line_intersection(&self, other: SegmentFloat) -> PointFloat {
		let (a, b) = self.a_b();
		let (c, d) = other.a_b();

		let (ax, ay) = a.x_y();
// 		let (bx, by) = b.x_y();
		let (cx, cy) = c.x_y();
// 		let (dx, dy) = d.x_y();

		let d1 = self.delta();
		let d2 = other.delta();

// 		let dx1 = bx - ax;
// 		let dx2 = dx - cx;
// 		let dy1 = by - ay;
// 		let dy2 = dy - cy;

// 		let x_num = ax * dy1 * dx2 - cx * dy2 * dx1 + cy * dx1 * dx2 - ay * dx1 * dx2;
// 		let y_num = ay * dx1 * dy2 - cy * dx2 * dy1 + cx * dy1 * dy2 - ax * dy1 * dy2;

// 		let x_dnm = dy1 * dx2 - dy2 * dx1;
// 		let y_dnm = dx1 * dy2 - dx2 * dy1;


		let x_num = ax * d1.y * d2.x - cx * d2.y * d1.x + cy * d1.x * d2.x - ay * d1.x * d2.x;
		let y_num = ay * d1.x * d2.y - cy * d2.x * d1.y + cx * d1.y * d2.y - ax * d1.y * d2.y;

		let x_dnm = d1.y * d2.x - d2.y * d1.x;
		let y_dnm = d1.x * d2.y - d2.x * d1.y;

		PointFloat { x: x_num / x_dnm, y: y_num / y_dnm }
	}
}

impl SimpleIntersect for SegmentInt {
	fn intersects(&self, other: SegmentInt) -> bool {
		let (a, b) = self.a_b();
		let (c, d) = other.a_b();

		let xa = PointInt::orient2d(a, b, c);
		let xb = PointInt::orient2d(a, b, d);

		// may intersect in an overlapping line or not intersect at all
		if xa == Orientation::Collinear && xb == Orientation::Collinear { return false; }

		let xc = PointInt::orient2d(c, d, a);
		let xd = PointInt::orient2d(c, d, b);

		if xa != xb && xc != xd { return true; }

		return false;
	}

	fn line_intersection(&self, other: SegmentInt) -> PointFloat {
		let (a, b) = self.a_b();
		let (c, d) = other.a_b();

		let (ax, ay) = a.x_y();
// 		let (bx, by) = b.x_y();
		let (cx, cy) = c.x_y();
// 		let (dx, dy) = d.x_y();

		let d1 = self.delta();
		let d2 = other.delta();

// 		let dx1 = bx - ax;
// 		let dx2 = dx - cx;
// 		let dy1 = by - ay;
// 		let dy2 = dy - cy;

// 		let x_num = ax * dy1 * dx2 - cx * dy2 * dx1 + cy * dx1 * dx2 - ay * dx1 * dx2;
// 		let y_num = ay * dx1 * dy2 - cy * dx2 * dy1 + cx * dy1 * dy2 - ax * dy1 * dy2;

// 		let x_dnm = dy1 * dx2 - dy2 * dx1;
// 		let y_dnm = dx1 * dy2 - dx2 * dy1;


		let x_num = (ax * d1.y * d2.x - cx * d2.y * d1.x + cy * d1.x * d2.x - ay * d1.x * d2.x) as f64;
		let y_num = (ay * d1.x * d2.y - cy * d2.x * d1.y + cx * d1.y * d2.y - ax * d1.y * d2.y) as f64;

		let x_dnm = (d1.y * d2.x - d2.y * d1.x) as f64;
		let y_dnm = (d1.x * d2.y - d2.x * d1.y) as f64;

		PointFloat { x: x_num / x_dnm, y: y_num / y_dnm }
	}
}

mod tests {
	use super::*;
	use crate::point::{PointFloat, PointInt};

// ---------------- SEGMENT CREATION
	#[test]
	fn create_float_works() {
		let s = SegmentFloat::random();

		assert!(s.a.x <= 1.);
		assert!(s.a.y <= 1.);
		assert!(s.a.x >= 0.);
		assert!(s.a.y >= 0.);

		assert!(s.b.x <= 1.);
		assert!(s.b.y <= 1.);
		assert!(s.b.x >= 0.);
		assert!(s.b.y >= 0.);

		let (a, b) = s.a_b();
		let s_dupe = SegmentFloat { a, b };
		assert_eq!(s, s_dupe);
	}

 	#[test]
	fn create_int_works() {
		let s = SegmentInt::random();
		let (a, b) = s.a_b();
		let s_dupe = SegmentInt { a, b };
		assert_eq!(s, s_dupe);
	}

// ---------------- SEGMENT COERCION
	#[test]
	fn coerce_works() {
		let s_float = SegmentFloat::random_ceil(100.);

		assert!(s_float.a.x <= 100.);
		assert!(s_float.a.y <= 100.);
		assert!(s_float.a.x >= -100.);
		assert!(s_float.a.y >= -100.);

		assert!(s_float.b.x <= 100.);
		assert!(s_float.b.y <= 100.);
		assert!(s_float.b.x >= -100.);
		assert!(s_float.b.y >= -100.);

		let s_int: SegmentInt = s_float.into();
		assert_eq!(s_float.a.x.round() as i64, s_int.a.x);
		assert_eq!(s_float.a.y.round() as i64, s_int.a.y);
		assert_eq!(s_float.b.x.round() as i64, s_int.b.x);
		assert_eq!(s_float.b.y.round() as i64, s_int.b.y);

		let s_float: SegmentFloat = s_int.into();
		assert_eq!(s_int.a.x as f64, s_float.a.x);
		assert_eq!(s_int.a.y as f64, s_float.a.y);
		assert_eq!(s_int.b.x as f64, s_float.b.x);
		assert_eq!(s_int.b.y as f64, s_float.b.y);
	}

// ---------------- SEGMENT INTERSECTS
	#[test]
	fn intersects_float_works() {
		let p0 = PointFloat::new(2300., 1900.);
		let p1 = PointFloat::new(4200., 1900.);
		let p2 = PointFloat::new(2387., 1350.);
		let p3 = PointFloat::new(2500., 2100.);
		let p4 = PointFloat::new(3200., 1900.);
		let p5 = PointFloat::new(2900., 2100.);

		// s0|s1 intersect
		// s0|s3 intersect
		// s0|s4 do not intersect
		let s0 = SegmentFloat::new(p0, p1);
		let s1 = SegmentFloat::new(p2, p3);
		let s3 = SegmentFloat::new(p2, p4);
		let s4 = SegmentFloat::new(p3, p5);

		assert!(s0.intersects(s1));
		assert!(s0.intersects(s3));
		assert!(!s0.intersects(s4));
	}

	#[test]
	fn intersects_int_works() {
		let p0 = PointInt::new(2300, 1900);
		let p1 = PointInt::new(4200, 1900);
		let p2 = PointInt::new(2387, 1350);
		let p3 = PointInt::new(2500, 2100);
		let p4 = PointInt::new(3200, 1900);
		let p5 = PointInt::new(2900, 2100);

		// s0|s1 intersect
		// s0|s3 intersect
		// s0|s4 do not intersect
		let s0 = SegmentInt::new(p0, p1);
		let s1 = SegmentInt::new(p2, p3);
		let s3 = SegmentInt::new(p2, p4);
		let s4 = SegmentInt::new(p3, p5);

		assert!(s0.intersects(s1));
		assert!(s0.intersects(s3));
		assert!(!s0.intersects(s4));
	}

	#[test]
	fn intersects_mixed_works() {

	}

// ---------------- SEGMENT LINE INTERSECTION
	#[test]
	fn line_intersection_float_works() {
		let p0 = PointFloat::new(2300., 1900.);
		let p1 = PointFloat::new(4200., 1900.);
		let p2 = PointFloat::new(2387., 1350.);
		let p3 = PointFloat::new(2500., 2100.);
		let p4 = PointFloat::new(3200., 1900.);
		let p5 = PointFloat::new(2900., 2100.);

		// s0|s1 intersect
		// s0|s3 intersect
		// s0|s4 do not intersect
		let s0 = SegmentFloat::new(p0, p1);
		let s1 = SegmentFloat::new(p2, p3);
		let s3 = SegmentFloat::new(p2, p4);
		let s4 = SegmentFloat::new(p3, p5);

		let res01 = PointFloat::new(2469.866666666667, 1900.); // s0 x s1
		let res03 = PointFloat::new(3200., 1900.); // s0 x s3
		// s0 x s4: null
		let res13 = p2; // s1 x s3 intersect at p2
		let res14 = p3; // s1 x s4 intersect at p3
		let res34 = PointFloat::new(3495.6363636363635, 2100.); // s3 x s4


		assert_eq!(s0.line_intersection(s1), res01);
		assert_eq!(s0.line_intersection(s3), res03);
		assert_ne!(s0.line_intersection(s4), res01);

		assert_eq!(s1.line_intersection(s3), res13);
		assert_eq!(s1.line_intersection(s4), res14);
		assert_eq!(s3.line_intersection(s4), res34);
	}

	#[test]
	fn line_intersection_int_works() {
		let p0 = PointInt::new(2300, 1900);
		let p1 = PointInt::new(4200, 1900);
		let p2 = PointInt::new(2387, 1350);
		let p3 = PointInt::new(2500, 2100);
		let p4 = PointInt::new(3200, 1900);
		let p5 = PointInt::new(2900, 2100);

		// s0|s1 intersect
		// s0|s3 intersect
		// s0|s4 do not intersect
		let s0 = SegmentInt::new(p0, p1);
		let s1 = SegmentInt::new(p2, p3);
		let s3 = SegmentInt::new(p2, p4);
		let s4 = SegmentInt::new(p3, p5);

		let res01 = PointFloat::new(2469.866666666667, 1900.); // s0 x s1
		let res03 = PointFloat::new(3200., 1900.); // s0 x s3
		// s0 x s4: null
		let res13 = PointFloat::from(p2); // s1 x s3 intersect at p2
		let res14 = PointFloat::from(p3); // s1 x s4 intersect at p3
		let res34 = PointFloat::new(3495.6363636363635, 2100.); // s3 x s4

		assert_eq!(s0.line_intersection(s1), res01);
		assert_eq!(s0.line_intersection(s3), res03);
		assert_ne!(s0.line_intersection(s4), res01);

		assert_eq!(s1.line_intersection(s3), res13);
		assert_eq!(s1.line_intersection(s4), res14);
		assert_eq!(s3.line_intersection(s4), res34);
	}

	#[test]
	fn line_intersection_mixed_works() {

	}


}


// use serde::{Serialize, Deserialize};
// use std::cmp::Ordering;
// use crate::{
// 	point,
// 	point::PointInt,
// 	point::PointFloat,
// };
//
// use wasm_bindgen::prelude::*;
//
// #[wasm_bindgen]
// extern "C" {
// 	pub type JsWall;
// 	pub type JsWallData;
//
// 	#[wasm_bindgen(method, getter)]
// 	fn data(this: &JsWall) -> JsWallData;
//
// 	#[wasm_bindgen(method, getter)]
// 	fn c(this: &JsWallData) -> Vec<f64>;
// }
//
// /// Segments have ordered points, such that a is new (<= x, <= y) than b
// #[wasm_bindgen]
// #[derive(Serialize, Deserialize, Debug, Clone, PartialEq, PartialOrd)]
// pub struct SegmentInt {
// 	pub a: PointInt,
// 	pub b: PointInt,
//
// // 	#[serde(default)]
// // 	pub id: String,
// }
//
// #[wasm_bindgen]
// #[derive(Serialize, Deserialize, Debug, Clone, PartialEq, PartialOrd)]
// pub struct SegmentFloat {
// 	pub a: PointFloat,
// 	pub b: PointFloat,
//
// // 	#[serde(default)]
// // 	pub id: String,
// }
//
// #[wasm_bindgen]
// impl SegmentInt {
// 	#[wasm_bindgen(constructor)]
// 	pub fn new(a: PointInt, b: PointInt) -> Self {
// 		// a: nw (min_xy) and b: se (max_xy)
// 		let order = a.partial_cmp(&b).unwrap();
// 		match order {
// 			Ordering::Less => Self { a, b },
// 			Ordering::Equal => Self { a, b },
// 			Ordering::Greater => Self { a: b, b: a },
// 		}
// 	}
//
// 	/// Construct a random Segment, using Point::random_ceil
// 	pub fn random_ceil(max: i32, negative: bool) -> Self {
// 		Self::new(PointInt::random_ceil(max, negative), PointInt::random_ceil(max, negative))
// 	}
//
// 	pub fn random() -> Self {
// 		Self::new(PointInt::random(), PointInt::random())
// 	}
// }
//
// #[wasm_bindgen]
// impl SegmentFloat {
//
//
// 	#[wasm_bindgen(constructor)]
// 	pub fn new(a: PointFloat, b: PointFloat) -> Self {
// 		// a: nw (min_xy) and b: se (max_xy)
// 		let order = a.partial_cmp(&b).unwrap();
// 		match order {
// 			Ordering::Less => Self { a, b },
// 			Ordering::Equal => Self { a, b },
// 			Ordering::Greater => Self { a: b, b: a },
// 		}
// 	}
//
// 	/// Construct a random Segment, using Point::random_ceil
// 	pub fn random_ceil(max: f64, negative: bool) -> Self {
// 		Self::new(PointFloat::random_ceil(max, negative), PointFloat::random_ceil(max, negative))
// 	}
//
// 	pub fn random() -> Self {
// 		Self::new(PointFloat::random(), PointFloat::random())
// 	}
//
// 	pub fn from_js(wall: &JsWall) -> Self {
// 		let data = wall.data();
// 		let c = data.c();
// 		Self::new(
// 			PointFloat::new(c[0], c[1]),
// 			PointFloat::new(c[2], c[3]),
// 		)
// 	}
// }
//
//
//
//
//
//
