// Interface to Javascript
// For speed, alloc memory in WASM and use pointers in Javascript
// Pass in flat arrays of coordinates for segments

// https://radu-matei.com/blog/practical-guide-to-wasm-memory/
// https://github.com/WebAssembly/design/issues/1231
use crate::intersections::{ix_brute_single};
use crate::point::{orient2d};
use crate::segment::OrderedSegment;
use geo::algorithm::kernels::Orientation;
use num_traits::{Num, ToPrimitive, FromPrimitive};

use wasm_bindgen::prelude::*;

// https://gist.github.com/thomas-jeepe/ff938fe2eff616f7bbe4bd3dca91a550
// https://stackoverflow.com/questions/45725975/getting-an-array-in-javascript-from-rust-compiled-to-emscripten

// Create specific structs for passing vectors to/from Javascript
// Take in a single vector of segment coordinates
// i16 (-32767 to 32767)
// u16 (0 to 65535)
// i32 (-2_147_483_647 to 2_147_483_647)
// Likely able to make do with either u16 or i32
//
// Return two vectors:
// - f64 of intersection coordinates
// - u32 of intersection indices


// Setup log to javascript
// https://rustwasm.github.io/wasm-bindgen/examples/console-log.html
#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    // Note that this is using the `log` function imported above
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}



#[derive(Debug, Copy, Clone, FromPrimitive, ToPrimitive)]
pub enum JsBytesUnit {
	F64 = 1,
	U32 = 2,
	I32 = 3,
	U16 = 4,
}



#[repr(C)]
#[derive(Debug)]
pub struct JsBytes {
    ptr: u32,
    len: u32,
    cap: u32,
    units: u32, // seems to need u32 so these fields are all aligned
}

#[repr(C)]
#[derive(Debug)]
pub struct JsBytesDouble {
	ptr0: u32,
	len0: u32,
	cap0: u32,
	units0: u32,

	ptr1: u32,
	len1: u32,
	cap1: u32,
	units1: u32,
}

impl JsBytes {
    pub fn new<T: Num>(mut bytes: Vec<T>, units: JsBytesUnit) -> *mut JsBytes {
        let ptr = bytes.as_mut_ptr() as u32;
        let len = bytes.len() as u32;
        let cap = bytes.capacity() as u32;
        let units = ToPrimitive::to_u32(&units).unwrap();
        std::mem::forget(bytes);
        let boxed = Box::new(JsBytes { ptr, len, cap, units });
        Box::into_raw(boxed)
    }
}

impl JsBytesDouble {
	pub fn new<T: Num, U: Num>(mut bytes0: Vec<T>, units0: JsBytesUnit,
	     					   mut bytes1: Vec<U>, units1: JsBytesUnit) -> *mut JsBytesDouble {
		let ptr0 = bytes0.as_mut_ptr() as u32;
        let len0 = bytes0.len() as u32;
        let cap0 = bytes0.capacity() as u32;
        let units0 = ToPrimitive::to_u32(&units0).unwrap();

		let ptr1 = bytes1.as_mut_ptr() as u32;
        let len1 = bytes1.len() as u32;
        let cap1 = bytes1.capacity() as u32;
        let units1 = ToPrimitive::to_u32(&units1).unwrap();

        std::mem::forget(bytes0);
        std::mem::forget(bytes1);

		let boxed = Box::new(JsBytesDouble { ptr0, len0, cap0, units0, ptr1, len1, cap1, units1 });
		Box::into_raw(boxed)
	}
}

#[no_mangle]
pub fn drop_bytes(ptr: *mut JsBytes) {
    unsafe {
        let boxed: Box<JsBytes> = Box::from_raw(ptr);
        let units: JsBytesUnit = FromPrimitive::from_u32(boxed.units).unwrap();
        match units {
        	JsBytesUnit::F64 => { Vec::from_raw_parts(boxed.ptr as *mut f64, boxed.len as usize, boxed.cap as usize); },
        	JsBytesUnit::U32 => { Vec::from_raw_parts(boxed.ptr as *mut u32, boxed.len as usize, boxed.cap as usize); },
        	JsBytesUnit::I32 => { Vec::from_raw_parts(boxed.ptr as *mut i32, boxed.len as usize, boxed.cap as usize); },
        	JsBytesUnit::U16 => { Vec::from_raw_parts(boxed.ptr as *mut u16, boxed.len as usize, boxed.cap as usize); },
        };

    }
}

