use geo::{CoordNum, Point, Coordinate};
// use crate::point::{orient2d};
use std::cmp::Ordering;

// Create a simple struct for an ordered Line, where a is ne of b
#[derive(Debug, Copy, Clone, PartialEq)]
pub struct OrderedSegment<T>
	where T: CoordNum,
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

//
// pub trait SimpleIntersect<B = Self> {
// 	fn intersects(&self, other: &B) -> bool;
// 	fn line_intersection(&self, other: &B) -> Option<PointFloat>;
// }
//
// impl<T> SimpleIntersect for OrderedSegment<T> {
// 	fn intersects(&self, other: &Self) -> bool {
// 		let (a, b) = self.points();
// 		let (c, d) = other.points();
//
// 		let xa = orient2d(a, b, c);
//
// 	}
//
// }