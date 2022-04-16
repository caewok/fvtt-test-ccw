// Skip List
// Based in part on
// https://wesleytsai.io/2015/08/09/skip-lists/
// https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/skiplists.pdf
// https://www.cs.umd.edu/class/fall2020/cmsc420-0201/Lects/lect09-skip.pdf

import { xmur3, mulberry32 } from "./Random.js";
import { MODULE_ID } from "./module.js";

class SkipNode {
  constructor(data, { num_lvls, rng = Math.random } = {}) {
    this.data = data;

    // need to first set the rng above so randomHeight can access it
    this.num_lvls = num_lvls ?? SkipNode.randomHeight(rng); // number of levels, including the 0 level

    // Array holds pointers to next SkipNodes, 1 per array level
    // Mirror array holds pointers to prev SkipNodes, to assist with insert/delete
    this.skipNext = Array(this.num_lvls);
    this.skipPrev = Array(this.num_lvls);
  }

 /**
  * Immediately subsequent node.
  * @type {SkipNode}
  */
  get next() { return this.skipNext[0]; }

 /**
  * Immediately prior node.
  * @type {SkipNode}
  */
  get prev() { return this.skipPrev[0]; }


 /**
  * A special skip node that represents the head of the skip list.
  * Two special properties: value is -Infinity and has infinite height
  */
  static newSentinel(sentinel_value = Number.POSITIVE_INFINITY) {
    const sentinel = new this(sentinel_value);
    sentinel.num_lvls = Number.POSITIVE_INFINITY;
    if(sentinel_value > 0) {
      sentinel.skipNext.length = 0;
      sentinel.skipPrev.length = 1;
    } else {
      sentinel.skipNext.length = 1;
      sentinel.skipPrev.length = 0;
    }

    return sentinel;
  }

 /**
  * Quick test if this node is a sentinel node
  */
  get isSentinel() { return !isFinite(this.num_lvls); }

 /**
  * Randomly determine the height of this node
  */
  static randomHeight(rng) {
    let num_lvls = 1;
    while(rng() < 0.5) { num_lvls += 1; }
    return num_lvls;
  }

 /**
  * Add this node before an existing node.
  * @param {SkipNode} existing
  */
  insertBefore(existing) {
    // change prev1 ... existing1 ... next1
    //        prev0 -- existing0 -- next0
    //
    // to     prev1 ... node1 ... existing1 ... next1
    //        prev0 -- node0 -- existing0 -- next0
    this._insert(existing, { before: true });
  }

 /**
  * Add this node after an existing node
  * @param {SkipNode} existing
  */
  insertAfter(existing) {
    // change prev1 ... existing1 ... next1
    //        prev0 -- existing0 -- next0
    //
    // to     prev1 ...  existing1 ... node1... next1
    //        prev0 -- existing0 -- node0 -- next0
    this._insert(existing, { before: false });
  }

 /**
  * Internal function to add existing node before or after this node.
  * @param {SkipNode} existing
  * @param {boolean}  before    If true, insert before. If false, insert after.
  */
  _insert(existing, { before = true } = {}) {
    let prev = before ? existing.prev : existing;
    let next = before ? existing : existing.next;
    let max_lvls = this.num_lvls;

    if(prev) {
       // walk backwards at given num_lvls level
       // until the prev node with num_lvls + 1 is found
       for(let h = 0; h < max_lvls; h += 1) {
         if(!prev) break;
         const max_iterations = 10_000;
         let iter = 0;
         while(h >= prev.num_lvls && iter < max_iterations) {
           iter += 1;
           if(h < 1) { console.error(`_insert h (prev) is ${h}`); }
           prev = prev.skipPrev[h - 1];
         }
         if(iter >= max_iterations) { console.warn("Max iterations hit for _insert prev."); }
         this.skipPrev[h] = prev;
         prev && (prev.skipNext[h] = this);
       }
    }

    if(next) {
      // walk backwards at given num_lvls level
      // until the next node with num_lvls + 1 is found
      for(let h = 0; h < max_lvls; h += 1) {
        if(!next) break;
        const max_iterations = 10_000;
        let iter = 0;
        while(h >= next.num_lvls && iter < max_iterations) {
          iter += 1;
          if(h < 1) { console.error(`_insert h (next) is ${h}`); }
          next = next.skipNext[h - 1];
        }
        if(iter >= max_iterations) { console.warn("Max iterations hit for _insert next."); }
        this.skipNext[h] = next;
        next && (next.skipPrev[h] = this);
      }
    }
  }

