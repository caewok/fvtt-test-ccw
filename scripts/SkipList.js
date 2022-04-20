/* globals
game
*/

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

    // Array holds pointers to next and previous SkipNodes, 1 per array level
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
    sentinel.skipNext.length = sentinel_value > 0 ? 0 : 1;
    sentinel.skipPrev.length = sentinel_value < 0 ? 0 : 1;
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
  * Add this node after an existing node at a given level
  * @param {SkipNode} existing
  * @param {Number}   h         Level to link in skipNext array
  */
  insertAfter(existing, h) {
    // change existingH ... nextH
    // to     existingH ... thisH... nextH

    if(h > this.num_levels) {
      console.warn("This node only has ${this.num_levels} levels. Cannot link at height ${h}.", this, existing);
      return;
    }

    if(h > existing.num_levels) {
      console.warn("Existing only has ${existing.num_levels} levels. Cannot link at height ${h}.", this, existing);
      return;
    }

    existing.skipNext[h].skipPrev[h] = this;
    this.skipPrev[h] = existing;

    this.skipNext[h] = existing.skipNext[h];
    existing.skipNext[h] = this;
  }

 /**
  * Remove this node after an existing node at a given level
  * @param {SkipNode} existing
  * @param {Number}   h         Level to de-link in skipNext array.
  */
  removeAfter(existing, h) {
    // change existingH ... thisH... nextH
    // to     existingH ... nextH

    if(h > this.num_levels) {
      console.warn("This node only has ${this.num_levels} levels. Cannot de-link at height ${h}.", this, existing);
      return;
    }

    if(h > existing.num_levels) {
      console.warn("Existing only has ${existing.num_levels} levels. Cannot de-link at height ${h}.", this, existing);
      return;
    }

    this.skipNext[h].skipPrev[h] = this.skipPrev[h];
    this.skipPrev[h] = null;

    existing.skipNext[h] = this.skipNext[h];
    this.skipNext[h] = null;
  }

 /**
  * Swap this node with another at a given level
  * @param {SkipNode} other
  * @param {Number}   h       Level for the swap
  */
  swap(other, h) {
    if(h > this.num_levels) {
      console.warn("This node only has ${this.num_levels} levels. Cannot swap at height ${h}.", this, other);
      return;
    }

    if(h > other.num_levels) {
      console.warn("Existing only has ${other.num_levels} levels. Cannot swap at height ${h}.", this, other);
      return;
    }

    // other.skipNext, etc. may be undefined for a given level
    if(this.skipNext[h] === other) {
      // change prevH ... thisH ... otherH ... nextH
      // to     prevH ... otherH ... thisH ... nextH
      other.skipNext[h] && (other.skipNext[h].skipPrev[h] = this);
      this.skipPrev[h]  && (this.skipPrev[h].skipNext[h] = other);

      [other.skipPrev[h], this.skipPrev[h]] = [this.skipPrev[h], other];
      [other.skipNext[h], this.skipNext[h]] = [this, other.skipNext[h]];

    } else if(this.skipPrev[h] === other) {
      // change prevH ... otherH ... thisH ... nextH
      // to     prevH ... thisH ... otherH ... nextH
      other.skipPrev[h] && (other.skipPrev[h].skipNext[h] = this);
      this.skipNext[h]  && (this.skipNext[h].skipPrev[h] = other);

      [other.skipPrev[h], this.skipPrev[h]] = [this, other.skipPrev[h]];
      [other.skipNext[h], this.skipNext[h]] = [this.skipNext[h], other];

    } else {
      // change prevH ... otherH ... nextH ... prevH ... thisH ... nextH or vice-versa
      // to     prevH ... thisH ... nextH ... prevH ... otherH ... nextH or vice-versa
      other.skipPrev[h] && (other.skipPrev[h].skipNext[h] = this);
      other.skipNext[h] && (other.skipNext[h].skipPrev[h] = this);

      this.skipPrev[h] && (this.skipPrev[h].skipNext[h] = other);
      this.skipNext[h] && (this.skipNext[h].skipPrev[h] = other);

      [other.skipPrev[h], this.skipPrev[h]] = [this.skipPrev[h], other.skipPrev[h]];
      [other.skipNext[h], this.skipNext[h]] = [this.skipNext[h], other.skipNext[h]];
    }
  }
}

export class SkipList {
  constructor({ comparator = (a, b) => a - b,
                minObject = Number.NEGATIVE_INFINITY,
                maxObject = Number.POSITIVE_INFINITY,
                seed = Math.random.toString() } = {}) {
    // build a seedable random generator, primarily for debugging
    const rng_seed = xmur3(seed);
    this.rng = mulberry32(rng_seed());

    this._length = 0; // track length mostly for debugging
    this.start = SkipNode.newSentinel(minObject); // sentinels don't really need the seeded rng
    this.end = SkipNode.newSentinel(maxObject);
    this.start.skipNext[0] = this.end;

    this.comparator = comparator;
    this.max_lvls = 1;
  }

