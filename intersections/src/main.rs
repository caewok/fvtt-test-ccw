mod point;

use geo::{Point, Line};
use std::fs;

struct TestSetup {
	points_float: Vec<Point<f64>>,
// 	points_int: Vec<Point<i32>>,
}

impl TestSetup {
	fn new() -> Self {
	   	let str1 = fs::read_to_string("points_test.json").unwrap();

		Self {
			points_float: serde_json::from_str(&str1).unwrap(),
// 			points_int: serde_json::from_str(&str1).unwrap(),
		}
	}
}

fn main() {
    println!("Hello, world!");

	let setup = TestSetup::new();
	let a = setup.points_float[0];
	let b = setup.points_float[1];
	let c = setup.points_float[2];
	let d = setup.points_float[3];

	let l1 = Line::new(a, b);
	let l2 = Line::new(c, d);

	println!("testing line {},{}|{},{} with line {},{}|{},{}", a.x(), a.y(), b.x(), b.y(), c.x(), c.y(), d.x(), d.y());

	let is_ix = point::line_segment_intersects(l1, l2);
	println!("intersects is {}", is_ix);

	let is_ix2 = point::line_segment_intersects_robust(l1, l2);
	println!("robust intersects is {}", is_ix2);
// 			let is_ix2 = line_segment_intersects_robust(l1, l2);


}