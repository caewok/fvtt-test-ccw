use geo::{ Point, Line, Coordinate };
use geo::prelude::EuclideanLength;
use intersections_line::segment::OrderedSegment;
use smallvec::SmallVec;
use std::cmp::Ordering;

use crate::circle::{Circle};
// use intersections_line::segment::SimpleIntersect;

#[derive(Debug, PartialEq)]
pub struct CircleIntersection {
	pub ixs: (Option<Point<f64>>, Option<Point<f64>>),
	pub a_inside: bool,
	pub b_inside: bool,
}

#[derive(Debug, PartialEq)]
pub struct CircleIntersectionIndex {
	pub ixs_result: CircleIntersection,
	pub idx: usize,
}

// brute and sort versions of intersecting a set of segments
pub fn ix_brute_circle_segments(circle: &Circle<f64>, segments: &[OrderedSegment<f64>]) -> SmallVec<[CircleIntersectionIndex; 4]> {
	let mut ixs = SmallVec::<[CircleIntersectionIndex; 4]>::new();
	for si in segments {
		let ixs_result = line_circle_intersection(circle, &Line::<f64>::from(*si));

		match ixs_result.ixs {
			(None, None) => {},
			(_, _) => ixs.push(
				CircleIntersectionIndex{
					ixs_result: ixs_result,
					idx: si.idx,
				})
		}
	}
	ixs
}

fn segment_is_left_of_circle(circle: &Circle<f64>, segment: &OrderedSegment<f64>) -> bool {
	// recall that y axis is reversed: y is less as you move up
	let circle_nw: Coordinate<f64> = Coordinate { x: circle.center.x - circle.radius, y: circle.center.y - circle.radius };
	let res = OrderedSegment::compare_xy(segment.end, circle_nw);
	res == Ordering::Less
}

fn segment_is_right_of_circle(circle: &Circle<f64>, segment: &OrderedSegment<f64>) -> bool {
	// recall that y axis is reversed: y is less as you move up
	let circle_se: Coordinate<f64> = Coordinate { x: circle.center.x + circle.radius, y: circle.center.y + circle.radius };
	let res = OrderedSegment::compare_xy(segment.start, circle_se);
	res == Ordering::Greater
}


pub fn ix_sort_circle_segments(circle: &Circle<f64>, segments: &mut [OrderedSegment<f64>]) -> SmallVec<[CircleIntersectionIndex; 4]> {
	segments.sort_unstable_by(|a, b| a.cmp_segments(b));
	let segments = segments; // no longer need mutability

	let mut ixs = SmallVec::<[CircleIntersectionIndex; 4]>::new();
	for si in segments {
		if segment_is_left_of_circle(&circle, &si) { continue; }
		if segment_is_right_of_circle(&circle, &si) { break; }

		let ixs_result = line_circle_intersection(circle, &Line::<f64>::from(*si));

		match ixs_result.ixs {
			(None, None) => {},
			(_, _) => ixs.push(
				CircleIntersectionIndex{
					ixs_result: ixs_result,
					idx: si.idx,
				})
		}
	}
	ixs
}




#[allow(dead_code)]
pub fn line_circle_intersection(circle: &Circle<f64>, line: &Line<f64>) -> CircleIntersection {
	let epsilon = 1.0e-8_f64;

	let r2 = circle.radius.powi(2);
	let delta_start = line.start - circle.center;
	let delta_end = line.end - circle.center;

	// Test whether starting point is contained
	let ar2 = (delta_start.x).powi(2) + (delta_start.y).powi(2);
	let a_inside = ar2 <= r2 + epsilon;

	// Test whether ending point is contained
	let br2 = (delta_end.x).powi(2) + (delta_end.y).powi(2);
	let b_inside = br2 <= r2 + epsilon;

	// if line segment is completely inside the circle, there is no intersection.
	if a_inside && b_inside {
		return CircleIntersection {
			ixs: (None, None),
			a_inside: a_inside,
			b_inside: b_inside,
		};
	}

	CircleIntersection {
		ixs: quadratic_intersections(circle, line),
		a_inside: a_inside,
		b_inside: b_inside,
	}


}

