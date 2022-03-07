#[cfg(test)]
mod tests {
	use crate::point::*;

// ---------------- POINT CREATION
 	#[test]
	fn create_float_point_works() {
		let p = PointFloat::random();

		assert!(p.x <= 1.);
		assert!(p.y <= 1.);
		assert!(p.x >= 0.);
		assert!(p.y >= 0.);

		let (x, y) = p.x_y();
		let p_dupe = PointFloat { x, y };
		assert_eq!(p, p_dupe);
	}

// ---------------- POINT COERCION



// ---------------- ORIENTATION





}