use geo::{CoordNum, Point, Coordinate};
use geo::algorithm::kernels::Orientation;
use crate::point::{orient2d, GenerateRandom};
use std::cmp::Ordering;
use num_traits::{Signed, Num, NumCast};
use castaway::{match_type};
use rand::prelude::Distribution;
use rand::distributions::Standard;
use rand::distributions::uniform::SampleUniform;

// Create a simple struct for an ordered Line, where a is ne of b
#[derive(Debug, Copy, Clone, PartialEq)]
pub struct OrderedSegment<T>
	where T: CoordNum + Num,
{
	pub start: Coordinate<T>,
	pub end: Coordinate<T>,
}

impl<T> OrderedSegment<T>
	where T: CoordNum,
{
	pub fn new<C>(start: C, end: C) -> OrderedSegment<T>
		where C: Into<Coordinate<T>>
	{
		let start: Coordinate<T> = start.into();
		let end: Coordinate<T> = end.into();
		let order = OrderedSegment::compare_xy(start, end);

		match order {
			Ordering::Less => Self { start, end },
			Ordering::Equal => Self { start, end },
			Ordering::Greater => Self { start: end, end: start },
		}
	}

	pub fn compare_xy<C>(start: C, end: C) -> Ordering
		where C: Into<Coordinate<T>>
	{
		let start: Coordinate<T> = start.into();
		let end: Coordinate<T> = end.into();

		let (ax, ay) = start.x_y();
		let (bx, by) = end.x_y();

		// following doesn't work b/c it wants T: Iterator for reasons...
// 		let order = ax.cmp(bx);
// 		if let Ordering::Equal = order {
// 			order = ay.cmp(by)
// 		}

		if ax == bx {
			if ay == by {
				Ordering::Equal
			} else if ay < by  {
				Ordering::Less
			} else {
				Ordering::Greater
			}
		} else {
			if ax < bx {
				Ordering::Less
			} else {
				Ordering::Greater
			}
		}
	}

	// difference in coordinates (∆x, ∆y)
	pub fn delta(&self) -> Coordinate<T> {
		self.end - self.start
	}

	// change in 'x' component
	pub fn dx(&self) -> T {
		//self.delta().x
		self.end.x - self.start.x
	}

	// change in 'y' component
	pub fn dy(&self) -> T {
// 		self.delta().y
		self.end.y - self.start.y
	}

	pub fn start_point(&self) -> Point<T> {
		Point(self.start)
	}

	pub fn end_point(&self) -> Point<T> {
		Point(self.end)
	}

	pub fn points(&self) -> (Point<T>, Point<T>) {
		(self.start_point(), self.end_point())
	}

	pub fn coords(&self) -> (T, T, T, T) {
		(self.start.x, self.start.y, self.end.x, self.end.y)
	}

	// segment is completely left of the other, meaning self.end < other.start
	pub fn is_left(&self, other: &Self) -> bool {
		let res = OrderedSegment::compare_xy(self.end, other.start);
		res == Ordering::Less
	}

	// segment is completely right of the other, meaning self.start > other.end
	pub fn is_right(&self, other: &Self) -> bool {
		let res = OrderedSegment::compare_xy(self.start, other.end);
		res == Ordering::Greater
	}
}

impl<T> GenerateRandom for OrderedSegment<T>
	where T: CoordNum + SampleUniform, Standard: Distribution<T>,
{
	type MaxType = T;

	fn random() -> Self {
		Self::new(Point::random(), Point::random())
	}

	fn random_range(min: T, max: T) -> Self {
		Self::new(Point::random_range(min, max), Point::random_range(min, max))
	}

	fn random_pos(max: T) -> Self {
		Self::new(Point::random_pos(max), Point::random_pos(max))
	}
}


pub trait SimpleIntersect<T: CoordNum, B = Self>
	where T: CoordNum
{
	fn intersects(&self, other: &B) -> bool;
	fn line_intersection(&self, other: &B) -> Option<Point<f64>>;
	fn line_intersection_mixed(&self, other: &B) -> Option<Point<T>>;
}

