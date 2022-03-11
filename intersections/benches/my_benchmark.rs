use criterion::*;
use intersections::point::{GenerateRandom, orient2d, orient2drobust};
use intersections::segment::{OrderedSegment, SimpleIntersect};
use intersections::intersections::{
	ix_brute_single,
	ix_brute_double,
	ix_sort_single,
	ix_sort_double
};
use geo::CoordNum;
use geo::Point;
use rand::prelude::Distribution;
use rand::distributions::Standard;
use rand::distributions::uniform::SampleUniform;
use std::fs;

// open -a "Google Chrome" target/criterion/report/index.html
// #[derive(Debug, Clone)]
struct BenchData<T>
	where T: CoordNum,
{
	p0: Point<T>,
	p1: Point<T>,
	p2: Point<T>,
	s0: OrderedSegment<T>,
	s1: OrderedSegment<T>,
}

impl<T> BenchData<T>
	where T: CoordNum + SampleUniform, Standard: Distribution<T>,
{
	fn new() -> BenchData<T> {
		let range: T = num_traits::cast(1000).unwrap();
		let neg_range: T = num_traits::cast(-1000).unwrap();

		BenchData {
			p0: Point::random_range(neg_range, range),
			p1: Point::random_range(neg_range, range),
			p2: Point::random_range(neg_range, range),

			s0: OrderedSegment::random_range(neg_range, range),
			s1: OrderedSegment::random_range(neg_range, range),
		}
	}
}

struct BenchSegmentInt {
	x10_0: Vec<OrderedSegment<i64>>,
	x100_0: Vec<OrderedSegment<i64>>,
	x1000_0: Vec<OrderedSegment<i64>>,

	x10_1: Vec<OrderedSegment<i64>>,
	x100_1: Vec<OrderedSegment<i64>>,
	x1000_1: Vec<OrderedSegment<i64>>,
}

struct BenchSegmentFloat {
	x10_0: Vec<OrderedSegment<f64>>,
	x100_0: Vec<OrderedSegment<f64>>,
	x1000_0: Vec<OrderedSegment<f64>>,

	x10_1: Vec<OrderedSegment<f64>>,
	x100_1: Vec<OrderedSegment<f64>>,
	x1000_1: Vec<OrderedSegment<f64>>,
}

struct BenchSegment {
	int: BenchSegmentInt,
	float: BenchSegmentFloat,
}

impl BenchSegment {
	fn new() -> Self {
		// the copy versions have start/end
		let str10_1 = fs::read_to_string("segments_random_10_1000_neg1 copy.json").unwrap();
		let str10_2 = fs::read_to_string("segments_random_10_1000_neg2 copy.json").unwrap();
		let str100_1 = fs::read_to_string("segments_random_100_2000_neg1 copy.json").unwrap();
		let str100_2 = fs::read_to_string("segments_random_100_2000_neg2 copy.json").unwrap();
		let str1000_1 = fs::read_to_string("segments_random_1000_4000_neg1 copy.json").unwrap();
		let str1000_2 = fs::read_to_string("segments_random_1000_4000_neg2 copy.json").unwrap();

		let f = BenchSegmentFloat {
			x10_0: serde_json::from_str(&str10_1).unwrap(),
			x100_0: serde_json::from_str(&str10_2).unwrap(),
			x1000_0: serde_json::from_str(&str100_1).unwrap(),

			x10_1: serde_json::from_str(&str100_2).unwrap(),
			x100_1: serde_json::from_str(&str1000_1).unwrap(),
			x1000_1: serde_json::from_str(&str1000_2).unwrap(),
		};

		let i = BenchSegmentInt {
			x10_0: f.x10_0.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
			x100_0: f.x100_0.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
			x1000_0: f.x1000_0.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),

			x10_1: f.x10_1.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
			x100_1: f.x100_1.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
			x1000_1: f.x1000_1.iter().map(|s| OrderedSegment::<i64>::from(*s)).collect(),
		};

		BenchSegment {
			int: i,
			float: f,
		}
	}
}



