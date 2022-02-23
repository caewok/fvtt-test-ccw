// const gridSize = 3;
// const buffer = [];
// for (let x = 0; x < gridSize; x++) {
//   let currXArr = [];
//   buffer.push(currXArr);
//   for (let y = 0; y < gridSize; y++) {
//     let currYArr = [];
//     currXArr.push(currYArr);
//     for (let z = 0; z < gridSize; z++) {
//       currYArr.push(new Float32Array([x,y,z]));
//     }
//   }
// }

function bruteGPUIx2(a, b) {
  //let s1 = a[this.thread.x];
  //let s2 = b[this.thread.y];

  return [a[this.thread.x], b[this.thread.y]];
}

gpuBrute2 = gpu.createKernel(bruteGPUIx2,
		{ fixIntegerDivisionAccuracy: false,
		  dynamicOutput: true,
			returnType: 'Array(2)' })

function gpuBrute2BM(segments1, segments2) {
  const ln1 = segments1.length
  const ln2 = segments2.length

  const s1_arr = [];
  const s2_arr = [];

  segments1.forEach(s => s1_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y])));
  segments2.forEach(s => s2_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y])));

		gpuBrute2.setOutput([ln1, ln2])
  const out = gpuBrute2(
					myGPU.input(
						s1_arr, [ln1]),
					myGPU.input(
						s2_arr, [ln2])
					);
// 	gpuBrute.destroy();
	return out;
}

segments1 = randomSegments(1);
segments2 = randomSegments(2);

gpuBrute2BM(segments1, segments2);




gridSize = 8;
buffer = [];
for (let x = 0; x < gridSize; x++) {
  let currXArr = [];
  buffer.push(currXArr);
  for (let y = 0; y < gridSize; y++) {
    let currYArr = [];
    currXArr.push(currYArr);
    for (let z = 0; z < gridSize; z++) {
      currYArr.push(new Float32Array([x,y,z]));
    }
  }
}

pipelineFuncSettings = {
  output: [gridSize, gridSize, gridSize],
  pipeline: true,
  returnType: 'Array(3)',
};
copyFramebufferFuncImmutable = gpu.createKernel(function(framebufTex) {
  const voxelColour = framebufTex[this.thread.x][this.thread.y][this.thread.z];
  return [voxelColour[0], voxelColour[1], voxelColour[2]];
}, {...pipelineFuncSettings, immutable: true, argumentTypes: {framebufTex: 'Array3D(3)'}});


bufferTex = copyFramebufferFuncImmutable(buffer);
texArray  = bufferTex.toArray();

// see if we can do something similar with segments1
segments1 = randomSegments(2);
segments2 = randomSegments(3);

ln1 = segments1.length
ln2 = segments2.length
s1_arr = [];
s2_arr = [];
segments1.forEach(s => s1_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y])));
segments2.forEach(s => s2_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y])));

pipelineFuncSettings = {
  output: [ln1, ln2],
  pipeline: true,
  returnType: 'Array(4)',
};

copyFramebufferFuncImmutable = gpu.createKernel(function(a, b) {
  const s1 = a[this.thread.x];
  const s2 = b[this.thread.y];

  return s1;
}, {...pipelineFuncSettings, immutable: true, argumentTypes: {a: 'Array1D(4)', b: 'Array1D(4)' }});

bufferTex = copyFramebufferFuncImmutable(s1_arr, s2_arr);
texArray  = bufferTex.toArray();

// now set up something bigger

// leave args as single numbers so they can be rearranged
function orient2dGPU(ax, ay, bx, by, cx, cy) {
  return (ay - cy) * (bx - cx) - (ax - cy) * (by - cy);
} // returns number

function lineSegmentIntersectsGPU(s1, s2) {
  // segment1 A endpoint
  const ax = s1[0];
  const ay = s1[1];

  // segment1 B endpoint
  const bx = s1[2];
  const by = s1[3];

  // segment2 A endpoint
  const cx = s2[0];
  const cy = s2[1];

  // segment2 B endpoint
  const dx = s2[2];
  const dy = s2[3];

  const xab = (orient2dGPU(ax, ay, bx, by, cx, cy) *
               orient2dGPU(ax, ay, bx, by, dx, dy));

  const xcd = (orient2dGPU(cx, cy, dx, dy, ax, ay) *
               orient2dGPU(cx, cy, dx, dy, bx, by));

  // note: doesn't work if xab or xcd are boolean.
  if(xab <= 0 && xcd <= 0) return 1;
  return 0;

} // returns boolean converted to 0|1