impl<T: 'static> SimpleIntersect<T> for OrderedSegment<T>
	where T: CoordNum + Signed,
 {
	fn intersects(&self, other: &Self) -> bool {
		let (a, b) = self.points();
		let (c, d) = other.points();

		let xa = orient2d(a.into(), b.into(), c.into());
		let xb = orient2d(a.into(), b.into(), d.into());

		// may intersect in an overlapping line or not intersect at all
		if xa == Orientation::Collinear && xb == Orientation::Collinear { return false; }

		let xc = orient2d(c.into(), d.into(), a.into());
		let xd = orient2d(c.into(), d.into(), b.into());

		if xa != xb && xc != xd { return true; }

		return false;
	}

	fn line_intersection(&self, other: &Self) -> Option<Point<f64>> {
		let (a, _b) = self.points();
		let (c, _d) = other.points();

		let (ax, ay) = a.x_y();
		let (cx, cy) = c.x_y();

		let d1 = self.delta();
		let d2 = other.delta();

		let z:T = num_traits::zero();

		let x_dnm = d1.y * d2.x - d2.y * d1.x;
		if x_dnm == z { return None; }

		let y_dnm = d1.x * d2.y - d2.x * d1.y;
		if y_dnm == z { return None; }

		let x_num = ax * d1.y * d2.x - cx * d2.y * d1.x + cy * d1.x * d2.x - ay * d1.x * d2.x;
		let y_num = ay * d1.x * d2.y - cy * d2.x * d1.y + cx * d1.y * d2.y - ax * d1.y * d2.y;

		// cast to float for division
		// TO-DO: Handle errors / None
		let x_dnm:f64 = num_traits::cast(x_dnm).unwrap();
		let y_dnm:f64 = num_traits::cast(y_dnm).unwrap();

		let x_num:f64 = num_traits::cast(x_num).unwrap();
		let y_num:f64 = num_traits::cast(y_num).unwrap();

		let res_x = x_num / x_dnm;
		let res_y = y_num / y_dnm;

		Some(Point::new(res_x.into(), res_y.into()))
	}

	fn line_intersection_mixed(&self, other: &Self) -> Option<Point<T>> {
		let (a, _b) = self.points();
		let (c, _d) = other.points();

		let (ax, ay) = a.x_y();
		let (cx, cy) = c.x_y();

		let d1 = self.delta();
		let d2 = other.delta();

		let z:T = num_traits::zero();

		let x_dnm = d1.y * d2.x - d2.y * d1.x;
		if x_dnm == z { return None; }

		let y_dnm = d1.x * d2.y - d2.x * d1.y;
		if y_dnm == z { return None; }

		let x_num = ax * d1.y * d2.x - cx * d2.y * d1.x + cy * d1.x * d2.x - ay * d1.x * d2.x;
		let y_num = ay * d1.x * d2.y - cy * d2.x * d1.y + cx * d1.y * d2.y - ax * d1.y * d2.y;

		let res_x = divide_robust(x_num, x_dnm);
		let res_y = divide_robust(y_num, y_dnm);

		Some(Point::new(res_x, res_y))
	}

}

pub fn divide_robust<T: 'static>(num: T, denom: T) -> T
	where T: Num + NumCast + Copy,
{
	let z: T = num_traits::zero();
	if num % denom == z {
		return num / denom;
	}

	// T is either an integer that does not evenly divide or a float
	// - if T is a float, can simply divide and return
	// - if T is an integer, we must round the floating point result
	let numf: f64 = num_traits::cast(num).unwrap();
	let denomf: f64 = num_traits::cast(denom).unwrap();
	let ratio = numf / denomf;

	let is_int = match_type!(num, {
		i128 as _ => true,
		i64 as _ => true,
		i32 as _ => true,
		i16 as _ => true,
		i8 as _ => true,
		_ => false,
	});

	if is_int {
		let out: T = num_traits::cast(ratio.round()).unwrap();
		out
	} else {
		let out: T = num_traits::cast(ratio).unwrap();
		out
	}
}


#[cfg(test)]
mod tests {
	use super::*;

// ---------------- SEGMENT CREATION
	#[test]
	fn create_float_works() {
		let s: OrderedSegment<f64> = OrderedSegment::random();
		let (ax, ay, bx, by) = s.coords();

		assert!(ax <= 1.);
		assert!(ay <= 1.);
		assert!(bx <= 1.);
		assert!(by <= 1.);

		assert!(ax >= 0.);
		assert!(ay >= 0.);
		assert!(bx >= 0.);
		assert!(by >= 0.);

		assert!(ax < bx || ax == bx && ay <= by);

		let (a, b) = s.points();
		let s_dupe = OrderedSegment::new(a, b);
		assert_eq!(s, s_dupe);
	}

	#[test]
	fn create_int_works() {
		let s: OrderedSegment<i64> = OrderedSegment::random();
		let (ax, ay, bx, by) = s.coords();
		assert!(ax < bx || ax == bx && ay <= by);

		let (a, b) = s.points();
		let s_dupe = OrderedSegment::new(a, b);
		assert_eq!(s, s_dupe);
	}

// ---------------- SEGMENT INTERSECTS
	#[test]
	fn intersects_float_works() {
		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
		let s2: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (3200., 1900.));
		let s3: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));

		assert!(s0.intersects(&s1));
		assert!(s0.intersects(&s2));
		assert!(!s0.intersects(&s3));
	}

	#[test]
	fn intersects_int_works() {
		let s0: OrderedSegment<i64> = OrderedSegment::new((2300, 1900), (4200, 1900));
		let s1: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (2500, 2100));
		let s2: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (3200, 1900));
		let s3: OrderedSegment<i64> = OrderedSegment::new((2500, 2100), (2900, 2100));

		assert!(s0.intersects(&s1));
		assert!(s0.intersects(&s2));
		assert!(!s0.intersects(&s3));
	}

