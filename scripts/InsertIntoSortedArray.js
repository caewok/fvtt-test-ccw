// insertion sort of single element
// run the last iteration of an insertion sort,
// assuming the entire array to that point is sorted

function insertIntoSortedArray(arr, elem, cmpFn) {
  arr.push(elem);

  let j = arr.length - 2;

  // cmpFn: need true if elem < arr[j]
  while((j > -1) && cmpFn(elem, arr[j]) < 0) {
    arr[j + 1] = arr[j];
    j--;
  }
  arr[j+1] = elem;
}

