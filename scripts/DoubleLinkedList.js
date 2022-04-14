// Double Linked List
// Used in particular for Bentley Ottoman Sweep, to
// easily find the predecessor and successor to a given segment

class LLNode {
  constructor(data) {
    this.data = data;
    this.prev = null;
    this.next = null;
  }

 /**
  * Add this node before an existing node.
  * @param {LLNode} existing
  */
  insertBefore(existing) {
    // change prev -- existing -- next
    // to     prev -- node -- existing -- next
    if(existing.prev) { existing.prev.next = this; }
    this.prev = existing.prev;
    this.next = existing;
    existing.prev = this;
  }

 /**
  * Add this node after an existing node.
  * @param {LLNode} existing
  */
  insertAfter(existing) {
    // change prev -- other -- next
    // to     prev -- other -- node -- next
    if(existing.next) { existing.next.prev = this; }
    this.next = existing.next;
    this.prev = existing;
    existing.next = this;
  }

 /**
  * Remove this node and relink as necessary.
  */
  remove() {
    if(this.prev) { this.prev.next = this.next; }
    if(this.next) { this.next.prev = this.prev; }
    this.prev = null;
    this.next = null;
  }

 /**
  * Unlink the data for this node and remove links if necessary.
  */
  destroy() {
    this.remove();
    this.data = undefined;
  }

 /**
  * Swap this node with another.
  * @param {LLNode} other
  */
  swap(other) {
    if(this === other) {
      console.warn("Attempted to swap node with itself", other);
      return;
    }

    // Swap the loopback links.
    // e.g. this.prev --> prev --> prev.next --> this
    // to   this.prev --> prev --> prev.next --> other
    // And swap the links for this and other
    if(this.prev === other) {
      // prev -- other -- this -- next
      if(other.prev) { other.prev.next = this; }
      if(this.next) { this.next.prev = other; }
      [this.prev, other.next] = [other.prev, this.next];
      [this.next, other.prev] = [other, this];

    } else if(this.next === other) {
      // prev -- this -- other -- next
      if(this.prev) { this.prev.next = other; }
      if(other.next) { other.next.prev = this; }
      [this.next, other.prev] = [other.next, this.prev];
      [this.prev, other.next] = [other, this];

    } else {
      // prev -- this -- next ... prev -- other -- next or
      // prev -- other -- next ... prev -- this -- next
      if(this.prev) { this.prev.next = other; }
      if(this.next) { this.next.prev = other; }
      if(other.prev) { other.prev.next = this; }
      if(other.next) { other.next.prev = this; }

      [this.prev, other.prev] = [other.prev, this.prev];
      [this.next, other.next] = [other.next, this.next];
    }
  }
}

export class OrderedDoubleLinkedList {
  constructor(comparator = (a, b) => a - b) {
    this._length = 0; // track length mostly for debugging
    this.start = null;
    this.end = null;
    this.comparator = comparator;
  }

 /**
  * @prop {number}
  */
  get length() { return this._length; }

 /**
  * Insert an object into the linked list.
  * @param {Object} data  Object to insert into the list.
  *                       Must be comparable using the comparator.
  * @return {LLNode} Object containing the stored data, which can be used to walk the list
  */
  insert(data) {
    const node = new LLNode(data);
    this._length += 1;

    // Base case
    if(!this.start) {
      this.start = node;
      this.end = node;
      this._length = 1; // just in case
      return node;
    }

    // find the correct position in the list for data
    // walk from start. If segment is after the current position, keep walking.
    const { existing, after} = this.findNextNode(data);

    if(after) {
      // at the end of the list: existing -- node -- end
      node.insertAfter(existing);
      this.end = node;

    } else {
      // change prev -- existing -- next
      // to     prev -- node -- existing -- next
      if(!existing.prev) { this.start = node; }
      node.insertBefore(existing);
    }

    return node;
  }

 /**
  * Remove an object from the linked list
  * @param {LLNode} node  Node to remove
  */
  remove(node) {
    if(!this.start || this._length < 1) { return; } // list is empty

    // update start and end if necessary
    if(this.start === node) {
      this.start = node.next;
    }

    if(this.end === node) {
      this.end = node.prev;
    }

    node.remove();
    this._length -= 1;
  }

 /**
  * Helper to remove data directly by doing a linear search for a node.
  * @param {Object}   data  Date to search
  */
  removeData(data) {
    const node = this.search(data);
    if(node) { this.remove(node); }
  }

 /**
  * Find the node immediately after where the data would go in the list.
  * Linear search walking the list, in O(n).
  * @param {Object} data   Data to test for position.
  * @param {{existing: LLNode, after: boolean} Object with:
  *   - existing: Node immediately next to the hypothetical data position.
  *   - after: If true, the data would be after the existing node
  */
  findNextNode(data) {
    let existing = this.start;
    let cmp_res = this.comparator(data, existing.data);
    while(cmp_res > 0 && existing.next) {
      existing = existing.next;
      cmp_res = this.comparator(data, existing.data);
    }
    return {
      existing,
      after: cmp_res > 0
    };
  }

 /**
  * Find the node containing the data in the list.
  * Linear search walking the list, in O(n).
  * @param {Object} data    Data to locate
  * @param {LLNode} Node containing the data
  */
  search(data) {
    const iter = this.iterateNodes();
    for(const node of iter) {
      if(this.comparator(data, node.data) === 0) {
        return node;
      }
    }
    return null;
  }

 /**
  * Construct an array of data from the nodes in order.
  * For debugging
  * @return {Object[]} Array of objects
  */
  inorder() {
    const iter = this.iterateData();
    return [...iter];
  }

  /**
  * Iterate over the array.
  * @return {Iterator} Iterator that will return data from each node.
  */
  * iterateNodes() {
    // for debugging
    const max_iterations = 100_000;
    let iter = 0;
    let curr = this.start;
    while(curr && iter < max_iterations) {
      iter += 1;
      yield curr;
      curr = curr.next;
    }

    if(iter >= max_iterations) { console.warn("Max iterations hit for inorder."); }
  }

 /**
  * Iterate over the array.
  * @return {Iterator} Iterator that will return data from each node.
  */
  * iterateData() {
    // for debugging
    const max_iterations = 100_000;
    let iter = 0;
    let curr = this.start;
    while(curr && iter < max_iterations) {
      iter += 1;
      yield curr.data;
      curr = curr.next;
    }

    if(iter >= max_iterations) { console.warn("Max iterations hit for inorder."); }
  }

 /**
  * Swap the positions of two objects in the list.
  * Dangerous! Need to account for whether the comparator is aware of the change.
  * @param {LLNode} node1
  * @param {LLNode} node2
  */
  swap(node1, node2) {
    if(this.start === node1) {
      this.start = node2;
    } else if(this.start === node2) {
      this.start = node1;
    }

    if(this.end === node1) {
      this.end = node2;
    } else if(this.end === node2) {
      this.end = node1;
    }

    node1.swap(node2);

  }
}