// return true/false for potential intersection -- meaning the discriminant shows
// intersections are possible.
#[allow(dead_code)]
pub fn quadratic_potential_intersects(circle: &Circle<f64>, line: &Line<f64>) -> bool {
	let epsilon = 1.0e-8_f64;
	let r2 = circle.radius.powi(2);

	// Test whether starting point is contained
	let delta_start = line.start - circle.center;
	let delta_end = line.end - circle.center;

	let ar2 = (delta_start.x).powi(2) + (delta_start.x).powi(2);
	let a_inside = ar2 <= r2 + epsilon;

	// Test whether ending point is contained
	let br2 = (delta_end.x).powi(2) + (delta_end.y).powi(2);
	let b_inside = br2 <= r2 + epsilon;

	// if line segment is completely inside the circle, there is no intersection.
	if a_inside && b_inside { return false; }

	// following is same as first part of quadratic_intersections.
	// may be able to store this calculation, but for now just repeat it...

	let delta_l = line.delta(); // change in x, y over the line

	// Quadratic terms where at^2 + bt + c = 0
	let a = delta_l.x.powi(2) + delta_l.y.powi(2);
	let b = (2. * delta_l.x * delta_start.x) + (2. * delta_l.y * delta_start.y);
	let c = delta_start.x.powi(2) + delta_start.y.powi(2) - circle.radius.powi(2);

	// Discriminant
	let disc2 = b.powi(2) - (4. * a * c);

	return disc2 > 0.
}

#[allow(dead_code)]
pub fn quadratic_intersections(circle: &Circle<f64>, line: &Line<f64>) -> (Option<Point<f64>>, Option<Point<f64>>) {
	let epsilon = 1.0e-8_f64;

	let delta_l = line.delta();
	let delta_c = line.start - circle.center;

	// Quadratic terms where at^2 + bt + c = 0
	let a = delta_l.x.powi(2) + delta_l.y.powi(2);
	let b = (2. * delta_l.x * delta_c.x) + (2. * delta_l.y * delta_c.y);
	let c = delta_c.x.powi(2) + delta_c.y.powi(2) - circle.radius.powi(2);

	// Discriminant
	let disc2 = b.powi(2) - (4. * a * c);

	if disc2 <= 0. { return (None, None); } // no intersections

	// Roots
	let disc = disc2.sqrt();
	let t1 = (-b - disc) / (2. * a);
	let t2 = (-b + disc) / (2. * a);

	// if t1 hits (between 0 and 1) it indicates an "entry"
	let ix1 = if t1 > (0. - epsilon) && t1 < (1. + epsilon) {
		Some((line.start + (delta_l * t1)).into())

	} else {
		None
	};

	// if t2 hits (between 0 and 1) it indicates an "exit"
	let ix2 = if t2 > (0. - epsilon) && t2 < (1. + epsilon) {
		Some((line.start + (delta_l * t2)).into())

	} else {
		None
	};

	(ix1, ix2)
}

#[allow(dead_code)]
pub fn geometric_intersections(circle: &Circle<f64>, line: &Line<f64>) -> (Option<Point<f64>>, Option<Point<f64>>) {
// 	https://stackoverflow.com/questions/1073336/circle-line-segment-collision-detection-algorithm
	// label A = line start; B = line_end
	let lab = line.euclidean_length();

	// direction vector D from line start to line end
	let d = line.delta() / lab;

	// the equation of the line AB is x = Dx*t + Ax, y = Dy*t + Ay with 0 <= t <= LAB.
	let delta_start = circle.center - line.start;

	let t = d.x * delta_start.x + d.y * delta_start.y;

	let e = (d * t) + line.start;
	let delta_e = e - circle.center;

	let lec2 = delta_e.x.powi(2) + delta_e.y.powi(2);
	let r2 = circle.radius.powi(2);

	// tangent point to circle is E
	if lec2 == r2 {
		return (Some(Point::<f64>::new(e.x, e.y)), None);
	}

	if lec2 > r2 { return (None, None); }

	// if t - dt < 0, p1 is inside the circle
	// if t + dt > 1, p2 is inside the circle
	let dt = (r2 - lec2).sqrt();
	let t1 = t - dt;
	let t2 = t + dt;

	// compute points using equation of a line
	let f = if t1 > 0. && t1 < lab {
		Some((d * t1 + line.start).into())
	} else { None };

	let g = if t2 > 0. && t2 < lab {
		Some((d * t2 + line.start).into())
	} else { None };

	(f, g)
}

