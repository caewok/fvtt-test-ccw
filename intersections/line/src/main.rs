// pub mod point;
// pub mod segment;
// pub mod intersections;
// pub mod js_api;

// use intersections::js_api::brute_i32;

use intersections_line::segment::{OrderedSegment, SimpleIntersect};
use geo::Point;

fn main() {
	println!("Hello world!");

	let s0f: OrderedSegment<f64> = OrderedSegment::new((2300., 1900.), (4200., 1900.));
	let s1f: OrderedSegment<f64> = OrderedSegment::new((2387., 1350.), (2500., 2100.));

	let s0: OrderedSegment<i32> = OrderedSegment::new((2300, 1900), (4200, 1900));
	let s1: OrderedSegment<i32> = OrderedSegment::new((2387, 1350), (2500, 2100));
	let res01: Point<f64> = Point::new(2469.866666666667, 1900.);

	println!("s0f x s1f");
	dbg!(s0f.line_intersection(&s1f));

	println!("s0 x s1");
	dbg!(s0.line_intersection(&s1), Some(res01));


		let nw = (i32::MIN, i32::MIN);
		let sw = (i32::MIN, i32::MAX);
		let ne = (i32::MAX, i32::MIN);
		let se = (i32::MAX, i32::MAX);

		let nwf = (i32::MIN as f64, i32::MIN as f64);
		let swf = (i32::MIN as f64, i32::MAX as f64);
		let nef = (i32::MAX as f64, i32::MIN as f64);
		let sef = (i32::MAX as f64, i32::MAX as f64);

// 		let z: (i32, i32) = (0, 0);

		let ne_swf: OrderedSegment<f64> = OrderedSegment::new(nef, swf);
		let se_nwf: OrderedSegment<f64> = OrderedSegment::new(sef, nwf);
		let ne_nwf: OrderedSegment<f64> = OrderedSegment::new(nef, nwf);
		let se_swf: OrderedSegment<f64> = OrderedSegment::new(sef, swf);

		let ne_sw: OrderedSegment<i32> = OrderedSegment::new(ne, sw);
		let se_nw: OrderedSegment<i32> = OrderedSegment::new(se, nw);
		let ne_nw: OrderedSegment<i32> = OrderedSegment::new(ne, nw);
		let se_sw: OrderedSegment<i32> = OrderedSegment::new(se, sw);

		// let res1: Point::<f64> = Point::new(-0.5, -0.5);
// 		let res2: Point::<f64> = Point::new(i32::MAX.into(), i32::MIN.into());

		println!("ne_sw x se_nw");
		dbg!(ne_swf.line_intersection(&se_nwf));
		dbg!(ne_sw.line_intersection(&se_nw)); // Some(res1)

		println!("ne_sw x ne_nw");
		dbg!(ne_swf.line_intersection(&ne_nwf));
		dbg!(ne_sw.line_intersection(&ne_nw)); // Some(res2)

		println!("ne_nw x se_sw");
		dbg!(ne_nwf.line_intersection(&se_swf));
		dbg!(ne_nw.line_intersection(&se_sw)); // None

// 	let coordinates: Vec<i32> = vec![
// 			2300, 1900, 4200, 1900,
// 			2387, 1350, 2500, 2100,
// 			2387, 1350, 3200, 1900,
// 			2500, 2100, 2900, 2100,
// 		];
//
//
// 	let expected: Vec<f64> = vec![
// 		2469.866666666667, 1900., 0., 1.,
// 		3200., 1900., 0., 2.,
// 		2387., 1350., 1., 2.,
// 		2500., 2100., 1., 3.,
// 	];
//
// 	dbg!(&coordinates);
// 	dbg!(&expected);
//
// 	let res = brute_i32(&coordinates[..]);
// 	dbg!(&res);

}