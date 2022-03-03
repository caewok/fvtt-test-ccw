use serde::{Serialize, Deserialize};
//use serde_json;
//use std::fs;
use rand::Rng;

//use std::cmp::Ordering;
use std::fmt;

// use num::Num; // https://stackoverflow.com/questions/37296351/is-there-any-trait-that-specifies-numeric-functionality

use wasm_bindgen::prelude::*;

// #[wasm_bindgen]
// extern "C" {
// 	pub type JsPoint;
//
// 	#[wasm_bindgen(method, getter)]
// 	fn x(this: &JsPoint) -> f64;
//
// 	#[wasm_bindgen(method, getter)]
// 	fn y(this: &JsPoint) -> f64;
// }


/// Represent a point on a 2-D plane with x,y coordinates.
/// Accepts any numeric value for x, y point, but requires they be the same type
/// for simplicity. (So either two floats, or two integers.)
// Cannot use Point<T> with wasm_bindgen: structs with #[wasm_bindgen] cannot have lifetime or type parameters currently

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, PartialOrd)]
pub struct PointFloat {
	pub x: f64,
  	pub y: f64,
}

// Don't use trait bound in struct definition above.
// See https://stackoverflow.com/questions/49229332/should-trait-bounds-be-duplicated-in-struct-and-impl
#[wasm_bindgen]
impl PointFloat {
	#[wasm_bindgen(constructor)]
	pub fn new(x: f64, y: f64) -> Self {
		Self { x, y }
	}

	/// Construct a random point with an optional maximum amount.
	/// If negative is true, the max will also serve as the floor.
	/// Otherwise, floor is 0.
	/// Useful for testing intersections where you need segments that could possibly
	/// overlap with greater frequency than using random alone.
	pub fn random_ceil(max: f64, negative: bool) -> Self {
		let mut rng = rand::thread_rng();

		if negative {
		  	Self {
		 		x: rng.gen_range(-max..max),
		 		y: rng.gen_range(-max..max),
		 	}
		} else {
			Self {
		 		x: rng.gen_range(0.0..max),
		 		y: rng.gen_range(0.0..max),
		 	}
		}
	}

	/// Construct a random point
	pub fn random() -> Self {
	  	let mut rng = rand::thread_rng();
	  	Self {
	    	x: rng.gen(),
			y: rng.gen(),
	  	}
	}

	// so this can be done from JS
	pub fn into_point_int(&self) -> PointInt {
		let s = self.clone();
		s.into()
	}

}

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, PartialOrd)]
pub struct PointInt {
	pub x: i32, // avoid i64 to avoid dealing with JS BigInt() problems
  	pub y: i32,
}




#[wasm_bindgen]
impl PointInt {
	#[wasm_bindgen(constructor)]
	pub fn new(x: i32, y: i32) -> Self {
		Self { x, y }
	}

	/// Construct a random point with an optional maximum amount.
	/// If negative is true, the max will also serve as the floor.
	/// Otherwise, floor is 0.
	/// Useful for testing intersections where you need segments that could possibly
	/// overlap with greater frequency than using random alone.
	pub fn random_ceil(max: i32, negative: bool) -> Self {
		let mut rng = rand::thread_rng();

		if negative {
		  	Self {
		 		x: rng.gen_range(-max..max),
		 		y: rng.gen_range(-max..max),
		 	}
		} else {
			Self {
		 		x: rng.gen_range(0..max),
		 		y: rng.gen_range(0..max),
		 	}
		}
	}

	/// Construct a random point
	pub fn random() -> Self {
	  	let mut rng = rand::thread_rng();
	  	Self {
	    	x: rng.gen(),
			y: rng.gen(),
	  	}
	}

	// so this can be done from JS
	pub fn into_point_float(&self) -> PointFloat {
		let s = self.clone();
		s.into()
	}

}


impl From<PointInt> for PointFloat {
	fn from(item: PointInt) -> Self {
		PointFloat { x: item.x as f64, y: item.y as f64 }
	}
}

impl From<PointFloat> for PointInt {
	fn from(item: PointFloat) -> Self {
		// round to nearest integer coordinates
		Self { x: item.x.round() as i32, y: item.y.round() as i32 }
	}
}

// impl From<&JsPoint> for Point {
// 	fn from(point: &JsPoint) -> Self {
// 		Self::new(point.x(), point.y())
// 	}
// }


impl fmt::Display for PointFloat {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		// Point x,y
        write!(f, "{},{}", self.x, self.y)
    }
}

impl fmt::Display for PointInt {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		// Point x,y
        write!(f, "{},{}", self.x, self.y)
    }
}