#[no_mangle]
pub fn drop_bytes_double(ptr: *mut JsBytesDouble) {
    unsafe {
    	let boxed: Box<JsBytesDouble> = Box::from_raw(ptr);

		let units0: JsBytesUnit = FromPrimitive::from_u32(boxed.units0).unwrap();
		match units0 {
        	JsBytesUnit::F64 => { Vec::from_raw_parts(boxed.ptr0 as *mut f64, boxed.len0 as usize, boxed.cap0 as usize); },
        	JsBytesUnit::U32 => { Vec::from_raw_parts(boxed.ptr0 as *mut u32, boxed.len0 as usize, boxed.cap0 as usize); },
        	JsBytesUnit::I32 => { Vec::from_raw_parts(boxed.ptr0 as *mut i32, boxed.len0 as usize, boxed.cap0 as usize); },
        	JsBytesUnit::U16 => { Vec::from_raw_parts(boxed.ptr0 as *mut u16, boxed.len0 as usize, boxed.cap0 as usize); },
        }

		let units1: JsBytesUnit = FromPrimitive::from_u32(boxed.units1).unwrap();
		match units1 {
        	JsBytesUnit::F64 => { Vec::from_raw_parts(boxed.ptr1 as *mut f64, boxed.len1 as usize, boxed.cap1 as usize); },
        	JsBytesUnit::U32 => { Vec::from_raw_parts(boxed.ptr1 as *mut u32, boxed.len1 as usize, boxed.cap1 as usize); },
        	JsBytesUnit::I32 => { Vec::from_raw_parts(boxed.ptr1 as *mut i32, boxed.len1 as usize, boxed.cap1 as usize); },
        	JsBytesUnit::U16 => { Vec::from_raw_parts(boxed.ptr1 as *mut u16, boxed.len1 as usize, boxed.cap1 as usize); },
        }
    }
}

fn returns_vec() -> Vec<i32> {
    vec![1, -2, 3]
}

#[no_mangle]
pub fn bytes() -> *mut JsBytes {
    JsBytes::new(returns_vec(), JsBytesUnit::I32)
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
pub fn alloc_i32_arr_js(len: usize) -> *mut JsBytes {
	JsBytes::new(Vec::<i32>::with_capacity(len), JsBytesUnit::I32)
}

#[no_mangle]
pub fn alloc_f64_arr_js(len: usize) -> *mut JsBytes {
	JsBytes::new(Vec::<f64>::with_capacity(len), JsBytesUnit::F64)
}

#[no_mangle]
pub fn alloc_u32_arr_js(len: usize) -> *mut JsBytes {
	JsBytes::new(Vec::<u32>::with_capacity(len), JsBytesUnit::U32)
}

#[no_mangle]
pub fn alloc_u16_arr_js(len: usize) -> *mut JsBytes {
	JsBytes::new(Vec::<u16>::with_capacity(len), JsBytesUnit::U16)
}


#[no_mangle]
pub fn alloc_float64_arr(len: usize) -> *mut f64 {
	let mut buf = Vec::with_capacity(len);
	let ptr = buf.as_mut_ptr();
	std::mem::forget(buf);
	return ptr;
}



#[no_mangle]
pub unsafe fn brute_i32_mem(segments_ptr: *mut JsBytes, indices_ptr: *mut JsBytes) -> *mut JsBytes {
	let boxed: Box<JsBytes> = Box::from_raw(segments_ptr);
	let n_coords = boxed.len as usize;
	console_log!("Num coords is {} with cap {}", n_coords, boxed.cap as usize);

	let data = Vec::from_raw_parts(boxed.ptr as *mut i32, n_coords, boxed.cap as usize);

	console_log!("Data has length {}", data.len());

	// build segments
	let mut segments = Vec::with_capacity(n_coords / 4);
	for i in (0..n_coords).step_by(4) {
		console_log!("Pushing coordinates {},{}|{},{}", data[i], data[i+1], data[i+2], data[i+3]);

		segments.push(OrderedSegment::new_with_idx((data[i], data[i+1]), (data[i+2], data[i+3]), i / 4));
	}


	let ixs = ix_brute_single(&segments[..]);
	let ixs_ln = ixs.len();

	console_log!("Found {} intersections!", ixs_ln);

// 	return ixs[0].ix.x().try_into().unwrap(); // works

// 	JsBytes::new(vec![ixs[0].ix.x(), ixs[0].ix.y()]) // works


	// store x, y, so double length of the intersections, + 1 to give length

	let mut buf = Vec::<f64>::with_capacity(ixs_ln * 2);  // need x, y for each ix
	let mut indices_buf = Vec::<u32>::with_capacity(ixs_ln * 2); // need s1, s2 for each
	for obj in ixs {
		buf.push(obj.ix.x());
		buf.push(obj.ix.y());
		indices_buf.push(obj.idx1 as u32);
		indices_buf.push(obj.idx2 as u32);
	}

	console_log!("Updating Indices pointer");
	let mut idx_boxed: Box<JsBytes> = Box::from_raw(indices_ptr);
	let _old_idx_data = Vec::from_raw_parts(idx_boxed.ptr as *mut u32, idx_boxed.len as usize, idx_boxed.cap as usize);

	idx_boxed.ptr = indices_buf.as_mut_ptr() as u32;
	idx_boxed.len = indices_buf.len() as u32;
	idx_boxed.cap = indices_buf.capacity() as u32;
	std::mem::forget(indices_buf);

// 	JsBytesDouble::new(buf, JsBytesUnit::F64, indices_buf, JsBytesUnit::U32)
	JsBytes::new(buf, JsBytesUnit::F64)

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



