// pub mod point;
// pub mod segment;
// pub mod intersections;
// pub mod js_api;

// use intersections::js_api::brute_i32;

use intersections_line::segment::{OrderedSegment};
use geo::Point;
use intersections_line::intersections::ix_sort_double_f64;

fn main() {
	println!("Hello world!");

	let p00: Point<f64> = Point::new(100., 100.);
	let p01: Point<f64> = Point::new(1000., 100.);
	let p02: Point<f64> = Point::new(1000., 1000.);
	let p03: Point<f64> = Point::new(100., 1000.);

	let p10: Point<f64> = Point::new(50., 500.);
	let p11: Point<f64> = Point::new(500., 50.);
	let p12: Point<f64> = Point::new(1500., 500.);
	let p13: Point<f64> = Point::new(500., 1500.);

	let mut segments0: Vec<OrderedSegment<f64>> = vec![
		OrderedSegment::new_with_idx(p00, p01, 0),
		OrderedSegment::new_with_idx(p01, p02, 1),
		OrderedSegment::new_with_idx(p02, p03, 2),
		OrderedSegment::new_with_idx(p03, p00, 3),
	];

	let mut segments1 = vec![
		OrderedSegment::new_with_idx(p10, p11, 0),
		OrderedSegment::new_with_idx(p11, p12, 1),
		OrderedSegment::new_with_idx(p12, p13, 2),
		OrderedSegment::new_with_idx(p13, p10, 3),
	];


	dbg!(ix_sort_double_f64(&mut segments0, &mut segments1));

}