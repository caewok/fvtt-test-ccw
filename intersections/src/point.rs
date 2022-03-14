use geo::{Point, CoordNum, Coordinate};
use geo::algorithm::kernels::Orientation;
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

	fn random_range(min: T, max: T) -> Self
	{
		let mut rng = rand::thread_rng();
		Self::new(rng.gen_range(min..=max), rng.gen_range(min..=max))
	}

	fn random_pos(max: T) -> Self
	{
		let mut rng = rand::thread_rng();
		let min = num_traits::zero();
		Self::new(rng.gen_range(min..=max), rng.gen_range(min..=max))
	}
}

/*
Using T for different types is possible, but it is very difficult to handle integer overflow.
If passed i32, it is possible to overflow with the subtraction or multiplication.
(More likely when calculating intersections, but..)
Cannot just use check overflow functions b/c they are not implemented for floats.

Instead, implement an orientation trait and switch on different coordinate types.
https://stackoverflow.com/questions/56100579/how-do-i-match-on-the-concrete-type-of-a-generic-parameter
*/
pub trait SimpleOrient<B = Self, C = Self> {
	fn orient2d(self, b: B, c: C) -> Orientation;
}

impl SimpleOrient for Coordinate<f64> {
	fn orient2d(self, b: Self, c: Self) -> Orientation {
		let dac = self - c;
		let dbc = b - c;
     	let res = dac.y * dbc.x - dac.x * dbc.y;
     	if res > 0. {
     		Orientation::CounterClockwise
     	} else if res < 0. {
     		Orientation::Clockwise
     	} else {
     		Orientation::Collinear
     	}
	}
}

impl SimpleOrient for Coordinate<i32> {
	fn orient2d(self, b: Self, c: Self) -> Orientation {
		// our choices are try w/o conversion using overflow checks or
		// convert upfront to i64.
		let (ax, ay) = self.x_y().into();
		let (bx, by) = b.x_y().into();
		let (cx, cy) = c.x_y().into();

		let (ax, ay) = (ax as i64, ay as i64);
		let (bx, by) = (bx as i64, by as i64);
		let (cx, cy) = (cx as i64, cy as i64);

		let res = (ay - cy) * (bx - cx) - (ax - cx) * (by - cy);
		if res > 0 {
			Orientation::CounterClockwise
		} else if res < 0 {
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
	fn orient_point_int32_works() {
		let p1: Coordinate<i32> = Coordinate { x:0, y:0 };
		let p2: Coordinate<i32> = Coordinate { x:1, y:1 };
		let p3: Coordinate<i32> = Coordinate { x:0, y:1 }; // cw
		let p4: Coordinate<i32> = Coordinate { x:1, y:0 }; // ccw
		let p5: Coordinate<i32> = Coordinate { x:2, y:2 }; // collinear

		assert_eq!(p1.orient2d(p2, p3), Orientation::Clockwise);
		assert_eq!(p1.orient2d(p2, p4), Orientation::CounterClockwise);
		assert_eq!(p1.orient2d(p2, p5), Orientation::Collinear);
	}

	#[test]
	fn orient_point_float64_works() {
		let p1: Coordinate<f64> = Coordinate { x:0., y:0. };
		let p2: Coordinate<f64> = Coordinate { x:1., y:1. };
		let p3: Coordinate<f64> = Coordinate { x:0., y:1. }; // cw
		let p4: Coordinate<f64> = Coordinate { x:1., y:0. }; // ccw
		let p5: Coordinate<f64> = Coordinate { x:2., y:2. }; // collinear

		assert_eq!(p1.orient2d(p2, p3), Orientation::Clockwise);
		assert_eq!(p1.orient2d(p2, p4), Orientation::CounterClockwise);
		assert_eq!(p1.orient2d(p2, p5), Orientation::Collinear);
	}

	#[test]
	fn orient_point_int32_overflow_works() {
		let p1: Coordinate<i32> = Coordinate { x:i32::MAX - 2, y: i32::MAX - 2 };
		let p2: Coordinate<i32> = Coordinate { x:i32::MAX - 1, y: i32::MAX - 1 };
		let p3: Coordinate<i32> = Coordinate { x:i32::MAX - 2, y: i32::MAX - 1 }; // cw
		let p4: Coordinate<i32> = Coordinate { x:i32::MAX - 1, y: i32::MAX - 2 }; // ccw
		let p5: Coordinate<i32> = Coordinate { x:i32::MAX, y:i32::MAX }; // collinear

		assert_eq!(p1.orient2d(p2, p3), Orientation::Clockwise);
		assert_eq!(p1.orient2d(p2, p4), Orientation::CounterClockwise);
		assert_eq!(p1.orient2d(p2, p5), Orientation::Collinear);

	}
}

