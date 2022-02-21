// Use gpu to process intersections

// Brute sort
/*
Input:
- pairs of points
- two arrays: intersect one versus the other

Output:
- for each pair, intersection or null?

*/

let cpu = new window.GPU({ mode: "cpu", fixIntegerDivisionAccuracy: false })
let gpu = new window.GPU({ fixIntegerDivisionAccuracy: false });

segments1 = randomEdges(2);
segments2 = randomEdges(3);

function gpuBrute(segments1, segments2) {
  let gpu = new window.GPU();
  let ln1 = segments1.length;
  let ln2 = segments2.length;

  let bruteFn = gpu.createKernel(function(a, b) {
    return [a[this.thread.x], b[this.thread.y]];
  }).setOutput([ln1, ln2]);

  s1 = [];
  s2 = [];

  segments1.forEach(s => s1.push([s.A.x, s.A.y, s.B.x, s.B.y]));
  segments2.forEach(s => s2.push([s.A.x, s.A.y, s.B.x, s.B.y]));

  return bruteFn(s1, s2);
}

bruteFn = gpu.createKernel(function(a, b) {
    return [a[this.thread.x], b[this.thread.y]];
  }).setOutput([ln1, ln2]);

bruteFn([1,2], [4,5,6])



bruteFn([[1.1, 1.2], [2.1, 2.2]],
        [[4.1, 4.2], [5.1, 5.2], [6.1, 6.2]])


// intersection
ixFn = gpu.createKernel(function(a, b, c, d) {
  const ax = a[0];
  const ay = a[1];

  const bx = b[0];
  const by = b[1];

  const cx = c[0];
  const cy = c[1];

  const dx = d[0];
  const dy = d[1];

  const dnm = (dy - cy) * (bx - ax) - (dx - cx) * (by - ay);
//   if(dnm === 0) { return [Infinity, Infinity] }

  //return [ ((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)), dnm];

  const t0 = ((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)) / dnm;

  //return [-1045000.00001 / -2042500.0, dnm];

  // will return [Infinity, NaN] if parallel
  return [ax + t0 * (bx - ax),
          ay + t0 * (by - ay)];

}, { fixIntegerDivisionAccuracy: false }).setOutput([1])

await ixFn.destroy()
await gpu.destroy()


// 0
// A: Vertex {x: 2387, y: 1350}
// B: Vertex {x: 3987, y: 2425}
//
// 1
// A: Vertex {x: 4300, y: 2100}
// B: Vertex {x: 2500, y: 2100}
//
// 2
// A: Vertex {x: 2300, y: 1900}
// B: Vertex {x: 4200, y: 1900}
//
// 1 & 2 are parallel; 0 intersects 1 and 2

segments = [
  new Segment(new Vertex(2387, 1350), new Vertex(3987, 2425)),
  new Segment(new Vertex(4300, 2100), new Vertex(2500, 2100)),
  new Segment(new Vertex(2300, 1900), new Vertex(4200, 1900))
]


walls = canvas.walls.placeables;
segments = walls.map(w => new Segment(w.A, w.B))
segments.forEach(s => s.draw())

// intersection
ixFn([segments[0].A.x, segments[0].A.y],
     [segments[0].B.x, segments[0].B.y],
     [segments[1].A.x, segments[1].A.y],
     [segments[1].B.x, segments[1].B.y])

foundry.utils.lineLineIntersection(segments[0].A, segments[0].B, segments[1].A, segments[1].B)




ixFn([segments[0].A.x, segments[0].A.y],
     [segments[0].B.x, segments[0].B.y],
     [segments[2].A.x, segments[2].A.y],
     [segments[2].B.x, segments[2].B.y])
foundry.utils.lineLineIntersection(segments[0].A, segments[0].B, segments[2].A, segments[2].B)

a = [segments[0].A.x, segments[0].A.y]
b = [segments[0].B.x, segments[0].B.y]
c = [segments[2].A.x, segments[2].A.y]
d = [segments[2].B.x, segments[2].B.y]