 /**
  * Remove this node and relink adjacent nodes as necessary.
  */
  remove() {
    if(!isFinite(this.num_lvls)) {
      console.warn("Tried to remove a sentinal node.");
      return;
    }

    // link the previous and next SkipNodes at each num_lvls
    for(let h = 0; h < this.num_lvls; h += 1) {
      this.skipNext[h] && (this.skipNext[h].skipPrev[h] = this.skipPrev[h]);
      this.skipPrev[h] && (this.skipPrev[h].skipNext[h] = this.skipNext[h]);
    }

    // maybe not strictly necessary to wipe clean, but helpful in debugging
    this.skipNext.length = 0;
    this.skipPrev.length = 0;
    this.num_lvls = -1;
    this.data = undefined;
  }

 /**
  * Swap this node with another. (Not the data, the actual nodes.)
  * @param {SkipNode} other
  */
  swap(other) {
    const self = this;

    if(self === other) {
      console.warn("Attempted to swap node with itself", other);
      return;
    }

    // increase the levels to match so links can be transferred
    let max_lvl = Math.max(self.num_lvls, other.num_lvls);
    self.skipNext.length = max_lvl;
    self.skipPrev.length = max_lvl;
    other.skipNext.length = max_lvl;
    other.skipPrev.length = max_lvl;

    // Swap the loopback links.
    // e.g. this.prev --> prev --> prev.next --> this
    // to   this.prev --> prev --> prev.next --> other
    // And swap the links for this and other
    // these mirror the DoubleLinkedList LLNode swap
    for(let h = 0; h < max_lvl; h += 1) {
      if(self.num_lvls > h) {
        if(self.skipPrev[h] === other) {
          // prev -- other -- this -- next
          self.skipNext[h] && (self.skipNext[h].skipPrev[h] = other);
        } else if(self.skipNext[h] === other) {
          // prev -- this -- other -- next
          self.skipPrev[h] && (self.skipPrev[h].skipNext[h] = other);
        } else {
          // prev -- this -- next ... prev -- other -- next or
          // prev -- other -- next ... prev -- this -- next
          self.skipPrev[h] && (self.skipPrev[h].skipNext[h] = other);
          self.skipNext[h] && (self.skipNext[h].skipPrev[h] = other);
        }
      }

      if(other.num_lvls > h) {
        if(other.skipNext[h] === self) {
          // prev -- other -- this -- next
          other.skipPrev[h] && (other.skipPrev[h].skipNext[h] = self);
        } else if(other.skipPrev[h] === self) {
          // prev -- this -- other -- next
          other.skipNext[h] && (other.skipNext[h].skipPrev[h] = self);
        } else {
          // prev -- this -- next ... prev -- other -- next or
          // prev -- other -- next ... prev -- this -- next
          other.skipPrev[h] && (other.skipPrev[h].skipNext[h] = self);
          other.skipNext[h] && (other.skipNext[h].skipPrev[h] = self);
        }
      }

      // the first two options would only occur if self and other both have this level
      // otherwise, either other.skipNext[h] points to undefined or could not point to self
      // same for other.skipPrev[h]
      if(other.skipNext[h] === self) {
        // prev -- other -- this -- next
        [self.skipPrev[h], other.skipNext[h]] = [other.skipPrev[h], self.skipNext[h]];
        [self.skipNext[h], other.skipPrev[h]] = [other, self];

      } else if(other.skipPrev[h] === self) {
        // prev -- this -- other -- next
        [self.skipNext[h], other.skipPrev[h]] = [other.skipNext[h], self.skipPrev[h]];
        [self.skipPrev[h], other.skipNext[h]] = [other, self];

      } else {
        // prev -- this -- next ... prev -- other -- next or
        // prev -- other -- next ... prev -- this -- next
        [self.skipPrev[h], other.skipPrev[h]] = [other.skipPrev[h], self.skipPrev[h]];
        [self.skipNext[h], other.skipNext[h]] = [other.skipNext[h], self.skipNext[h]];
      }

    }
    [other.num_lvls, self.num_lvls] = [self.num_lvls, other.num_lvls];

    // reset the skip array lengths to correspond to num_lvls.
    other.skipNext.length = other.num_lvls;
    other.skipPrev.length = other.num_lvls;

    self.skipNext.length = self.num_lvls;
    self.skipPrev.length = self.num_lvls;



  }
}

