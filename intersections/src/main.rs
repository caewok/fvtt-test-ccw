// TO-DO: Possibly switch to geo crate to handle points, lines.
// For now, create from scratch to learn rust.

#[derive(Debug)]
struct Point {
  x: f64,
  y: f64,
}

/// Determine the relative orientation of three points in two-dimensional space.
/// The result is also an approximation of twice the signed area of the triangle
/// defined by the three points. This method is fast but not robust against issues
/// of floating point precision. Best used with integer coordinates.
/// Adapted from https://github.com/mourner/robust-predicates
fn orient2d(a: &Point, b: &Point, c: &Point) -> f64 {
  (a.x - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y)
}

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
      x: 2387.0,
      y: 1350.0,
    };

    let o = orient2d(&a, &b, &c);
    dbg!(&a);
    dbg!(&b);
    dbg!(&c);

    println!("Point orientation is {}", o);
}
