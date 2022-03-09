use geo::{Point, CoordNum};
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

pub trait SimpleOrient<A = Self, B = Self, C = Self> {
	fn orient2d(a: A, b: B, c: C) -> Orientation;

	// TO-DO: robust version using y in correct orientation (y decreases moving up)
	// flip the robust orientation from Point?
}

impl<T> SimpleOrient for Point<T>
	where T: CoordNum + Signed,
{
	fn orient2d(a: Point<T>, b: Point<T>, c: Point<T>) -> Orientation {
		let dac = a - c;
		let dbc = b - c;

		let res = dac.y() * dbc.x() - dac.x() * dbc.y();
		let z:T = num_traits::zero();

		if res > z {
			Orientation::CounterClockwise
		} else if res < z {
			Orientation::Clockwise
		} else {
			Orientation::Collinear
		}
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

		assert_eq!(Point::orient2d(p1, p2, p3), Orientation::Clockwise);
		assert_eq!(Point::orient2d(p1, p2, p4), Orientation::CounterClockwise);
		assert_eq!(Point::orient2d(p1, p2, p5), Orientation::Collinear);
	}

	#[test]
	fn orient_point_float_works() {
		let p1: Point<f64> = Point::new(0., 0.);
		let p2: Point<f64> = Point::new(1., 1.);
		let p3: Point<f64> = Point::new(0., 1.); // cw
		let p4: Point<f64> = Point::new(1., 0.); // ccw
		let p5: Point<f64> = Point::new(2., 2.); // collinear

		assert_eq!(Point::orient2d(p1, p2, p3), Orientation::Clockwise);
		assert_eq!(Point::orient2d(p1, p2, p4), Orientation::CounterClockwise);
		assert_eq!(Point::orient2d(p1, p2, p5), Orientation::Collinear);
	}
}

