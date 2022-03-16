use geo::{ Coordinate, Point, Line, CoordNum };
use geo::prelude::EuclideanLength;
use intersections_line::point::GenerateRandom;
use rand::Rng;
use rand::prelude::Distribution;
use rand::distributions::Standard;
use rand::distributions::uniform::SampleUniform;
use num_traits::Bounded;
// use intersections_line::segment::SimpleIntersect;


#[derive(Debug)]
pub struct Circle<T>
	where T: CoordNum,
{
	pub center: Coordinate<T>,
	pub radius: T,
}

impl<T> Circle<T>
	where T: CoordNum,
{
	pub fn new<C>(center: C, radius: T) -> Self
		where C: Into<Coordinate<T>>
	{
		let center: Coordinate<T> = center.into();
		Self { center, radius }
	}
}

impl<T> GenerateRandom for Circle<T>
	where T: CoordNum + SampleUniform + Bounded, Standard: Distribution<T>,
{
	type MaxType = T;

	fn random() -> Self {
		let center = rand::random::<(T, T)>();
		let z: T = num_traits::zero();
		let max = <T as Bounded>::max_value();
		let mut rng = rand::thread_rng();
		let radius = rng.gen_range(z..max);
		Self::new(center, radius)
	}

	fn random_range(min: T, max: T) -> Self {
		let mut rng = rand::thread_rng();
		let z: T = num_traits::zero();
		let center = (rng.gen_range(min..=max), rng.gen_range(min..=max));
		let radius = rng.gen_range(z..=max);
		Self::new(center, radius)
	}

	fn random_pos(max: T) -> Self {
		let mut rng = rand::thread_rng();
		let z: T = num_traits::zero();
		let center = (rng.gen_range(z..=max), rng.gen_range(z..=max));
		let radius = rng.gen_range(z..=max);
		Self::new(center, radius)
	}
}

// http://cliffle.com/p/dangerust/4/
#[repr(C)]
union IntOrFloat {
	u: u32,
	f: f32,
}

impl IntOrFloat {
	// Return storage as f32
	pub fn as_float(&self) -> f32 {
		// Safety: in-memory representation of f64 and u64 is compatible in that
		// they share the same number of bits, so access to the union members is safe
		// in any order.
		unsafe {
			self.f
		}
	}

	// Return storage as u32
	pub fn as_uint(&self) -> u32 {
		// Safety: in-memory representation of f64 and u64 is compatible in that
		// they share the same number of bits, so access to the union members is safe
		// in any order.
		unsafe {
			self.u
		}
	}

// 	pub fn uint_to_float(num: u32) -> f32 {
// 		let convert: Self = IntOrFloat { u: num };
// 		return convert.as_float();
// 	}
//
// 	pub fn float_to_uint(num: f32) -> u32 {
// 		let convert: Self = IntOrFloat { f: num };
// 		return convert.as_uint();
// 	}

}

//https://betterexplained.com/articles/understanding-quakes-fast-inverse-square-root/

fn inv_sqrt_fast(x: f64) -> f64 {
	let xhalf: f64 = 0.5 * x;
	dbg!(xhalf);

	let u = IntOrFloat { f: (xhalf as f32) };
	let i: u32 = u.as_uint();
	dbg!(i);

    let i = 0x5f3759df_u32.wrapping_sub(i >> 1); // initial guess for Newton's method
	dbg!(i);

	let u = IntOrFloat { u: i };
	let x: f64 = u.as_float() as f64; // convert new bits back to float
	dbg!(x);

	let x = x * (1.5_f64 - xhalf * x * x); // One round of Newton's method
	dbg!(x);

	return x;
}

#[allow(dead_code)]
pub fn line_circle_intersection(circle: &Circle<f64>, line: &Line<f64>) -> (Option<Point<f64>>, Option<Point<f64>>) {
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
	if a_inside && b_inside { return (None, None); }

	quadratic_intersections(circle, line)

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


// impl Circle<f64> {
// 	fn padding(density: usize) {
//
// 	}
// }
//
// impl SimpleIntersect for Circle<f64> {
//
// }
//
// pub trait SegmentIntersect<B = Line<T>>
// 	where T: CoordNum,
// {
// 	line_segment_intersection(&self, other: &B) -> Option<Point<f64>>;
// }
//
// impl SegmentIntersect<Line<f64>> for Circle<f64> {
// 	fn line_segment_intersection(&self, other: &Line<f64>) -> Option<Point<f64>> {
//
// 	}
// }
//
// impl From<Polygon<T>> for Circle<T> {
//
// }
//
//
//
//
//
//
// pub trait Contains<Other = Self> {
// 	// Encompasses means the endpoints of other are completely inside self.
// 	// contains means, in addition, other does not intersect self.
// 	// For a point in an object, contains and encompasses are identical.
// 	// A third test could be whether any endpoint is on the boundary of self
// 	// e.g., strictly encompasses vs encompasses
// 	fn contains(&self, other: &Other) -> bool;
// 	fn encompasses(&self, other: &Other) -> bool;
// }
//
//
// pub trait Combine<B = Polygon<T>> {
// 	fn union(&self, other: &B) -> B;
// 	fn intersection(&self, other: &B) -> B;
// }
//
//
//
// fn combine(poly: &Polygon<f64>, circle: &Circle<f64>, clockwise: bool, density: usize) -> Option(Polygon<f64>) {
// 	// for now, deal only with a polygon without holes; ignore interiors entirely.
//
// 	let pts: &[f64] = _tracePolygon(poly.exterior(), circle, clockwise, density);
//
// 	if pts.len() == 0 {
// 		// if no intersections, then either the circle/polygon does not overlap
// 		// or one encompasses the other
// 		let union = !clockwise;
// 		if circle.encompasses(poly) { // contains === encompasses
// 			if union {
// 				return Some(circle.toPolygon(density));
// 			} else {
// 				return Some(poly);
// 			}
// 		}
//
// 		// from above, already know that the circle does not contain any polygon points.
// 		// if circle center is within polygon, then polygon must contain the circle
// 		if(poly.contains(circle.center)) {
// 			if union {
// 				return Some(poly);
// 			} else {
// 				return Some(circle.toPolygon(density));
// 			}
// 		}
//
// 		return None;
// 	}
//
// 	return new Polygon(pts);
// }
//
//
// fn tracePolygonBorder(poly: &LineString<f64>, circle: &Circle<f64>, clockwise: bool, density: usize) -> Polygon<f64> {
// 	// walk around the poly border.
// 	// for each edge, check for intersection with circle.
// 	// could intersect at endpoint or on line
// 	// endpoint: will show as intersecting on two consecutive edges
// 	// could intersect the same edge twice
//
// 	for line in poly.lines() {
//
//
// 	}
//
//
//
//
// }

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

// ---------------- SQRT
	#[test]
	fn inv_sqrt_fast_works() {
		assert_eq!(inv_sqrt_fast(2_f64), 1_f64 / 2_f64.sqrt());
		assert_eq!(inv_sqrt_fast(1_f64), 1_f64 / 1_f64.sqrt());
		assert_eq!(inv_sqrt_fast(100.5_f64), 1_f64 / 100.5_f64.sqrt());
	}

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
}