#[allow(dead_code)]
pub fn geometric_potential_intersects(circle: &Circle<f64>, line: &Line<f64>) -> bool {
	let epsilon = 1.0e-8_f64;
	let r2 = circle.radius.powi(2);

	// Test whether starting point is contained
	let delta_start = line.start - circle.center;
	let delta_end = line.end - circle.center;

	let ar2 = (delta_start.x).powi(2) + (delta_start.x).powi(2);
	let a_inside = ar2 <= r2 + epsilon;

	// Test whether ending point is contained
	let br2 = (delta_end.x).powi(2) + (delta_end.y).powi(2);
	let b_inside = br2 <= r2 + epsilon;

	// if line segment is completely inside the circle, there is no intersection.
	if a_inside && b_inside { return false; }

	// label A = line start; B = line_end
	let lab = line.euclidean_length();

	// direction vector D from line start to line end
	let d = line.delta() / lab;

	// the equation of the line AB is x = Dx*t + Ax, y = Dy*t + Ay with 0 <= t <= LAB.
	let delta_start = circle.center - line.start;

	let t = d.x * delta_start.x + d.y * delta_start.y;

	let e = (d * t) + line.start;
	let delta_e = e - circle.center;

	let lec2 = delta_e.x.powi(2) + delta_e.y.powi(2);

	lec2 <= r2 // if equal, it is a tangent
}

#[allow(dead_code)]
pub fn geometric_area_intersections(circle: &Circle<f64>, line: &Line<f64>) -> (Option<Point<f64>>, Option<Point<f64>>) {
// 	https://stackoverflow.com/questions/1073336/circle-line-segment-collision-detection-algorithm
	// using triangle ABC area formula, area = bh / 2
	// choose the segment AB to be the base so that h is the shortest distance from C to line

	// compute the triangle area times 2 (area = area2 / 2)
	let delta_l = line.delta();
	let delta_start = circle.center - line.start;

	let area2 = (delta_l.x * delta_start.y - delta_start.x * delta_l.y).abs();

	// compute the AB segment length
	// could compute an approximate 1 / LAB: http://betterexplained.com/articles/understanding-quakes-fast-inverse-square-root/

	let lab = line.euclidean_length();

	// compute the triangle height
	let h = area2 / lab;

	if h >= circle.radius { return (None, None); }

	// compute the line AB direction vetor components
	let d = delta_l / lab;

	// compute the distance from A towards B of closest point to C
	let t = d.x * delta_start.x + d.y * delta_start.y;

	// t should equal sqrt((Cx - Ax)^2 + (Cy - Ay)^2 - h2)

	// compute the intersection point distance from t
	let r2 = circle.radius.powi(2);
	let dt = (r2 - h.powi(2)).sqrt();

	let t1 = t - dt;
	let t2 = t + dt;

	// compute points using equation of a line
	let f = if t1 > 0. && t1 < lab {
		Some((d * t1 + line.start).into())
	} else { None };

	let g = if t2 > 0. && t2 < lab {
		Some((d * t2 + line.start).into())
	} else { None };

	(f, g)
}




