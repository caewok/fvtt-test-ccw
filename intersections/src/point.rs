use geo::{Point, CoordNum, Coordinate};
use geo::algorithm::kernels::Orientation;
use num_traits::{ Signed };
// use std::ops::Neg;
// use std::num::Saturating;
use rand::prelude::Distribution;
use rand::distributions::Standard;
use rand::distributions::uniform::SampleUniform;
use rand::Rng;


pub trait GenerateRandom {
	type MaxType;

	fn random() -> Self;

	fn random_range(min: Self::MaxType, max: Self::MaxType) -> Self;

	fn random_pos(max: Self::MaxType) -> Self;
}

impl<T> GenerateRandom for Point<T>
	where T: CoordNum + SampleUniform, Standard: Distribution<T>,
{
	type MaxType = T;

	fn random() -> Self {
		let (x, y) = rand::random::<(T, T)>();
		Self::new(x, y)
	}

	fn random_range(min: T, max: T) -> Self {
		let mut rng = rand::thread_rng();
		Self::new(rng.gen_range(min..=max), rng.gen_range(min..=max))
	}

	fn random_pos(max: T) -> Self {
		let mut rng = rand::thread_rng();
		let min = num_traits::zero();
		Self::new(rng.gen_range(min..=max), rng.gen_range(min..=max))
	}
}

pub fn orient2d<T>(a: Coordinate<T>, b: Coordinate<T>, c: Coordinate<T>) -> Orientation
	where T: CoordNum + Signed,
{
	let dac = a - c;
	let dbc = b - c;

	let res = dac.y * dbc.x - dac.x * dbc.y;
	let z:T = num_traits::zero();

	if res > z {
		Orientation::CounterClockwise
	} else if res < z {
		Orientation::Clockwise
	} else {
		Orientation::Collinear
	}
}

pub fn orient2drobust<T>(a: Coordinate<T>, b: Coordinate<T>, c: Coordinate<T>) -> Orientation
	where T: CoordNum + Signed, f64: From<T>,
{
	let orientation = robust::orient2d(
		robust::Coord {
			x: a.x,
			y: a.y,
		},
		robust::Coord {
			x: b.x,
			y: b.y,
		},
		robust::Coord {
			x: c.x,
			y: c.y,
		},
	);
	// robust orientation flipped b/c y-axis is flipped
	if orientation > 0. {
		Orientation::Clockwise
	} else if orientation < 0. {
		Orientation::CounterClockwise
	} else {
		Orientation::Collinear
	}
}


#[cfg(test)]
mod tests {
	use super::*;

// ---------------- ORIENTATION
	#[test]
	fn orient_point_int_works() {
		let p1: Point<i64> = Point::new(0, 0);
		let p2: Point<i64> = Point::new(1, 1);
		let p3: Point<i64> = Point::new(0, 1); // cw
		let p4: Point<i64> = Point::new(1, 0); // ccw
		let p5: Point<i64> = Point::new(2, 2); // collinear

		assert_eq!(orient2d(p1.into(), p2.into(), p3.into()), Orientation::Clockwise);
		assert_eq!(orient2d(p1.into(), p2.into(), p4.into()), Orientation::CounterClockwise);
		assert_eq!(orient2d(p1.into(), p2.into(), p5.into()), Orientation::Collinear);
	}

	#[test]
	fn orient_point_float_works() {
		let p1: Point<f64> = Point::new(0., 0.);
		let p2: Point<f64> = Point::new(1., 1.);
		let p3: Point<f64> = Point::new(0., 1.); // cw
		let p4: Point<f64> = Point::new(1., 0.); // ccw
		let p5: Point<f64> = Point::new(2., 2.); // collinear

		assert_eq!(orient2d(p1.into(), p2.into(), p3.into()), Orientation::Clockwise);
		assert_eq!(orient2d(p1.into(), p2.into(), p4.into()), Orientation::CounterClockwise);
		assert_eq!(orient2d(p1.into(), p2.into(), p5.into()), Orientation::Collinear);
	}

	#[test]
	fn orientrobust_point_int_works() {
		let p1: Point<i32> = Point::new(0, 0);
		let p2: Point<i32> = Point::new(1, 1);
		let p3: Point<i32> = Point::new(0, 1); // cw
		let p4: Point<i32> = Point::new(1, 0); // ccw
		let p5: Point<i32> = Point::new(2, 2); // collinear

		assert_eq!(orient2drobust(p1.into(), p2.into(), p3.into()), Orientation::Clockwise);
		assert_eq!(orient2drobust(p1.into(), p2.into(), p4.into()), Orientation::CounterClockwise);
		assert_eq!(orient2drobust(p1.into(), p2.into(), p5.into()), Orientation::Collinear);
	}

	#[test]
	fn orientrobust_point_float_works() {
		let p1: Point<f64> = Point::new(0., 0.);
		let p2: Point<f64> = Point::new(1., 1.);
		let p3: Point<f64> = Point::new(0., 1.); // cw
		let p4: Point<f64> = Point::new(1., 0.); // ccw
		let p5: Point<f64> = Point::new(2., 2.); // collinear

		assert_eq!(orient2drobust(p1.into(), p2.into(), p3.into()), Orientation::Clockwise);
		assert_eq!(orient2drobust(p1.into(), p2.into(), p4.into()), Orientation::CounterClockwise);
		assert_eq!(orient2drobust(p1.into(), p2.into(), p5.into()), Orientation::Collinear);
	}
}

