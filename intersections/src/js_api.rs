// Interface to Javascript
// For speed, alloc memory in WASM and use pointers in Javascript
// Pass in flat arrays of coordinates for segments

// https://radu-matei.com/blog/practical-guide-to-wasm-memory/
// https://github.com/WebAssembly/design/issues/1231

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