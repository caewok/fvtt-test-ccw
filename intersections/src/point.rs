use geo::{Point, CoordNum};
// use geo::algorithm::kernels::Orientation;
// use num_traits::{ Num, Signed };
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
