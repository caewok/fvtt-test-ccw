// Interface to Javascript
// For speed, alloc memory in WASM and use pointers in Javascript
// Pass in flat arrays of coordinates for segments

// https://radu-matei.com/blog/practical-guide-to-wasm-memory/
// https://github.com/WebAssembly/design/issues/1231
use crate::intersections::{ix_brute_single};
use crate::point::{orient2d};
use crate::segment::OrderedSegment;
use geo::algorithm::kernels::Orientation;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn brute_i32_mem(coordinates: &[i32]) -> Option<Box<[f64]>> {
	let n_coords = coordinates.len();

	// build segments
	let mut segments = Vec::with_capacity(n_coords / 4);
	for i in (0..n_coords).step_by(4) {
		segments.push(OrderedSegment::new_with_idx((coordinates[i], coordinates[i+1]), (coordinates[i+2], coordinates[i+3]), i / 4));
	}
	let segments = segments; // don't need mutability anymore

	let ixs = ix_brute_single(&segments);
	let ixs_ln = ixs.len();
	if ixs_ln == 0 { return None };

	// build return array: coords followed by indices
	let mut buf = Vec::<f64>::with_capacity(ixs_ln * 4);
	for obj in ixs {
		buf.push(obj.ix.x());
		buf.push(obj.ix.y());
		buf.push(obj.idx1 as f64);
		buf.push(obj.idx2 as f64);
	}

	Some(buf.into_boxed_slice())
}


#[wasm_bindgen]
pub fn orient2d_js(ax: i32, ay: i32, bx: i32, by: i32, cx: i32, cy: i32) -> i8 {
	let res = orient2d((ax, ay).into(), (bx, by).into(), (cx, cy).into());
	match res {
		Orientation::Clockwise => 1,
		Orientation::CounterClockwise => -1,
		Orientation::Collinear => 0
	}
}



