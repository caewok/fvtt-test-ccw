// TO-DO: Possibly switch to geo crate to handle points, lines.
// For now, create from scratch to learn rust.
pub mod geometry;
pub mod intersections;

use geometry::{Point, Segment};
use serde_json;

fn main() {
    println!("Hello, world!");


    // horizontal line 2300,1900|4200,1900
    // point to left: 2387, 1350
    // point on line: 3200, 1900
    // point to right: 2500, 2100
    let a = Point {
      x: 2300.0,
      y: 1900.0,
    };

    let b = Point {
      x: 4200.0,
      y: 1900.0,
    };

    let c = Point {
      x: 3200.0,
      y: 1350.0,
    };

    let d = Point {
      x: 3200.0,
      y: 1900.0,
    };

    let e = Point {
      x: 2500.0,
      y: 2100.0,
    };

    let f = Point {
      x: 4300.0,
      y: 2100.0,
    };

    let g = Point {
      x: 2500.0,
      y: 2100.0,
    };

    let o = geometry::orient2d(&a, &b, &c);
    dbg!(&a);
    dbg!(&b);
    dbg!(&c);

    println!("Point orientation is {}", o);

    let s1 = Segment { a: Point { ..a }, b: Point { ..b } };
    let s2 = Segment { a: Point { ..c }, b: Point { ..d } };
    let s3 = Segment { a: Point { ..d }, b: Point { ..e } };
    let s4 = Segment { a: Point { ..f }, b: Point { ..g } };

    let serialized = serde_json::to_string(&s1).unwrap();
    println!("serialized = {}", serialized);

    let deserialized: Segment = serde_json::from_str(&serialized).unwrap();
    println!("deserialized = {:?}", deserialized);

    let segments = vec![s1, s2, s3, s4];
    let ixs = intersections::brute_single(&segments);
    dbg!(&ixs);

    // just use the same array for now
    let ixs2 = intersections::brute_double(&segments, &segments);
    dbg!(&ixs2);

    let serialized = serde_json::to_string(&segments).unwrap();
    println!("serialized = {}", serialized);

    let deserialized: Vec<Segment> = serde_json::from_str(&serialized).unwrap();
    println!("deserialized = {:?}", deserialized);


}