function lineLineIntersectionGPU(s1, s2) {
  // segment1 A endpoint
  const ax = s1[0];
  const ay = s1[1];

  // segment1 B endpoint
  const bx = s1[2];
  const by = s1[3];

  // segment2 A endpoint
  const cx = s2[0];
  const cy = s2[1];

  // segment2 B endpoint
  const dx = s2[2];
  const dy = s2[3];

  const dnm = (dy - cy) * (bx - ax) - (dx - cx) * (by - ay);
  const t0 = ((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)) / dnm;

	return [ax + t0 * (bx - ax),
				  ay + t0 * (by - ay)];
} // returns Array(2) (ignore t0 for now)

let cpu = new window.GPU({ mode: "cpu", fixIntegerDivisionAccuracy: false })
let gpu = new window.GPU({ fixIntegerDivisionAccuracy: false });

let arg_types = { ax: 'Number', ay: 'Number',
									bx: 'Number', by: 'Number',
									cx: 'Number', cy: 'Number',
									dx: 'Number', dy: 'Number' }

cpu.addFunction(orient2dGPU, { returnType: 'Number',
                               argumentTypes: arg_types });

gpu.addFunction(orient2dGPU, { returnType: 'Number',
                               argumentTypes: arg_types });

cpu.addFunction(lineSegmentIntersectsGPU, { returnType: 'Integer',
                                            argumentTypes: { s1: 'Array(4)', s2: 'Array(4)' } });

gpu.addFunction(lineSegmentIntersectsGPU, { returnType: 'Integer',
                                            argumentTypes: { s1: 'Array(4)', s2: 'Array(4)' } });

cpu.addFunction(lineLineIntersectionGPU, { returnType: 'Array(2)',
                                            argumentTypes: { s1: 'Array(4)', s2: 'Array(4)' } });

gpu.addFunction(lineLineIntersectionGPU, { returnType: 'Array(2)',
                                            argumentTypes: { s1: 'Array(4)', s2: 'Array(4)' } });

function bruteGPUImmutable(a, b) {
  const s1 = a[this.thread.x];
  const s2 = b[this.thread.y];

  //return s2;

  // segment1 A endpoint
//   const ax = s1[0];
//   const ay = s1[1];
//
//   // segment1 B endpoint
//   const bx = s1[2];
//   const by = s1[3];
//
//   // segment2 A endpoint
//   const cx = s2[0];
//   const cy = s2[1];
//
//   // segment2 B endpoint
//   const dx = s2[2];
//   const dy = s2[3];

//   return [cx, cy, dx, dy];
//
//   return [orient2dGPU(ax, ay, bx, by, cx, cy),
//           orient2dGPU(ax, ay, bx, by, dx, dy),
//           orient2dGPU(cx, cy, dx, dy, ax, ay),
//           orient2dGPU(cx, cy, dx, dy, bx, by)];

  const intersects = lineSegmentIntersectsGPU(s1, s2);

//   return [intersects, intersects, intersects, intersects]

  if(intersects === 0) {
    return [-1, -1];
  }

  return lineLineIntersectionGPU(s1, s2);
}

// see if we can do something similar with segments1
segments1 = randomSegments(2);
segments2 = randomSegments(3);

ln1 = segments1.length
ln2 = segments2.length
s1_arr = [];
s2_arr = [];
segments1.forEach(s => s1_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y]))); // same using Float32Array
segments2.forEach(s => s2_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y])));


// fake segments for tracking
s1_arr = [];
s2_arr = [];
segments1.forEach((s, idx) => s1_arr.push(new Float32Array([idx*4, idx*4 + 1, idx * 4 + 2, idx * 4 + 3])))
segments2.forEach((s, idx) => s2_arr.push(new Float32Array([idx*4, idx*4 + 1, idx * 4 + 2, idx * 4 + 3])))


pipelineFuncSettings = {
  output: [ln1, ln2],
  pipeline: true,
  returnType: 'Array(2)',
};

copyFramebufferFuncImmutable = gpu.createKernel(bruteGPUImmutable, {...pipelineFuncSettings, immutable: true, argumentTypes: {a: 'Array1D(4)', b: 'Array1D(4)' }});

bufferTex = copyFramebufferFuncImmutable(s1_arr, s2_arr);
texArray  = bufferTex.toArray();