// ---------------- SEGMENT LINE INTERSECTION
	#[test]
	fn line_intersection_float_works() {
		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
		let s2: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (3200., 1900.));
		let s3: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));

		let res01: Point<f64> = Point::new(2469.866666666667, 1900.); // s0 x s1
		let res02: Point<f64> = Point::new(3200., 1900.); // s0 x s2
		// s0 x s3: null
		let res12: Point<f64> = Point::new(2387., 1350.); // s1 x s2 intersect at p2
		let res13: Point<f64> = Point::new(2500., 2100.); //s1 x s4 intersect
		let res23: Point<f64> = Point::new(3495.6363636363635, 2100.);

		assert_eq!(s0.line_intersection(&s1), Some(res01));
		assert_eq!(s0.line_intersection(&s2), Some(res02));
		assert_eq!(s0.line_intersection(&s3), None);

		assert_eq!(s1.line_intersection(&s2), Some(res12));
		assert_eq!(s1.line_intersection(&s3), Some(res13));
		assert_eq!(s2.line_intersection(&s3), Some(res23));
	}

	#[test]
	fn line_intersection_int_works() {
		let s0: OrderedSegment<i64> = OrderedSegment::new((2300, 1900), (4200, 1900));
		let s1: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (2500, 2100));
		let s2: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (3200, 1900));
		let s3: OrderedSegment<i64> = OrderedSegment::new((2500, 2100), (2900, 2100));

		let res01: Point<f64> = Point::new(2469.866666666667, 1900.); // s0 x s1
		let res02: Point<f64> = Point::new(3200., 1900.); // s0 x s2
		// s0 x s3: null
		let res12: Point<f64> = Point::new(2387., 1350.); // s1 x s2 intersect at p2
		let res13: Point<f64> = Point::new(2500., 2100.); //s1 x s4 intersect
		let res23: Point<f64> = Point::new(3495.6363636363635, 2100.);

		assert_eq!(s0.line_intersection(&s1), Some(res01));
		assert_eq!(s0.line_intersection(&s2), Some(res02));
		assert_eq!(s0.line_intersection(&s3), None);

		assert_eq!(s1.line_intersection(&s2), Some(res12));
		assert_eq!(s1.line_intersection(&s3), Some(res13));
		assert_eq!(s2.line_intersection(&s3), Some(res23));
	}


// ---------------- SEGMENT LINE INT INTERSECTION
	#[test]
	fn line_intersection_mixed_float_works() {
		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
		let s2: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (3200., 1900.));
		let s3: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));

		let res01: Point<f64> = Point::new(2469.866666666667, 1900.); // s0 x s1
		let res02: Point<f64> = Point::new(3200., 1900.); // s0 x s2
		// s0 x s3: null
		let res12: Point<f64> = Point::new(2387., 1350.); // s1 x s2 intersect at p2
		let res13: Point<f64> = Point::new(2500., 2100.); //s1 x s4 intersect
		let res23: Point<f64> = Point::new(3495.6363636363635, 2100.);

		assert_eq!(s0.line_intersection_mixed(&s1), Some(res01));
		assert_eq!(s0.line_intersection_mixed(&s2), Some(res02));
		assert_eq!(s0.line_intersection_mixed(&s3), None);

		assert_eq!(s1.line_intersection_mixed(&s2), Some(res12));
		assert_eq!(s1.line_intersection_mixed(&s3), Some(res13));
		assert_eq!(s2.line_intersection_mixed(&s3), Some(res23));
	}

	#[test]
	fn line_intersection_mixed_int_works() {
		let s0: OrderedSegment<i64> = OrderedSegment::new((2300, 1900), (4200, 1900));
		let s1: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (2500, 2100));
		let s2: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (3200, 1900));
		let s3: OrderedSegment<i64> = OrderedSegment::new((2500, 2100), (2900, 2100));

		let res01: Point<i64> = Point::new(2470, 1900); // s0 x s1
		let res02: Point<i64> = Point::new(3200, 1900); // s0 x s2
		// s0 x s3: null
		let res12: Point<i64> = Point::new(2387, 1350); // s1 x s2 intersect at p2
		let res13: Point<i64> = Point::new(2500, 2100); //s1 x s4 intersect
		let res23: Point<i64> = Point::new(3496, 2100);

		assert_eq!(s0.line_intersection_mixed(&s1), Some(res01));
		assert_eq!(s0.line_intersection_mixed(&s2), Some(res02));
		assert_eq!(s0.line_intersection_mixed(&s3), None);

		assert_eq!(s1.line_intersection_mixed(&s2), Some(res12));
		assert_eq!(s1.line_intersection_mixed(&s3), Some(res13));
		assert_eq!(s2.line_intersection_mixed(&s3), Some(res23));
	}

}
