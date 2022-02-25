use serde::{Serialize, Deserialize};
use serde_json;
use std::fs;
use rand::Rng;

#[derive(Serialize, Deserialize, Debug)]
pub struct Point {
  pub x: f64,
  pub y: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Segment {
  pub a: Point,
  pub b: Point,
}

impl Point {
	/// Construct a random point with an optional maximum amount.
	/// If negative is true, the max will also serve as the floor.
	/// Otherwise, floor is 0.
	/// Useful for testing intersections where you need segments that could possibly
	/// overlap with greater frequency than using random alone.
	pub fn random_ceil(max: f64, negative: bool) -> Point {
		let mut rng = rand::thread_rng();

		if negative {
		  	Point {
		 		x: rng.gen_range(-max..max),
		 		y: rng.gen_range(-max..max),
		 	}
		} else {
			Point {
		 		x: rng.gen_range(0.0..max),
		 		y: rng.gen_range(0.0..max),
		 	}
		}
	}

	/// Construct a random point
	pub fn random() -> Point {
	  	let mut rng = rand::thread_rng();
	  	Point {
	    	x: rng.gen(),
			y: rng.gen(),
	  	}
	}
}

impl Segment {
	/// Construct a random Segment, using Point::random_ceil
	pub fn random_ceil(max: f64, negative: bool) -> Segment {
		Segment {
			a: Point::random_ceil(max, negative),
			b: Point::random_ceil(max, negative),
		}
	}

	pub fn random() -> Segment {
		Segment {
			a: Point::random(),
			b: Point::random(),
		}
	}
}

/// Determine the relative orientation of three points in two-dimensional space.
/// The result is also an approximation of twice the signed area of the triangle
/// defined by the three points. This method is fast but not robust against issues
/// of floating point precision. Best used with integer coordinates.
/// Adapted from https://github.com/mourner/robust-predicates
///
/// ## Arguments
/// *a* An endpoint of segment AB, relative to which point C is tested.
/// *b* An endpoint of segment AB, relative to which point C is tested.
/// *c* A point is tested compared to A --> B --> C.
///
/// ## Returns
/// Positive value if the points are in counter-clockwise order.
/// Negative value if the points are in clockwise order.
/// Zero if the points are collinear.
pub fn orient2d(a: &Point, b: &Point, c: &Point) -> f64 {
  (a.y - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y)
}

/// Quickly test if two line segments, AB and CD, intersect.
/// This method does not determine the point of intersection.
///
/// ## Arguments
/// *a* First endpoint of AB
/// *b* Second endpoint of AB
/// *c* First endpoint of CD
/// *d* Second endpoint of CD
///
/// ## Returns
/// True if the lines segments intersect.
pub fn line_segment_intersects(a: &Point, b: &Point, c: &Point, d: &Point) -> bool {
  let xab = (orient2d(a, b, c) * orient2d(a, b, d)) <= 0.0;
  let xcd = (orient2d(c, d, a) * orient2d(c, d, b)) <= 0.0;
  return xab && xcd
}

/// Compute the intersection between two infinite lines.
/// Does not check for parallel lines; will return Infinite, NaN coordinates in that case
///
/// ## Arguments
/// *a* First endpoint of AB
/// *b* Second endpoint of AB
/// *c* First endpoint of CD
/// *d* Second endpoint of CD
///
/// ## Returns
/// Coordinates of the intersection.
pub fn line_line_intersection(a: &Point, b: &Point, c: &Point, d: &Point) -> Point {
	let dx1 = b.x - a.x;
  	let dx2 = d.x - c.x;
  	let dy1 = b.y - a.y;
  	let dy2 = d.y - c.y;

  	let x_num = a.x * dy1 * dx2 - c.x * dy2 * dx1 + c.y * dx1 * dx2 - a.y * dx1 * dx2;
  	let y_num = a.y * dx1 * dy2 - c.y * dx2 * dy1 + c.x * dy1 * dy2 - a.x * dy1 * dy2;

  	let x_dnm = dy1 * dx2 - dy2 * dx1;
  	let y_dnm = dx1 * dy2 - dx2 * dy1;

  	Point { x: x_num / x_dnm, y: y_num / y_dnm }
}

struct TestSetup {
	points: Vec<Point>,
	segments_10_1: Vec<Segment>,
	segments_10_2: Vec<Segment>,
	segments_100_1: Vec<Segment>,
	segments_100_2: Vec<Segment>,
	segments_1000_1: Vec<Segment>,
	segments_1000_2: Vec<Segment>,
}

impl TestSetup {
	fn new() -> Self {
	   	let str1 = fs::read_to_string("points_test.json").unwrap();
	   	let str2 = fs::read_to_string("segments_random_10_1000_neg1.json").unwrap();
	  	let str3 = fs::read_to_string("segments_random_10_1000_neg2.json").unwrap();
	   	let str4 = fs::read_to_string("segments_random_100_2000_neg1.json").unwrap();
	   	let str5 = fs::read_to_string("segments_random_100_2000_neg2.json").unwrap();
	   	let str6 = fs::read_to_string("segments_random_1000_4000_neg1.json").unwrap();
	   	let str7 = fs::read_to_string("segments_random_1000_4000_neg2.json").unwrap();

		Self {
			points: serde_json::from_str(&str1).unwrap(),
			segments_10_1: serde_json::from_str(&str2).unwrap(),
			segments_10_2: serde_json::from_str(&str3).unwrap(),
			segments_100_1: serde_json::from_str(&str4).unwrap(),
			segments_100_2: serde_json::from_str(&str5).unwrap(),
			segments_1000_1: serde_json::from_str(&str6).unwrap(),
			segments_1000_2: serde_json::from_str(&str7).unwrap(),
		}
	}
}


#[cfg(test)]
mod tests {
	use super::*;

