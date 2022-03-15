use geo::{CoordNum, Point, Coordinate};
use geo::algorithm::kernels::Orientation;
use crate::point::{SimpleOrient, GenerateRandom};
use std::cmp::Ordering;
use num_traits::{Num};
use rand::prelude::Distribution;
use rand::distributions::Standard;
use rand::distributions::uniform::SampleUniform;
use serde::{Serialize, Deserialize};



// Create a simple struct for an ordered Line, where a is ne of b
#[derive(Debug, Copy, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderedSegment<T>
	where T: CoordNum + Num,
{
	pub start: Coordinate<T>,
	pub end: Coordinate<T>,

	#[serde(default)]
	pub idx: usize, // needed to easily track intersections
}





impl<T> OrderedSegment<T>
	where T: CoordNum,
{
	pub fn new_with_idx<C>(start: C, end: C, idx: usize) -> OrderedSegment<T>
		where C: Into<Coordinate<T>>
	{
		let start: Coordinate<T> = start.into();
		let end: Coordinate<T> = end.into();
		let order = OrderedSegment::compare_xy(start, end);

		match order {
			Ordering::Less => Self { start, end, idx },
			Ordering::Equal => Self { start, end, idx },
			Ordering::Greater => Self { start: end, end: start, idx },
		}
	}

	pub fn new<C>(start: C, end: C) -> OrderedSegment<T>
		where C: Into<Coordinate<T>>
	{
		let start: Coordinate<T> = start.into();
		let end: Coordinate<T> = end.into();
		let order = OrderedSegment::compare_xy(start, end);
		let idx: usize = 0;

		match order {
			Ordering::Less => Self { start, end, idx },
			Ordering::Equal => Self { start, end, idx },
			Ordering::Greater => Self { start: end, end: start, idx },
		}
	}

	pub fn set_idx(&mut self, idx: usize) {
		self.idx = idx;
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
		} else if ax < bx {
			Ordering::Less

		} else {
			Ordering::Greater
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

	pub fn coordinates(&self) -> (Coordinate<T>, Coordinate<T>) {
		(self.start, self.end)
	}

	pub fn coords(&self) -> (T, T, T, T) {
		(self.start.x, self.start.y, self.end.x, self.end.y)
	}

	// use compare_xy to determine if one segment is to the left of the other
	pub fn cmp_segments(&self, other: &Self) -> Ordering {
		OrderedSegment::compare_xy(self.end, other.start)
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

impl From<OrderedSegment<f64>> for OrderedSegment<i64> {
	fn from(item: OrderedSegment<f64>) -> Self {
		let (ax, ay, bx, by) = item.coords();
		Self::new((ax.round() as i64, ay.round() as i64),
		          (bx.round() as i64, by.round() as i64))
	}
}

impl From<OrderedSegment<i64>> for OrderedSegment<f64> {
	fn from(item: OrderedSegment<i64>) -> Self {
		let (ax, ay, bx, by) = item.coords();
		Self::new((ax as f64, ay as f64), (bx as f64, by as f64))
	}
}

impl From<OrderedSegment<f64>> for OrderedSegment<i32> {
	fn from(item: OrderedSegment<f64>) -> Self {
		let (ax, ay, bx, by) = item.coords();
		Self::new((ax.round() as i32, ay.round() as i32),
		          (bx.round() as i32, by.round() as i32))
	}
}

impl From<OrderedSegment<i32>> for OrderedSegment<f64> {
	fn from(item: OrderedSegment<i32>) -> Self {
		let (ax, ay, bx, by) = item.coords();
		Self::new((ax as f64, ay as f64), (bx as f64, by as f64))
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



pub trait SimpleIntersect<B = Self> {
	fn intersects(&self, other: &B) -> bool;
	fn line_intersection(&self, other: &B) -> Option<Point<f64>>;
}

// all intersects are the same but we have not implemented orient2d for all,
// so just repeat for now
impl SimpleIntersect for OrderedSegment<f64> {
	fn intersects(&self, other: &Self) -> bool {
		let (a, b) = self.coordinates();
		let (c, d) = other.coordinates();

		let xa = a.orient2d(b, c);
		let xb = a.orient2d(b, d);

		// may intersect in an overlapping line or not intersect at all
		if xa == Orientation::Collinear && xb == Orientation::Collinear { return false; }

		let xc = c.orient2d(d, a);
		let xd = c.orient2d(d, b);

		if xa != xb && xc != xd { return true; }

		false
	}

	fn line_intersection(&self, other: &Self) -> Option<Point<f64>> {
// 		let (ax, ay, bx, by) = self.coords();
// 		let (cx, cy, dx, dy) = other.coords();
// 		println!("\nintersecting {},{}|{},{} x {},{}|{},{}", ax, ay, bx, by, cx, cy, dx, dy);


		let d1 = self.delta();
		let d2 = other.delta();

		let x_dnm = d1.y * d2.x - d2.y * d1.x;
		if x_dnm == 0. { return None; }

		let y_dnm = d1.x * d2.y - d2.x * d1.y;
		if y_dnm == 0. { return None; }

		// dbg!(x_dnm);
// 		dbg!(y_dnm);

		let a = self.start;
		let c = other.start;

		let (ax, ay) = a.x_y();
		let (cx, cy) = c.x_y();

		let x_num = ax * d1.y * d2.x - cx * d2.y * d1.x + cy * d1.x * d2.x - ay * d1.x * d2.x;
		let y_num = ay * d1.x * d2.y - cy * d2.x * d1.y + cx * d1.y * d2.y - ax * d1.y * d2.y;

		// dbg!(x_num);
// 		dbg!(y_num);
// 		println!("");

		let ratio_x = x_num / x_dnm;
		let ratio_y = y_num / y_dnm;

		Some(Point::new(ratio_x, ratio_y))
	}
}

impl SimpleIntersect for OrderedSegment<i32> {
	#[inline]
	fn intersects(&self, other: &Self) -> bool {
		let (a, b) = self.coordinates();
		let (c, d) = other.coordinates();

		let xa = a.orient2d(b, c);
		let xb = a.orient2d(b, d);

		// may intersect in an overlapping line or not intersect at all
		if xa == Orientation::Collinear && xb == Orientation::Collinear { return false; }

		let xc = c.orient2d(d, a);
		let xd = c.orient2d(d, b);

		if xa != xb && xc != xd { return true; }

		false
	}

	#[inline]
	fn line_intersection(&self, other: &Self) -> Option<Point<f64>> {
		let (ax, ay, bx, by) = self.coords();
		let (cx, cy, dx, dy) = other.coords();

		let (ax, ay) = (ax as i128, ay as i128);
		let (bx, by) = (bx as i128, by as i128);
		let (cx, cy) = (cx as i128, cy as i128);
		let (dx, dy) = (dx as i128, dy as i128);

// 		use core::num::Wrapping;
// 		let (ax, ay) = (Wrapping(ax), Wrapping(ay));
// 		let (bx, by) = (Wrapping(bx), Wrapping(by));
// 		let (cx, cy) = (Wrapping(cx), Wrapping(cy));
// 		let (dx, dy) = (Wrapping(dx), Wrapping(dy));


		// End result will be a coordinate, but with infinite lines the coordinate
		// intersection conceivably could exceed the coordinate bounds
		// cannot be infinitely large given integer coordinates.
		// instead, the largest is if one line is along the canvas border and starts
		// at the other canvas corner and moves down to the bottom corner - 1.
		// So worst case should be:
		// s0: (MIN, MIN),(MIN, MAX)
		// s1: (MAX, MIN), (MAX - 1, MAX)
		// if this were i8:
		// s0: (-128, -128), (-128, 127)
		// s1: ( 127, -128), ( 126, 127)
		// ix: (-128, 64897, t0: 255)
		// if s0: (MIN, MIN), (MIN, MIN + 1) then t0: 65025
		// so i32 to handle the coordinates

		// But—we don't actually care about intersection locations outside the bounds,
		// so we could return the max/min in that situation
		// still need to calculate it without overflow issues!

		// switch to
		// const dnm = ((d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y));
		// const t0 = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / dnm; (dist from a)
		// x: a.x + t0 * (b.x - a.x),
		// y: a.y + t0 * (b.y - a.y)

		// (assume we are unlucky and all subtractions become additions)
		// 2*MAX * 2*MAX ≈ 2^2 * 2^31 * 2^31 ≈ 2^64
		// 2^64 + 2^64 ≈ 2^1 * 2^64 ≈ 2^65 .. and now we have exceeded i64 (barely)!
		// worse, we eventually need to multiply below, so more likely to exceed t0

// 		let dnm = (dy - cy) * (bx - ax) - (dx - cx) * (by - ay);
// 		if dnm == 0 { return None; }

// 		dbg!(dnm);

		// dnm cannot be a fraction, so we know that t0 is the same or smaller magnitude than its numerator
		// but we are dividing, so we need to switch to float or use euclidean and then switch
// 		let num = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
// 		dbg!(num);

// 		let t0: f64 = (num as f64) / (dnm as f64);
// 		dbg!(t0);
//
// 		let x = ax as f64 + t0 * (bx - ax) as f64;
// 		let y = ay as f64 + t0 * (by - ay) as f64;

// 		let x = ax.saturating_add(t0.saturating_mul(bx - ax));
// 		let y = ay.saturating_add(t0.saturating_mul(by - ay));

// 		Some(Point::new(x as f64, y as f64))


		// MAX + 2^39 * (2*2^32) = not w/in i64 --> possibly over but unlikely.




// 		println!("\nintersecting {},{}|{},{} x {},{}|{},{}", ax, ay, bx, by, cx, cy, dx, dy);

		let d1x = bx - ax;
		let d1y = by - ay;
		let d2x = dx - cx;
		let d2y = dy - cy;

		let x_dnm = d1y * d2x - d2y * d1x;
		if x_dnm == 0 { return None; }

		let y_dnm = d1x * d2y - d2x * d1y;
		if y_dnm == 0 { return None; }


		// dbg!(x_dnm);
// 		dbg!(y_dnm);

		// MAX
		// d1x = 2^31 + 2^31 ≈ 2^32
		// x_num paren = (2^31 * 2^32 * 2^32) ≈ 2^95
		// x_num = 2^95 + 2^95 + 2^95 + 2^95 ≈ 2^2 * 2^95 ≈ 2^97

		// (cx * d2y + cy * d2x - ay * d2x)
		// 2^31 * 2^32 + 2^31 * 2^32 + 2^31 * 2^32 ≈ 2^63 + 2^63 + 2^63 ≈ 2^3 * 2^63 ≈ 2^66
		// 2^32 * 2^66 ≈ 2^98

		let x_num = ax * d1y * d2x - cx * d2y * d1x + cy * d1x * d2x - ay * d1x * d2x;
		let y_num = ay * d1x * d2y - cy * d2x * d1y + cx * d1y * d2y - ax * d1y * d2y;


		// d has max value of 2 * i32::MAX
		// coordinate has max value of i32::MAX
		// so a * d * d has maximum i32::MAX * 2 * i32::MAX * 2 * i32::MAX = 4 * i32::MAX ^ 3
		//

		// d1x(cx * d2y + cy * d2x - ay * d2x)
		// d1y(cx * d2x + cx * d2y - ax * d2y)
// 		let x_left = ax * d1y * d2x;
// 		let x_right_paren = cx * d2y + cy * d2x - ay * d2x;
// 		let x_right = d1x * x_right_paren;
// 		let x_num = x_left - x_right;
//
// 		let y_left = ay * d1x * d2y;
// 		let y_right_paren = cx * d2x + cx * d2y - ax * d2y;
// 		let y_right = d1y * y_right_paren;
// 		let y_num = y_left - y_right;

		// dbg!(x_num);
// 		dbg!(y_num);
// 		println!("");

		// euclid: 7 / 3 = 2 rem 1
		// convert to float: 2 + 1/3

		// euclid vs division of float: both are basically same for performance
		let quot_x = x_num.div_euclid(x_dnm);
		let rem_x = x_num.rem_euclid(x_dnm);
		let ratio_x = (quot_x as f64) + (rem_x as f64 / x_dnm as f64);

		let quot_y = y_num.div_euclid(y_dnm);
		let rem_y = y_num.rem_euclid(y_dnm);
		let ratio_y = (quot_y as f64) + (rem_y as f64 / y_dnm as f64);


// 		let ratio_x = (x_num as f64) / (x_dnm as f64);
// 		let ratio_y = (y_num as f64) / (y_dnm as f64);

		Some(Point::new(ratio_x, ratio_y))
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
	fn intersects_f64_works() {
		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
		let s2: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (3200., 1900.));
		let s3: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));

		assert!(s0.intersects(&s1));
		assert!(s0.intersects(&s2));
		assert!(!s0.intersects(&s3));
	}

	#[test]
	fn intersects_i32_works() {
		let s0: OrderedSegment<i32> = OrderedSegment::new((2300, 1900), (4200, 1900));
		let s1: OrderedSegment<i32> = OrderedSegment::new((2387, 1350), (2500, 2100));
		let s2: OrderedSegment<i32> = OrderedSegment::new((2387, 1350), (3200, 1900));
		let s3: OrderedSegment<i32> = OrderedSegment::new((2500, 2100), (2900, 2100));

		assert!(s0.intersects(&s1));
		assert!(s0.intersects(&s2));
		assert!(!s0.intersects(&s3));
	}

	#[test]
	fn intersects_i32_overflow_works() {
		let nw = (i32::MIN, i32::MIN);
		let sw = (i32::MIN, i32::MAX);
		let ne = (i32::MAX, i32::MIN);
		let se = (i32::MAX, i32::MAX);
// 		let z: (i32, i32) = (0, 0);

		let ne_sw: OrderedSegment<i32> = OrderedSegment::new(ne, sw);
		let se_nw: OrderedSegment<i32> = OrderedSegment::new(se, nw);
		let ne_nw: OrderedSegment<i32> = OrderedSegment::new(ne, nw);
		let se_sw: OrderedSegment<i32> = OrderedSegment::new(se, sw);

		assert!(ne_sw.intersects(&se_nw));
		assert!(ne_sw.intersects(&ne_nw));
		assert!(!ne_nw.intersects(&se_sw));
	}

// ---------------- SEGMENT LINE INTERSECTION
	#[test]
	fn line_intersection_f64_works() {
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
	fn line_intersection_i32_works() {
		let s0: OrderedSegment<i32> = OrderedSegment::new((2300, 1900), (4200, 1900));
		let s1: OrderedSegment<i32> = OrderedSegment::new((2387, 1350), (2500, 2100));
		let s2: OrderedSegment<i32> = OrderedSegment::new((2387, 1350), (3200, 1900));
		let s3: OrderedSegment<i32> = OrderedSegment::new((2500, 2100), (2900, 2100));

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
	fn line_intersection_i32_overflow_works() {
		let nw = (i32::MIN, i32::MIN);
		let sw = (i32::MIN, i32::MAX);
		let ne = (i32::MAX, i32::MIN);
		let se = (i32::MAX, i32::MAX);
// 		let z: (i32, i32) = (0, 0);

		let ne_sw: OrderedSegment<i32> = OrderedSegment::new(ne, sw);
		let se_nw: OrderedSegment<i32> = OrderedSegment::new(se, nw);
		let ne_nw: OrderedSegment<i32> = OrderedSegment::new(ne, nw);
		let se_sw: OrderedSegment<i32> = OrderedSegment::new(se, sw);

		let res1: Point::<f64> = Point::new(-0.5, -0.5);
		let res2: Point::<f64> = Point::new(i32::MAX.into(), i32::MIN.into());

		assert_eq!(ne_sw.line_intersection(&se_nw), Some(res1));
		assert_eq!(ne_sw.line_intersection(&ne_nw), Some(res2));
		assert_eq!(ne_nw.line_intersection(&se_sw), None);
	}

	#[test]
	fn line_intersection_i32_overflow_severe_works() {

		// s0: (MIN, MIN),(MIN, MAX)
		// s1: (MAX, MIN), (MAX - 1, MAX)
		let vert: OrderedSegment<i32> = OrderedSegment::new((i32::MIN, i32::MIN), (i32::MIN, i32::MAX));
		let near_horiz: OrderedSegment<i32> = OrderedSegment::new((i32::MAX, i32::MIN), (i32::MAX - 1, i32::MAX));

		let res1: Point::<f64> = Point::new(-2147483648., 18446744062972133000.);

		assert_eq!(vert.line_intersection(&near_horiz), Some(res1));
	}
}
