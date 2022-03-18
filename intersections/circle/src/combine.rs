use crate::circle::{Circle};
use geo::{ CoordNum, Coordinate, Line, LineString, MultiPoint };
use crate::circle_intersect::{ line_circle_intersection };
use num_traits::real::Real;
use float_cmp::approx_eq;

pub trait Contains<Other = Self> {
	// Encompasses means the endpoints of other are completely inside self.
	// contains means, in addition, other does not intersect self.
	// For a point in an object, contains and encompasses are identical.
	// A third test could be whether any endpoint is on the boundary of self
	// e.g., strictly encompasses vs encompasses
	fn contains(&self, other: &Other) -> bool;
	fn encompasses(&self, other: &Other) -> bool;
}

impl<T> Contains<Coordinate<T>> for Circle<T>
	where T: CoordNum + Real,
{
	fn contains(&self, other: &Coordinate<T>) -> bool {
		let z: T = num_traits::zero();

		if self.radius <= z { return false; }

		let r2 = self.radius.powi(2);
		let mut delta = self.center - *other;

		delta.x = delta.x.powi(2);
		delta.y = delta.y.powi(2);

		(delta.x + delta.y) <= r2
	}

	fn encompasses(&self, other: &Coordinate<T>) -> bool {
		self.contains(other)
	}
}

// impl Contains<Line<T>> for Circle<T>
// 	where T: CoordNum,
// {
// 	fn contains(&self, other: Line<T>) -> bool {
//
// 	}
// }


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



fn trace_polygon_border(poly: &LineString<f64>, circle: &Circle<f64>, clockwise: bool, density: usize) -> MultiPoint<f64> {
	// walk around the poly border.
	// for each edge, check for intersection with circle.
	// could intersect at endpoint or on line
	// endpoint: will show as intersecting on two consecutive edges
	// could intersect the same edge twice

	// likely capacity: at most the polygon points + circle points + intersections
	// but unlikely to be that much b/c unlikely (impossible?) to use all points from
	// circle and polygon
	// so try every polygon point + double the density (num points for 360º given density)
	let cap = poly.0.len() * 2 + density * 2;
	let mut pts: Vec<Coordinate<f64>> = Vec::with_capacity(cap);

	// store the starting edges
	// could not be more than poly.len() * 2
	// tradeoff with likely number of points before encountering intersection:
	// - worst case is every edge but one
	// - half or 1/4 is likely
	let mut intersection_data = ProcessedIntersectionData {
		clockwise,
		is_tracing_segment: false,
		ix: None,
		density,
		circle_start: None,
		a_inside: true,
		b_inside: true,
	};

	let mut edges: Vec<Line<f64>> = poly.lines().collect();

	// first, find the first intersecting edge
	// then loop around until back at the first intersecting edge
	let max_iterations = edges.len() * 2;
	let ln = edges.len();
	let mut first_intersecting_edge_idx: isize = -1;
	let mut circled_back = false;
	for i in 0..max_iterations {
		println!("\n{}:", i);
		if circled_back {
			println!("Back to first intersecting edge—breaking out!");
			break;
		}

		let edge_idx = i % ln;
		let edge = edges[edge_idx];

		if edge_idx as isize == first_intersecting_edge_idx {
			circled_back = true;
			println!("Breaking after this iteration!");
		}

		let ixs_result = line_circle_intersection(&circle, &edge);
		match ixs_result.ixs {
			(None, None) => {
				println!("No intersection");
				// if first_intersecting_edge_idx == -1 { starting_edges.push(line); }
			},

			(Some(ix1), Some(ix2)) => {
				println!("Handling intersections {},{} and {},{}", ix1.x(), ix1.y(), ix2.x(), ix2.y());
				if first_intersecting_edge_idx == -1 {
					first_intersecting_edge_idx = edge_idx as isize;
					intersection_data.is_tracing_segment = true;
				}

				// we must have a outside --> i0 ---> i1 ---> b outside
				intersection_data.ix = Some(ix1.into());
				intersection_data.a_inside = ixs_result.a_inside;
				intersection_data.b_inside = ixs_result.b_inside;

				let mut processed_pts = process_intersection(&circle, &edge, &mut intersection_data, false);
				pts.append(&mut processed_pts);

				intersection_data.ix = Some(ix2.into());
				let mut processed_pts = process_intersection(&circle, &edge, &mut intersection_data, true);
				pts.append(&mut processed_pts);
			},

			(Some(ix), None) => {
				println!("Handling intersection {},{}", ix.x(), ix.y());
				if first_intersecting_edge_idx == -1 {
					first_intersecting_edge_idx = edge_idx as isize;
					intersection_data.is_tracing_segment = true;
				}
				intersection_data.ix = Some(ix.into());
				intersection_data.a_inside = ixs_result.a_inside;
				intersection_data.b_inside = ixs_result.b_inside;

				let mut processed_pts = process_intersection(&circle, &edge, &mut intersection_data, false);
				pts.append(&mut processed_pts);
			}

			(None, Some(ix)) => {
				println!("Handling intersection {},{}", ix.x(), ix.y());
				if first_intersecting_edge_idx == -1 {
					first_intersecting_edge_idx = edge_idx as isize;
					intersection_data.is_tracing_segment = true;
				}
				intersection_data.ix = Some(ix.into());
				intersection_data.a_inside = ixs_result.a_inside;
				intersection_data.b_inside = ixs_result.b_inside;

				let mut processed_pts = process_intersection(&circle, &edge, &mut intersection_data, false);
				pts.append(&mut processed_pts);
			},
		}

		if intersection_data.is_tracing_segment & !circled_back {
			// add the edge B vertex to points array
			println!("Adding endpoint {},{}", edge.end.x, edge.end.y);
			pts.push(edge.end);
		}

	}

	pts.into()
}

