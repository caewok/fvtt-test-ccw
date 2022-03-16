// cargo bench -- ixs to filter to intersections
// open -a "Google Chrome" target/criterion/report/index.html
// open -a "Google Chrome" target/criterion/line_circle_ix/report/index.html
// from main dir
use criterion::*;

use intersections_line::point::{GenerateRandom};
use intersections_circle::circle_intersect::{
	Circle,
	quadratic_potential_intersects,
	quadratic_intersections,
	geometric_intersections,
	geometric_potential_intersects,
	geometric_area_intersections,
};

use geo::{Point, Line, CoordNum};
use rand::prelude::Distribution;
use rand::distributions::Standard;
use rand::distributions::uniform::SampleUniform;
use num_traits::Bounded;

use criterion::black_box as bb_;

struct BenchData<T>
	where T: CoordNum,
{
	circle: Circle<T>,
	line: Line<T>,
}

impl <T> BenchData<T>
	where T: CoordNum + SampleUniform + Bounded, Standard: Distribution<T>,
{
	fn new() -> BenchData<T> {
		let range: T = num_traits::cast(1000).unwrap();
		let neg_range: T = num_traits::cast(-1000).unwrap();
		let start: Point<T> = Point::random_range(neg_range, range).into();
		let end: Point<T> = Point::random_range(neg_range, range).into();

		BenchData {
			circle: Circle::random_range(neg_range, range).into(),
			line: Line::new(start, end),
		}
	}
}

fn bench_line_circle_ix(c: &mut Criterion) {
	let mut group = c.benchmark_group("line_circle_ix");

	group.bench_function("quadratic_potential_intersects", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
			quadratic_potential_intersects(bb_(&data.circle), bb_(&data.line));
		},
		BatchSize::SmallInput)
	});

	group.bench_function("geometric_potential_intersects", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
			geometric_potential_intersects(bb_(&data.circle), bb_(&data.line));
		},
		BatchSize::SmallInput)
	});

	group.bench_function("quadratic_intersections", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
			quadratic_intersections(bb_(&data.circle), bb_(&data.line));
		},
		BatchSize::SmallInput)
	});

	group.bench_function("geometric_intersections", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
			geometric_intersections(bb_(&data.circle), bb_(&data.line));
		},
		BatchSize::SmallInput)
	});

	group.bench_function("geometric_area_intersections", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
			geometric_area_intersections(bb_(&data.circle), bb_(&data.line));
		},
		BatchSize::SmallInput)
	});
}


criterion_group!(
	benches,
	bench_line_circle_ix,
	);

criterion_main!(benches);

