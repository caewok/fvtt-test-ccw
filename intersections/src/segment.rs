use crate::point::*;

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
}

impl SegmentInt {
	pub fn new(a: PointInt, b: PointInt) -> Self { SegmentInt { a, b }}

	pub fn a_b(&self) -> (PointInt, PointInt) { (self.a, self.b) }
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
