// Double Linked List
// But instead of nodes, put the prev/next in the objects in the list.
// Suspect better for speed

export class DoubleLinkedObjectList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  inorder() {
    const out = [];
    let curr = this.head;
    for(let i = 0; i < this.length; i += 1) {
      out.push(curr);
      curr = curr._llnext;
    }
    return out;
  }

  push(data) {
    if(this.length === 0) {
      this.head = data;
      this.tail = data;

    } else {
      this.tail._llnext = data;
      data._llprev = this.tail;
      this.tail = data;
    }
    this.length += 1;
    return data;
  }

  pop() {
    const out = this.tail;
    this.tail = out._llprev;
    this.tail && (this.tail._llnext = null);
    this.length -= 1;

    if(this.length === 0) { this.head = null; this.tail = null; }
    out._llnext = undefined;
    out._llprev = undefined;

    return out;
  }

  shift(data) {
    if(this.length === 0) {
      this.head = data;
      this.tail = data;
    } else {
      this.head._llprev = data;
      data._llnext = this.head;
      this.head = data;
    }
    this.length += 1;
    return data;
  }

  unshift() {
    const out = this.head;
    this.head = out._llnext;
    this.head && (this.head._llprev = null);
    this.length -= 1;

    if(this.length === 0) { this.head = null; this.tail = null; }
    out._llnext = undefined;
    out._llprev = undefined;

    return out;
  }

  removeNode(data) {
    if(this.length <= 0) {
      console.error(`DoubleLinkedList length 0; cannot remove data`, data);
    }
    if(this.head === data) {
      this.head = data._llnext;
    }

    if(this.tail === data) {
      this.tail = data._llprev;
    }

    data._llnext && (data._llnext._llprev = data._llprev);
    data._llprev && (data._llprev._llnext = data._llnext);
    this.length -= 1;

    data._llnext = undefined;
    data._llprev = undefined
  }
}