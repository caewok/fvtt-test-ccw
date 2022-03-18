// cargo bench -- ixs to filter to intersections
// open -a "Google Chrome" target/criterion/report/index.html
// open -a "Google Chrome" target/criterion/line_circle_ix/report/index.html
// from main dir
use criterion::*;

use intersections_line::point::{GenerateRandom};
use intersections_circle::circle::Circle;
use intersections_circle::circle_intersect::{
	quadratic_potential_intersects,
	quadratic_intersections,
	geometric_intersections,
	geometric_potential_intersects,
	geometric_area_intersections,
};
use intersections_circle::combine::trace_polygon_border;

use geo::prelude::ConvexHull;
use geo::{ Point, Line, CoordNum, Polygon, MultiPoint, GeoNum };
use rand::prelude::Distribution;
use rand::distributions::Standard;
use rand::distributions::uniform::SampleUniform;
use num_traits::Bounded;
use rand::Rng;
use num_traits::real::Real;

use criterion::black_box as bb_;

struct BenchData<T>
	where T: CoordNum + Real,
{
	circle: Circle<T>,
	line: Line<T>,
	poly: Polygon<T>,
}

impl <T> BenchData<T>
	where T: CoordNum + SampleUniform + Bounded + Real + geo::kernels::HasKernel, Standard: Distribution<T>,
{
	fn new() -> BenchData<T> {
		let range: T = num_traits::cast(1000).unwrap();
		let neg_range: T = num_traits::cast(-1000).unwrap();
		let start: Point<T> = Point::random_range(neg_range, range).into();
		let end: Point<T> = Point::random_range(neg_range, range).into();

		let n_min: usize = 3;
		let n_max: usize = 100;
		let mut rng = rand::thread_rng();
		let n: usize = rng.gen_range(n_min..=n_max);

		BenchData {
			circle: Circle::random_range(neg_range, range).into(),
			line: Line::new(start, end),
			poly: random_simple_poly(n),
		}
	}
}

// Create a simple polygon by creating a random set of points
// and constructing a convex hull around them
fn random_simple_poly<T>(n: usize) -> Polygon<T>
	where T: CoordNum + SampleUniform + Bounded + Real, Standard: Distribution<T>, T: GeoNum,
{
	assert!(n > 2); // not much use creating a polygon with less than 3 points...
	let range: T = num_traits::cast(1000_i32).unwrap();
	let neg_range: T = num_traits::cast(-1000_i32).unwrap();
	let mut pts: Vec<Point<T>> = Vec::with_capacity(n);

	for i in 0..n {
		pts.push(Point::random_range(neg_range, range).into());
	}

	let mp: MultiPoint<T> = pts.into();
	mp.convex_hull()
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

fn bench_poly_circle_union(c: &mut Criterion) {
	let mut group = c.benchmark_group("poly_circle");

	group.bench_function("poly_circle_union", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
			trace_polygon_border(bb_( bb_(&data.circle), &data.poly.exterior()), false, 60_usize);
		},
		BatchSize::SmallInput)
	});

	group.bench_function("poly_circle_intersects", move |b| {
		b.iter_batched(|| BenchData::<f64>::new(),
		|data| {
			trace_polygon_border(bb_(bb_(&data.circle), &data.poly.exterior()), true, 60_usize);
		},
		BatchSize::SmallInput)
	});
}


criterion_group!(
	benches,
	bench_line_circle_ix,
	bench_poly_circle_union,
	);

criterion_main!(benches);