	// a|b is horizontal
	// c is to left of a|b
	// d is to right of a|b
	// e is collinear with a|b
	// c|d intersects a|b
	// d|f parallel to a|b, c|d does not intersect as a segment but does as infinite line

    #[test]
    fn ccw_orientation_works() {
    	let setup = TestSetup::new();
    	let a = &setup.points[0];
    	let b = &setup.points[1];
    	let c = &setup.points[2];

// 		let a = Point {
// 			x: 2300.0,
// 			y: 1900.0,
// 		};
//
// 		let b = Point {
// 			x: 4200.0,
// 			y: 1900.0,
// 		};
//
// 		let c = Point {
// 			x: 2387.0,
// 			y: 1350.0,
// 		};
		let o = orient2d(a, b, c);
		assert_eq!(o, 1045000.0);
	}

	#[test]
	fn cw_orientation_works() {
	    let setup = TestSetup::new();
    	let a = &setup.points[0];
    	let b = &setup.points[1];
    	let d = &setup.points[3];

// 		let a = Point {
// 			x: 2300.0,
// 			y: 1900.0,
// 		};
//
// 		let b = Point {
// 			x: 4200.0,
// 			y: 1900.0,
// 		};
//
// 		let d = Point {
// 			x: 2500.0,
// 			y: 2100.0,
// 		};

		let o = orient2d(a, b, d);
		assert_eq!(o, -380000.0);
	}

	#[test]
	fn collinear_orientation_works() {
	    let setup = TestSetup::new();
    	let a = &setup.points[0];
    	let b = &setup.points[1];
    	let e = &setup.points[4];

// 		let a = Point {
// 			x: 2300.0,
// 			y: 1900.0,
// 		};
//
// 		let b = Point {
// 			x: 4200.0,
// 			y: 1900.0,
// 		};
//
// 		let e = Point {
// 			x: 3200.0,
// 			y: 1900.0,
// 		};

		let o = orient2d(a, b, e);
		assert_eq!(o, 0.0);
	}

	#[test]
	fn intersection_found() {
		let setup = TestSetup::new();
    	let a = &setup.points[0];
    	let b = &setup.points[1];
    	let c = &setup.points[2];
    	let d = &setup.points[3];

// 		let a = Point {
// 			x: 2300.0,
// 			y: 1900.0,
// 		};
//
// 		let b = Point {
// 			x: 4200.0,
// 			y: 1900.0,
// 		};
//
// 		let c = Point {
// 			x: 2387.0,
// 			y: 1350.0,
// 		};
//
// 		let d = Point {
// 			x: 2500.0,
// 			y: 2100.0,
// 		};

		let is_ix = line_segment_intersects(a, b, c, d);
		assert!(is_ix);
	}

	#[test]
	fn intersection_not_found() {
		let setup = TestSetup::new();
    	let a = &setup.points[0];
    	let b = &setup.points[1];
    	let d = &setup.points[3];
    	let f = &setup.points[5];


// 		let a = Point {
// 			x: 2300.0,
// 			y: 1900.0,
// 		};
//
// 		let b = Point {
// 			x: 4200.0,
// 			y: 1900.0,
// 		};
//
// 		let d = Point {
// 			x: 2500.0,
// 			y: 2100.0,
// 		};
//
// 		let f = Point {
// 			x: 2900.0,
// 			y: 2100.0,
// 		};

		let is_ix = line_segment_intersects(a, b, d, f);
		assert!(!is_ix);
	}

	#[test]
	fn intersection() {
		let setup = TestSetup::new();
    	let a = &setup.points[0];
    	let b = &setup.points[1];
    	let c = &setup.points[2];
    	let e = &setup.points[4];

// 		let a = Point {
// 			x: 2300.0,
// 			y: 1900.0,
// 		};
//
// 		let b = Point {
// 			x: 4200.0,
// 			y: 1900.0,
// 		};
//
// 		let c = Point {
// 			x: 2387.0,
// 			y: 1350.0,
// 		};
//
// 		let e = Point {
// 			x: 3200.0,
// 			y: 1900.0,
// 		};

		let ix = line_line_intersection(a, b, c, e);
		assert_eq!(ix.x, 3200.0);
		assert_eq!(ix.y, 1900.0);
	}
}
