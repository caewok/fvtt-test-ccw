// TO-DO: Possibly switch to geo crate to handle points, lines.
// For now, create from scratch to learn rust.
// for nightly:
// cargo +nightly build
// cargo +nightly test
// cargo +nightly benchmark
// cargo +nightly run

// #![feature(test)]
//#![feature(saturating_int_impl)]

// extern crate test;

pub mod point;
pub mod segment;
pub mod intersections;
pub mod js_api;

