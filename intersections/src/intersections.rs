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







