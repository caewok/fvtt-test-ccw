use serde::{Serialize, Deserialize};
use std::cmp::Ordering;
use js_sys::Array;
use crate::{
	point,
	point::PointInt,
	point::PointFloat,
	point::JsPoint,

	segment::SegmentInt,
	segment::SegmentFloat,
	segment::JsWall,
};

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug)]
pub struct IntersectionResult {
	pub ix: PointFloat,
// 	pub id1: String,
// 	pub id2: String,
}

// impl IntersectionResult {
	// Order ids so that id1 is ne of id2. (id1.x <= id2.x; id1.y <= id2.y if id1.x == id2.x)

// 	fn order_ids(&mut self) {
// 		let order = self.id1.cmp(&self.id2);
// 		if order == Ordering::Greater {
// 			let id1 = self.id1.clone();
// 			self.id1 = self.id2.clone();
// 			self.id2 = id1;
// 		}
// 	}

/// Detect intersections in a single array of segments.
/// Uses a brute-force algorithm, comparing each segment to every other segment.
///
/// ## Arguments
/// *segments* Array of segments to test. Each should be a Segment made up of 2 Floating Points.
///
/// ## Returns
/// Array of intersections and segment indices.
#[wasm_bindgen]
pub fn brute_single(js_walls: Vec<JsValue>) -> Array {
	let ln = js_walls.len();
	let mut segments = Vec::with_capacity(ln);

// 	for (i, wall) in js_walls.iter().enumerate() {
// 		let wall = JsWall::from(wall);
// 		segments.push(SegmentFloat::from_js(&wall));
// 	}
// 	for i in 0..ln {
// 		let wall = JsWall::from(&js_walls[i]);
// 		segments.push(SegmentFloat::from_js(&wall));
// 	}
	for wall in js_walls {
		let wall = JsWall::from(wall);
		segments.push(SegmentFloat::from_js(&wall));
	}

	let mut ixs: Vec<PointFloat> = Vec::new();
	for (i, si) in segments.iter().enumerate() {
		let segments_slice = &segments[(i + 1)..]; // faster than if i <= j { continue; }
		for (j, sj) in segments_slice.iter().enumerate() {
			// if i <= j { continue; } // don't need to compare the same segments twice
			if !point::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }

			let ix = point::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
			ixs.push(ix);
			//IntersectionResult {
// 				ix,
// 				id1: si.id.clone(),
// 				id2: sj.id.clone(),
// 			});
		}
	}

	ixs.iter().map(|&pt| JsValue::from(pt)).collect()
}

#[wasm_bindgen]
pub fn brute_single_serde(val: &JsValue) -> JsValue {
	let segments: Vec<SegmentFloat> = val.into_serde().unwrap();

	let mut ixs: Vec<PointFloat> = Vec::new();
	for (i, si) in segments.iter().enumerate() {
		let segments_slice = &segments[(i + 1)..]; // faster than if i <= j { continue; }
		for (j, sj) in segments_slice.iter().enumerate() {
			// if i <= j { continue; } // don't need to compare the same segments twice
			if !point::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }

			let ix = point::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
			ixs.push(ix);
			//IntersectionResult {
// 				ix,
// 				id1: si.id.clone(),
// 				id2: sj.id.clone(),
// 			});
		}
	}

	JsValue::from_serde(&ixs).unwrap()
}

#[wasm_bindgen]
pub fn brute_single_serde_native(val: JsValue) -> JsValue {
	let segments: Vec<SegmentFloat> = serde_wasm_bindgen::from_value(val).unwrap();

	let mut ixs: Vec<PointFloat> = Vec::new();
	for (i, si) in segments.iter().enumerate() {
		let segments_slice = &segments[(i + 1)..]; // faster than if i <= j { continue; }
		for (j, sj) in segments_slice.iter().enumerate() {
			// if i <= j { continue; } // don't need to compare the same segments twice
			if !point::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }

			let ix = point::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
			ixs.push(ix);
			//IntersectionResult {
// 				ix,
// 				id1: si.id.clone(),
// 				id2: sj.id.clone(),
// 			});
		}
	}

	serde_wasm_bindgen::to_value(&ixs).unwrap()
}