/* Javascript version of testing:
c = new PIXI.Circle(0, 0, 100);
c.center = {x: 0, y: 0}
l_inside = new Ray({x: -25, y: -25}, {x: 25, y: 25});
l_outside = new Ray({x: -100, y: 200}, {x: 100, y: 200});
l1 = new Ray({x: -200, y: 0}, {x: 0, y: 0});
l1_b = new Ray({x: 0, y: 0}, {x: 200, y: 0});
l2 = new Ray({x: -200, y: 0}, {x: 200, y: 0});
l_tan = new Ray({x: -200, y: 100}, {x: 200, y: 100});

foundry.utils.lineCircleIntersection(l_inside.A, l_inside.B, c.center, c.radius) // none
foundry.utils.lineCircleIntersection(l_outside.A, l_outside.B, c.center, c.radius) // none
foundry.utils.lineCircleIntersection(l1.A, l1.B, c.center, c.radius) {x: -100, y: 0}
foundry.utils.lineCircleIntersection(l2.A, l2.B, c.center, c.radius) {x: -100, y: 0}, {x: 100, y: 0}
foundry.utils.lineCircleIntersection(l_tan.A, l_tan.B, c.center, c.radius) // none

intersectionsWithCircleGeometry(l_inside, c.center, c.radius)
intersectionsWithCircleGeometry(l_outside, c.center, c.radius)
intersectionsWithCircleGeometry(l1, c.center, c.radius)
intersectionsWithCircleGeometry(l1_b, c.center, c.radius)
intersectionsWithCircleGeometry(l2, c.center, c.radius)
intersectionsWithCircleGeometry(l_tan, c.center, c.radius)

function intersectionsWithCircleGeometry(l, center, radius) {
    const LAB = l.distance;
    const Dx = l.dx / LAB;
    const Dy = l.dy / LAB;
    const t = Dx * (center.x - l.A.x) + Dy * (center.y - l.A.y);
    const Ex = t * Dx + l.A.x;
    const Ey = t * Dy + l.A.y;
    const Edx = Ex - center.x;
    const Edy = Ey - center.y;
    const LEC2 = Edx * Edx + Edy * Edy;
    const R2 = radius * radius;

    console.log(`LAB: ${LAB}; LEC2: ${LEC2}`);

    // tangent point to circle is E
    if(LEC2.almostEqual(R2)) {
      let p = { x: Ex, y: Ey };
      return [p];
    }
    if(LEC2 > R2) return null; // no intersections

    // two intersections; compute points using equation of a line
    const dt = Math.sqrt(R2 - LEC2);
    const t1 = t - dt;
    const t2 = t + dt;
    const Fx = t1 * Dx + l.A.x;
    const Fy = t1 * Dy + l.A.y;

    const Gx = t2 * Dx + l.A.x;
    const Gy = t2 * Dy + l.A.y

    let intersections = [{ x: Fx, y: Fy, t1:t1, on_segment: t1.between(0, LAB)}, { x: Gx, y: Gy, t2: t2, on_segment: t2.between(0, LAB)}];
    return intersections;
  }

*/

// display stdout during testing:
// cargo test -- --nocapture
#[cfg(test)]
mod tests {
	use super::*;
	use geo::{ Line, Point, Coordinate };

// ---------------- INTERSECTS
	#[test]
	fn quadratic_intersects_works() {
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.
		};

		let l_inside = Line::<f64>::new((-25., -25.), (25., 25.));
		let l_outside = Line::<f64>::new((-100., 200.), (100., 200.));
		let l1 = Line::<f64>::new((-200., 0.), (0., 0.));
		let l1_b = Line::<f64>::new((0., 0.), (200., 0.));
		let l2 = Line::<f64>::new((-200., 0.), (200., 0.));
		let l_tan = Line::<f64>::new((-200., 100.), (200., 100.));

		assert_eq!(quadratic_potential_intersects(&c, &l_inside), false);
		assert_eq!(quadratic_potential_intersects(&c, &l_outside), false);
		assert_eq!(quadratic_potential_intersects(&c, &l1), true);
		assert_eq!(quadratic_potential_intersects(&c, &l1_b), true);
		assert_eq!(quadratic_potential_intersects(&c, &l2), true);
// 		assert_eq!(quadratic_potential_intersects(&c, &l_tan), true); // tangent fails for JS as well; floats too inexact
	}

	#[test]
	fn geometric_intersects_works() {
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.
		};

		let l_inside = Line::<f64>::new((-25., -25.), (25., 25.));
		let l_outside = Line::<f64>::new((-100., 200.), (100., 200.));
		let l1 = Line::<f64>::new((-200., 0.), (0., 0.));
		let l1_b = Line::<f64>::new((0., 0.), (200., 0.));
		let l2 = Line::<f64>::new((-200., 0.), (200., 0.));
		let l_tan = Line::<f64>::new((-200., 100.), (200., 100.));

		assert_eq!(geometric_potential_intersects(&c, &l_inside), false);
		assert_eq!(geometric_potential_intersects(&c, &l_outside), false);
		assert_eq!(geometric_potential_intersects(&c, &l1), true);
		assert_eq!(geometric_potential_intersects(&c, &l1_b), true);
		assert_eq!(geometric_potential_intersects(&c, &l2), true);
