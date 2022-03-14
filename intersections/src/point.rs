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

// compare to impl functions
// no diff
// pub fn orient2d_f64(a: Coordinate<f64>, b: Coordinate<f64>, c: Coordinate<f64>) -> Orientation {
// 	let dac = a - c;
// 	let dbc = b - c;
// 	let right = dac.y * dbc.x;
// 	let left = dac.x * dbc.y;
// 	if right > left {
// 		Orientation::CounterClockwise
// 	} else if right < left {
// 		Orientation::Clockwise
// 	} else {
// 		Orientation::Collinear
// 	}
// }


pub trait SimpleOrient<B = Self, C = Self> {
	fn orient2d(self, b: B, c: C) -> Orientation;
}

impl SimpleOrient for Coordinate<f64> {
	fn orient2d(self, b: Self, c: Self) -> Orientation {
		let dac = self - c;
		let dbc = b - c;
     	let right = dac.y * dbc.x;
     	let left = dac.x * dbc.y;
     	if right > left {
     		Orientation::CounterClockwise
     	} else if right < left {
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
		let (ax, ay) = self.x_y();
		let (bx, by) = b.x_y();
		let (cx, cy) = c.x_y();

		// TO-DO: Any faster or better alternative to i128?
		// jumping from i32 to i128 is quite limiting
		let (ax, ay) = (ax as i128, ay as i128);
		let (bx, by) = (bx as i128, by as i128);
		let (cx, cy) = (cx as i128, cy as i128);

		// right/left version appears slower, perhaps b/c
		// integer compare to 0 is fast or b/c res calc is streamlined
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
		let nw = (i32::MIN, i32::MIN);
		let sw = (i32::MIN, i32::MAX);
		let ne = (i32::MAX, i32::MIN);
		let se = (i32::MAX, i32::MAX);
		let z: (i32, i32) = (0, 0);

		let nw: Coordinate<i32> = nw.into();
		let sw: Coordinate<i32> = sw.into();
		let ne: Coordinate<i32> = ne.into();
		let se: Coordinate<i32> = se.into();
		let z:  Coordinate<i32> = z.into();

		assert_eq!(nw.orient2d(se, ne), Orientation::CounterClockwise);
		assert_eq!(nw.orient2d(se, sw), Orientation::Clockwise);
		assert_eq!(nw.orient2d(z, se), Orientation::Collinear);
		assert_eq!(nw.orient2d(sw, se), Orientation::CounterClockwise);
		assert_eq!(nw.orient2d(ne, se), Orientation::Clockwise);
	}
}

