// Double Linked List

/* eslint no-unused-expressions: ["warn", { "allowShortCircuit": true }] */

/**
 * Container to hold the data of each element of the list.
 * Note: Also tested just adding links to the objects of the list directly.
 *       Not much faster, and requires messing with properties of an unknown object,
 *       so this container method is preferable.
 */
class LLNode {
  constructor(data) {
    this.data = data;
    this.prev = null;
    this.next = null;
  }
}

/**
 * Basic double linked list.
 * - Push to the end of the list in O(1) time.
 * - Shift to the beginning of the list in O(1) time.
 * - Pop last element in O(1) time
 * - Unshift the first element in O(1) time.
 * - Remove a given node in O(1) time.
 *
 * To facilitate removal of a node, the node object is returned whenever
 * data is added using push or shift.
 */
export class DoubleLinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  /**
  * Traverse the list, returning the data at each node in turn.
  * @return {Object[]}    Array of data in sequential order.
  */
  inorder() {
    const out = [];
    let curr = this.head;
    for (let i = 0; i < this.length; i += 1) {
      out.push(curr.data);
      curr = curr.next;
    }
    return out;
  }

  push(data) {
    const node = new LLNode(data);
    if (this.length === 0) {
      this.head = node;
      this.tail = node;

    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }
    this.length += 1;
    return node;
  }

  pop() {
    const out = this.tail;
    this.tail = out.prev;
    this.tail && (this.tail.next = null);
    this.length -= 1;

    if (this.length === 0) { this.head = null; this.tail = null; }

    return out.data;
  }

  shift(data) {
    const node = new LLNode(data);
    if (this.length === 0) {
      this.head = node;
      this.tail = node;
    } else {
      this.head.prev = node;
      node.next = this.head;
      this.head = node;
    }
    this.length += 1;
    return node;
  }

  unshift() {
    const out = this.head;
    this.head = out.next;
    this.head && (this.head.prev = null);
    this.length -= 1;

    if (this.length === 0) { this.head = null; this.tail = null; }
    return out.data;
  }

  removeNode(node) {
    this.head === node && (this.head = node.next);
    this.tail === node && (this.tail = node.prev);

    node.next && (node.next.prev = node.prev);
    node.prev && (node.prev.next = node.next);
    this.length -= 1;
  }
}
