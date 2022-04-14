// Functions to binary search a sorted array.

/**
 * Find the first element that meets a condition,
 * based on binary search of a sorted array.
 * Comparable to Array.findIndex, but in O(log(n)) time.
 * @param {Object[]} arr          Array to search
 * @param {Function} comparator   Comparison function to call.
 *                                Must return true or false, like with Array.findIndex.
 * @return {number|-1}            Index of the object or -1 if not found.
 *
 * Example:
 * cmpNum = (a, b) => a - b;
 * arr = [0,1,2,3,4,5,6,7]
 * arr.sort(cmpNum)
 * binaryFindIndex(arr, elem => elem > 3)
 * arr.findIndex(elem => elem > 3)
 *
 * binaryFindIndex(arr, elem => cmpNum(3, elem) <= 0)
 * arr.findIndex(elem => elem > cmpNum(3, elem) <= 0)
 *
 * binaryFindIndex(arr, elem => cmpNum(elem, 3) > 0)
 * arr.findIndex(elem => cmpNum(elem, 3) > 0)
 */
export function binaryFindIndex(arr, comparator) {
  let start = 0;
  let end = arr.length - 1;
  let mid = -1;

  // need first index for which callbackFn returns true
  // b/c the array is sorted, once the callbackFn is true for an index,
  // it is assumed true for the rest
  // so, e.g, [F,F,F, T, T, T, T]
  // progressively check until we have no items left.



  // Iterate, halving the search each time we find a true value
  let last_true_index = -1;
  while (start <= end){
    // find the mid index
    mid = Math.floor((start + end) / 2);

    // determine if this index returns true
    const res = comparator(arr[mid], mid);

    if(res) {
      // if we found a true value, we can ignore everything after mid
      last_true_index = mid;
      end = mid - 1;
    } else {
      // otherwise, the first true value might be after mid
      // (b/c it is sorted, it cannot be before)
      start = mid + 1;
    }
  }

  return last_true_index;
}

/**
 * Find the index of an object in a sorted array based on binary search.
 * Comparable to Array.indexOf, but in O(log(n)) time.
 * @param {Object[]} arr    Array to search
 * @param {Object} obj      Object to find.
 * @param {Function} cmpFn  Comparaison function to call.
 *                          Like Array.sort, and in fact must return results
 *                          just like the function used to sort the array.
 * @return {number|-1}      Index of the object found or -1 if not found.
 *
 * Example:
 * cmpNum = (a, b) => a - b;
 * arr = [0,1,2,3,4,5,6,7]
 * arr.sort(cmpNum)
 * binaryIndexOf(arr, 2, cmpNum)
 * arr.indexOf(2)
 */
export function binaryIndexOf(arr, obj, cmpFn) {
  let start = 0;
  let end = arr.length - 1;

  // iterate, halving the search each time
  while (start <= end) {
    let mid = Math.floor((start + end) / 2);
    let res = cmpFn(obj, arr[mid]);
    if(!res) return mid;

    if(res > 0) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return -1;
}
