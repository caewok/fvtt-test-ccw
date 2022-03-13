// pub mod point;
// pub mod segment;
// pub mod intersections;
// pub mod js_api;

use intersections::js_api::brute_i32;

fn main() {
	let coordinates: Vec<i32> = vec![
			2300, 1900, 4200, 1900,
			2387, 1350, 2500, 2100,
			2387, 1350, 3200, 1900,
			2500, 2100, 2900, 2100,
		];


	let expected: Vec<f64> = vec![
		2469.866666666667, 1900., 0., 1.,
		3200., 1900., 0., 2.,
		2387., 1350., 1., 2.,
		2500., 2100., 1., 3.,
	];

	dbg!(&coordinates);
	dbg!(&expected);

	let res = brute_i32(&coordinates[..]);
	dbg!(&res);

}