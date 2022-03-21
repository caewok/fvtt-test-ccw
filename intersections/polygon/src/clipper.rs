use geo::{ Coordinate, LineString, Polygon, MultiPolygon };
use geo_clipper::{ ClipperInt };

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub enum Operation {
	Union = 1,
	Intersection = 2,
	XOR = 3,
	Difference = 4,
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

fn convert_line_string_input_i64(arr: &[i64]) -> LineString<i64> {
	assert!(arr.len() > 0); // at least a measure of size

	let num_pts = arr[0] as usize;
	let num_coords = num_pts * 2;
	let mut ls: Vec<Coordinate<i64>> = Vec::with_capacity(num_pts);
	for i in (0..num_coords).step_by(2) {
		ls.push(Coordinate { x: arr[i], y: arr[i + 2] });
	}

	ls.into()
}

fn convert_line_string_output_i64(ls: &LineString<i64>) -> Vec<i64> {
	let ls_len = ls.0.len();
	let mut arr: Vec<i64> = Vec::with_capacity(1 + ls_len * 2);
	arr.push(num_traits::cast(ls_len).unwrap()); // number of points
	for coord in ls.coords() {
		arr.push(coord.x);
		arr.push(coord.y);
	}
	arr
}

fn convert_polygon_input_i64(arr: &[i64]) -> Polygon<i64> {
	let arr_ln = arr.len();
	assert!(arr_ln > 1);

	let interior_num = arr[0] as usize;

	// construct exterior
	let offset = 1;
	let exterior = convert_line_string_input_i64(&arr[offset..]);
	let ext_coords_num = exterior.0.len();

	// construct interior(s) if any
	let mut interiors: Vec<LineString<i64>> = Vec::new();
	if interior_num > 0 {
		let mut offset = 2 + ext_coords_num;
		for _i in 0..interior_num {
			let interior = convert_line_string_input_i64(&arr[offset..]);
			offset += interior.0.len();
			interiors.push(interior);
		}
	}

	Polygon::new(exterior, interiors)
}

fn convert_polygon_output_i64(poly: &Polygon<i64>) -> Vec<i64> {
	let exterior = poly.exterior();
	let interiors = poly.interiors();

	let num_ext_pts = exterior.0.len();
	let num_ints = (*interiors).len();
	let mut num_int_pts: usize = 0;
	for i in 0..num_ints {
		num_int_pts += interiors[i].0.len();
	}

	// 1 element for number of interiors
	// 1 element for exterior length + exterior elements
	// 1 element for each interior length + interior elements
	let mut arr: Vec<i64> = Vec::with_capacity(2 + num_ints + num_ext_pts * 2 + num_int_pts * 2);

	arr.push(num_traits::cast(num_ints).unwrap());
	// construct exterior
	arr.append(&mut convert_line_string_output_i64(&exterior));

	// construct interior(s)
	for i in 0..num_ints {
		arr.append(&mut convert_line_string_output_i64(&interiors[i]));
	}

	arr
}

// arr[0] indicates the number of polygons
// each polygon array follows, per convert_polygon_output_i64
fn convert_multipolygon_output_i64(mp: &MultiPolygon<i64>) -> Vec<i64> {
	let mut arrs: Vec<i64> = mp.iter().flat_map(|poly| convert_polygon_output_i64(&poly)).collect();
	let mut arr: Vec<i64> = Vec::with_capacity(arrs.len() + 1);
	arr[0] = num_traits::cast(mp.0.len()).unwrap();
	arr.append(&mut arrs);
	arr
}

#[wasm_bindgen]
pub fn clip_i64(poly1: &[i64], poly2: &[i64], operation: Operation) -> Box<[i64]> {
	// build the polygons
	let subject = convert_polygon_input_i64(poly1);
	let clip = convert_polygon_input_i64(poly2);

	let result = match operation {
		Operation::Union => subject.union(&clip),
		Operation::Intersection => subject.intersection(&clip),
		Operation::XOR => subject.xor(&clip),
		Operation::Difference => subject.difference(&clip),
	};

	// result is a MultiPolygon<i64>
	convert_multipolygon_output_i64(&result).into_boxed_slice()
}

// fn clip_f64(poly1: &[f64], poly2: &[f64], operation: Operation, factor: f64) -> Box<[f64]> {
//
// }

