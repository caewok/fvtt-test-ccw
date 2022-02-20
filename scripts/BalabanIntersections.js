// https://www2.cs.sfu.ca/~binay/813.2011/Balaban.pdf
// https://www.yumpu.com/en/document/read/11542973/03-line-segment-intersection-made-in-placepdf

// L is a set of segments spanning strip <b, e>, ordered by <b
// spanning strip <b,e> means l ≤ b < e ≤ r, where l and r are endpoints of s.

// Find Int b,e(L)
// In other words, split a set L into subsets Q and L' ordered by <b so that
// staircase (Q, <b,e>) is complete relative to L'

// L is an array of segments [s[1], ..., s[k], s[i] <b s [i+1]]
split(L, b, e) {
  const Lprime = [];
  const Q = [];
  const k = L.length;
  
  for(j = 0, j < k, j += 1) {
    // if the segment s(j) does not intersect the last segment of Q within
    // <b,e> and spans this strip then add s[j] to the end of Q
    const s = L[j];
    const lastQ = Q[Q.length - 1];
    
    const spans = s.min_x < b && s.max_x > e;
    const no_intersect = Q.length === 0 || 
          foundry.utils.lineSegmentIntersects(s.A, s.B, lastQ.A, lastQ.B);
    
    if(spans && no_intersect) {
      Q.push(s);
    } else {
      // else add s[j] to the end of L'
      Lprime.push(s);
    }  
  }
  return({ Q: Q, Lprime: Lprime })
}

// Given L, find Int b,e (L) and R using the following recursive procedure
searchInStrip(L, R, b, e) {
  const { Q, Lprime } = split(L, b, e);
  
  if(Lprime.length === 0) {
    R = Q;
    return { L: L, R: R}
  }
  
  // find Int b,e (Q, L') ??
  
  // Rprime is ?? 
  searchInStrip(Lprime, Rprime)
  
  R = merge e (Q, Rprime)
}

intersectingPairs(S0) {
  // sort the 2N endpoints by abscissa and find pi, s[i], i = 1, ... , 2N; Sr := S0;
  // TreeSearch(Sr, 1, 2N);
  
  const N = S0.length;
  const Lr = ((s[1]))
  const Ir = // S0 \ ({s[1]} U {s[2N]}) 
  // Rr is ??
  treeSearch(Lr, Ir, 1, 2*N, Rr);
  
}

treeSearch(Lv, Iv, b, e, Rv) {
  // 1. if e - b = 1 then
  // Lv = sort Sv by <b; SearchInStrip b,e (Lv, Rv); exit
  
  if((e - b) === 1) {    
    searchInStrip(Lv, Rv, b, e);
    return; 
  }
  
  // 2. split Sv into Qv and S'v so that staircase Dv := (Qv, {<b, e>}) 
  //    be complete relative to S'v
  
  
  // 3. Find Int(Dv, S'v)
  // 4. c= [(b + e) / 2]
  // 5. Place segments of S'v 
  // crossing the strip <b, c> into S ls[v] and
  // crossing the strip <c, e> into S rs[v]
  const Sls = [];
  const Srs = [];
  Sprime_v.forEach(s => {
    if(s.min_x < b && s.min_x > c) Sls.push(s);
    
    // assuming here we can add a segment to both 
    if(s.min_x < c && s.min_x > e) Srs.push(s);
   })
  
  
  // 6. TreeSearch(S ls [v], b, c)
  treeSearch()
  
  // 7. TreeSearch(S rs [v], c, e)
  
  
  
}

