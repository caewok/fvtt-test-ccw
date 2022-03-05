//use serde::{Serialize, Deserialize};
use geo::{Point, Line, CoordNum, GeoNum, GeoFloat, Coordinate};

//use serde_json;
use std::fs;
//use rand::Rng;
//use rand::distributions::Standard;
//use rand::prelude::Distribution;

//use std::cmp::Ordering;
//use std::fmt;

//use wasm_bindgen::prelude::*;

// https://stackoverflow.com/questions/25413201/how-do-i-implement-a-trait-i-dont-own-for-a-type-i-dont-own

// use std::ops::{Deref, DerefMut};
// struct MyPoint<T: CoordNum>(Point<T>);
//
// impl<T: CoordNum> MyPoint<T>
// 	where Standard: Distribution<T> {
// 	pub fn random() -> Point<T> {
// 		let mut rng = rand::thread_rng();
// 		Point::new(rng.gen(), rng.gen())
// 	}
// }
//
// impl<T: CoordNum> fmt::Display for MyPoint<T> {
// 	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
// 		// Point x,y
//         write!(f, "{:#?},{:#?}", self.x(), self.y())
//     }
// }
//
// impl<T: CoordNum> Deref for MyPoint<T> {
// 	type Target = Point<T>;
// 	fn deref(&self) -> &Self::Target {
// 		&self.0
// 	}
// }
//
// impl<T: CoordNum> DerefMut for MyPoint<T> {
// 	fn deref_mut(&mut self) -> &mut Self::Target {
// 		&mut self.0
// 	}
// }



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
pub fn orient2d<T: CoordNum>(a: Coordinate<T>, b: Coordinate<T>, c: Coordinate<T>) -> T::Output
	where T: std::ops::Mul
{
	let (ax, ay) = a.x_y();
	let (bx, by) = b.x_y();
	let (cx, cy) = c.x_y();



	let _: <T as std::ops::Mul::Output> (ay - cy) * (bx - cx) - (ax - cx) * (by - cy)
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
pub fn line_segment_intersects<F: CoordNum>(l1: Line<F>, l2: Line<F>) -> bool {
	let a = l1.start;
	let b = l1.end;
	let c = l2.start;
	let d = l2.end;

	let xa = orient2d(a, b, c);
	let xb = orient2d(a, b, d);

	let z = F::zero();

	if xa == z && xb == z { return false; }

	let xab = (xa * xb) <= z;
	let xcd = (orient2d(c, d, a) * orient2d(c, d, b)) <= z;
	return xab && xcd;
}

pub fn line_segment_intersects_robust<F>(l1: Line<F>, l2: Line<F>) -> bool
	where
		F: GeoFloat,
{
	use geo::kernels::{Kernel, Orientation::*, RobustKernel};

	let a = l1.start;
	let b = l1.end;
	let c = l2.start;
	let d = l2.end;

	let xa = RobustKernel::orient2d(a, b, c);
	let xb = RobustKernel::orient2d(a, b, d);

// 	println!("xa is {:?}; xb is {:?}", xa, xb);

	if matches!(
		(xa, xb),
		(Collinear, Collinear) | (Clockwise, Clockwise) | (CounterClockwise, CounterClockwise)
	) {
		return false;
	}

	let xc = RobustKernel::orient2d(c, d, a);
	let xd = RobustKernel::orient2d(c, d, b);

	if matches!(
		(xc, xd),
		(Clockwise, Clockwise) | (CounterClockwise, CounterClockwise)
	) {
		return false;
	}

	return true;
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
pub fn line_line_intersection<F>(l1: Line<F>, l2: Line<F>) -> Point<F>
	where
		F: CoordNum,
{
	let (ax, ay) = l1.start.x_y();
	//let (bx, by) = l1.end.x_y();
	let (cx, cy) = l2.start.x_y();
	//let (dx, dy) = l2.end.x_y();

	let dx1 = l1.dx();
  	let dx2 = l2.dx();
  	let dy1 = l1.dy();
  	let dy2 = l2.dy();

  	let x_num = ax * dy1 * dx2 - cx * dy2 * dx1 + cy * dx1 * dx2 - ay * dx1 * dx2;
  	let y_num = ay * dx1 * dy2 - cy * dx2 * dy1 + cx * dy1 * dy2 - ax * dy1 * dy2;

  	let x_dnm = dy1 * dx2 - dy2 * dx1;
  	let y_dnm = dx1 * dy2 - dx2 * dy1;

	return (x_num / x_dnm, y_num / y_dnm).into();
}



struct TestSetup {
	points_float: Vec<Point<f64>>,
	points_int: Vec<Point<i32>>,
}

impl TestSetup {
	fn new() -> Self {
	   	let str1 = fs::read_to_string("points_test.json").unwrap();

	   	let pts: Vec<Point<f64>> = serde_json::from_str(&str1).unwrap();
	   	let pts_int = pts.clone();

	   	let pts_int: Vec<Point<i32>> = pts_int.into_iter().map(|x| Point::new(x.x() as i32, x.y() as i32)).collect();

		Self {
			points_float: pts,
			points_int: pts_int,
		}
	}
}


#[cfg(test)]
mod tests {
		use super::*;

		// a|b is horizontal
		// c is to left of a|b
		// d is to right of a|b
		// e is collinear with a|b
		// c|d intersects a|b
		// d|f parallel to a|b, c|d does not intersect as a segment but does as infinite line

		#[test]
		fn ccw_orientation_works() {
			let setup = TestSetup::new();
			let a = setup.points_float[0].into();
			let b = setup.points_float[1].into();
			let c = setup.points_float[2].into();

			let o = orient2d(a, b, c);
			assert_eq!(o, 1045000.0);

			let a = setup.points_int[0].into();
			let b = setup.points_int[1].into();
			let c = setup.points_int[2].into();

			let o = orient2d(a, b, c);
			assert_eq!(o, 1045000);
		}

		#[test]
		fn cw_orientation_works() {
			let setup = TestSetup::new();
			let a = setup.points_float[0].into();
			let b = setup.points_float[1].into();
			let d = setup.points_float[3].into();

			let o = orient2d(a, b, d);
			assert_eq!(o, -380000.0);

			let a = setup.points_int[0].into();
			let b = setup.points_int[1].into();
			let d = setup.points_int[3].into();

			let o = orient2d(a, b, d);
			assert_eq!(o, -380000);
		}

		#[test]
		fn collinear_orientation_works() {
			let setup = TestSetup::new();
			let a = setup.points_float[0].into();
			let b = setup.points_float[1].into();
			let e = setup.points_float[4].into();

			let o = orient2d(a, b, e);
			assert_eq!(o, 0.0);

			let a = setup.points_int[0].into();
			let b = setup.points_int[1].into();
			let e = setup.points_int[4].into();

			let o = orient2d(a, b, e);
			assert_eq!(o, 0);
		}

		#[test]
		fn intersection_found() {
			let setup = TestSetup::new();
			let a = setup.points_float[0];
			let b = setup.points_float[1];
			let c = setup.points_float[2];
			let d = setup.points_float[3];

			let l1 = Line::new(a, b);
			let l2 = Line::new(c, d);

			let is_ix = line_segment_intersects(l1, l2);
			let is_ix2 = line_segment_intersects_robust(l1, l2);
			assert!(is_ix);
			assert!(is_ix2);

			let a = setup.points_int[0];
			let b = setup.points_int[1];
			let c = setup.points_int[2];
			let d = setup.points_int[3];

			let l1 = Line::new(a, b);
			let l2 = Line::new(c, d);

			let is_ix = line_segment_intersects(l1, l2);
			assert!(is_ix);
		}

		#[test]
		fn intersection_not_found() {
			let setup = TestSetup::new();
			let a = setup.points_float[0];
			let b = setup.points_float[1];
			let d = setup.points_float[3];
			let f = setup.points_float[5];

			let l1 = Line::new(a, b);
			let l2 = Line::new(d, f);

			let is_ix = line_segment_intersects(l1, l2);
			let is_ix2 = line_segment_intersects_robust(l1, l2);
			assert!(!is_ix);
			assert!(!is_ix2);

// 			let a = setup.points_int[0];
// 			let b = setup.points_int[1];
// 			let d = setup.points_int[3];
// 			let f = setup.points_int[5];
//
// 			let l1 = Line::new(a, b);
// 			let l2 = Line::new(d, f);
//
// 			let is_ix = line_segment_intersects(l1, l2);
// 			assert!(!is_ix);
		}

		#[test]
		fn intersection() {
			let setup = TestSetup::new();
			let a = setup.points_float[0];
			let b = setup.points_float[1];
			let c = setup.points_float[2];
			let e = setup.points_float[4];

			let l1 = Line::new(a, b);
			let l2 = Line::new(c, e);

			let ix = line_line_intersection(l1, l2);
			assert_eq!(ix.x(), 3200.0);
			assert_eq!(ix.y(), 1900.0);

// 			let a = setup.points_int[0];
// 			let b = setup.points_int[1];
// 			let c = setup.points_int[2];
// 			let e = setup.points_int[4];
//
// 			let l1 = Line::new(a, b);
// 			let l2 = Line::new(c, e);
//
// 			let ix = line_line_intersection(l1, l2);
// 			assert_eq!(ix.x(), 3200);
// 			assert_eq!(ix.y(), 1900);
		}
}