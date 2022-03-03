use serde::{Serialize, Deserialize};
use std::cmp::Ordering;
use crate::{
	point,
	point::PointInt,
	point::PointFloat,
};

use wasm_bindgen::prelude::*;


/// Segments have ordered points, such that a is new (<= x, <= y) than b
#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, PartialOrd)]
pub struct SegmentInt {
	pub a: PointInt,
	pub b: PointInt,
}

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, PartialOrd)]
pub struct SegmentFloat {
	pub a: PointFloat,
	pub b: PointFloat,
}

#[wasm_bindgen]
impl SegmentInt {
	#[wasm_bindgen(constructor)]
	pub fn new(a: PointInt, b: PointInt) -> Self {
		// a: nw (min_xy) and b: se (max_xy)
		let order = a.partial_cmp(&b).unwrap();
		match order {
			Ordering::Less => Self { a, b },
			Ordering::Equal => Self { a, b },
			Ordering::Greater => Self { a: b, b: a },
		}
	}

	/// Construct a random Segment, using Point::random_ceil
	pub fn random_ceil(max: i32, negative: bool) -> Self {
		Self::new(PointInt::random_ceil(max, negative), PointInt::random_ceil(max, negative))
	}

	pub fn random() -> Self {
		Self::new(PointInt::random(), PointInt::random())
	}
}

#[wasm_bindgen]
impl SegmentFloat {
	#[wasm_bindgen(constructor)]
	pub fn new(a: PointFloat, b: PointFloat) -> Self {
		// a: nw (min_xy) and b: se (max_xy)
		let order = a.partial_cmp(&b).unwrap();
		match order {
			Ordering::Less => Self { a, b },
			Ordering::Equal => Self { a, b },
			Ordering::Greater => Self { a: b, b: a },
		}
	}

	/// Construct a random Segment, using Point::random_ceil
	pub fn random_ceil(max: f64, negative: bool) -> Self {
		Self::new(PointFloat::random_ceil(max, negative), PointFloat::random_ceil(max, negative))
	}

	pub fn random() -> Self {
		Self::new(PointFloat::random(), PointFloat::random())
	}
}






