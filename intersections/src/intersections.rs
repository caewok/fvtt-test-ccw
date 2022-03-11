use geo::{Point, CoordNum};
use crate::segment::{OrderedSegment, SimpleIntersect};
use num_traits::{Signed};

#[derive(Debug, PartialEq)]
pub struct IxResultFloat {
	pub ix: Point<f64>,
	pub idx1: usize,
	pub idx2: usize,
}

// Need enum to store different IxResults
// #[derive(Debug, PartialEq)]
// pub enum IxResultEnum {
// 	Float(IxResult<f64>),
// 	Int(IxResult<i64>),
// }

pub fn ix_brute_single<T>(segments: &[OrderedSegment<T>]) -> Vec<IxResultFloat>
	where T: CoordNum + Signed,
{
		let mut ixs: Vec<IxResultFloat> = Vec::new();
		for(i, si) in segments.iter().enumerate() {
			for sj in &segments[(i + 1)..] {
				if !si.intersects(sj) { continue; }
				let res = si.line_intersection(sj);
				if let Some(ix) = res {
					ixs.push( IxResultFloat {
						ix,
						idx1: si.idx,
						idx2: sj.idx,
					});
				}
			}
		}

		ixs
}

pub fn ix_brute_double<T>(segments1: &[OrderedSegment<T>], segments2: &[OrderedSegment<T>]) -> Vec<IxResultFloat>
	where T: CoordNum + Signed,
{
	let mut ixs: Vec<IxResultFloat> = Vec::new();
	for si in segments1 {
		for sj in segments2 {
			if !si.intersects(sj) { continue; }
			let res = si.line_intersection(sj);

			if let Some(ix) = res {
				ixs.push( IxResultFloat {
					ix,
					idx1: si.idx,
					idx2: sj.idx,
				});
			}
		}
	}

	ixs
}

// pub fn ix_brute_single_mixed<T: 'static>(segments: &Vec<OrderedSegment<T>>) -> Vec<IxResultEnum>
// 	where T: CoordNum + Signed,
// {
// 		let mut ixs: Vec<IxResult<T>> = Vec::new();
// 		for(i, si) in segments.iter().enumerate() {
// 			for sj in &segments[(i + 1)..] {
// 				if !si.intersects(&sj) { continue; }
// 				let res = si.line_intersection_mixed(&sj);
// 				if let Some(ix) = res {
// 					ixs.push(
// 						IxResultEnum(
// 							IxResult {
// 								ix,
// 							}
// 						)
// 					);
// 				}
// 			}
// 		}
//
// 		ixs
// }
//
// pub fn ix_brute_double_mixed<T: 'static>(segments1: &Vec<OrderedSegment<T>>, segments2: &Vec<OrderedSegment<T>>) -> Vec<IxResultEnum>
// 	where T: CoordNum + Signed,
// {
// 	let mut ixs: Vec<IxResult<T>> = Vec::new();
// 	for si in segments1 {
// 		for sj in segments2 {
// 			if !si.intersects(&sj) { continue; }
// 			let res = si.line_intersection_mixed(&sj);
//
// 			if let Some(ix) = res {
// 				ixs.push(
// 					IxResultEnum(
// 						IxResult {
// 							ix,
// 						}
// 					)
// 				);
// 			}
// 		}
// 	}
//
// 	ixs
// }

pub fn ix_sort_single<T>(segments: &mut [OrderedSegment<T>]) -> Vec<IxResultFloat>
	where T: CoordNum + Signed,
{
	segments.sort_unstable_by(|a, b| a.cmp_segments(b));
	let segments = segments; // no longer need mutability

	let mut ixs: Vec<IxResultFloat> = Vec::new();
	for(i, si) in segments.iter().enumerate() {
		for sj in &segments[(i + 1)..] {
			// if we have not yet reached the left end, we can skip
			if sj.is_left(si) { continue; }

			// if we reach the right end, we can skip the rest
			if sj.is_right(si) { break; }

			if !si.intersects(sj) { continue; }
			let res = si.line_intersection(sj);
			if let Some(ix) = res {
				ixs.push( IxResultFloat {
					ix,
					idx1: si.idx,
					idx2: sj.idx,
				});
			}
		}
	}

	ixs
}

pub fn ix_sort_double<T>(segments1: &mut [OrderedSegment<T>], segments2: &mut [OrderedSegment<T>]) -> Vec<IxResultFloat>
	where T: CoordNum + Signed,
{
	segments1.sort_unstable_by(|a, b| a.cmp_segments(b));
	segments2.sort_unstable_by(|a, b| a.cmp_segments(b));

	// no longer need mutability after the sort
	let segments1 = segments1;
	let segments2 = segments2;

	let mut ixs: Vec<IxResultFloat> = Vec::new();
	for si in segments1 {
		for sj in &mut *segments2 {
			// if we have not yet reached the left end, we can skip
			if sj.is_left(si) { continue; }

			// if we reach the right end, we can skip the rest
			if sj.is_right(si) { break; }

			if !si.intersects(sj) { continue; }
			let res = si.line_intersection(sj);

			if let Some(ix) = res {
				ixs.push( IxResultFloat {
					ix,
					idx1: si.idx,
					idx2: sj.idx
				});
			}
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
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 0,
				idx2: 1,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 1,
				idx2: 2,
			},
		];

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
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 0,
				idx2: 1,
			},
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 1,
				idx2: 0,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 1,
				idx2: 2,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 2,
				idx2: 1,
			},
		];

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
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 0,
				idx2: 1,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 1,
				idx2: 2,
			},
		];

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
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 0,
				idx2: 1,
			},
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 1,
				idx2: 0,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 1,
				idx2: 2,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 2,
				idx2: 1,
			},
		];

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
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 0,
				idx2: 1,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 1,
				idx2: 2,
			},
		];

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
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 0,
				idx2: 1,
			},
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 1,
				idx2: 0,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 1,
				idx2: 2,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 2,
				idx2: 1,
			},
		];

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
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 0,
				idx2: 1,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 1,
				idx2: 2,
			},
		];

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
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 0,
				idx2: 1,
			},
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
				idx1: 1,
				idx2: 0,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 1,
				idx2: 2,
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
				idx1: 2,
				idx2: 1,
			},
		];

		let ixs = ix_sort_double(&mut segments1, &mut segments2);
		assert_eq!(ixs, res);
	}

}