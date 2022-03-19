use geo::{ Coordinate, CoordNum, Line, LineString, Polygon };
use num_traits::Bounded;
use rand::Rng;
use rand::prelude::Distribution;
use rand::distributions::Standard;
use rand::distributions::uniform::SampleUniform;
use intersections_line::point::GenerateRandom;
// use measurements::angle::Angle;
use std::f64::consts::PI;
use num_traits::real::Real;
use num_traits::ToPrimitive;

#[derive(Debug)]
pub struct Circle<T>
	where T: CoordNum + Real,
{
	pub center: Coordinate<T>,
	pub radius: T,
}

impl<T> Circle<T>
	where T: CoordNum + Real,
{
	pub fn new<C>(center: C, radius: T) -> Self
		where C: Into<Coordinate<T>>
	{
		let center: Coordinate<T> = center.into();
		Self { center, radius }
	}

	pub fn as_polygon(&self, density: usize) -> Polygon<T> {
		Polygon::new(
			LineString::from(self.as_points_from_angle(0., 0., density)),
			vec![],
		)
	}

	pub fn as_points(&self, from_pt: Coordinate<T>, to_pt: Coordinate<T>, density: usize) -> Vec<Coordinate<T>> {
		let from_l = Line::new(self.center, from_pt);
		let to_l = Line::new(self.center, to_pt);

		let from_dx = from_l.dx().to_f64().unwrap();
		let from_dy = from_l.dy().to_f64().unwrap();

		let to_dx = to_l.dx().to_f64().unwrap();
		let to_dy = to_l.dy().to_f64().unwrap();

		// atan returns -pi to pi, so no need to normalize
		let from_rads = from_dy.atan2(from_dx);
		let to_rads = to_dy.atan2(to_dx);

		self.as_points_from_angle(from_rads, to_rads, density)
	}

	// like Projection::project_along_angle but assumes distance radius
	pub fn project_on_circle(&self, radians: f64) -> Coordinate<T> {
		let distance: f64 = self.radius.to_f64().unwrap();
		self.center.project_along_angle(radians, distance)
	}

	pub fn as_points_from_angle(&self, from_radians: f64, to_radians: f64, density: usize) -> Vec<Coordinate<T>> {
		let density = PI / (density as f64);

		// Determine padding delta
		let mut padding_angle = to_radians - from_radians;
		if padding_angle <= 0. {
			padding_angle = padding_angle + (2. * PI);
		} // handle cycling past PI

		let num_pad:usize = (padding_angle / density).round().to_usize().unwrap();
		if num_pad == 0 { return Vec::with_capacity(0); }

		let mut padding: Vec<Coordinate<T>> = Vec::with_capacity(num_pad);

		// construct points based on incrementing angle
		let delta_angle = padding_angle / (num_pad as f64);
		for i in 1..num_pad {
			let new_angle = from_radians + (delta_angle * (i as f64));
			padding.push(self.project_on_circle(new_angle));
		}

		padding
	}
}


pub trait Projection {
	fn project_along_angle(&self, radians: f64, distance: f64) -> Self;
}

impl<T> Projection for Coordinate<T>
	where T: CoordNum + Real,
{
	fn project_along_angle(&self, radians: f64, distance: f64) -> Self {
		let x = self.x.to_f64().unwrap();
		let y = self.y.to_f64().unwrap();

		let (dy, dx) = radians.sin_cos();

		let x: T = num_traits::cast(x + (dx * distance)).unwrap();
		let y: T = num_traits::cast(y + (dy * distance)).unwrap();
		Coordinate { x: x, y: y }
	}
}

pub trait Normalize {
	fn normalize(&self) -> Self;
}

impl Normalize for f64 {
	fn normalize(&self) -> Self {
		let mut r = *self;
		let pi2 = 2. * PI;
		while r < -PI { r += pi2; }
		while r > PI { r -= pi2; }
		r
	}
}



// fn normalizeAngle(a: Angle) -> Angle {
// 	let r = a.as_radians();
// 	let pi2 = 2 * PI;
// 	while r < -PI { r += pi2; }
// 	while r > PI { r -= pi2; }
// 	Angle::from_radians(r)
// }