export class SkipList {
  constructor(comparator = (a, b) => a - b, { seed = Math.random.toString() } = {}) {
    // build a seedable random generator, primarily for debugging
    const rng_seed = xmur3(seed);
    this.rng = mulberry32(rng_seed());

    this._length = 0; // track length mostly for debugging
    this.start = SkipNode.newSentinel(Number.NEGATIVE_INFINITY); // sentinels don't really need the seeded rng
    this.end = SkipNode.newSentinel(Number.POSITIVE_INFINITY);
    this.start.skipNext[0] = this.end;
    this.end.skipPrev[0] = this.start;

    this.comparator = comparator;
    this.max_lvls = 1;
  }

 /**
  * Helper to handle comparisons with sentinels.
  * We cannot ensure this.comparator can handle sentinels, because node.data
  * might not be numeric. So handle separately
  * @param {Object} a   Data for the a node
  * @param {Object} b   Data for the b node
  * @return {Number} Like with Array.sort, < 0 if a before b; > 0 if b before a
  */
  _cmp(a, b) {
    // a is ∞: b, a
    // a is ⧞: a, b
    // b is ∞: a, b
    // b is ⧞: b, a

    if(a === Number.POSITIVE_INFINITY) {
      return b === Number.POSITIVE_INFINITY ? 0 : Number.POSITIVE_INFINITY; // b, a
    } else if(a === Number.NEGATIVE_INFINITY) {
      return b === Number.NEGATIVE_INFINITY ? 0 : Number.NEGATIVE_INFINITY; // a, b
    } else if(b === Number.POSITIVE_INFINITY) {
      // already checked above if a and b are both ∞
      return Number.NEGATIVE_INFINITY; // a, b
    } else if(b === Number.NEGATIVE_INFINITY) {
       // already checked above if a and b are both ⧞
       return Number.POSITIVE_INFINITY; // b, a
    }

    return this.comparator(a, b);
  }

 /**
  * @prop {number}
  */
  get length() { return this._length; }

 /**
  * Insert an object into the skip list.
  * @param {Object} data  Object to insert into the list.
  *                       Must be comparable using the comparator.
  * @return {SkipNode} Object containing the stored data, which can be used to walk the list
  */
  insert(data) {
    let { existing, after } = this.findNextNode(data);

    let node = new SkipNode(data, { rng: this.rng });
    this.max_lvls = Math.max(this.max_lvls, node.num_lvls);

    // if start or end are not at the correct height, add length
    // if greater than max height, that is an error
    let curr_sentinel_level = this.start.skipNext.length;
    if(curr_sentinel_level !== this.end.skipPrev.length) {
      console.error("Start and end have different lengths");
      curr_sentinel_level = Math.min(curr_sentinel_level, this.end.skipPrev.length);
    }

    if(curr_sentinel_level > this.max_lvls) {
      console.error(`Sentinel level is ${curr_sentinel_level} but should be ${this.max_lvls}`);
    }

    if(curr_sentinel_level < this.max_lvls) {
      // add levels to the sentinels and connect start/end accordingly at each new level
      this.start.skipNext.length = this.max_lvls;
      this.end.skipPrev.length = this.max_lvls;
      for(let h = curr_sentinel_level; h < this.max_lvls; h += 1) {
        this.start.skipNext[h] = this.end;
        this.end.skipPrev[h] = this.start;
      }
    }

    // for each level to connect, move forward until finding a node
    // with the required height and link
    // same for previous
    // relink the prior node by look to the found node -->
    node._insert(existing, { before: !after });

    this._length += 1;
    if(game.modules.get(MODULE_ID).api.debug && !this.verifyStructure()) { console.log(`after insert: structure inconsistent.`, this, node); }
    return node;
  }

