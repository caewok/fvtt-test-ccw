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
    this._first = undefined;
    this._second = undefined;
    this.comparefn = comparefn;
    this.idsInQueue = new Set();
  }
  
 /**
  * Does the queue have this id?
  * @param {string} id
  * @return {boolean}
  */
  has(obj) { return this.idsInQueue.has(obj.id); } 
  
 /**
  * Count how many objects are in the queue
  * @return {number}
  */
  get size() {
    return this.queue.size;
  } 
  
  get first() {
    if(!this._first) { this._first = this.queue.findMinNode().data; }
    return this._first;
  } 
  
 /**
  * Retrieve the second-closest, if any.
  * Runs in O(1) if a second exists; O(n) the first time to execute the search.
  * @return {Object}
  */  
  get second() {
    if(!this._second) { this._second = this.queue.nthInOrder(2); }
    return this._second;
  }
  
 /** 
  * Pull the first object, meaning delete it from the queue and return it.
  * @return {undefined|Object}
  */
  pullFirst() {    
    const out = this.first;
    this.queue.remove(out);
    this._first = this._second ? this._second : undefined;
    this._second = undefined;
    this.idsInQueue.delete(out.id);
    
    return out;
  } 
  
 /**
  * Pull the second object, meaning delete it from the queue and return it.
  * @return {undefined|Object}
  */
  pullSecond() {
    const out = this.second;
    this.queue.remove(out);
    this._second = undefined;
    this.idsInQueue.delete(out.id);
    return out;
  } 
      
 /**
  * Add an object to the queue.
  * @param {Object} obj
  */
  insert(obj) { 
    this.queue.insert(obj);
    this.idsInQueue.add(obj.id);
    this._first = undefined;
    this._second = undefined;
  }
  
 /**
  * Removes object from the queue.
  * Speed likely O(1)---based on speed of adding to queue.
  * Will be slightly faster if the object is in the first or second position.
  * @param {string} id    Id of object to remove
  */
  remove(obj) {  
    if(this._first && this.first.id === obj.id) { 
      this.pullFirst();
      return;
    }
    
    if(this._second && this.second.id === obj.id) {
      this.pullSecond();
      return;
    }
  
    this.queue.remove(obj);
    this.idsInQueue.delete(obj.id);
  }  

}