struct ProcessedIntersectionData {
	clockwise: bool,
	is_tracing_segment: bool,
	ix: Option<Coordinate<f64>>,
	a_inside: bool,
	b_inside: bool,
	density: usize,
	circle_start: Option<Coordinate<f64>>,
}

fn process_intersection(circle: &Circle<f64>,
						line: &Line<f64>,
						ix_data: &mut ProcessedIntersectionData,
						is_second_ix: bool) -> Vec<Coordinate<f64>> {
	let start_inside = ix_data.a_inside;
	let end_inside = ix_data.b_inside;
	let clockwise = ix_data.clockwise;
// 	let start_inside = circle.contains(line.start);
// 	let end_inside = circle.contains(line.end);
	let was_tracing_segment = ix_data.is_tracing_segment;
	let ix = ix_data.ix.unwrap();

	let is_tracing_segment = match (start_inside, end_inside) {
		(false, false) => {
			// two intersections
			// we must have a outside --> i0 ---> i1 ---> b outside
			if is_second_ix {
				!clockwise
			} else {
				clockwise
			}
		},
		(true, false) => !clockwise,
		(false, true) => clockwise, // on circle if we want CCW direction
		(true, true) => panic!("process_intersection encountered a line with both endpoints inside the circle!"),
	};

	println!("Ix {},{}: Tracing segment: {} (Was tracing: {})", ix.x, ix.y, is_tracing_segment, was_tracing_segment);

	let mut padding: Vec<Coordinate<f64>> =
		if !was_tracing_segment && is_tracing_segment {
			// we have moved circle to segment; pad the previous intersection to here

			let from_pt = ix_data.circle_start.unwrap();
			ix_data.circle_start = None;
			println!("Moved from circle to segment; padding from {},{} to {},{}", from_pt.x, from_pt.y, ix.x, ix.y);
			circle.as_points(from_pt, ix, ix_data.density)
		} else if was_tracing_segment && !is_tracing_segment {
			// we have moved from segment to circle; remember the previous intersection
			println!("Moved from segment to circle; storing {},{}", ix.x, ix.y);
			ix_data.circle_start = Some(ix);
			Vec::with_capacity(1)
		} else {
			Vec::with_capacity(1)
		};

	// if we were tracing the segment or are now tracing the segment, add intersection
    // (skip if we are just continuing the circle)
    // (also skip if the intersection is equal to line end)
	if was_tracing_segment || is_tracing_segment &&
	   !(approx_eq!(f64, line.end.x, ix.x, ulps = 2) &&
	     approx_eq!(f64, line.end.y, ix.y, ulps = 2)) {
	      println!("Adding ix {},{}", ix.x, ix.y);
		padding.push(ix);
	};

	ix_data.is_tracing_segment = is_tracing_segment;

	padding
}



