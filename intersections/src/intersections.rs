use geo::{Point, CoordNum};
use crate::segment::{OrderedSegment, SimpleIntersect};
use num_traits::{Signed};

#[derive(Debug, PartialEq)]
pub struct IxResultFloat {
	pub ix: Point<f64>,
}

// Need enum to store different IxResults
// #[derive(Debug, PartialEq)]
// pub enum IxResultEnum {
// 	Float(IxResult<f64>),
// 	Int(IxResult<i64>),
// }

// 2D vector to store intersections
// assumes same number of rows and columns
// Keeping it simple by forcing it to be a specific type.
// https://stackoverflow.com/questions/50100202/how-can-i-conveniently-convert-a-2-dimensional-array-into-a-2-dimensional-vector
#[derive(Debug, PartialEq)]
pub struct Vec2d
{
	n_row: usize,
	n_col: usize,
	data: Vec<Option<Point<f64>>>,
}


impl Vec2d {
	fn new(n_row: usize, n_col: usize) -> Self {
		// fill with None
		let data = vec![None; n_col * n_row];
		Vec2d {
			n_col,
			n_row,
			data,
		}
	}

	fn get(&self, row: usize, col: usize) -> &Option<Point<f64>> {
		assert!(row < self.n_row);
		assert!(col < self.n_col);
		&self.data[row * self.n_row + col]
	}

	fn set(&mut self, row: usize, col: usize, data: Option<Point<f64>>) {
		assert!(row < self.n_row);
		assert!(col < self.n_col);
		self.data[row * self.n_row + col] = data;
	}
}

pub fn ix_brute_single<T>(segments: &[OrderedSegment<T>]) -> Vec2d
	where T: CoordNum + Signed,
{
	let s_ln = segments.len();
	let mut ixs = Vec2d::new(s_ln, s_ln);
	for(i, si) in segments.iter().enumerate() {
		for sj in &segments[(i + 1)..] {
			if !si.intersects(sj) { continue; }
			let res = si.line_intersection(sj);
			ixs.set(si.idx, sj.idx, res);
		}
	}

	ixs
}

pub fn ix_brute_double<T>(segments1: &[OrderedSegment<T>], segments2: &[OrderedSegment<T>]) -> Vec2d
	where T: CoordNum + Signed,
{
	let s1_ln = segments1.len();
	let s2_ln = segments2.len();
	let mut ixs = Vec2d::new(s1_ln, s2_ln);
	for si in segments1 {
		for sj in segments2 {
			if !si.intersects(sj) { continue; }
			let res = si.line_intersection(sj);
			ixs.set(si.idx, sj.idx, res);
		}
	}

	ixs
}

pub fn ix_sort_single<T>(segments: &mut [OrderedSegment<T>]) -> Vec2d
	where T: CoordNum + Signed,
{
	segments.sort_unstable_by(|a, b| a.cmp_segments(b));
	let segments = segments; // no longer need mutability

	let s_ln = segments.len();
	let mut ixs = Vec2d::new(s_ln, s_ln);

	for(i, si) in segments.iter().enumerate() {
		for sj in &segments[(i + 1)..] {
			// if we have not yet reached the left end, we can skip
			if sj.is_left(si) { continue; }

			// if we reach the right end, we can skip the rest
			if sj.is_right(si) { break; }

			if !si.intersects(sj) { continue; }
			let res = si.line_intersection(sj);
			ixs.set(si.idx, sj.idx, res);
		}
	}

	ixs
}

