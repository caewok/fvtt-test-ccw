use geo::{Point, CoordNum};
use crate::segment::{OrderedSegment, SimpleIntersect};
use num_traits::{Signed};
use serde_json;
use std::fs;

extern crate test;
use test::Bencher;

#[derive(Debug, PartialEq)]
pub struct IxResultFloat {
	pub ix: Point<f64>,
// 	pub s1: <u64>,
// 	pub s2: <u64>,
}

#[derive(Debug, PartialEq)]
pub struct IxResult<T>
	where T: CoordNum,
{
	pub ix: Point<T>,
// 	pub s1: <u64>,
// 	pub s2: <u64>,
}

// Need enum to store different IxResults
// #[derive(Debug, PartialEq)]
// pub enum IxResultEnum {
// 	Float(IxResult<f64>),
// 	Int(IxResult<i64>),
// }

pub fn ix_brute_single<T: 'static>(segments: &[OrderedSegment<T>]) -> Vec<IxResultFloat>
	where T: CoordNum + Signed,
{
		let mut ixs: Vec<IxResultFloat> = Vec::new();
		for(i, si) in segments.iter().enumerate() {
			for sj in &segments[(i + 1)..] {
				if !si.intersects(&sj) { continue; }
				let res = si.line_intersection(&sj);
				if let Some(ix) = res {
					ixs.push( IxResultFloat {
						ix,
					});
				}
			}
		}

		ixs
}