 /**
  * Remove an object from the skip list
  * @param {SkipNode} node
  */
  remove(node) {
    if(!(node instanceof SkipNode)) {
      console.error("remove node is not a SkipNode", node);
      return;
    }

    if(this.length < 0) {
      console.warn(`Tried to remove node from empty skiplist`, node);
      return;
    }

    if(!(node.skipNext.length || node.skipPrev.length)) {
      console.warn(`Node is already removed.`, node);
      return;
    }

    // for each height level of the node, if it points to only sentinels, we can drop
    for(let h = node.num_lvls - 1; h >= 0; h -= 1) {
      if(node.skipPrev[h] && node.skipPrev[h].isSentinel && node.skipNext[h] && node.skipNext[h].isSentinel) {
        this.max_lvls -= 1;
        node.num_lvls -= 1;
        this.start.skipNext.length = this.max_lvls;
        this.end.skipPrev.length = this.max_lvls;

      } else {
        break;
      }
    }

    node.remove();
    this._length -= 1;
    if(game.modules.get(MODULE_ID).api.debug && !this.verifyStructure()) { console.log(`after remove: structure inconsistent.`, this, node); }
  }

 /**
  * Remove object matching data from the skip list
  * @param {Object} data
  */
  removeData(data) {
    const node = this.search(data);
    node && this.remove(node);
  }

 /**
  * Swap two nodes in the skipList
  * Dangerous!
  * @param {SkipNode} node1
  * @param {SkipNode} node2
  */
  swap(node1, node2) {
    node1.swap(node2);
    if(game.modules.get(MODULE_ID).api.debug && !this.verifyStructure()) { console.log(`after swap: structure inconsistent.`, this, node1, node2); }
  }


 /**
  * Find the node immediately after where the data would go in the list.
  * Approximately O(log(n)) to search.
  * @param {Object} data   Data to test for position.
  * @param {{existing: SkipNode, after: boolean} Object with:
  *   - existing: Node immediately next to the hypothetical data position.
  *   - after: If true, the data would be after the existing node
  */
  findNextNode(data) {
    let h = this.max_lvls - 1;
    let existing = this.start;
    const max_iterations = 10_000;
    let iter = 0;
    while(h >= 0 && iter < max_iterations) {  // while levels remain
      iter += 1;
      let next = existing.skipNext[h];
      if(!next) { return { existing: existing, after: false }; } // at end of list

      let cmp_res = this._cmp(data, next.data);
      if(!cmp_res) { return { existing: next, after: false }; }
      if(cmp_res > 0) { // cmp_res < 0: data, next; cmp_res > 0: next, data
        existing = next; // advance along same level
      } else {
        h -= 1; // drop down a level
      }
    }

    // could store next from the loop and return that as {existing: next, after: false}
    // but it is easy to insert after an item, so leave for now

    if(iter >= max_iterations) { console.warn("Max iterations hit for findNextNode."); }
    return { existing: existing, after: true };
  }


 /**
  * Find the node containing the data in the list.
  * Approximately O(log(n)) to search.
  * @param {Object} data    Data to locate
  * @param {LLNode} Node containing the data
  */
  search(data) {
    let h = this.max_lvls - 1;
    let existing = this.start;
    const max_iterations = 10_000;
    let iter = 0;
    while(h >= 0 && iter < max_iterations) {  // while levels remain
      iter += 1;
      let next = existing.skipNext[h];
      if(!next) { return null; } // at end of list

      let cmp_res = this._cmp(data, next.data);
      if(!cmp_res) { return next; }  // found it!
      if(cmp_res > 0) {  // data is before next ?
        existing = next; // advance along same level
      } else {
        h -= 1;  // drop one level down
      }
    }

    if(iter >= max_iterations) { console.warn("Max iterations hit for search."); }
    return null;
  }

 /**
  * Construct an array of data from the nodes in order.
  * For debugging
  * @return {Object[]} Array of objects
  */
  inorder(num_lvls = 0) {
    const iter = this.iterateData(num_lvls);
    return [...iter];
  }