/// Determine the relative orientation of three points in two-dimensional space.
/// The result is also an approximation of twice the signed area of the triangle
/// defined by the three points. This method is fast but not robust against issues
/// of floating point precision. Best used with integer coordinates.
/// Adapted from https://github.com/mourner/robust-predicates
///
/// ## Arguments
/// *a* An endpoint of segment AB, relative to which point C is tested.
/// *b* An endpoint of segment AB, relative to which point C is tested.
/// *c* A point is tested compared to A --> B --> C.
///
/// ## Returns
/// Positive value if the points are in counter-clockwise order.
/// Negative value if the points are in clockwise order.
/// Zero if the points are collinear.
#[wasm_bindgen]
pub fn orient2d(a: &PointFloat, b: &PointFloat, c: &PointFloat) -> f64 {
  (a.y - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y)
}

#[wasm_bindgen]
pub fn orient2d_int(a: &PointInt, b: &PointInt, c: &PointInt) -> i32 {
  (a.y - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y)
}


/// Quickly test if two line segments, AB and CD, intersect.
/// This method does not determine the point of intersection.
///
/// ## Arguments
/// *a* First endpoint of AB
/// *b* Second endpoint of AB
/// *c* First endpoint of CD
/// *d* Second endpoint of CD
///
/// ## Returns
/// True if the lines segments intersect.
#[wasm_bindgen]
pub fn line_segment_intersects(a: &PointFloat, b: &PointFloat, c: &PointFloat, d: &PointFloat) -> bool {
	let xa = orient2d(a, b, c);
	let xb = orient2d(a, b, d);

	if xa == 0.0 && xb == 0.0 { return false; }

	let xab = (xa * xb) <= 0.0;
	let xcd = (orient2d(c, d, a) * orient2d(c, d, b)) <= 0.0;
	return xab && xcd
}

#[wasm_bindgen]
pub fn line_segment_intersects_int(a: &PointInt, b: &PointInt, c: &PointInt, d: &PointInt) -> bool {
	let xa = orient2d_int(a, b, c);
	let xb = orient2d_int(a, b, d);

	if xa == 0 && xb == 0 { return false; }

	let xab = (xa * xb) <= 0;
	let xcd = (orient2d_int(c, d, a) * orient2d_int(c, d, b)) <= 0;
	return xab && xcd
}

/// Compute the intersection between two infinite lines.
/// Does not check for parallel lines; will return Infinite, NaN coordinates in that case
///
/// ## Arguments
/// *a* First endpoint of AB
/// *b* Second endpoint of AB
/// *c* First endpoint of CD
/// *d* Second endpoint of CD
///
/// ## Returns
/// Coordinates of the intersection.
#[wasm_bindgen]
pub fn line_line_intersection(a: &PointFloat, b: &PointFloat, c: &PointFloat, d: &PointFloat) -> PointFloat {
	let dx1 = b.x - a.x;
  	let dx2 = d.x - c.x;
  	let dy1 = b.y - a.y;
  	let dy2 = d.y - c.y;

  	let x_num = a.x * dy1 * dx2 - c.x * dy2 * dx1 + c.y * dx1 * dx2 - a.y * dx1 * dx2;
  	let y_num = a.y * dx1 * dy2 - c.y * dx2 * dy1 + c.x * dy1 * dy2 - a.x * dy1 * dy2;

  	let x_dnm = dy1 * dx2 - dy2 * dx1;
  	let y_dnm = dx1 * dy2 - dx2 * dy1;

  	PointFloat { x: x_num / x_dnm, y: y_num / y_dnm }
}

#[wasm_bindgen]
pub fn line_line_intersection_int(a: &PointInt, b: &PointInt, c: &PointInt, d: &PointInt) -> PointFloat {
	let dx1 = b.x - a.x;
  	let dx2 = d.x - c.x;
  	let dy1 = b.y - a.y;
  	let dy2 = d.y - c.y;

  	let x_num = a.x * dy1 * dx2 - c.x * dy2 * dx1 + c.y * dx1 * dx2 - a.y * dx1 * dx2;
  	let y_num = a.y * dx1 * dy2 - c.y * dx2 * dy1 + c.x * dy1 * dy2 - a.x * dy1 * dy2;

  	let x_dnm = dy1 * dx2 - dy2 * dx1;
  	let y_dnm = dx1 * dy2 - dx2 * dy1;

  	PointFloat { x: x_num as f64 / x_dnm as f64, y: y_num as f64 / y_dnm as f64 }
}