pub fn ix_brute_double<T: 'static>(segments1: &[OrderedSegment<T>], segments2: &[OrderedSegment<T>]) -> Vec<IxResultFloat>
	where T: CoordNum + Signed,
{
	let mut ixs: Vec<IxResultFloat> = Vec::new();
	for si in segments1 {
		for sj in segments2 {
			if !si.intersects(&sj) { continue; }
			let res = si.line_intersection(&sj);

			if let Some(ix) = res {
				ixs.push( IxResultFloat {
					ix,
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

pub fn ix_sort_single<T: 'static>(segments: &mut [OrderedSegment<T>]) -> Vec<IxResultFloat>
	where T: CoordNum + Signed,
{
	segments.sort_unstable_by(|a, b| a.cmp_segments(&b));

	let mut ixs: Vec<IxResultFloat> = Vec::new();
	for(i, si) in segments.iter().enumerate() {
		for (j, sj) in (&segments[(i + 1)..]).iter().enumerate() {
			// if we have not yet reached the left end, we can skip
			if sj.is_left(&si) { continue; }

			// if we reach the right end, we can skip the rest
			if sj.is_right(&si) { break; }

			if !si.intersects(&sj) { continue; }
			let res = si.line_intersection(&sj);
			if let Some(ix) = res {
				ixs.push( IxResultFloat {
					ix,
				});
			}
		}
	}

	ixs
}

pub fn ix_sort_double<T: 'static>(segments1: &mut [OrderedSegment<T>], segments2: &mut [OrderedSegment<T>]) -> Vec<IxResultFloat>
	where T: CoordNum + Signed,
{
	segments1.sort_unstable_by(|a, b| a.cmp_segments(&b));
	segments2.sort_unstable_by(|a, b| a.cmp_segments(&b));

	let mut ixs: Vec<IxResultFloat> = Vec::new();
	for (i, si) in segments1.iter().enumerate() {
		for (j, sj) in segments2.iter().enumerate() {
			// if we have not yet reached the left end, we can skip
			if sj.is_left(&si) { continue; }

			// if we reach the right end, we can skip the rest
			if sj.is_right(&si) { break; }

			if !si.intersects(&sj) { continue; }
			let res = si.line_intersection(&sj);

			if let Some(ix) = res {
				ixs.push( IxResultFloat {
					ix,
				});
			}
		}
	}

	ixs
}

struct BenchSegmentInt {
	x10_0: Vec<OrderedSegment<i64>>,
	x100_0: Vec<OrderedSegment<i64>>,
	x1000_0: Vec<OrderedSegment<i64>>,

	x10_1: Vec<OrderedSegment<i64>>,
	x100_1: Vec<OrderedSegment<i64>>,
	x1000_1: Vec<OrderedSegment<i64>>,
}

struct BenchSegmentFloat {
	x10_0: Vec<OrderedSegment<f64>>,
	x100_0: Vec<OrderedSegment<f64>>,
	x1000_0: Vec<OrderedSegment<f64>>,

	x10_1: Vec<OrderedSegment<f64>>,
	x100_1: Vec<OrderedSegment<f64>>,
	x1000_1: Vec<OrderedSegment<f64>>,
}

struct BenchSetup {
	int: BenchSegmentInt,
	float: BenchSegmentFloat,
}

impl BenchSetup {
	fn new() -> Self {
		// the copy versions have start/end
		let str10_1 = fs::read_to_string("segments_random_10_1000_neg1 copy.json").unwrap();
		let str10_2 = fs::read_to_string("segments_random_10_1000_neg2 copy.json").unwrap();
		let str100_1 = fs::read_to_string("segments_random_100_2000_neg1 copy.json").unwrap();
		let str100_2 = fs::read_to_string("segments_random_100_2000_neg2 copy.json").unwrap();
		let str1000_1 = fs::read_to_string("segments_random_1000_4000_neg1 copy.json").unwrap();
		let str1000_2 = fs::read_to_string("segments_random_1000_4000_neg2 copy.json").unwrap();

		let f = BenchSegmentFloat {
			x10_0: serde_json::from_str(&str10_1).unwrap(),
			x100_0: serde_json::from_str(&str10_2).unwrap(),
			x1000_0: serde_json::from_str(&str100_1).unwrap(),

			x10_1: serde_json::from_str(&str100_2).unwrap(),
			x100_1: serde_json::from_str(&str1000_1).unwrap(),
			x1000_1: serde_json::from_str(&str1000_2).unwrap(),
		};

		let i = BenchSegmentInt {
			x10_0: f.x10_0.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
			x100_0: f.x100_0.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
			x1000_0: f.x1000_0.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),

			x10_1: f.x10_1.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
			x100_1: f.x100_1.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
			x1000_1: f.x1000_1.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
		};

		BenchSetup {
			int: i,
			float: f,
		}
	}
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
		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
		let s2: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));

		let segments = vec![s0, s1, s2];
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
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
		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
		let s2: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));

		let segments = vec![s0, s1, s2];
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
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
		let s0: OrderedSegment<i64> = OrderedSegment::new((2300, 1900), (4200, 1900));
		let s1: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (2500, 2100));
		let s2: OrderedSegment<i64> = OrderedSegment::new((2500, 2100), (2900, 2100));

		let segments = vec![s0, s1, s2];
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
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
		let s0: OrderedSegment<i64> = OrderedSegment::new((2300, 1900), (4200, 1900));
		let s1: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (2500, 2100));
		let s2: OrderedSegment<i64> = OrderedSegment::new((2500, 2100), (2900, 2100));

		let segments = vec![s0, s1, s2];
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
			},
		];

		let ixs = ix_brute_double(&segments, &segments);
		assert_eq!(ixs, res);
	}