 /**
  * Print a diagram of the SkipList to the console.
  * For debugging (obv.)
  */
  diagram() {
    // start at height 0,
    let lvls = Array.fromRange(this.max_lvls).map(elem => []);
    let iter = this.iterateNodes();
    let idx = 0;
    let hmax = this.max_lvls;
    for(const node of iter) {
      console.log(node);
      for(let h = hmax; h > 0; h -= 1) {
        let str = "";
        if(node.num_lvls >= h) {
          if(typeof node.data === "number" && isFinite(node.data)) {
            str += node.data;
          } else {
            str += idx;
          }
        } else {
          str = "...";
        }
        lvls[h - 1].push(str);
      }
      idx += 1;
    }

    lvls.forEach(l => {
      l.unshift("⧞");
      l.push("∞");
    });

    // go from top level down
    let out = "\n";
    for(let i = lvls.length - 1; i >= 0; i -= 1) {
      const l = lvls[i];
      out += l.join("\t⇄\t");
      out += "\n";
    }

    console.log(out);
    return lvls;
  }

 /**
  * Verify the SkipList structure.
  * For debugging (obv.)
  */
  verifyStructure() {
    let self = this;
    let okay = true;

    let hmax = self.max_lvls;
    if(self.start.skipNext.length !== hmax) { console.warn(`Start skipNext length ${self.start.skipNext.length} ≠ ${hmax}`); okay = false; }
    if(self.end.skipPrev.length !== hmax) { console.warn(`End skipPrev length ${self.end.skipPrev.length} ≠ ${hmax}`); okay = false; }

    for(let h = 1; h < hmax; h += 1) {
      let iter0 = self.iterateNodes();
      let iter_h = self.iterateNodes(h);

      let nH = iter_h.next().value;
      if(self.start.skipNext[h] !== nH) { console.warn(`Start skipNext at height ${h} does not point to expected node`, self.start, nH); okay = false; }

      for(const node of iter0) {
        // check if the node's arrays are consistent with its indicated number of levels
        if(node.skipNext.length !== node.skipPrev.length ||
          node.skipNext.length !== node.num_lvls) {
          console.warn(`node has inconsistent skip heights: Levels: ${node.num_lvls}, skipNext: ${node.skipNext.length}, skipPrev: ${node.skipPrev.length}`, self.start, nH);
          okay = false;
        }

        if(!node.skipNext[0]) {
          console.warn(`node has undefined skipNext for height 0`);
          okay = false;
        }

        if(!node.skipPrev[0]) {
          console.warn(`node has undefined skipPrev for height 0`);
          okay = false;
        }

        if(node.num_lvls < (h + 1)) {
          // continue walking along the bottom level until we find the node with the
          // requisite height
          continue;
        }

        if(!node.skipNext[h]) {
          console.warn(`node has undefined skipNext for height ${h}`);
          okay = false;
        }

        if(!node.skipPrev[h]) {
          console.warn(`node has undefined skipPrev for height ${h}`);
          okay = false;
        }

        // we should be at the next node at the given height, after skipping 0+ nodes
        // from walking along the bottom level
        if(node !== nH) { console.warn(`Node at height ${h} is unexpected`, node, nH); okay = false; }
        nH = iter_h.next().value; // go to the next node at the given height
      }
    }
    return okay;
  }


 /**
  * Iterate over the array.
  * @return {Iterator} Iterator that will return data from each node.
  */
  * iterateNodes(level = 0) {
    // for debugging
    const max_iterations = 10_000;
    let iter = 0;
    let curr = this.start.skipNext[level];
    while(curr && !curr.isSentinel && iter < max_iterations) {
      iter += 1;
      yield curr;
      curr = curr.skipNext[level];
    }

    if(iter >= max_iterations) { console.warn("Max iterations hit for inorder."); }
  }

 /**
  * Iterate over the array.
  * @return {Iterator} Iterator that will return data from each node.
  */
  * iterateData(level = 0) {
    // for debugging
    const max_iterations = 10_000;
    let iter = 0;
    let curr = this.start.skipNext[level];
    while(curr && !curr.isSentinel && iter < max_iterations) {
      iter += 1;
      yield curr.data;
      curr = curr.skipNext[level];
    }

    if(iter >= max_iterations) { console.warn("Max iterations hit for inorder."); }
  }

}

/* test
pts = Array.fromRange(10).map(e => randomPoint(5000))
sl = new SkipList(compareXY)
pts.forEach(pt => sl.insert(pt))
sl.diagram()




*/
