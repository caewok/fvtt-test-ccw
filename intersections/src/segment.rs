use geo::{Point, CoordNum, Line};

pub trait SimpleIntersect<B = Self> {
	fn intersects(&self, other: B) -> bool;
	fn line_intersection(&self, other: B) -> Option<PointFloat>;
}