// confirm accuracy
// orient2GPU
//   return [orient2dGPU(ax, ay, bx, by, cx, cy),
//           orient2dGPU(ax, ay, bx, by, dx, dy),
//           orient2dGPU(cx, cy, dx, dy, ax, ay),
//           orient2dGPU(cx, cy, dx, dy, bx, by)];
out = []
for(let i = 0; i < ln2; i += 1) {
  let s2 = s2_arr[i];
  let out2 = []
  out.push(out2)
  for(let j = 0; j < ln1; j += 1) {
    let s1 = s1_arr[j];
    out2.push(new Float32Array([orient2dGPU(s1[0], s1[1], s1[2], s1[3], s2[0], s2[1]),
               orient2dGPU(s1[0], s1[1], s1[2], s1[3], s2[2], s2[3]),
               orient2dGPU(s2[0], s2[1], s2[2], s2[3], s1[0], s1[1]),
               orient2dGPU(s2[0], s2[1], s2[2], s2[3], s1[2], s1[3]) ]));
  }
}

// intersects
//   return [intersects, intersects, intersects, intersects]
out = []
for(let i = 0; i < ln2; i += 1) {
  let s2 = s2_arr[i];
  let out2 = []
  out.push(out2)
  for(let j = 0; j < ln1; j += 1) {
    let s1 = s1_arr[j];
    let res = lineSegmentIntersectsGPU(s1, s2);

    out2.push(new Float32Array([res, res, res, res]));
  }
}

// compare for equality
is_equal = true;
for(let i = 0; i < ln2; i += 1) {
  for(let j = 0; j < ln1; j += 1) {
    if(!texArray[i][j].every((elem, idx) => elem === out[i][j][idx])) {
      is_equal = false;
      console.log(`${i},${j} not equal.`)
    }
  }
}

// benchmark
function gpuBrute2BM(segments1, segments2) {
  const ln1 = segments1.length
  const ln2 = segments2.length

  const s1_arr = [];
  const s2_arr = [];

	segments1.forEach(s => s1_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y]))); // same using Float32Array
	segments2.forEach(s => s2_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y])));

	pipelineFuncSettings = {
		output: [ln1, ln2],
		pipeline: true,
		returnType: 'Array(2)',
	};

	copyFramebufferFuncImmutable = gpu.createKernel(bruteGPUImmutable, {...pipelineFuncSettings, immutable: true, argumentTypes: {a: 'Array1D(4)', b: 'Array1D(4)' }});

	bufferTex = copyFramebufferFuncImmutable(s1_arr, s2_arr);
	return bufferTex.toArray();
}


// see if we can do something similar with segments1
segments1 = randomSegments(1000);
segments2 = randomSegments(1000);

N = 100
await benchmarkLoopFn(N, gpuBrute2BM, "js", segments1, segments2)
// 1000 takes 87 ms; much faster but still slower than js


// probably don't need to pipeline; set up regular version


gpuBrute2 = gpu.createKernel(bruteGPUImmutable,
		{ dynamicOutput: true,
		  argumentTypes: {a: 'Array1D(4)', b: 'Array1D(4)' },
			returnType: 'Array(2)' })

function gpuBrute2BM(segments1, segments2) {
  const ln1 = segments1.length
  const ln2 = segments2.length

  const s1_arr = [];
  const s2_arr = [];

	segments1.forEach(s => s1_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y]))); // same using Float32Array
	segments2.forEach(s => s2_arr.push(new Uint16Array([s.A.x, s.A.y, s.B.x, s.B.y])));

  const gpuBrute2 = gpu.createKernel(bruteGPUImmutable,
		{ dynamicOutput: false,
		  argumentTypes: {a: 'Array1D(4)', b: 'Array1D(4)' },
		  output: [ln1, ln2],
			returnType: 'Array(2)' })

// 	gpuBrute2.setOutput([ln1, ln2]);
	return gpuBrute2(s1_arr, s2_arr);
}


segments1 = randomSegments(2000);
segments2 = randomSegments(2000);

gpuBrute2BM(segments1, segments2)

N = 100
await benchmarkLoopFn(N, gpuBrute2BM, "js", segments1, segments2)

// comparable to pipeline version but still too long for 1000: 90 ms vs ~ 30–50 ms
// same if using non-dynamic output: ~ 90 ms
// 2000: 469 ms

