// Interface to Javascript
// For speed, alloc memory in WASM and use pointers in Javascript
// Pass in flat arrays of coordinates for segments

// https://radu-matei.com/blog/practical-guide-to-wasm-memory/
// https://github.com/WebAssembly/design/issues/1231
use crate::intersections::{ix_brute_single};
use crate::point::{orient2d};
use crate::segment::OrderedSegment;
use geo::algorithm::kernels::Orientation;
use num_traits::Num;

use wasm_bindgen::prelude::*;

// https://gist.github.com/thomas-jeepe/ff938fe2eff616f7bbe4bd3dca91a550
// https://stackoverflow.com/questions/45725975/getting-an-array-in-javascript-from-rust-compiled-to-emscripten

#[repr(C)]
#[derive(Debug)]
pub struct JsBytes {
    ptr: u32,
    len: u32,
    cap: u32,
}

impl JsBytes
{
    pub fn new<T: Num>(mut bytes: Vec<T>) -> *mut JsBytes {
        let ptr = bytes.as_mut_ptr() as u32;
        let len = bytes.len() as u32;
        let cap = bytes.capacity() as u32;
        std::mem::forget(bytes);
        let boxed = Box::new(JsBytes { ptr, len, cap });
        Box::into_raw(boxed)
    }
}

#[no_mangle]
pub fn drop_bytes(ptr: *mut JsBytes) {
    unsafe {
        let boxed: Box<JsBytes> = Box::from_raw(ptr);
        Vec::from_raw_parts(boxed.ptr as *mut u8, boxed.len as usize, boxed.cap as usize);
    }
}

fn returns_vec() -> Vec<i8> {
    vec![1, -2, 3]
}

#[no_mangle]
pub fn bytes() -> *mut JsBytes {
    JsBytes::new(returns_vec())
}


#[no_mangle]
pub fn alloc_int16_arr(len: usize) -> *mut i16 {
	// create a new mutable buffer
	let mut buf = Vec::with_capacity(len);

	// take a mutable pointer to the buffer
	let ptr = buf.as_mut_ptr();

	// take ownership of the memory block and
    // ensure that its destructor is not
    // called when the object goes out of scope
    // at the end of the function
    std::mem::forget(buf);

    // return the pointer so the runtime
    // can write data at this offset
    return ptr;
}

#[no_mangle]
pub fn alloc_int32_arr(len: usize) -> *mut i32 {
	let mut buf = Vec::with_capacity(len);
	let ptr = buf.as_mut_ptr();
	std::mem::forget(buf);
	return ptr;
}

#[no_mangle]
pub fn alloc_int32_arr_js(len: usize) -> *mut JsBytes {
	JsBytes::new(Vec::<i32>::with_capacity(len))
}

#[no_mangle]
pub fn alloc_float64_arr(len: usize) -> *mut f64 {
	let mut buf = Vec::with_capacity(len);
	let ptr = buf.as_mut_ptr();
	std::mem::forget(buf);
	return ptr;
}

#[no_mangle]
pub unsafe fn brute_i32_mem(segments_ptr: *mut i32, n_segments: usize) -> *mut JsBytes { //*mut f64 {
	let n_coords = n_segments * 4;
	let data = Vec::from_raw_parts(segments_ptr, n_coords, n_coords);

	// build segments
	let mut segments = Vec::with_capacity(n_segments);
	for i in (0..n_coords).step_by(4) {
		segments.push(OrderedSegment::new_with_idx((data[i], data[i+1]), (data[i+2], data[i+3]), i % 4));
	}


	let ixs = ix_brute_single(&segments[..]);
	let ixs_ln = ixs.len();

// 	return ixs[0].ix.x().try_into().unwrap(); // works

// 	JsBytes::new(vec![ixs[0].ix.x(), ixs[0].ix.y()]) // works


	// store x, y, so double length of the intersections, + 1 to give length

	let mut buf = Vec::<f64>::with_capacity(ixs_ln * 2);  // need x, y for each ix
	for obj in ixs {
		buf.push(obj.ix.x());
		buf.push(obj.ix.y());
	}

	JsBytes::new(buf)

// 	return buf[0];

// 	let ptr = buf.as_mut_ptr() as u32;
// 	let len = buf.len() as u32;
// 	let cap = buf.capacity() as u32;
// 	std::mem::forget(buf);
// 	let boxed = Box::new(JsBytes { ptr, len, cap });
// 	Box::into_raw(boxed)
// 	JsBytes::new(buf)


// 	let buf_ln = (ixs_ln * 2) + 1;
// 	let mut buf = Vec::with_capacity(buf_ln as usize);
// 	buf[0] = ixs_ln as f64;
// 	let ptr = buf.as_mut_ptr();
// 	ptr


// 	buf[0] = ixs_ln as f64;
// 	for i in (0..buf_ln).step_by(2) {
// 		let ixs_i = (i % 2);
// 		assert!(ixs_i < ixs_ln);
//
// 		buf[i] = ixs[ixs_i].ix.x();
// 		buf[i+1] = ixs[ixs_i + 1].ix.y();
// 	}

// 	std::mem::forget(buf);
// 	return ptr;
}



#[wasm_bindgen]
pub fn orient2d_js(ax: i32, ay: i32, bx: i32, by: i32, cx: i32, cy: i32) -> i8 {
	let res = orient2d((ax, ay).into(), (bx, by).into(), (cx, cy).into());
	match res {
		Orientation::Clockwise => 1,
		Orientation::CounterClockwise => -1,
		Orientation::Collinear => 0
	}
}