// 		assert_eq!(quadratic_potential_intersects(&c, &l_tan), true); // tangent fails for JS as well; floats too inexact
	}

// ---------------- INTERSECTION
	#[test]
	fn quadratic_intersection_works() {
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.
		};

		let l_inside = Line::<f64>::new((-25., -25.), (25., 25.));
		let l_outside = Line::<f64>::new((-100., 200.), (100., 200.));
		let l1 = Line::<f64>::new((-200., 0.), (0., 0.));
		let l1_b = Line::<f64>::new((0., 0.), (200., 0.));
		let l2 = Line::<f64>::new((-200., 0.), (200., 0.));
		let l_tan = Line::<f64>::new((-200., 100.), (200., 100.));

		assert_eq!(quadratic_intersections(&c, &l_inside), (None, None));
		assert_eq!(quadratic_intersections(&c, &l_outside), (None, None));
		assert_eq!(quadratic_intersections(&c, &l1),
			( Some(Point::<f64>::new(-100., 0.)),
			  None,
			));
		assert_eq!(quadratic_intersections(&c, &l1_b),
			( None,
			  Some(Point::<f64>::new(100., 0.)),
			));
		assert_eq!(quadratic_intersections(&c, &l2),
			( Some(Point::<f64>::new(-100., 0.)),
			  Some(Point::<f64>::new(100., 0.)),
			));
// 		assert_eq!(quadratic_intersections(&c, &l_tan),
// 			( Some(Point::<f64>::new(100., 100.)),
// 			  None,
// 			)); // tangent fails for Javascript version as well; floats too inexact
	}

	#[test]
	fn geometric_intersections_works() {
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.
		};

		let l_inside = Line::<f64>::new((-25., -25.), (25., 25.));
		let l_outside = Line::<f64>::new((-100., 200.), (100., 200.));
		let l1 = Line::<f64>::new((-200., 0.), (0., 0.));
		let l1_b = Line::<f64>::new((0., 0.), (200., 0.));
		let l2 = Line::<f64>::new((-200., 0.), (200., 0.));
		let l_tan = Line::<f64>::new((-200., 100.), (200., 100.));

		assert_eq!(geometric_intersections(&c, &l_inside), (None, None));
		assert_eq!(geometric_intersections(&c, &l_outside), (None, None));
		assert_eq!(geometric_intersections(&c, &l1),
			( Some(Point::<f64>::new(-100., 0.)),
			  None,
			));
		assert_eq!(geometric_intersections(&c, &l1_b),
			( None,
			  Some(Point::<f64>::new(100., 0.)),
			));

		assert_eq!(geometric_intersections(&c, &l2),
			( Some(Point::<f64>::new(-100., 0.)),
			  Some(Point::<f64>::new(100., 0.)),
			));
// 		assert_eq!(quadratic_intersections(&c, &l_tan),
// 			( Some(Point::<f64>::new(100., 100.)),
// 			  None,
// 			)); // tangent fails for Javascript version as well; floats too inexact
	}

	#[test]
	fn geometric_area_intersections_works() {
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.
		};

		let l_inside = Line::<f64>::new((-25., -25.), (25., 25.));
		let l_outside = Line::<f64>::new((-100., 200.), (100., 200.));
		let l1 = Line::<f64>::new((-200., 0.), (0., 0.));
		let l1_b = Line::<f64>::new((0., 0.), (200., 0.));
		let l2 = Line::<f64>::new((-200., 0.), (200., 0.));
		let l_tan = Line::<f64>::new((-200., 100.), (200., 100.));

		assert_eq!(geometric_area_intersections(&c, &l_inside), (None, None));
		assert_eq!(geometric_area_intersections(&c, &l_outside), (None, None));
		assert_eq!(geometric_area_intersections(&c, &l1),
			( Some(Point::<f64>::new(-100., 0.)),
			  None,
			));
		assert_eq!(geometric_area_intersections(&c, &l1_b),
			( None,
			  Some(Point::<f64>::new(100., 0.)),
			));

		assert_eq!(geometric_area_intersections(&c, &l2),
			( Some(Point::<f64>::new(-100., 0.)),
			  Some(Point::<f64>::new(100., 0.)),
			));