// From Foundry JS:
//   get angle() {
//     if ( this._angle === undefined ) this._angle = Math.atan2(this.dy, this.dx);
//     return this._angle;
//   }
//
// Math.normalizeRadians
// ƒ (radians) {
//   let pi2 = 2 * Math.PI;
//   while ( radians < -Math.PI ) radians += pi2;
//   while ( radians > Math.PI ) radians -= pi2;
//   return radians;
// }
//
//   static fromAngle(x, y, radians, distance) {
//     const dx = Math.cos(radians);
//     const dy = Math.sin(radians);
//     const ray = this.fromArrays([x ,y], [x + (dx * distance), y + (dy * distance)]);
//     ray._angle = Math.normalizeRadians(radians); // Store the angle, cheaper to compute here
//     ray._distance = distance; // Store the distance, cheaper to compute here
//     return ray;
//   }
//
//  shiftAngle(offset, distance) {
//     return this.constructor.fromAngle(this.x0, this.y0, this.angle + offset, distance || this.distance);
//   }
//
//   _getPaddingPoints(r0, r1) {
//     const density = Math.PI / this.config.density;
//     const padding = [];
//
//     // Determine padding delta
//     let d = r1.angle - r0.angle;
//     if ( d < 0 ) d += (2*Math.PI); // Handle cycling past pi
//     const nPad = Math.round(d / density);
//     if ( nPad === 0 ) return [];
//
//     // Construct padding rays
//     const delta = d / nPad;
//     for ( let i=1; i<nPad; i++ ) {
//       const p = r0.shiftAngle(i * delta);
//       padding.push(p.B);
//     }
//     return padding;
//   }
//
// testing version
//
// function getPaddingPoints(r0, r1, density = 60) {
//     density = Math.PI / density;
//     console.log(`density is ${density}`);
//
//     const padding = [];
//
//     // Determine padding delta
//     let d = r1.angle - r0.angle;
//     if ( d < 0 ) d += (2*Math.PI); // Handle cycling past pi
//
//     console.log(`d is ${d}`);
//     const nPad = Math.round(d / density);
//     if ( nPad === 0 ) return [];
//
//     console.log(`nPad is ${nPad}`);
//
//     // Construct padding rays
//     const delta = d / nPad;
//     console.log(`delta is ${delta}`);
//
//     for ( let i=1; i<nPad; i++ ) {
//       const p = r0.shiftAngle(i * delta);
//       padding.push(p.B);
//     }
//     return padding;
//   }
//
// // quarter turn:
// let r0 = new Ray({x: 0, y: 0}, {x: 0, y: -100});
// let r1 = new Ray({x: 0, y: 0}, {x: 100, y: 0});
// getPaddingPoints(r0, r1)




impl<T> GenerateRandom for Circle<T>
	where T: CoordNum + SampleUniform + Bounded + Real, Standard: Distribution<T>,
{
	type MaxType = T;

	fn random() -> Self {
		let center = rand::random::<(T, T)>();
		let z: T = num_traits::zero();
		let max = <T as Bounded>::max_value();
		let mut rng = rand::thread_rng();
		let radius = rng.gen_range(z..max);
		Self::new(center, radius)
	}

	fn random_range(min: T, max: T) -> Self {
		let mut rng = rand::thread_rng();
		let z: T = num_traits::zero();
		let center = (rng.gen_range(min..=max), rng.gen_range(min..=max));
		let radius = rng.gen_range(z..=max);
		Self::new(center, radius)
	}

	fn random_pos(max: T) -> Self {
		let mut rng = rand::thread_rng();
		let z: T = num_traits::zero();
		let center = (rng.gen_range(z..=max), rng.gen_range(z..=max));
		let radius = rng.gen_range(z..=max);
		Self::new(center, radius)
	}
}


// display stdout during testing:
// cargo test -- --nocapture
#[cfg(test)]
mod tests {
	use super::*;
	use geo::Coordinate;
	use intersections_line::point::GenerateRandom;

// ---------------- PADDING
	#[test]
	fn padding_works() {
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.
		};

// 		let inv_sqrt_2 = 1_f64 / 2_f64.sqrt();

		// 90º quarter turn
		let start: Coordinate::<f64> = Coordinate { x: 0., y: -100. };
		let end: Coordinate::<f64> = Coordinate { x: 100., y: 0. };
		let expected: Vec<Coordinate<f64>> = vec![ Coordinate { x: 70.71067811865476, y: -70.71067811865474 } ];
		assert_eq!(c.as_points(start, end, 3), expected);

		// 270º turn
		let end: Coordinate::<f64> = Coordinate { x: -100., y: 0. };
		let expected: Vec<Coordinate<f64>> = vec![
			Coordinate { x: 80.90169943749474, y: -58.778525229247315 },
			Coordinate { x: 95.10565162951535, y: 30.901699437494738 },
			Coordinate { x: 30.901699437494745, y: 95.10565162951535 },
			Coordinate { x: -58.7785252292473, y: 80.90169943749474 },
		];

		assert_eq!(c.as_points(start, end, 3), expected);

		// 360º
		let expected: Vec<Coordinate<f64>> = vec![
			Coordinate { x: 86.60254037844386, y: -50.0 },
			Coordinate { x: 86.60254037844388, y: 49.999999999999986 },
			Coordinate { x: 6.123233995736766e-15, y: 100.0 },
			Coordinate { x: -86.60254037844385, y:  50.000000000000036 },
			Coordinate { x: -86.6025403784439, y: -49.999999999999936 },
		];
		assert_eq!(c.as_points(start, start, 3), expected);

		// 450º -- same as 90º
		let end: Coordinate::<f64> = Coordinate { x: 100., y: 0. };
		let expected: Vec<Coordinate<f64>> = vec![ Coordinate { x: 70.71067811865476, y: -70.71067811865474 } ];
		assert_eq!(c.as_points(start, end, 3), expected);
	}

}