#[derive(Debug)]
pub struct Point {
  x: f64,
  y: f64,
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
pub fn lineSegmentIntersects(a: &Point, b: &Point, c: &Point, d: &Point) -> bool {
  let xab = (orient2d(a, b, c) * orient2d(a, b, d)) <= 0.0;
  let xcd = (orient2d(c, d, a) * orient2d(c, d, b)) <= 0.0;
  return xab && xcd
}

#[cfg(test)]
mod tests {
	use super::*;

	// a|b is horizontal
	// c is to left of a|b
	// d is to right of a|b
	// e is collinear with a|b
	// c|d intersects a|b
	// d|f parallel to a|b

    #[test]
    fn ccw_orientation_works() {
		let a = Point {
			x: 2300.0,
			y: 1900.0,
		};

		let b = Point {
			x: 4200.0,
			y: 1900.0,
		};

		let c = Point {
			x: 2387.0,
			y: 1350.0,
		};
		let o = orient2d(&a, &b, &c);
		assert_eq!(o, 1045000.0);
	}

	#[test]
	fn cw_orientation_works() {
		let a = Point {
			x: 2300.0,
			y: 1900.0,
		};

		let b = Point {
			x: 4200.0,
			y: 1900.0,
		};

		let d = Point {
			x: 2500.0,
			y: 2100.0,
		};

		let o = orient2d(&a, &b, &d);
		assert_eq!(o, -380000.0);
	}

	#[test]
	fn collinear_orientation_works() {
		let a = Point {
			x: 2300.0,
			y: 1900.0,
		};

		let b = Point {
			x: 4200.0,
			y: 1900.0,
		};

		let e = Point {
			x: 3200.0,
			y: 1900.0,
		};

		let o = orient2d(&a, &b, &e);
		assert_eq!(o, 0.0);
	}

	#[test]
	fn intersection_found() {
		let a = Point {
			x: 2300.0,
			y: 1900.0,
		};

		let b = Point {
			x: 4200.0,
			y: 1900.0,
		};

		let c = Point {
			x: 2387.0,
			y: 1350.0,
		};

		let d = Point {
			x: 2500.0,
			y: 2100.0,
		};

		let is_ix = lineSegmentIntersects(&a, &b, &c, &d);
		assert!(is_ix);
	}

	#[test]
	fn intersection_not_found() {
		let a = Point {
			x: 2300.0,
			y: 1900.0,
		};

		let b = Point {
			x: 4200.0,
			y: 1900.0,
		};

		let d = Point {
			x: 2500.0,
			y: 2100.0,
		};

		let f = Point {
			x: 2900.0,
			y: 2100.0,
		};

		let is_ix = lineSegmentIntersects(&a, &b, &d, &f);
		assert!(!is_ix);
	}
}
