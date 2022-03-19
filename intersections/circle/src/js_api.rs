use crate::combine::{
	circle_poly_union,
	circle_poly_intersect,
};

use crate::circle_intersect::{
	line_circle_intersection,
};

use crate::circle::Circle;

use geo::{ Line, Polygon, LineString, Coordinate };

use wasm_bindgen::prelude::*;

#[allow(dead_code)]
#[wasm_bindgen]
pub struct JSPoint {
	x: f64,
	y: f64,
}

#[allow(dead_code)]
#[wasm_bindgen]
pub struct LineCircleJSOutput {
	ix1: Option<JSPoint>,
	ix2: Option<JSPoint>,
	a_inside: bool,
	b_inside: bool,
}


#[wasm_bindgen]
pub fn line_circle_intersection_f64(ax: f64, ay: f64, bx: f64, by: f64, center_x: f64, center_y: f64, radius: usize) -> LineCircleJSOutput {
	let circle = Circle::<f64>::new((center_x, center_y), radius as f64);
	let line = Line::<f64>::new((ax, ay), (bx, by));

	let res = line_circle_intersection(&circle, &line);
	match res.ixs {
		(None, None) => {
			LineCircleJSOutput {
				ix1: None,
				ix2: None,
				a_inside: res.a_inside,
				b_inside: res.b_inside,
			}
		}
		(None, Some(ix)) => {
			LineCircleJSOutput {
				ix1: None,
				ix2: Some(JSPoint { x: ix.x(), y: ix.y() }),
				a_inside: res.a_inside,
				b_inside: res.b_inside,
			}
		},
		(Some(ix), None) => {
			LineCircleJSOutput {
				ix1: Some(JSPoint { x: ix.x(), y: ix.y() }),
				ix2: None,
				a_inside: res.a_inside,
				b_inside: res.b_inside,
			}
		},
		(Some(ix1), Some(ix2)) => {
			LineCircleJSOutput {
				ix1: Some(JSPoint { x: ix1.x(), y: ix1.y() }),
				ix2: Some(JSPoint { x: ix2.x(), y: ix2.y() }),
				a_inside: res.a_inside,
				b_inside: res.b_inside,
			}
		}
	}
}

#[wasm_bindgen]
pub fn circle_poly_union_f64(center_x: f64, center_y: f64, radius: usize, density: usize, pts: &[f64]) -> Option<Box<[f64]>> {
	let circle = Circle::<f64>::new((center_x, center_y), radius as f64);
	let n_pts = pts.len();

	let mut coords: Vec<Coordinate<f64>> = Vec::with_capacity(n_pts / 2);
	for i in (0..n_pts).step_by(2) {
		coords.push( Coordinate { x: pts[i], y: pts[i+1] });
	}

	let poly = Polygon::<f64>::new(
		LineString::from(coords),
		vec![],
	);

	let res = circle_poly_union(&circle, &poly, density);

	match res {
		Some(poly) => bundle_poly(&poly),
		None => None,
	}
}

#[wasm_bindgen]
pub fn circle_poly_intersect_f64(center_x: f64, center_y: f64, radius: usize, density: usize, pts: &[f64]) -> Option<Box<[f64]>> {
	let circle = Circle::<f64>::new((center_x, center_y), radius as f64);
	let n_pts = pts.len();

	let mut coords: Vec<Coordinate<f64>> = Vec::with_capacity(n_pts / 2);
	for i in (0..n_pts).step_by(2) {
		coords.push( Coordinate { x: pts[i], y: pts[i+1] });
	}

	let poly = Polygon::<f64>::new(
		LineString::from(coords),
		vec![],
	);

	let res = circle_poly_intersect(&circle, &poly, density);

	match res {
		Some(poly) => bundle_poly(&poly),
		None => None,
	}
}

fn bundle_poly(poly: &Polygon<f64>) -> Option<Box<[f64]>> {
	let ext = poly.exterior();
	let ln = ext.0.len();
	let mut buf = Vec::<f64>::with_capacity(ln * 2);

	for coord in ext.coords() {
		buf.push(coord.x);
		buf.push(coord.y);
	}

	Some(buf.into_boxed_slice())
}

