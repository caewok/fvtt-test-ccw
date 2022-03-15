// API for calling WASM (rust) functions
// Includes methods for creating arbitrary numeric arrays in WASM memory to use

const JSBytesUnit = {
	F64: 1,
	U32: 2,
	I32: 3,
	U16: 4,
};

class JSBytes {

	/**
	 * Store the WASM instance used to interface with WASM memory.
	 * example: instance = await api.WASM.default();
	 * @param {Object} instance
	 */
	constructor(ptr, instance) {
		this.instance = instance;
		this.ptr = ptr;
		this.construct_array();
	}

	/**
	 * Using the pointer, access the positions on the heap corresponding to the JSBytes data.
	 */
	construct_array() {
		this.arr = new Uint32Array(this.instance.memory.buffer, this.ptr, 4);
	}

	// -------------- GETTERS
	get array_ptr() { return this.arr[0]; }
	get length() { return this.arr[1]; }
	get capacity() { return this.arr[2]; }
	get type() { return this.arr[3]; } // JSBytesUnit

	set length(value) {
		if(value > this.capacity || value < 0) {
			console.error("JSBytes: Cannot set length to ${} with capacity ${}", value, this.capacity);
			return;
		}
		this.arr[1] = value;
	}
}



class WASM_Array {

	static alloc_fn_name = {
		[`${JSBytesUnit.F64}`]: "alloc_f64_arr_js",
		[`${JSBytesUnit.I32}`]: "alloc_i32_arr_js",
		[`${JSBytesUnit.U32}`]: "alloc_u32_arr_js",
		[`${JSBytesUnit.U16}`]: "alloc_u16_arr_js",
	}

	static build_class = {
		[`${JSBytesUnit.F64}`]: Float64Array,
		[`${JSBytesUnit.I32}`]: Int32Array,
		[`${JSBytesUnit.U32}`]: Uint32Array,
		[`${JSBytesUnit.U16}`]: Uint16Array,
	}

	/**
	 * @param {int} len
	 * @param {JSBytesUnit} type	What type of numeric array?
	 */
	constructor(instance, type, capacity) {
		this.instance = instance;
		this._capacity = capacity;
		this._type = type;
	}

	static constructArray(instance, type, capacity) {
		let wasm_array = new WASM_Array(instance, type, capacity);
		wasm_array.allocateAndBuild();
		return wasm_array;
	}

	static constructJSBytes(instance, type, capacity = 1) {
		let wasm_array = new WASM_Array(instance, type, capacity);
		wasm_array.alloc(); // this.jsbytes_ptr
		wasm_array.build_JSBytes(); // this.jsbytes
		return wasm_array;
	}

	allocateAndBuild() {
		this.alloc(); // this.jsbytes_ptr
		this.build_JSBytes(); // this.jsbytes
		this.build_array(); // this.arr
	}

	static fromJSBytesPointer(ptr, instance) {
		let jsbytes = new JSBytes(ptr, instance);

		let wasm_array = new WASM_Array(instance, jsbytes.type, jsbytes.capacity);
		wasm_array.jsbytes_ptr = ptr;
		wasm_array.jsbytes = jsbytes;
		wasm_array.build_array();
		return wasm_array;
	}

	// -------------- ALLOCATE WASM MEMORY
	/**
	 * Allocate the chosen type of array with a given capacity.
	 */
	alloc() {
		console.log(`Type is ${this.type}`);
		let fn_name = WASM_Array.alloc_fn_name[this.type];
		console.log(`Allocating using ${fn_name}`);
		this.jsbytes_ptr = this.instance[fn_name](this.capacity);
	}

	// -------------- BUILD JSBYTES DATA
	build_JSBytes() {
		this.jsbytes = new JSBytes(this.jsbytes_ptr, this.instance);
	}

	get length() {
		if(!this.jsbytes) return undefined;
		return this.jsbytes.length;
	}

  set length(value) {
  	if(!jsbytes) {
  		console.warn("WASM_Array: Attempted to set length without allocating JSBytes first.");
  		return;
  	}
  	this.jsbytes.length = value;
  }

	get capacity() { return this._capacity; }
	set capacity(value) { stop("Cannot change capacity."); }

	get type() { return this._type; }
	set type(value) { stop("Cannot change value."); }

	// -------------- ARRAY ACCESS
	build_array() {
		let build_class = WASM_Array.build_class[this.type];
		this.arr = new build_class(this.instance.memory.buffer, this.jsbytes.array_ptr, this.jsbytes.capacity);
	}

	update_length() {
		this.jsbytes.length = this.arr.length;
	}

	update_JSBytes() {
		this.build_JSBytes();
		this.build_array();
	}

	// -------------- CLEANUP
	destroy() {
		try {
			this.instance.drop_bytes(this.jsbytes_ptr);
		} catch (error) {
			console.warn(error);
		}
	}

}