// ---------------- BRUTE MIXED
// 	#[test]
// 	fn brute_single_mixed_float_works() {
// 		// s0|s1 intersect
// 		// s0|s2 do not intersect
// 		// s1|s2 intersect at endpoint
// 		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
// 		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
// 		let s2: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));
//
// 		let segments = vec![s0, s1, s2];
// 		let res = vec![
// 			IxResult {
// 				ix: Point::<f64>::new(2469.866666666667, 1900.),
// 			},
// 			IxResult {
// 				ix: Point::<i64>::new(2500, 2100),
// 			},
// 		];
//
// 		let ixs = ix_brute_single_mixed(&segments);
// 		assert_eq!(ixs, res);
// 	}
//
// 	#[test]
// 	fn brute_double_mixed_float_works() {
// 		// s0|s1 intersect
// 		// s0|s2 do not intersect
// 		// s1|s2 intersect at endpoint
// 		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
// 		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
// 		let s2: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));
//
// 		let segments = vec![s0, s1, s2];
// 		let res = vec![
// 			IxResult {
// 				ix: Point::<f64>::new(2469.866666666667, 1900.),
// 			},
// 			IxResult {
// 				ix: Point::<f64>::new(2469.866666666667, 1900.),
// 			},
// 			IxResult {
// 				ix: Point::<i64>::new(2500, 2100),
// 			},
// 			IxResult {
// 				ix: Point::<i64>::new(2500, 2100),
// 			},
// 		];
//
// 		let ixs = ix_brute_double_mixed(&segments, &segments);
// 		assert_eq!(ixs, res);
// 	}
//
// 	#[test]
// 	fn brute_single_mixed_int_works() {
// 		// s0|s1 intersect
// 		// s0|s2 do not intersect
// 		// s1|s2 intersect at endpoint
// 		let s0: OrderedSegment<i64> = OrderedSegment::new((2300, 1900), (4200, 1900));
// 		let s1: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (2500, 2100));
// 		let s2: OrderedSegment<i64> = OrderedSegment::new((2500, 2100), (2900, 2100));
//
// 		let segments = vec![s0, s1, s2];
// 		let res = vec![
// 			IxResult {
// 				ix: Point::<f64>::new(2469.866666666667, 1900.),
// 			},
// 			IxResult {
// 				ix: Point::<i64>::new(2500, 2100),
// 			},
// 		];
//
// 		let ixs = ix_brute_single_mixed(&segments);
// 		assert_eq!(ixs, res);
// 	}
//
// 	#[test]
// 	fn brute_double_mixed_int_works() {
// 		// s0|s1 intersect
// 		// s0|s2 do not intersect
// 		// s1|s2 intersect at endpoint
// 		let s0: OrderedSegment<i64> = OrderedSegment::new((2300, 1900), (4200, 1900));
// 		let s1: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (2500, 2100));
// 		let s2: OrderedSegment<i64> = OrderedSegment::new((2500, 2100), (2900, 2100));
//
// 		let segments = vec![s0, s1, s2];
// 		let res = vec![
// 			IxResult {
// 				ix: Point::<f64>::new(2469.866666666667, 1900.),
// 			},
// 			IxResult {
// 				ix: Point::<f64>::new(2469.866666666667, 1900.),
// 			},
// 			IxResult {
// 				ix: Point::<i64>::new(2500, 2100),
// 			},
// 			IxResult {
// 				ix: Point::<i64>::new(2500, 2100),
// 			},
// 		];
//
// 		let ixs = ix_brute_double_mixed(&segments, &segments);
// 		assert_eq!(ixs, res);
// 	}

// ---------------- SORT
	#[test]
	fn sort_single_float_works() {
		// s0|s1 intersect
		// s0|s2 do not intersect
		// s1|s2 intersect at endpoint
		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
		let s2: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));

		let mut segments = vec![s0, s1, s2];
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
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
		let s0: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
		let s1: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));
		let s2: OrderedSegment<f64> = OrderedSegment::new((2500., 2100.), (2900., 2100.));

		let mut segments1 = vec![s0, s1, s2];
		let mut segments2 = segments1.clone();
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
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
		let s0: OrderedSegment<i64> = OrderedSegment::new((2300, 1900), (4200, 1900));
		let s1: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (2500, 2100));
		let s2: OrderedSegment<i64> = OrderedSegment::new((2500, 2100), (2900, 2100));

		let mut segments = vec![s0, s1, s2];
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
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
		let s0: OrderedSegment<i64> = OrderedSegment::new((2300, 1900), (4200, 1900));
		let s1: OrderedSegment<i64> = OrderedSegment::new((2387, 1350), (2500, 2100));
		let s2: OrderedSegment<i64> = OrderedSegment::new((2500, 2100), (2900, 2100));

		let mut segments1 = vec![s0, s1, s2];
		let mut segments2 = segments1.clone();
		let res = vec![
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2469.866666666667, 1900.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
			},
			IxResultFloat {
				ix: Point::new(2500., 2100.),
			},
		];

		let ixs = ix_sort_double(&mut segments1, &mut segments2);
		assert_eq!(ixs, res);
	}

