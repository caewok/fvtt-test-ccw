// TO-DO: Possibly switch to geo crate to handle points, lines.
// For now, create from scratch to learn rust.
// for nightly:
// cargo +nightly build
// cargo +nightly test
// cargo +nightly benchmark
// cargo +nightly run

//#![feature(test)]
//#![feature(saturating_int_impl)]

// extern crate test;

mod point;
mod segment;

use crate::point::{ GenerateRandom, orient2d, orient2drobust };
use crate::segment::{ OrderedSegment };
use geo::{Point, Coordinate};


fn main() {
	println!("Hello, world!");

	let p_f: Point<f64> = Point::random();
	let p_i: Point<i64> = Point::random();
	let p_u: Point<u64> = Point::random();

	dbg!(p_f);
	dbg!(p_i);
	dbg!(p_u);

	let p_f: Point<f64> = Point::random_range(-100., 100.);
	let p_i: Point<i64> = Point::random_range(-100, 100);
	let p_u: Point<u64> = Point::random_range(0, 100);

	dbg!(p_f);
	dbg!(p_i);
	dbg!(p_u);

	let p_f: Point<f64> = Point::random_pos(100.);
	let p_i: Point<i64> = Point::random_pos(100);
	let p_u: Point<u64> = Point::random_pos(100);

	dbg!(p_f);
	dbg!(p_i);
	dbg!(p_u);

	let p1: Point<f64> = Point::random_range(-100., 100.);
	let p2: Point<f64> = Point::random_range(-100., 100.);
	let p3: Point<f64> = Point::random_range(-100., 100.);
	dbg!(orient2d(p1.into(), p2.into(), p3.into()));
	dbg!(orient2drobust(p1.into(), p2.into(), p3.into()));

	let p1: Point<i64> = Point::random_range(-100, 100);
	let p2: Point<i64> = Point::random_range(-100, 100);
	let p3: Point<i64> = Point::random_range(-100, 100);
	dbg!(orient2d(p1.into(), p2.into(), p3.into()));
// 	dbg!(orient2drobust(p1, p2, p3)); // fails to build as expected

	dbg!(p1.x().cmp(&p1.y()));

	let x1 = Coordinate::from(p1).x;
	let x2 = Coordinate::from(p2).x;
	dbg!(x1.cmp(&x2));

// 	dbg!(Coordinate::from(p1).partial_cmp(&Coordinate::from(p2))); // fails

	let s1: OrderedSegment<i64> = OrderedSegment::new(p1.0, p2.0);
	dbg!(p1);
	dbg!(p2);
	dbg!(s1);
	dbg!(s1.coords());

	dbg!(OrderedSegment::compare_xy(p1, p2));
	dbg!(OrderedSegment::compare_xy(Coordinate::from(p1), Coordinate::from(p2)));

}