// https://radu-matei.com/blog/practical-guide-to-wasm-memory/
// https://github.com/WebAssembly/design/issues/1231
// mod = await api.WASM.default()
// mod.memory.bufffer
/// Allocate memory into the module's linear memory
/// and return the offset to the start of the block
#[no_mangle]
pub fn alloc_int32_arr(len: usize) -> *mut i32 {
	// create a new mutable buffer
	let mut buf = Vec::with_capacity(len);

	// take a mutable pointer to the buffer
	let ptr = buf.as_mut_ptr();

	// take ownership of the memory block and
    // ensure that its destructor is not
    // called when the object goes out of scope
    // at the end of the function
    std::mem::forget(buf);

    // return the pointer so the runtime
    // can write data at this offset
    return ptr;
}

#[no_mangle]
pub fn alloc_float64_arr(len: usize) -> *mut f64 {
	let mut buf = Vec::with_capacity(len);
	let ptr = buf.as_mut_ptr();
	std::mem::forget(buf);
	return ptr;
}

/// Given a pointer to the start of a byte array and
/// its length, return the sum of its elements.
#[no_mangle]
pub unsafe fn array_sum(ptr: *mut i32, len: usize) -> i32 {
    // create a Vec<u8> from the pointer to the
    // linear memory and the length
    let data = Vec::from_raw_parts(ptr, len, len);
    // actually compute the sum and return it
    data.iter().sum()
}


#[no_mangle]
pub unsafe fn brute_mem(segments_ptr: *mut i32, segments_len: usize, ixs_ptr: *mut f64, ixs_len: usize) -> i32 {
	let data = Vec::from_raw_parts(segments_ptr, segments_len, segments_len);
	let mut ixs = Vec::from_raw_parts(ixs_ptr, ixs_len, ixs_len);


	// build segments
	let mut segments: Vec<SegmentInt> = Vec::new();
	let ln = data.len();
	for i in (0..ln).step_by(4) {
		segments.push(SegmentInt::new(PointInt::new(data[i], data[i+1]),
									  PointInt::new(data[i+2], data[i+3])));
	}

	let ln = segments.len();
	let mut num_ix: i32 = 0;

	for (i, si) in segments.iter().enumerate() {
		let segments_slice = &segments[(i + 1)..]; // faster than if i <= j { continue; }
		for (j, sj) in segments_slice.iter().enumerate() {
			// if i <= j { continue; } // don't need to compare the same segments twice
			if !point::line_segment_intersects_int(&si.a, &si.b, &sj.a, &sj.b) { continue; }

			let ix = point::line_line_intersection_int(&si.a, &si.b, &sj.a, &sj.b);

			num_ix += 1;

			ixs[i * ln * 2 + j * 2] = ix.x;
			ixs[i * ln * 2 + j * 2 + 1] = ix.y

			//ixs.push(ix);
			//IntersectionResult {
// 				ix,
// 				id1: si.id.clone(),
// 				id2: sj.id.clone(),
// 			});
		}
	}

	return num_ix;

// 	return ixs.len().try_into().unwrap()
}

// 	pub fn brute_single_int<I>(segments: I) -> Vec<IntersectionResult>
// 	where
// 			I: IntoIterator<Item = SegmentInt>,
// 	{
// 		let mut ixs: Vec<IntersectionResult> = Vec::new();
//
// 		for (i, si) in segments.iter().enumerate() {
// 			let segments_slice = &segments[(i + 1)..]; // faster than if i <= j { continue; }
// 			for (j, sj) in segments_slice.iter().enumerate() {
// 				// if i <= j { continue; } // don't need to compare the same segments twice
// 				if !point::line_segment_intersects(&si.a, &si.b, &sj.a, &sj.b) { continue; }
//
// 				let ix = point::line_line_intersection(&si.a, &si.b, &sj.a, &sj.b);
// 				ixs.push(IntersectionResult {
// 					ix,
// 					id1: si.id.clone(),
// 					id2: sj.id.clone(),
// 				});
// 			}
// 		}
//
// 		ixs
// 	}