// ---------------- BENCHMARKING

// ---------------- BENCHMARK BRUTE INTEGER VERSIONS

	// #[bench]
// 	fn bench_10_single_int_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_single(&setup.int.x10_0));
// 	}
//
// 	#[bench]
// 	fn bench_100_single_int_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_single(&setup.int.x100_0));
// 	}
//
// 	#[bench]
// 	fn bench_1000_single_int_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_single(&setup.int.x1000_0));
// 	}
//
// 	#[bench]
// 	fn bench_10_double_int_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_double(&setup.int.x10_0, &setup.int.x10_1));
// 	}
//
// 	#[bench]
// 	fn bench_100_double_int_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_double(&setup.int.x100_0, &setup.int.x100_1));
// 	}
//
// 	#[bench]
// 	fn bench_1000_double_int_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_double(&setup.int.x1000_0, &setup.int.x1000_1));
// 	}
//
// // ---------------- BENCHMARK BRUTE FLOAT VERSIONS
// 	#[bench]
// 	fn bench_10_single_float_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_single(&setup.float.x10_0));
// 	}
//
// 	#[bench]
// 	fn bench_100_single_float_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_single(&setup.float.x100_0));
// 	}
//
// 	#[bench]
// 	fn bench_1000_single_float_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_single(&setup.float.x1000_0));
// 	}
//
// 	#[bench]
// 	fn bench_10_double_float_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_double(&setup.float.x10_0, &setup.float.x10_1));
// 	}
//
// 	#[bench]
// 	fn bench_100_double_float_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_double(&setup.float.x100_0, &setup.float.x100_1));
// 	}
//
// 	#[bench]
// 	fn bench_1000_double_float_brute(b: &mut Bencher) {
// 		let setup = BenchSetup::new();
// 		b.iter(|| ix_brute_double(&setup.float.x1000_0, &setup.float.x1000_1));
// 	}
//
// // ---------------- BENCHMARK SORT INTEGER VERSIONS
//
// 	#[bench]
// 	fn bench_10_single_int_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_single(&mut setup.int.x10_0));
// 	}
//
// 	#[bench]
// 	fn bench_100_single_int_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_single(&mut setup.int.x100_0));
// 	}
//
// 	#[bench]
// 	fn bench_1000_single_int_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_single(&mut setup.int.x1000_0));
// 	}
//
// 	#[bench]
// 	fn bench_10_double_int_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_double(&mut setup.int.x10_0, &mut setup.int.x10_1));
// 	}
//
// 	#[bench]
// 	fn bench_100_double_int_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_double(&mut setup.int.x100_0, &mut setup.int.x100_1));
// 	}
//
// 	#[bench]
// 	fn bench_1000_double_int_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_double(&mut setup.int.x1000_0, &mut setup.int.x1000_1));
// 	}
//
// // ---------------- BENCHMARK SORT FLOAT VERSIONS
//
// 	#[bench]
// 	fn bench_10_single_float_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_single(&mut setup.float.x10_0));
// 	}
//
// 	#[bench]
// 	fn bench_100_single_float_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_single(&mut setup.float.x100_0));
// 	}
//
// 	#[bench]
// 	fn bench_1000_single_float_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_single(&mut setup.float.x1000_0));
// 	}
//
// 	#[bench]
// 	fn bench_10_double_float_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_double(&mut setup.float.x10_0, &mut setup.float.x10_1));
// 	}
//
// 	#[bench]
// 	fn bench_100_double_float_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_double(&mut setup.float.x100_0, &mut setup.float.x100_1));
// 	}
//
// 	#[bench]
// 	fn bench_1000_double_float_sort(b: &mut Bencher) {
// 		let mut setup = BenchSetup::new();
// 		b.iter(|| ix_sort_double(&mut setup.float.x1000_0, &mut setup.float.x1000_1));
// 	}

}