// parallel
ixFn([segments[1].A.x, segments[1].A.y],
     [segments[1].B.x, segments[1].B.y],
     [segments[2].A.x, segments[2].A.y],
     [segments[2].B.x, segments[2].B.y])
foundry.utils.lineLineIntersection(segments[1].A, segments[1].B, segments[1].A, segments[1].B)

// how slow is the overhead here?

function ixGPU(segments1, segments2) {
  const out = [];
  const ln1 = segments1.length;
  const ln2 = segments2.length;
  for(let i = 0; i < ln1; i += 1) {
    const s1 = segments1[i];
    for(let j = 0; j < ln2; j += 1) {
      const s2 = segments2[j];
      out.push(ixFn([s1.A.x, s1.A.y],
                    [s1.B.x, s1.B.y],
                    [s2.A.x, s2.A.y],
                    [s2.B.x, s2.B.y])[0]);
    }
   }

  return out;
}


function ixCPU(segments1, segments2) {
  const out = [];
  const ln1 = segments1.length;
  const ln2 = segments2.length;
  for(let i = 0; i < ln1; i += 1) {
    const s1 = segments1[i];
    for(let j = 0; j < ln2; j += 1) {
      const s2 = segments2[j];
      out.push(foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B));
    }
  }
  return out;
}


segments1 = randomSegments(2);
segments2 = randomSegments(3);

ixFn([segments1[0].A.x, segments1[0].A.y],
     [segments1[0].B.x, segments1[0].B.y],
     [segments2[0].A.x, segments2[0].A.y],
     [segments2[0].B.x, segments2[0].B.y])



ixGPU(segments1, segments2)
ixCPU(segments1, segments2)


// overhead of about 1.5 ms for the GPU
N = 100
await benchmarkLoopFn(N, ixGPU, "GPU", segments1, segments2)
await benchmarkLoopFn(N, ixCPU, "GPU", segments1, segments2)


testGPU = gpu.createKernel(function() {
  return [-1045000 / -2042500, 1045000 / 2042500]
}, {fixIntegerDivisionAccuracy: false }).setOutput([1])
testGPU()[0]

testCPU = cpu.createKernel(function() {
  return [-1045000 / -2042500, 1045000 / 2042500]
}, { }).setOutput([1])
testCPU()[0]






// Now build up the intersection test
function lineLineIntersection(s1, s2) {
  const ax = s1[0];
  const ay = s1[1];

  const bx = s1[3];
  const by = s1[4];

  const cx = s2[0];
  const cy = s2[1];

  const dx = s2[3];
  const dy = s2[4];

  const dnm = (dy - cy) * (bx - ax) - (dx - cx) * (by - ay);
//   if(dnm === 0) { return [Infinity, Infinity] }

  //return [ ((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)), dnm];

  const t0 = ((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)) / dnm;

  //return [-1045000.00001 / -2042500.0, dnm];

  // will return [Infinity, NaN] if parallel
  return [ax + t0 * (bx - ax),
          ay + t0 * (by - ay)];
}

function bruteGPU(a, b) {

  //return [this.thread.x, this.thread.y];

  // for thread.x length 2, thread.y length 3:
  // [0, 0], [1,0]
  // [0, 1], [1,1]
  // [0, 2], [1,2]

//   const s1 = a[this.thread.x]; // doesn't work, maybe b/c it cannot determine the size
//   const ax = s1[0];
//   const ay = s1[1];

  // segment1 A endpoint
  const ax = a[this.thread.x][0];
  const ay = a[this.thread.x][1];
//   return [ax, ay];

  // segment1 B endpoint
  const bx = a[this.thread.x][2];
  const by = a[this.thread.x][3];
//   return [bx, by];

  // segment2 A endpoint
  const cx = b[this.thread.y][0];
  const cy = b[this.thread.y][1];
//   return [cx, cy];

  // segment2 B endpoint
  const dx = b[this.thread.y][2];
  const dy = b[this.thread.y][3];
//   return [dx, dy];

  const dnm = (dy - cy) * (bx - ax) - (dx - cx) * (by - ay);
  const t0 = ((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)) / dnm;

  return [ax + t0 * (bx - ax),
          ay + t0 * (by - ay)];
}

