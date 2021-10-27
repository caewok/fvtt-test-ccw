/* globals foundry */

import { BinarySearchTree } from "./class_BinarySearchTree.js";

/**
 * Priority Queue provides quick O(1) access to the smallest object in the queue.
 * It will optionally locate and cache the second smallest object. 
 * Once a second smallest is requested, it tracks the second-smallest until the queue is
 * depleted.
 * Add and remove methods are supported. 
 * Access to other objects are not supported directly 
 * (but can be achieved by examining the queue property)
 * Objects should have a data property for comparisons and an id property for lookup.
 * Id is optional; a random id will be added if not present.
 */

export class PriorityQueueBST {

 /**
  * Constructor
  * @param comparefn Function to compare the objects added to the queue.
  *   Default is to compare the objects' data property using less-than or greater-than.
  */
  constructor(comparefn = (a, b) => { return a.data === b.data ? 0 : a.data < b.data ? -1 : 1 }) {
    this.queue = new BinarySearchTree(comparefn);
    this.first = undefined;
    this._second = undefined;
    this.comparefn = comparefn;
  }
  
 /**
  * Does the queue have this id?
  * @param {string} id
  * @return {boolean}
  */
  has(obj) {
    if(Object.is(this.first, obj)) return true;
    if(Object.is(this._second, obj)) return true;
    return Boolean(this.queue.find(obj));
  } 
  
 /**
  * Count how many objects are in the queue
  * @return {number}
  */
  get size() {
    return this.queue.size + (this.first ? 1 : 0) + (this._second ? 1 : 0);
  } 
  
 /**
  * Retrieve the second-closest, if any.
  * Runs in O(1) if a second exists; O(n) the first time to execute the search.
  * @return {Object}
  */  
  get second() {
    if(!this.first) return undefined;
    if(!this._second) {
      this._second = this._pullSmallestFromQueue();
    } 
    return this._second;
  }
  
 /** 
  * Pull the first object, meaning delete it from the queue and return it.
  * @return {undefined|Object}
  */
  pullFirst() {
    const res = this.first;
    if(!res) { return undefined; }
    this.remove(res.id);
    return res;
  } 
  
 /**
  * Pull the second object, meaning delete it from the queue and return it.
  * @return {undefined|Object}
  */
  pullSecond() {
    const res = this.second;
    if(!res) { return undefined; }
    this.remove(res.id);
    return res;
  } 
  
  
 /**
  * Internal method to search queue for smallest entry.
  * Removes the object from the queue and returns it.
  * @return {undefined|Object}
  * @private
  */
  _pullSmallestFromQueue() { return this.queue.pullMinNode(); }
    
 /**
  * Add an object to the queue.
  * Runs in O(1). May do 1 or 2 comparisons to the existing first and second position
  * objects, if any. 
  * @param {Object} obj
  */
  insert(obj) {  
    if(!this.first) {
      this.first = obj;
    } else {
      // check if obj should be first
      // then check if larger should be second
      // then put larger in the queue
      // only set a second if it has already been set (accessed)
      
      const first_cmp = this.comparefn(this.first, obj) === 1;
      let larger = first_cmp ? this.first : obj;
      let smaller = first_cmp ? obj : this.first;
      this.first = smaller;
      
      if(!this._second) {
        this.queue.set(larger.id, larger);
      } else {
        const second_cmp = this.comparefn(this._second, larger) === 1;
        larger = second_cmp ? this.first : obj;
        smaller = second_cmp ? obj : this.first;
        this._second = smaller;
        this.queue.insert(larger);
      }
    }  
    
  }
  
 /**
  * Removes object from the queue.
  * Speed likely O(1)---based on speed of adding to queue.
  * Will be slightly faster if the object is in the first or second position.
  * @param {string} id    Id of object to remove
  */
  remove(obj) {  
    if(Object.is(this.first, obj)) {
      // This is the smallest object; clear first and second positions.
      // use private this._second to access to not trigger the search-and-cache
      this.first = this._second;
      this._second = undefined;
      
      if(!this.first) { this.first = this._pullSmallestFromQueue(); }
      
    } else if(Object.is(this._second, obj)) {
      // This is the second-smallest object; clear second position.
      this._second = undefined;
    } else {
      // Object is somewhere in the queue; remove
      this.queue.remove(obj);
    }
  }

}