// display stdout during testing:
// cargo test -- --nocapture
#[cfg(test)]
mod tests {
	use super::*;
	use geo::{ Coordinate };

	#[test]
	fn contains_point_works() {
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.,
		};

		let inside: Coordinate<f64> = Coordinate { x: 25., y: -25. };
		let outside: Coordinate<f64> = Coordinate { x: -150., y: -150. };
		let border: Coordinate<f64> = Coordinate { x: 100., y: 0. };

		assert!(c.contains(&inside));
		assert!(!c.contains(&outside));
		assert!(c.contains(&border));
	}

	#[test]
	fn circle_poly_union_works() {
		// for ccw-oriented polygon:
		// intersect: clockwise = true
		// union: clockwise = false
		let density = 12_usize;
		let clockwise = false;
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.,
		};

		// diamond shape with one point at circle center
		let ls: LineString<f64> = vec![
			Coordinate { x: -200., y: 0. },
			Coordinate { x: -100., y: 200. },
			Coordinate { x: 0., y: 0. },
			Coordinate { x: -100., y: -200. },
			Coordinate { x: -200., y: 0. } // closed
		].into();


		let res = trace_polygon_border(&ls, &c, clockwise, density);

		let mut expected: Vec<Coordinate<f64>> = vec![
			Coordinate { x: -44.721359549995796, y: 89.44271909999159 },
		];


		expected.append(&mut c.as_points(expected[0], Coordinate { x: -44.721359549995796, y: -89.44271909999159}, density));
		expected.push(Coordinate { x: -44.721359549995796, y: -89.44271909999159});
		expected.push(Coordinate { x: -100., y: -200. });
		expected.push(Coordinate { x: -200., y: 0. });
		expected.push(Coordinate { x: -100., y: 200. });
		expected.push(Coordinate { x: -44.721359549995796, y: 89.44271909999159 });

		let expected: MultiPoint<f64> = expected.into();
		assert_eq!(res, expected); // todo: fix
	}

	#[test]
	fn circle_poly_intersect_works() {
		// for ccw-oriented polygon:
		// intersect: clockwise = true
		// union: clockwise = false
		let density = 12_usize;
		let clockwise = true;
		let c: Circle<f64> = Circle {
			center: Coordinate { x: 0., y: 0. },
			radius: 100.,
		};

		// diamond shape with one point at circle center
		let ls: LineString<f64> = vec![
			Coordinate { x: -200., y: 0. },
			Coordinate { x: -100., y: 200. },
			Coordinate { x: 0., y: 0. },
			Coordinate { x: -100., y: -200. },
			Coordinate { x: -200., y: 0. } // closed
		].into();


		let res = trace_polygon_border(&ls, &c, clockwise, density);

		let mut expected: Vec<Coordinate<f64>> = vec![
			Coordinate { x: -44.721359549995796, y: 89.44271909999159 },
			Coordinate { x: 0., y: 0. },
			Coordinate { x: -44.721359549995796, y: -89.44271909999159},
		];

		expected.append(&mut c.as_points(expected[2], expected[0], density));
		expected.push(expected[0]);

		let expected: MultiPoint<f64> = expected.into();
		assert_eq!(res, expected); // todo: fix
	}

}

