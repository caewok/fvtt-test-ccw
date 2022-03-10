use criterion::*;
use intersections::point::{GenerateRandom, orient2d, orient2drobust};
use geo::CoordNum;
use geo::Point;
use rand::prelude::Distribution;
use rand::distributions::Standard;
use rand::distributions::uniform::SampleUniform;

// open -a "Google Chrome" target/criterion/report/index.html
#[derive(Debug, Clone)]
struct BenchPoints<T>
	where T: CoordNum,
{
	p1: Point<T>,
	p2: Point<T>,
	p3: Point<T>,
}

impl<T> BenchPoints<T>
	where T: CoordNum + SampleUniform, Standard: Distribution<T>,
{
	fn new() -> BenchPoints<T> {
		let range: T = num_traits::cast(1000).unwrap();
		let neg_range: T = num_traits::cast(-1000).unwrap();

		BenchPoints {
			p1: Point::random_range(neg_range, range),
			p2: Point::random_range(neg_range, range),
			p3: Point::random_range(neg_range, range),
		}
	}

}


fn bench_orient2d(c: &mut Criterion) {
	let mut group = c.benchmark_group("orient2d");

	group.bench_function("orient2d_f64", move |b| {
		b.iter_batched(|| BenchPoints::<f64>::new(),
		|data| {
				orient2d(data.p1.into(), data.p2.into(), data.p3.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("orient2d_f32", move |b| {
		b.iter_batched(|| BenchPoints::<f32>::new(),
		|data| {
				orient2d(data.p1.into(), data.p2.into(), data.p3.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("orient2d_i64", move |b| {
		b.iter_batched(|| BenchPoints::<i64>::new(),
		|data| {
				orient2d(data.p1.into(), data.p2.into(), data.p3.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("orient2d_i32", move |b| {
		b.iter_batched(|| BenchPoints::<i32>::new(),
		|data| {
				orient2d(data.p1.into(), data.p2.into(), data.p3.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("robust_f64", move |b| {
		b.iter_batched(|| BenchPoints::<f64>::new(),
		|data| {
				orient2drobust(data.p1.into(), data.p2.into(), data.p3.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("robust_f32", move |b| {
		b.iter_batched(|| BenchPoints::<f32>::new(),
		|data| {
				orient2drobust(data.p1.into(), data.p2.into(), data.p3.into());
		},
		BatchSize::SmallInput)
	});

//  cannot coerce i64 --> robust f64
// 	group.bench_function("robust_i64", move |b| {
// 		b.iter_batched(|| BenchPoints::<i64>::new(),
// 		|data| {
// 				orient2drobust(data.p1.into(), data.p2.into(), data.p3.into());
// 		},
// 		BatchSize::SmallInput)
// 	});

	group.bench_function("robust_i32", move |b| {
		b.iter_batched(|| BenchPoints::<i32>::new(),
		|data| {
				orient2drobust(data.p1.into(), data.p2.into(), data.p3.into());
		},
		BatchSize::SmallInput)
	});


	group.finish();
}


criterion_group!(benches, bench_orient2d);
criterion_main!(benches);
