// TO-DO: Possibly switch to geo crate to handle points, lines.
// For now, create from scratch to learn rust.


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
      x: 3200,0,
      y: 1350.0,
    };

    let o = orient2d(&a, &b, &c);
    dbg!(&a);
    dbg!(&b);
    dbg!(&c);

    println!("Point orientation is {}", o);
}
