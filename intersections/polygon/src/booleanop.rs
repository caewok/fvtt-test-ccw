// extern crate geo;
// extern crate geo_booleanop;


use old_geo_types::{ Coordinate, LineString, Polygon, MultiPolygon };
use geo_booleanop::boolean::BooleanOp;

use wasm_bindgen::prelude::*;


// Setup log to javascript
// https://rustwasm.github.io/wasm-bindgen/examples/console-log.html
#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    // Note that this is using the `log` function imported above
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}


#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MyOperation {
	Intersection,
	Difference,
	Union,
	Xor,
}

// Define the polygon array to/from Javascript to be:
// Line String input:
// [num_pts, coord.x0, coord.y0, ... coord.xn, coord.yn]
// Where num_pts equals the number of points made up of x,y coordinates.
// e.g.:
// [2, coord.x0, coord.y0, coord.x1, coord.y1]

// Polygon Input:
// 1 exterior LineString. 0+ Interior LineStrings
// [num_interior_vectors,
//  num_exterior_pts, ext_coord.x0, ext_coord.y0, ext_coord.x1, ext_coord.y1, ... ext_coord.xn, ext_coord.yn,
//	num_interior0_pts, int0_coord.x0, int0_coord.y0, int0_coord.x1, int0_coord.y1, ... int0_coord.xn, int0_coord.yn,
//  num_interior1_pts, ...]
// num_exterior is always defined.
// If no interior points, array ends at end of exterior points
// Similarly if only one set of interior points, array ends at end of interior point set
// Same as:
// [num_interior_vectors,
//  LineStringInput_ext,
//  LineStringInput_int0,
//  LineStringInput_int1, ...]

// e.g.
// [ 	2,
// 	3, x0, y0, x1, y1, x2, y2,
// 	2, x0, y0, x1, y1,
// 	1, x0, y0,
// ]

// interior_num = 2
// ext_pts_num = 3
// ext_coords_num = 3 * 2 = 6
// offset = 2 + 6 = 8

fn convert_line_string_input_f64(arr: &[f64]) -> LineString<f64> {
	assert!(arr.len() > 0); // at least a measure of size

	let num_pts = arr[0] as usize;
// 	console_log!("Line string input is length {}, with {} points", arr.len(), num_pts);

	let num_coords = num_pts * 2;
	let mut ls: Vec<Coordinate<f64>> = Vec::with_capacity(num_pts);
	for i in (1..(num_coords+1)).step_by(2) {
		ls.push(Coordinate { x: arr[i], y: arr[i + 1] });
	}

	ls.into()
}

fn convert_line_string_output_f64(ls: &LineString<f64>) -> Vec<f64> {
	let ls_len = ls.0.len();
// 	console_log!("Outputting LineString of length {}", ls_len);

	let mut arr: Vec<f64> = Vec::with_capacity(1 + ls_len * 2);
	arr.push(num_traits::cast(ls_len).unwrap()); // number of points
	for pt in &ls.0 { // iterate over a slice to avoid move of shared ref
		arr.push(pt.x);
		arr.push(pt.y);
	}
// 	console_log!("Returning array of length {} for lineString of length {}", arr.len(), ls_len);

	arr
}

fn convert_polygon_input_f64(arr: &[f64]) -> Polygon<f64> {
	let arr_ln = arr.len();
	assert!(arr_ln > 1);

	let interior_num = arr[0] as usize;
// 	console_log!("Polygon input is length {}, with {} interiors",  arr_ln, interior_num);

	// construct exterior
	let offset = 1;
	let exterior = convert_line_string_input_f64(&arr[offset..]);
	let ext_coords_num = exterior.0.len();

	// construct interior(s) if any
	let mut interiors: Vec<LineString<f64>> = Vec::new();
	if interior_num > 0 {
		let mut offset = 2 + ext_coords_num;
		for _i in 0..interior_num {
			let interior = convert_line_string_input_f64(&arr[offset..]);
			offset += interior.0.len();
			interiors.push(interior);
		}
	}

	Polygon::new(exterior, interiors)
}

fn convert_polygon_output_f64(poly: &Polygon<f64>) -> Vec<f64> {
	let exterior = poly.exterior();
	let interiors = poly.interiors();

	let num_ext_pts = exterior.0.len();
	let num_ints = (*interiors).len();
	let mut num_int_pts: usize = 0;
	for i in 0..num_ints {
		num_int_pts += interiors[i].0.len();
	}

// 	console_log!("Outputting polygon with {} exterior points, {} interiors, and {} interior points", num_ext_pts, num_ints, num_int_pts);

	// 1 element for number of interiors
	// 1 element for exterior length + exterior elements
	// 1 element for each interior length + interior elements
	let cap = 2 + num_ints + num_ext_pts * 2 + num_int_pts * 2;
	let mut arr: Vec<f64> = Vec::with_capacity(cap);
// 	console_log!("Total output polygon capacity is {} elements", cap);

	arr.push(num_traits::cast(num_ints).unwrap());
	// construct exterior
	arr.append(&mut convert_line_string_output_f64(&exterior));

	// construct interior(s)
	for i in 0..num_ints {
		arr.append(&mut convert_line_string_output_f64(&interiors[i]));
	}

// 	console_log!("Returning array of length {} for Polygon", arr.len());

	arr
}

// arr[0] indicates the number of polygons
// each polygon array follows, per convert_polygon_output_f64
fn convert_multipolygon_output_f64(mp: &MultiPolygon<f64>) -> Vec<f64> {
	let mut arr: Vec<f64> = Vec::new();
	arr.push(num_traits::cast(mp.0.len()).unwrap());

// 	console_log!("{} polygons to process", mp.0.len());

	for p in mp {
		let mut p_arr = convert_polygon_output_f64(&p);
// 		console_log!("Adding {} elements for polygon", p_arr.len());
		arr.append(&mut p_arr);
	}

	arr
}

#[wasm_bindgen]
pub fn boolean_f64(poly1: &[f64], poly2: &[f64], operation: MyOperation) -> Box<[f64]> {
	// build the polygons
// 	console_log!("Building subject poly...");
	let subject = convert_polygon_input_f64(poly1);

// 	console_log!("Building clip poly...");
	let clip = convert_polygon_input_f64(poly2);

// 	console_log!("Running requested operation...");
	let result = match operation {
		MyOperation::Intersection => subject.intersection(&clip),
		MyOperation::Difference => subject.difference(&clip),
		MyOperation::Union => subject.union(&clip),
		MyOperation::Xor => subject.xor(&clip),
	};

// 	console_log!("Converting result to Boxed slice...");

	// result is a MultiPolygon<f64>
	let arr = convert_multipolygon_output_f64(&result);
// 	console_log!("Resulting array is length {}", arr.len());

	arr.into_boxed_slice()
}

// fn clip_f64(poly1: &[f64], poly2: &[f64], operation: Operation, factor: f64) -> Box<[f64]> {
//
// }

