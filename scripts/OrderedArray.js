// Ordered Array Class
// Uses an array to track an ordered set of objects.
// Insertions and deletions can be done using binary search, O(log(n)) or
// linear search, O(n).

import { binaryFindIndex, binaryIndexOf } from "./BinarySearch.js";

export class OrderedArray {

 /**
  * @param {Function} comparator  Compare two elements, similar to Array.sort.
  */
  constructor(comparator = (a, b) => a - b) {
    this.comparator = comparator;
    this.data = [];
  }

 /**
  * @type {number}  Number of elements in the ordered array.
  */
  get length() { this.data.length; }


 /**
  * Return the predecessor object for a given index (i.e., object at the index - 1)
  * @param {number} idx   Index of the object
  * @return {Object|undefined} Object at index - 1.
  */
  predecessor(idx) { return this.data[idx - 1]; }

 /**
  * Return the successor object for a given index (i.e., object at the index + 1)
  * @param {number} idx   Index of the object
  * @return {Object|undefined} Object at index + 1.
  */
  successor(idx) { return this.data[idx + 1]; }

 /**
  * Retrieve object at given index.
  * @param {number} idx   Index of the object
  * @return {Object|undefined} Object at index.
  */
  atIndex(idx) { return this.data[idx]; }

 /**
  * Linear search (O(n)) for object in array.
  * @param {Object} obj   Object to find.
  * @return {number}      Index of the object.
  */
  indexOf(obj) { return this.data.indexOf(obj); }

 /**
  * Binary search (O(log(n))) for object in array.
  * Requires that the array is strictly sorted according to the comparator function.
  * @param {Object} obj   Object to find.
  * @return {number}      Index of the object.
  */
  binaryIndexOf(obj) { return binaryIndexOf(this.data, obj, this.comparator); }

 /**
  * Insert an object in the array
  * @param {Object} obj   Object to insert
  * @return {number}      Index where the object was inserted.
  */
  insert(obj) {
    const idx = this.data.findIndex(elem => this._elemIsAfter(obj, elem));
    return this._insertAt(obj, idx);
  }

 /**
  * Insert an object in the array using a binary search.
  * Requires that the array is strictly sorted according to the comparator function.
  * @param {Object} obj   Object to insert
  * @return {number}      Index where the object was inserted.
  */
  binaryInsert(obj) {
    const idx = binaryFindIndex(this.data, elem => this._elemIsAfter(obj, elem));
    return this._insertAt(obj, idx);
  }

 /**
  * Helper to insert an object at a specified index. Inserts at end if index is -1.
  * @param {Object} obj   Object to insert
  * @param {number} idx   Location to insert
  * @return               The index where the object was inserted.
  */
  _insertAt(obj, idx) {
    if(~idx) {
      // insert element at the index
      this.data.splice(idx, undefined, obj);
      return idx;

    } else {
      // not found; obj is the largest value in the array
      this.data.push(obj);
      return this.data.length - 1;
    }
  }

 /**
  * Helper function transforming the comparator output to true/false; used by insert.
  * @param {Object} obj   Object to search for
  * @param {Object} elem  Element of the array
  * @return {boolean}     True if the element is after the segment in the ordered array.
  */
  _elemIsAfter(obj, elem) { return this.comparator(obj, elem) < 0; }

 /**
  * Swap two objects in the array by index.
  * Dangerous! If comparator does not accommodate the swap, binary searching may
  * return unpredictable results and insertion/deletion (binary or non-binary) may also
  * fail.
  * @param {number} idx1    Index of first object to swap in array
  * @param {number} idx2    Index of second object to swap in array
  */
  swapIndices(idx1, idx2) {
    [this.data[idx1], this.data[idx2]] = [this.data[idx2], this.data[idx1]];
  }

 /**
  * Remove an object at a given index.
  * @param {number} idx   Index of object to remove
  */
  removeAtIndex(idx) {
    if(idx < 0 || idx > ( this.data.length - 1)) {
      console.log(`Attempted deleteAtIndex ${idx} with data length ${this.data.length}`, this.data);
      return;
    }
    this.data.splice(idx, 1);
  }
}