//
// kernel = gpu.createKernel(function(a, b) {
//   return a[this.thread.y][this.thread.x] + b[this.thread.y][this.thread.x];
// }).setOutput([3,3]);
//
// kernel(
//   myGPU.input(
//     new Float32Array([1,2,3,4,5,6,7,8,9]),
//     [3, 3]
//   ),
//   myGPU.input(
//     new Float32Array([1,2,3,4,5,6,7,8,9]),
//     [3, 3]
//   )
// );




ln1 = segments1.length
ln2 = segments2.length

s1_arr = [];
s2_arr = [];
// s1_arr = new Float32Array(); // cannot push; would need to set up at once
// s2_arr = new Float32Array();
segments1.forEach(s => s1_arr.push(s.A.x, s.A.y, s.B.x, s.B.y));
segments2.forEach(s => s2_arr.push(s.A.x, s.A.y, s.B.x, s.B.y));

s1_arr = new Float32Array(4 * ln1)
s2_arr = new Float32Array(4 * ln2)

segments1.forEach((s, idx) => {
  s1_arr[idx * 4] = s.A.x;
  s1_arr[(idx * 4) + 1] = s.A.y;
  s1_arr[(idx * 4) + 2] = s.B.x;
  s1_arr[(idx * 4) + 3] = s.B.y;
});

segments2.forEach((s, idx) => {
  s2_arr[idx * 4] = s.A.x;
  s2_arr[(idx * 4) + 1] = s.A.y;
  s2_arr[(idx * 4) + 2] = s.B.x;
  s2_arr[(idx * 4) + 3] = s.B.y;
});


s1_arr.push(s.A.x, s.A.y, s.B.x, s.B.y));
segments2.forEach(s => s2_arr.push(s.A.x, s.A.y, s.B.x, s.B.y));

gpuBrute = gpu.createKernel(bruteGPU,
  { fixIntegerDivisionAccuracy: false,
    returnType: 'Array(2)' })
  .setOutput([ln1, ln2]) // thread.x, thread.y

gpuBrute(
  myGPU.input(
    s1_arr, [4, ln1]),
  myGPU.input(
    s2_arr, [4, ln2])
  );

cpuBrute = cpu.createKernel(bruteGPU,
  { returnType: 'Array(2)', dynamicOutput: true })
//   .setOutput([ln1, ln2]) // thread.x, thread.y

// test against js version and cpu version
	gpuBrute = gpu.createKernel(bruteGPU,
		{ returnType: 'Array(2)', dynamicOutput: true })

// 	gpuBrute2 = gpu.createKernel(bruteGPU,
// 		{ returnType: 'Array(2)', dynamicOutput: true, tactic: 'speed' })

