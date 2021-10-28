/**
 * Priority Queue provides quick O(1) access to the smallest object in the queue.
 * It will optionally locate and cache the second smallest object. 
 * Once a second smallest is requested, it tracks the second-smallest until the queue is
 * depleted.
 * Add and remove methods are supported. 
 * Access to other objects is not supported directly 
 * (but can be achieved by examining the queue property)
 * Objects should have a data property for comparisons and an id property for lookup.
 */

export class PriorityQueueSet {

 /**
  * Constructor
  * @param comparefn Function to compare the objects added to the queue.
  *   Default is to compare the objects' data property using less-than or greater-than.
  */
  constructor(comparefn = (a, b) => { return a.data === b.data ? 0 : a.data < b.data ? -1 : 1 }) {
    this.queue = new Set();
    this.first = undefined;
    this._second = undefined;
    this.comparefn = comparefn;
  }
  
 /**
  * Does the queue have this object?
  * @param {Object} obj
  * @return {boolean}
  */
  has(obj) {
    if(Object.is(this.first, obj)) return true;
    if(Object.is(this._second, obj)) return true;
    return this.queue.has(obj);
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
    const out = this.first;
    this._first = this._second ? this._second : this._pullSmallestFromQueue();
    this._second = undefined;
    return out;
  } 
  
 /**
  * Pull the second object, meaning delete it from the queue and return it.
  * @return {undefined|Object}
  */
  pullSecond() {
    const out = this.second;
    this._second = undefined;    
    return out;
  } 
  
  
 /**
  * Internal method to search queue for smallest entry.
  * Removes the object from the queue and returns it.
  * @return {undefined|Object}
  * @private
  */
  _pullSmallestFromQueue() {
    if(this.queue.size === 0) { return undefined; }
    
    let iter = this.queue.values();
    let result = iter.next();
    if(this.queue.size === 1) {
      this.queue.clear();
      return result.value;
    }
    
    // should be at least 2 total in queue, so pull another iteration and compare
    let smallest = result.value;
    result = iter.next();
    while(!result.done) {
      smallest = this.comparefn(smallest, result.value) === 1 ? result.value : smallest;
      result = iter.next();
    }
    
    this.queue.delete(smallest);
    return smallest;
  }
    
 /**
  * Add an object to the queue.
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
      const smaller = first_cmp ? obj : this.first;
      const larger = first_cmp ? this.first : obj;
      this.first = smaller;
      
      if(!this._second) {
        this.queue.add(larger);
      } else {
        const second_cmp = this.comparefn(this._second, larger) === 1;
        const second_smaller = second_cmp ? larger : this._second;
        const second_larger  = second_cmp ? this._second : larger;
        this._second = second_smaller;
        this.queue.add(second_larger);
      }
    }  
    
  }
  
 /**
  * Removes object from the queue.
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
      this.queue.delete(obj);
    }
  }

}