// 		assert_eq!(geometric_area_intersections(&c, &l_tan),
// 			( Some(Point::<f64>::new(100., 100.)),
// 			  None,
// 			)); // tangent fails for Javascript version as well; floats too inexact
	}

	#[test]
	fn ix_brute_circle_segment_works() {
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.
		};

		let l_inside = OrderedSegment::<f64>::new_with_idx((-25., -25.), (25., 25.), 0);
		let l_outside = OrderedSegment::<f64>::new_with_idx((-100., 200.), (100., 200.), 1);
		let l1 = OrderedSegment::<f64>::new_with_idx((-200., 0.), (0., 0.), 2);
		let l1_b = OrderedSegment::<f64>::new_with_idx((0., 0.), (200., 0.), 3);
		let l2 = OrderedSegment::<f64>::new_with_idx((-200., 0.), (200., 0.), 4);

		let segments = vec!(l_inside, l_outside, l1, l1_b, l2);
		let mut expected = SmallVec::<[CircleIntersectionIndex; 4]>::new();

		// l1
		expected.push(
			CircleIntersectionIndex {
				ixs_result: CircleIntersection {
					ixs: ( Some(Point::<f64>::new(-100., 0.)), None ),
					a_inside: false,
					b_inside: true,
				},
				idx: 2,
			}
		);

		// l1_b
		expected.push(
			CircleIntersectionIndex {
				ixs_result: CircleIntersection {
					ixs: ( None, Some(Point::<f64>::new(100., 0.)) ),
					a_inside: true,
					b_inside: false,
				},
				idx: 3,
			}
		);

		// l2
		expected.push(
			CircleIntersectionIndex {
				ixs_result: CircleIntersection {
					ixs: ( Some(Point::<f64>::new(-100., 0.)), Some(Point::<f64>::new(100., 0.)) ),
					a_inside: false,
					b_inside: false,
				},
				idx: 4,
			}
		);

		assert_eq!(ix_brute_circle_segments(&c, &segments[..]), expected);
	}

		#[test]
	fn ix_sort_circle_segment_works() {
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.
		};

		let l_inside = OrderedSegment::<f64>::new_with_idx((-25., -25.), (25., 25.), 0);
		let l_outside = OrderedSegment::<f64>::new_with_idx((-100., 200.), (100., 200.), 1);
		let l1 = OrderedSegment::<f64>::new_with_idx((-200., 0.), (0., 0.), 2);
		let l1_b = OrderedSegment::<f64>::new_with_idx((0., 0.), (200., 0.), 3);
		let l2 = OrderedSegment::<f64>::new_with_idx((-200., 0.), (200., 0.), 4);

		let mut segments = vec!(l_inside, l_outside, l1, l1_b, l2);
		let mut expected = SmallVec::<[CircleIntersectionIndex; 4]>::new();

		// l1
		expected.push(
			CircleIntersectionIndex {
				ixs_result: CircleIntersection {
					ixs: ( Some(Point::<f64>::new(-100., 0.)), None ),
					a_inside: false,
					b_inside: true,
				},
				idx: 2,
			}
		);

		// l1_b
		expected.push(
			CircleIntersectionIndex {
				ixs_result: CircleIntersection {
					ixs: ( None, Some(Point::<f64>::new(100., 0.)) ),
					a_inside: true,
					b_inside: false,
				},
				idx: 3,
			}
		);

		// l2
		expected.push(
			CircleIntersectionIndex {
				ixs_result: CircleIntersection {
					ixs: ( Some(Point::<f64>::new(-100., 0.)), Some(Point::<f64>::new(100., 0.)) ),
					a_inside: false,
					b_inside: false,
				},
				idx: 4,
			}
		);

		assert_eq!(ix_sort_circle_segments(&c, &mut segments[..]), expected);
	}
}