pub fn ix_sort_double<T>(segments1: &mut [OrderedSegment<T>], segments2: &mut [OrderedSegment<T>]) -> Vec2d
	where T: CoordNum + Signed,
{
	segments1.sort_unstable_by(|a, b| a.cmp_segments(b));
	segments2.sort_unstable_by(|a, b| a.cmp_segments(b));

	// no longer need mutability after the sort
	let segments1 = segments1;
	let segments2 = segments2;

	let s1_ln = segments1.len();
	let s2_ln = segments2.len();
	let mut ixs = Vec2d::new(s1_ln, s2_ln);

	for si in segments1 {
		for sj in &mut *segments2 {
			// if we have not yet reached the left end, we can skip
			if sj.is_left(si) { continue; }

			// if we reach the right end, we can skip the rest
			if sj.is_right(si) { break; }

			if !si.intersects(sj) { continue; }
			let res = si.line_intersection(sj);
			ixs.set(si.idx, sj.idx, res);
		}
	}

	ixs
}

#[cfg(test)]
mod tests {
	use super::*;

// ---------------- BENCHMARK FLOAT VERSIONS

// ---------------- TESTING

// ---------------- BRUTE
	#[test]
	fn brute_single_float_works() {
		// s0|s1 intersect
		// s0|s2 do not intersect
		// s1|s2 intersect at endpoint
		let s0: OrderedSegment<f64> = OrderedSegment::new_with_idx((2300., 1900.), (4200., 1900.), 0);
		let s1: OrderedSegment<f64> = OrderedSegment::new_with_idx((2387., 1350.), (2500., 2100.), 1);
		let s2: OrderedSegment<f64> = OrderedSegment::new_with_idx((2500., 2100.), (2900., 2100.), 2);

		let segments = vec![s0, s1, s2];
		let mut res = Vec2d::new(3,3);
		res.set(0,1, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,2, Some(Point::new(2500., 2100.)));

		let ixs = ix_brute_single(&segments);
		assert_eq!(ixs, res);
	}

	#[test]
	fn brute_double_float_works() {
		// s0|s1 intersect
		// s0|s2 do not intersect
		// s1|s2 intersect at endpoint
		let s0: OrderedSegment<f64> = OrderedSegment::new_with_idx((2300., 1900.), (4200., 1900.), 0);
		let s1: OrderedSegment<f64> = OrderedSegment::new_with_idx((2387., 1350.), (2500., 2100.), 1);
		let s2: OrderedSegment<f64> = OrderedSegment::new_with_idx((2500., 2100.), (2900., 2100.), 2);

		let segments = vec![s0, s1, s2];
		let mut res = Vec2d::new(3,3);
		res.set(0,1, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,0, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,2, Some(Point::new(2500., 2100.)));
		res.set(2,1, Some(Point::new(2500., 2100.)));

		let ixs = ix_brute_double(&segments, &segments);
		assert_eq!(ixs, res);
	}

	#[test]
	fn brute_single_int_works() {
		// s0|s1 intersect
		// s0|s2 do not intersect
		// s1|s2 intersect at endpoint
		let s0: OrderedSegment<i64> = OrderedSegment::new_with_idx((2300, 1900), (4200, 1900), 0);
		let s1: OrderedSegment<i64> = OrderedSegment::new_with_idx((2387, 1350), (2500, 2100), 1);
		let s2: OrderedSegment<i64> = OrderedSegment::new_with_idx((2500, 2100), (2900, 2100), 2);

		let segments = vec![s0, s1, s2];
		let mut res = Vec2d::new(3,3);
		res.set(0,1, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,2, Some(Point::new(2500., 2100.)));

		let ixs = ix_brute_single(&segments);
		assert_eq!(ixs, res);
	}

