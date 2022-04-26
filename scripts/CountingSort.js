// Counting sort for objects that can be "scored" with integer
// arr = [1,3,3,4,2,1,3,7,20,99,42,41]
// arr = arr.map(n => {return {score: n}})
// countingSortWithScore(arr, "score")

export function countingSortWithScore(arr, scoreProp, { min, max } = {}) {
  if(!min || !max) {
    {min, max} = arr.reduce((prev, curr) => {
      return { min: Math.min(prev.min, curr[scoreProp]),
               max: Math.max(prev.max, curr[scoreProp])}
    }, { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY});
  }

//   let max = arr.reduce((prev, curr) => Math.max(prev, curr[scoreProp]), Number.NEGATIVE_INFINITY)
//   let min = arr.reduce((prev, curr) => Math.min(prev, curr[scoreProp]), Number.POSITIVE_INFINITY)

  let ln = arr.length;
  let range = max - min + 1;
  let count = Array.from({length: range}, (_, i) => 0); // store count of individual scores
  let output = Array(ln); // sorted arr

  // store count of each score
  for(let i = 0; i < ln; i++){
    count[arr[i][scoreProp] - min]++;
  }

  // change count[i] so it contains actual position in output array
  for(let i = 1; i < range; i++) {
    count[i] += count[i - 1];
  }

  for(let i = ln - 1; i >= 0; i--) {
    output[count[arr[i][scoreProp] - min] - 1] = arr[i];
    count[arr[i][scoreProp] - min]--;
  }

  return output;
//  for(let i = 0; i < ln; i++) {
//    arr[i] = output[i];
//  }
}