 /**
  * @prop {number}
  */
  get length() { return this._length; }

 /**
  * Insert a specific node into the list.
  * @param {SkipNode} node
  * @return {SkipNode} Object containing the stored data, which can be used to walk the list
  */
  insertNode(node) {
    // walk each level from the top
    // - stop at the node where node.skipNext is greater than data
    // - link that node
    let self = this;
    let data = node.data;

    // Update the maximum levels for this skip list and confirm the start sentinel's
    // skipNext is set to the correct height
    self.max_lvls = Math.max(self.max_lvls, node.num_lvls);
    let curr_sentinel_level = self.start.skipNext.length;
    if(curr_sentinel_level < self.max_lvls) {
      // add slots to the start skipNext array; connect to end
      self.start.skipNext.length = self.max_lvls;
      for(let h = curr_sentinel_level; h < self.max_lvls; h += 1) {
        self.start.skipNext[h] = self.end;
      }
    }

    let level_nodes = self._walkList(data);

    // connect at each height present for the node
    for(let h = node.num_lvls - 1; h >= 0; h -= 1) {
      node.insertAfter(level_nodes[h], h);
    }

    self._length += 1;

    if(game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) { console.log(`after insert: structure inconsistent.`, self, node); }

    return node;
  }

  /**
  * Insert an object into the skip list.
  * @param {Object} data  Object to insert into the list.
  *                       Must be comparable using the comparator.
  * @return {SkipNode} Object containing the stored data, which can be used to walk the list
  */
  insert(data) {
    const node = new SkipNode(data, { rng: self.rng });
    return this.insertNode(node);
  }

 /**
  * Helper to walk the list, store the last node encountered at each level,
  * and return along with the node.
  */
  _walkList(data) {
    let self = this;
    let curr = self.start;
    let level_nodes = Array(self.max_lvls);
    for(let h = self.max_lvls - 1; h >= 0; h -= 1) {
      let cmp_res = self.comparator(curr.skipNext[h].data, data); // < 0: a before b; > 0: b before a
      let max_iterations = 10_000;
      let iter = 0;
      while(cmp_res < 0 && iter < max_iterations) {
        iter += 1;
        curr = curr.skipNext[h];
        cmp_res = self.comparator(curr.skipNext[h].data, data);
      }
      if(iter >= max_iterations) { console.warn("remove: max_iterations exceeded."); }

      // we are at a level for which this node connects. Store for disconnection
      level_nodes[h] = curr;
    }

    return level_nodes;
  }


 /**
  * Remove node from the skip list directly.
  * Instead of searching the list, remove the nodes directly at each level
  */
  removeNode(node) {
    let self = this;

    for(let h = node.num_lvls - 1; h >= 0; h -= 1) {
      node.removeAfter(node.skipPrev[h], h);
    }

    this._trimMaxLevel(); // not absolutely needed, but this prevents the skip height from being unnecessarily high
    self._length -= 1;
    if(game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) { console.log(`after remove node: structure inconsistent.`, self, node); }
  }

 /**
  * Remove data from the skip list
  * @param {SkipNode} node
  */
  remove(data) {
    // walk each level from the top
    // - stop at the node where node.skipNext is greater than data
    // - store that node for delinking
    // - find the actual node for the data, then delink it at each level
    let self = this;

    let level_nodes = self._walkList(data);

    // we have found the node corresponding to data.
    let node = level_nodes[0].skipNext[0];
    if(self.comparator(node.data, data)) {
      console.warn("Node to remove does not contain data to remove", data, node);
      return;
    }

    // disconnect at each height present for the node
    for(let h = node.num_lvls - 1; h >= 0; h -= 1) {
      node.removeAfter(level_nodes[h], h);
    }

    this._trimMaxLevel(); // not absolutely needed, but this prevents the skip height from being unnecessarily high
    self._length -= 1;
    if(game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) { console.log(`after remove: structure inconsistent.`, self, node); }
  }

 /**
  * Trim the maximum level
  */
  _trimMaxLevel() {
    // if the start simply points to the end, then we don't need it
    for(let h = this.max_lvls - 1; h > 0; h -= 1) {
      if(this.start.skipNext[h].isSentinel) {
        this.max_lvls -= 1;
      } else {
        break;
      }
    }
  }


