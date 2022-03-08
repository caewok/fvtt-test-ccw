// Benchmark intersections
// run using cargo +nightly bench

use crate::segment::{ Segment, SegmentFloat, SegmentInt };
use std::fs;
use serde_json;

struct BenchInt {
	x10: [ Vec<Segment>; 2 ],
	x100: [ Vec<Segment>; 2 ],
	x1000: [ Vec<Segment>; 2 ],
}

struct BenchFloat {
	x10: [ Vec<Segment>; 2 ],
	x100: [ Vec<Segment>; 2 ],
	x1000: [ Vec<Segment>; 2 ],
}


struct BenchSetup {
	int: BenchInt,
	float: BenchFloat,
}

impl BenchSetup {
	fn new() -> Self {
		let str10_1 = fs::read_to_string("segments_random_10_1000_neg1.json").unwrap();
		let str10_2 = fs::read_to_string("segments_random_10_1000_neg2.json").unwrap();
		let str100_1 = fs::read_to_string("segments_random_100_2000_neg1.json").unwrap();
		let str100_2 = fs::read_to_string("segments_random_100_2000_neg2.json").unwrap();
		let str1000_1 = fs::read_to_string("segments_random_1000_4000_neg1.json").unwrap();
		let str1000_2 = fs::read_to_string("segments_random_1000_4000_neg2.json").unwrap();


		let segments_10_1: Vec<SegmentFloat> = serde_json::from_str(&str10_1).unwrap();
		let segments_10_2: Vec<SegmentFloat> = serde_json::from_str(&str10_1).unwrap();
		let segments_100_1: Vec<SegmentFloat> = serde_json::from_str(&str10_1).unwrap();
		let segments_100_2: Vec<SegmentFloat> = serde_json::from_str(&str10_1).unwrap();
		let segments_1000_1: Vec<SegmentFloat> = serde_json::from_str(&str10_1).unwrap();
		let segments_1000_1: Vec<SegmentFloat> = serde_json::from_str(&str10_1).unwrap();

		Self {
			int: BenchInt {
				x10: [
					segments_10_1.clone().iter().map(|s| Segment::Int(SegmentInt::from(*s))).collect(),
					segments_10_1.clone().iter().map(|s| Segment::Int(SegmentInt::from(*s))).collect(),
				],

				x100: [
					segments_100_1.clone().iter().map(|s| Segment::Int(SegmentInt::from(*s))).collect(),
					segments_100_1.clone().iter().map(|s| Segment::Int(SegmentInt::from(*s))).collect(),
				],

				x1000: [
					segments_1000_1.clone().iter().map(|s| Segment::Int(SegmentInt::from(*s))).collect(),
					segments_1000_1.clone().iter().map(|s| Segment::Int(SegmentInt::from(*s))).collect(),
				],
			},

			float: BenchFloat {
				x10: [
					segments_10_1.clone().iter().map(|s| Segment::Float(*s)).collect(),
					segments_10_1.clone().iter().map(|s| Segment::Float(*s)).collect(),
				],

				x100: [
					segments_100_1.clone().iter().map(|s| Segment::Float(*s)).collect(),
					segments_100_1.clone().iter().map(|s| Segment::Float(*s)).collect(),
				],

				x1000: [
					segments_1000_1.clone().iter().map(|s| Segment::Float(*s)).collect(),
					segments_1000_1.clone().iter().map(|s| Segment::Float(*s)).collect(),
				],
			},

		}
	}
}

#[cfg(test)]
mod tests {
	use test::Bencher;
	use super::*;
	use crate::segment::{Segment, SegmentFloat, SegmentInt};
	use crate::intersection::{
		ix_brute_single,
		ix_brute_double,
		ix_sort_single,
		ix_sort_double,
	};


	static setup: BenchSetup = BenchSetup::new();

	#[bench]
	fn bench_10_brute_single(b: &mut Bencher) {
		let segments = setup::int::x10[0].clone();
		b.iter(|| ix_brute_single(&segments));
	}
}