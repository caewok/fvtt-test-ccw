// Double Linked List

class LLNode {
  constructor(data) {
    this.data = data;
    this.prev = null;
    this.next = null;
  }
}


export class DoubleLinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  inorder() {
    const out = [];
    let curr = this.head;
    for(let i = 0; i < this.length; i += 1) {
      out.push(curr.data);
      curr = curr.next;
    }
    return out;
  }

  push(data) {
    const node = new LLNode(data);
    if(this.length === 0) {
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

    if(this.length === 0) { this.head = null; this.tail = null; }

    return out.data;
  }

  shift(data) {
    const node = new LLNode(data);
    if(this.length === 0) {
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

    if(this.length === 0) { this.head = null; this.tail = null; }
    return out.data;
  }

  removeNode(node) {
//     this.length <= 0 && console.error(`DoubleLinkedList length 0; cannot remove node`, node);
    this.head === node && (this.head = node.next);
    this.tail === node && (this.tail = node.prev);

    node.next && (node.next.prev = node.prev);
    node.prev && (node.prev.next = node.next);
    this.length -= 1;
  }
}