	#[test]
	fn brute_double_int_works() {
		// s0|s1 intersect
		// s0|s2 do not intersect
		// s1|s2 intersect at endpoint
		let s0: OrderedSegment<i64> = OrderedSegment::new_with_idx((2300, 1900), (4200, 1900), 0);
		let s1: OrderedSegment<i64> = OrderedSegment::new_with_idx((2387, 1350), (2500, 2100), 1);
		let s2: OrderedSegment<i64> = OrderedSegment::new_with_idx((2500, 2100), (2900, 2100), 2);

		let segments = vec![s0, s1, s2];
		let mut res = Vec2d::new(3,3);
		res.set(0,1, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,0, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,2, Some(Point::new(2500., 2100.)));
		res.set(2,1, Some(Point::new(2500., 2100.)));

		let ixs = ix_brute_double(&segments, &segments);
		assert_eq!(ixs, res);
	}


// ---------------- SORT
	#[test]
	fn sort_single_float_works() {
		// s0|s1 intersect
		// s0|s2 do not intersect
		// s1|s2 intersect at endpoint
		let s0: OrderedSegment<f64> = OrderedSegment::new_with_idx((2300., 1900.), (4200., 1900.), 0);
		let s1: OrderedSegment<f64> = OrderedSegment::new_with_idx((2387., 1350.), (2500., 2100.), 1);
		let s2: OrderedSegment<f64> = OrderedSegment::new_with_idx((2500., 2100.), (2900., 2100.), 2);

		let mut segments = vec![s0, s1, s2];
		let mut res = Vec2d::new(3,3);
		res.set(0,1, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,2, Some(Point::new(2500., 2100.)));

		let ixs = ix_sort_single(&mut segments);
		assert_eq!(ixs, res);
	}

	#[test]
	fn sort_double_float_works() {
		// s0|s1 intersect
		// s0|s2 do not intersect
		// s1|s2 intersect at endpoint
		let s0: OrderedSegment<f64> = OrderedSegment::new_with_idx((2300., 1900.), (4200., 1900.), 0);
		let s1: OrderedSegment<f64> = OrderedSegment::new_with_idx((2387., 1350.), (2500., 2100.), 1);
		let s2: OrderedSegment<f64> = OrderedSegment::new_with_idx((2500., 2100.), (2900., 2100.), 2);

		let mut segments1 = vec![s0, s1, s2];
		let mut segments2 = segments1.clone();
		let mut res = Vec2d::new(3,3);
		res.set(0,1, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,0, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,2, Some(Point::new(2500., 2100.)));
		res.set(2,1, Some(Point::new(2500., 2100.)));
		let ixs = ix_sort_double(&mut segments1, &mut segments2);
		assert_eq!(ixs, res);
	}

	#[test]
	fn sort_single_int_works() {
		// s0|s1 intersect
		// s0|s2 do not intersect
		// s1|s2 intersect at endpoint
		let s0: OrderedSegment<i64> = OrderedSegment::new_with_idx((2300, 1900), (4200, 1900), 0);
		let s1: OrderedSegment<i64> = OrderedSegment::new_with_idx((2387, 1350), (2500, 2100), 1);
		let s2: OrderedSegment<i64> = OrderedSegment::new_with_idx((2500, 2100), (2900, 2100), 2);

		let mut segments = vec![s0, s1, s2];
		let mut res = Vec2d::new(3,3);
		res.set(0,1, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,2, Some(Point::new(2500., 2100.)));

		let ixs = ix_sort_single(&mut segments);
		assert_eq!(ixs, res);
	}

	#[test]
	fn sort_double_int_works() {
		// s0|s1 intersect
		// s0|s2 do not intersect
		// s1|s2 intersect at endpoint
		let s0: OrderedSegment<i64> = OrderedSegment::new_with_idx((2300, 1900), (4200, 1900), 0);
		let s1: OrderedSegment<i64> = OrderedSegment::new_with_idx((2387, 1350), (2500, 2100), 1);
		let s2: OrderedSegment<i64> = OrderedSegment::new_with_idx((2500, 2100), (2900, 2100), 2);

		let mut segments1 = vec![s0, s1, s2];
		let mut segments2 = segments1.clone();
		let mut res = Vec2d::new(3,3);
		res.set(0,1, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,0, Some(Point::new(2469.866666666667, 1900.)));
		res.set(1,2, Some(Point::new(2500., 2100.)));
		res.set(2,1, Some(Point::new(2500., 2100.)));

		let ixs = ix_sort_double(&mut segments1, &mut segments2);
		assert_eq!(ixs, res);
	}

}