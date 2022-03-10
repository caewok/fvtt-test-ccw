use geo::{Point, CoordNum};
use crate::segment::{OrderedSegment, SimpleIntersect};
use num_traits::{Signed};
use serde_json;

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

pub fn ix_brute_single<T: 'static>(segments: &Vec<OrderedSegment<T>>) -> Vec<IxResultFloat>
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

pub fn ix_brute_double<T: 'static>(segments1: &Vec<OrderedSegment<T>>, segments2: &Vec<OrderedSegment<T>>) -> Vec<IxResultFloat>
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

pub fn ix_brute_single_mixed<T: 'static>(segments: &Vec<OrderedSegment<T>>) -> Vec<IxResult<T>>
	where T: CoordNum + Signed,
{
		let mut ixs: Vec<IxResult<T>> = Vec::new();
		for(i, si) in segments.iter().enumerate() {
			for sj in &segments[(i + 1)..] {
				if !si.intersects(&sj) { continue; }
				let res = si.line_intersection_mixed(&sj);
				if let Some(ix) = res {
					ixs.push( IxResult {
						ix,
					});
				}
			}
		}

		ixs
}

pub fn ix_brute_double_mixed<T: 'static>(segments1: &Vec<OrderedSegment<T>>, segments2: &Vec<OrderedSegment<T>>) -> Vec<IxResult<T>>
	where T: CoordNum + Signed,
{
	let mut ixs: Vec<IxResult<T>> = Vec::new();
	for si in segments1 {
		for sj in segments2 {
			if !si.intersects(&sj) { continue; }
			let res = si.line_intersection_mixed(&sj);

			if let Some(ix) = res {
				ixs.push( IxResult {
					ix,
				});
			}
		}
	}

	ixs
}