function jsBruteBM(segments1, segments2) {
	const out = [];
	segments2.forEach(s2 => {
		const out2 = [];
		segments1.forEach(s1 => {
			out2.push(foundry.utils.lineLineIntersection(s1.A, s1.B, s2.A, s2.B));
		})
		out.push(out2);
	});
	return out;
}
function gpuBruteBM(segments1, segments2) {
  const ln1 = segments1.length
  const ln2 = segments2.length

  // faster to not create Float32Array
//   const s1_arr = new Float32Array(4 * ln1)
//   const s2_arr = new Float32Array(4 * ln2)
//
//   segments1.forEach((s, idx) => {
// 		s1_arr[idx * 4] = s.A.x;
// 		s1_arr[(idx * 4) + 1] = s.A.y;
// 		s1_arr[(idx * 4) + 2] = s.B.x;
// 		s1_arr[(idx * 4) + 3] = s.B.y;
//   });
//
// 	segments2.forEach((s, idx) => {
// 		s2_arr[idx * 4] = s.A.x;
// 		s2_arr[(idx * 4) + 1] = s.A.y;
// 		s2_arr[(idx * 4) + 2] = s.B.x;
// 		s2_arr[(idx * 4) + 3] = s.B.y;
// 	});

  const s1_arr = [];
  const s2_arr = [];

  segments1.forEach(s => s1_arr.push(s.A.x, s.A.y, s.B.x, s.B.y));
  segments2.forEach(s => s2_arr.push(s.A.x, s.A.y, s.B.x, s.B.y));

	// const gpuBrute = gpu.createKernel(bruteGPU,
// 		{ returnType: 'Array(2)' })
// 		.setOutput([ln1, ln2])

  gpuBrute.setOutput([ln1, ln2]);
  return gpuBrute(
					myGPU.input(
						s1_arr, [4, ln1]),
					myGPU.input(
						s2_arr, [4, ln2])
					);

// 	gpuBrute.destroy();
// 	return out;
}
function cpuBruteBM(segments1, segments2) {
  const ln1 = segments1.length
  const ln2 = segments2.length

  const s1_arr = new Float32Array(4 * ln1)
  const s2_arr = new Float32Array(4 * ln2)

  segments1.forEach((s, idx) => {
		s1_arr[idx * 4] = s.A.x;
		s1_arr[(idx * 4) + 1] = s.A.y;
		s1_arr[(idx * 4) + 2] = s.B.x;
		s1_arr[(idx * 4) + 3] = s.B.y;
  });

	segments2.forEach((s, idx) => {
		s2_arr[idx * 4] = s.A.x;
		s2_arr[(idx * 4) + 1] = s.A.y;
		s2_arr[(idx * 4) + 2] = s.B.x;
		s2_arr[(idx * 4) + 3] = s.B.y;
	});

// 	const cpuBrute = cpu.createKernel(bruteGPU,
// 		{ fixIntegerDivisionAccuracy: false,
// 			returnType: 'Array(2)' })
// 		.setOutput([ln1, ln2])
  cpuBrute.setOutput([ln1, ln2]);
  return cpuBrute(
					myGPU.input(
						s1_arr, [4, ln1]),
					myGPU.input(
						s2_arr, [4, ln2])
					);
}



segments1 = randomSegments(1000);
segments2 = randomSegments(1000);

jsBruteBM(segments1, segments2);
gpuBruteBM(segments1, segments2);
cpuBruteBM(segments1, segments2);

N = 100
await benchmarkLoopFn(N, jsBruteBM, "js", segments1, segments2)
await benchmarkLoopFn(N, gpuBruteBM, "GPU", segments1, segments2)
await benchmarkLoopFn(N, gpuBruteBM, "GPU", segments1, segments2)
await benchmarkLoopFn(N, cpuBruteBM, "CPU", segments1, segments2)

/* Benchmarks
// appears to be a warm-up for the gpu?
// N = 1 getting 4.8 for the first but 4.3 or less for subsequent.
// break-even around 500

N				js			gpu			cpu
1			  0.004		4.779		0.263
10      0.015		4.704		0.352
100		  0.591		5.744	  9.135
200			6.768	 13.17	 29.07
400	   46.79   50.99   50.44
500    75.80   76.28   75.76
1000	349.1		292.0		671.6

// much faster by using dynamic arguments and keeping the function outside
// but it occassionally throws RangeError: offset is out of bounds
// maybe confused when setting the ln1, ln2 variables repeatedly?
At N = 1, 2.7 vs 7 ms or so (numbers vary, but several multiples higher)
// no obvious difference when setting tactic: speed
// taking the higher gpu score
// break-even around 500
// but doing worse at the high-end with dynamic args

N				js			gpu			cpu
1			  0.013		0.600		0.005
10      0.046		0.612		0.043
100		  0.724		2.05	  1.09 *gpu also scored 1.04
200			6.851		9.671	 25.45
400	   46.58   47.22  101.9
500    73.86   73.63  165.9
1000	331.3		314.1		712.9