// --------------- 	BENCH ORIENT2D
fn bench_orient2d(c: &mut Criterion) {
	let mut group = c.benchmark_group("orient2d");

	group.bench_function("f64", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
				orient2d(data.p0.into(), data.p1.into(), data.p2.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("f32", move |b| {
		b.iter_batched(|| BenchData::<f32>::new(),
		|data| {
				orient2d(data.p0.into(), data.p1.into(), data.p2.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("i64", move |b| {
		b.iter_batched(|| BenchData::<i64>::new(),
		|data| {
				orient2d(data.p0.into(), data.p1.into(), data.p2.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("i32", move |b| {
		b.iter_batched(|| BenchData::<i32>::new(),
		|data| {
				orient2d(data.p0.into(), data.p1.into(), data.p2.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("robust_f64", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
				orient2drobust(data.p0.into(), data.p1.into(), data.p2.into());
		},
		BatchSize::SmallInput)
	});

	group.bench_function("robust_f32", move |b| {
		b.iter_batched(|| BenchData::<f32>::new(),
		|data| {
				orient2drobust(data.p0.into(), data.p1.into(), data.p2.into());
		},
		BatchSize::SmallInput)
	});

//  cannot coerce i64 --> robust f64
// 	group.bench_function("robust_i64", move |b| {
// 		b.iter_batched(|| BenchData::<i64>::new(),
// 		|data| {
// 				orient2drobust(data.p0.into(), data.p1.into(), data.p2.into());
// 		},
// 		BatchSize::SmallInput)
// 	});

	group.bench_function("robust_i32", move |b| {
		b.iter_batched(|| BenchData::<i32>::new(),
		|data| {
				orient2drobust(data.p0.into(), data.p1.into(), data.p2.into());
		},
		BatchSize::SmallInput)
	});


	group.finish();
}

// ---------------- BENCH SEGMENT INTERSECT
fn bench_segment_intersects(c: &mut Criterion) {
	let mut group = c.benchmark_group("intersects");

	group.bench_function("f64", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
				data.s0.intersects(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("i64", move |b| {
		b.iter_batched(|| BenchData::<i64>::new(),
		|data| {
				data.s0.intersects(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("f32", move |b| {
		b.iter_batched(|| BenchData::<f32>::new(),
		|data| {
				data.s0.intersects(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("i32", move |b| {
		b.iter_batched(|| BenchData::<i32>::new(),
		|data| {
				data.s0.intersects(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.finish();
}

// ---------------- BENCH SEGMENT LINE INTERSECTION
fn bench_segment_intersection(c: &mut Criterion) {
	let mut group = c.benchmark_group("line_intersection");

	group.bench_function("f64", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
				data.s0.line_intersection(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("i64", move |b| {
		b.iter_batched(|| BenchData::<i64>::new(),
		|data| {
				data.s0.line_intersection(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("f32", move |b| {
		b.iter_batched(|| BenchData::<f32>::new(),
		|data| {
				data.s0.line_intersection(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("i32", move |b| {
		b.iter_batched(|| BenchData::<i32>::new(),
		|data| {
				data.s0.line_intersection(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("mixed_f64", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
				data.s0.line_intersection_mixed(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("mixed_i64", move |b| {
		b.iter_batched(|| BenchData::<i64>::new(),
		|data| {
				data.s0.line_intersection_mixed(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("mixed_f32", move |b| {
		b.iter_batched(|| BenchData::<f32>::new(),
		|data| {
				data.s0.line_intersection_mixed(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("mixed_i32", move |b| {
		b.iter_batched(|| BenchData::<i32>::new(),
		|data| {
				data.s0.line_intersection_mixed(&data.s1);
		},
		BatchSize::SmallInput)
	});

	group.finish();
}

fn bench_ixs(c: &mut Criterion) {
	let mut group = c.benchmark_group("brute_single");

	let data = BenchSegment::new();

	group.throughput(Throughput::Elements(10 as u64));
	group.bench_with_input(BenchmarkId::new("f64", "x10"), &data, |b, i| {
		b.iter(|| ix_brute_single(&i.float.x10_0))
	});

	group.throughput(Throughput::Elements(100 as u64));
	group.bench_with_input(BenchmarkId::new("f64", "x100"), &data, |b, i| {
		b.iter(|| ix_brute_single(&i.float.x100_0))
	});

	group.throughput(Throughput::Elements(1000 as u64));
	group.bench_with_input(BenchmarkId::new("f64", "x1000"), &data, |b, i| {
		b.iter(|| ix_brute_single(&i.float.x1000_0))
	});

	group.finish();
}

criterion_group!(
	benches,
	bench_orient2d,
	bench_segment_intersects,
	bench_segment_intersection,
	bench_ixs);

criterion_main!(benches);