 /**
  * Swap two nodes directly
  */
  swapNodes(node1, node2) {
    let self = this;

    // increase levels to match so links can be transferred
    let max_lvl = Math.max(node1.num_lvls, node2.num_lvls);
    node1.skipNext.length = max_lvl;
    node2.skipNext.length = max_lvl;

    node1.skipPrev.length = max_lvl;
    node2.skipPrev.length = max_lvl;

    for(let h = max_lvl - 1; h >= 0; h -= 1) {
      node1.swap(node2, h);
    }

    // reset the skip array lengths to correspond to the correct height
    [node1.num_lvls, node2.num_lvls] = [node2.num_lvls, node1.num_lvls]

    node1.skipNext.length = node1.num_lvls;
    node1.skipPrev.length = node1.num_lvls;

    node2.skipNext.length = node2.num_lvls;
    node2.skipPrev.length = node2.num_lvls;

    if(game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) { console.log(`after swap node: structure inconsistent.`, self, node1, node2); }
  }

 /**
  * Swap two nodes based on data
  */
  swap(data1, data2) {
    let self = this;

    // disconnect the two nodes (like remove but we are saving the connections)
    // order matters—--removing node1 affects the links of node2

    // remove node1
    let level_nodes1 = self._walkList(data1);
    let node1 = level_nodes1[0].skipNext[0];
    if(self.comparator(node1.data, data1)) {
      console.warn("Node to remove does not contain data to swap", data1, node1);
      return;
    }
    for(let h = node1.num_lvls - 1; h >= 0; h -= 1) {
      node1.removeAfter(level_nodes1[h], h);
    }

    // remove node2
    let level_nodes2 = self._walkList(data2);
    let node2 = level_nodes2[0].skipNext[0];
    if(self.comparator(node2.data, data2)) {
      console.warn("Node to remove does not contain data to swap", data2, node2);
      return;
    }
    for(let h = node2.num_lvls - 1; h >= 0; h -= 1) {
      node2.removeAfter(level_nodes2[h], h);
    }

    // insert node1 using the node2 links
    for(let h = node1.num_lvls - 1; h >= 0; h -= 1) {
      node1.insertAfter(level_nodes2[h], h);
    }

    // insert node2 using the node1 links
    for(let h = node2.num_lvls - 1; h >= 0; h -= 1) {
      node2.insertAfter(level_nodes1[h], h);
    }

    if(game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) { console.log(`after swap: structure inconsistent.`, self, node1, node2); }
  }

 /**
  * Find the node immediately prior to where the data would go in the list.
  * Approximately O(log(n)) to search.
  * @param {Object} data   Data to test for position.
  * @return The node immediately prior, which may be this.start.
  */
  findPrevNode(data) {
    let curr = this.start;
    for(let h = this.max_lvls - 1; h >= 0; h -= 1) {
      let cmp_res = this.comparator(curr.skipNext[h].data, data); // < 0: a before b; > 0: b before a
      let max_iterations = 10_000;
      let iter = 0;
      while(cmp_res < 0 && iter < max_iterations) {
        iter += 1;
        curr = curr.skipNext[h];
        cmp_res = this.comparator(curr.skipNext[h].data, data);
      }
      if(iter >= max_iterations) { console.warn("remove: max_iterations exceeded."); }
    }

    return curr;
  }

 /**
  * Find data in the list and return the node, if any
  * Approximately O(log(n)) to search.
  * @param {Object} data    Data to search for in the list
  * @return The node containing data or undefined if not found.
  */
  search(data) {
    const prev_node = this.findPrevNode(data);
    const node = prev_node.skipNext[0];
    return this.comparator(data, node.data) ? undefined : node;
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
    if(self.start.skipNext.length < hmax) { console.warn(`Start skipNext length ${self.start.skipNext.length} ≠ ${hmax}`); okay = false; }

    for(let h = 1; h < hmax; h += 1) {
      let iter0 = self.iterateNodes();
      let iter_h = self.iterateNodes(h);

      let nH = iter_h.next().value;
      if(self.start.skipNext[h] !== nH && !self.start.skipNext[h].isSentinel) { console.warn(`Start skipNext at height ${h} does not point to expected node`, self.start, nH); okay = false; }

      for(const node of iter0) {
        // check if the node's arrays are consistent with its indicated number of levels
        if(node.skipNext.length !== node.num_lvls || node.skipPrev.length !== node.num_lvls) {
          console.warn(`node has inconsistent skip heights: Levels: ${node.num_lvls}, skipNext: ${node.skipNext.length}`, self.start, nH);
          okay = false;
        }

        if(!node.skipNext[0]) {
          console.warn(`node has undefined skipNext for height 0`);
          okay = false;
        }

        if(!node.skipPrev[0]) {
          console.warn(`node has undefined skipNext for height 0`);
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
          console.warn(`node has undefined skipNext for height ${h}`);
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

// or
sl = new SkipList()
sl.insert(5)
sl.insert(10)
sl.insert(20)
sl.insert(15)
sl.diagram()

sl.removeNode(15)
sl.diagram()

// sl.swap works, but only once (messes up finding data) unless the comparison is adaptive
sl.swap(5, 20)
sl.diagram()

*/
