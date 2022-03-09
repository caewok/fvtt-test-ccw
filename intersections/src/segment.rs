use geo::{CoordNum, Point, Coordinate};
use geo::algorithm::kernels::Orientation;
use crate::point::{orient2d};
use std::cmp::Ordering;
use num_traits::{Signed, Num};

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


pub trait SimpleIntersect<T: CoordNum, B = Self>
	where T: CoordNum
{
	fn intersects(&self, other: &B) -> bool;
	fn line_intersection(&self, other: &B) -> Option<Point<T>>;
}

impl<T: CoordNum + Signed> SimpleIntersect<T> for OrderedSegment<T> {
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

	fn line_intersection(&self, other: &Self) -> Option<Point<T>> {
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

		let x: f64 = x_num.into();
		let y: f64 = y_num.into();

// 		let x:f64 = x_num as f64 / x_dnm as f64;
// 		let y:f64 = y_num as f64 / y_dnm as f64;

		if (x == (x as T) as f64) &&
		   (y == (y as T) as f64) {
			return Some(Point::new(x_num / x_dnm, y_num / y_dnm));
		   }

		let x = x.round();
		let y = y.round();
		Some(Point::new(x as T, y as T))
	}

}