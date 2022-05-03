/* globals
game
*/

/* Skip List
Based in part on
https://wesleytsai.io/2015/08/09/skip-lists/
https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/skiplists.pdf
https://www.cs.umd.edu/class/fall2020/cmsc420-0201/Lects/lect09-skip.pdf

Skip list is a simplified alternative to a self-balancing tree.
See above links for description and diagrams.

Used by MyersSweep because it allows O(log(n)) insertion of a value, along
with O(1) removal and swapping of nodes, assuming a node is provided.
Otherwise, O(log(n)) to search for the value to remove or swap.

O(1) to locate the previous and next values. To facilitate this, the skip nodes link to
both previous and next nodes.
*/

import { MODULE_ID } from "./module.js";

class SkipNode {

  /**
   * Set the number of levels randomly using the provided rng function or by setting
   * to the provided num_lvls.
   * Create arrays with size set to the number of levels, which will contain pointers
   * to the next and previous node at each level.
   */
  constructor(data, { num_lvls, rng = Math.random } = {}) {
    this.data = data;

    // Need to first set the rng above so randomHeight can access it
    this.num_lvls = num_lvls ?? SkipNode.randomHeight(rng); // Number of levels, including the 0 level

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
    while (rng() < 0.5) { num_lvls += 1; }
    return num_lvls;
  }

  /**
   * Add this node after an existing node at a given level
   * @param {SkipNode} existing
   * @param {Number}   h         Level to link in skipNext array
   */
  insertAfter(existing, h) {
    // Change existingH ... nextH
    // To     existingH ... thisH... nextH

    if (h > this.num_levels) {
      console.warn(`This node only has ${this.num_levels} levels. Cannot link at height ${h}.`, this, existing);
      return;
    }

    if (h > existing.num_levels) {
      console.warn(`Existing only has ${existing.num_levels} levels. Cannot link at height ${h}.`, this, existing);
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
    // Change existingH ... thisH... nextH
    // To     existingH ... nextH

    if (h > this.num_levels) {
      console.warn(`This node only has ${this.num_levels} levels. Cannot de-link at height ${h}.`, this, existing);
      return;
    }

    if (h > existing.num_levels) {
      console.warn(`Existing only has ${existing.num_levels} levels. Cannot de-link at height ${h}.`, this, existing);
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
    if (h > this.num_levels) {
      console.warn(`This node only has ${this.num_levels} levels. Cannot swap at height ${h}.`, this, other);
      return;
    }

    if (h > other.num_levels) {
      console.warn(`Existing only has ${other.num_levels} levels. Cannot swap at height ${h}.`, this, other);
      return;
    }

    // Other.skipNext, etc. may be undefined for a given level
    if (this.skipNext[h] === other) {
      // Change prevH ... thisH ... otherH ... nextH
      // To     prevH ... otherH ... thisH ... nextH
      other.skipNext[h] && (other.skipNext[h].skipPrev[h] = this); // eslint-disable-line no-unused-expressions
      this.skipPrev[h] && (this.skipPrev[h].skipNext[h] = other);  // eslint-disable-line no-unused-expressions

      [other.skipPrev[h], this.skipPrev[h]] = [this.skipPrev[h], other];
      [other.skipNext[h], this.skipNext[h]] = [this, other.skipNext[h]];

    } else if (this.skipPrev[h] === other) {
      // Change prevH ... otherH ... thisH ... nextH
      // To     prevH ... thisH ... otherH ... nextH
      other.skipPrev[h] && (other.skipPrev[h].skipNext[h] = this); // eslint-disable-line no-unused-expressions
      this.skipNext[h] && (this.skipNext[h].skipPrev[h] = other);  // eslint-disable-line no-unused-expressions

      [other.skipPrev[h], this.skipPrev[h]] = [this, other.skipPrev[h]];
      [other.skipNext[h], this.skipNext[h]] = [this.skipNext[h], other];

    } else {
      // Change prevH ... otherH ... nextH ... prevH ... thisH ... nextH or vice-versa
      // To     prevH ... thisH ... nextH ... prevH ... otherH ... nextH or vice-versa
      other.skipPrev[h] && (other.skipPrev[h].skipNext[h] = this); // eslint-disable-line no-unused-expressions
      other.skipNext[h] && (other.skipNext[h].skipPrev[h] = this); // eslint-disable-line no-unused-expressions

      this.skipPrev[h] && (this.skipPrev[h].skipNext[h] = other); // eslint-disable-line no-unused-expressions
      this.skipNext[h] && (this.skipNext[h].skipPrev[h] = other); // eslint-disable-line no-unused-expressions

      [other.skipPrev[h], this.skipPrev[h]] = [this.skipPrev[h], other.skipPrev[h]];
      [other.skipNext[h], this.skipNext[h]] = [this.skipNext[h], other.skipNext[h]];
    }
  }
}

export class SkipList {
  /**
   * @param {Function} comparator  Comparator is a callback function used to contrast data of two nodes.
   *                               The default assumes a numeric array of data, to be sorted low to high.
   * @param {Object} minObject     An object representing the theoretical minimum object,
   *                               for purposes of comparator. Used to set the minimum sentinel node.
   * @param {Object} maxObject     An object representing the theoretical maximum object,
   *                               for purposes of comparator. Used to set the maximum sentinel node.
   */
  constructor({ comparator = (a, b) => a - b,
                minObject = Number.NEGATIVE_INFINITY,           // eslint-disable-line indent
                maxObject = Number.POSITIVE_INFINITY } = {}) {  // eslint-disable-line indent
    this._length = 0; // Track length mostly for debugging
    this.start = SkipNode.newSentinel(minObject); // Sentinels don't really need a special rng
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
    // Walk each level from the top
    // - stop at the node where node.skipNext is greater than data
    // - link that node
    const self = this;
    const data = node.data;

    // Update the maximum levels for this skip list and confirm the start sentinel's
    // skipNext is set to the correct height
    self.max_lvls = Math.max(self.max_lvls, node.num_lvls);
    const curr_sentinel_level = self.start.skipNext.length;
    if (curr_sentinel_level < self.max_lvls) {
      // Add slots to the start skipNext array; connect to end
      self.start.skipNext.length = self.max_lvls;
      for (let h = curr_sentinel_level; h < self.max_lvls; h += 1) {
        self.start.skipNext[h] = self.end;
      }
    }

    const level_nodes = self._walkList(data);

    // Connect at each height present for the node
    for (let h = node.num_lvls - 1; h >= 0; h -= 1) {
      node.insertAfter(level_nodes[h], h);
    }

    self._length += 1;

    if (game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) {
      console.log("after insert: structure inconsistent.", self, node);
    }

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
    const self = this;
    let curr = self.start;
    const level_nodes = Array(self.max_lvls);
    const max_iterations = 10_000;
    for (let h = self.max_lvls - 1; h >= 0; h -= 1) {
      let cmp_res = self.comparator(curr.skipNext[h].data, data); // < 0: a before b; > 0: b before a
      let iter = 0;
      while (cmp_res < 0 && iter < max_iterations) {
        iter += 1;
        curr = curr.skipNext[h];
        cmp_res = self.comparator(curr.skipNext[h].data, data);
      }
      if (iter >= max_iterations) { console.warn("remove: max_iterations exceeded."); }

      // We are at a level for which this node connects. Store for disconnection
      level_nodes[h] = curr;
    }

    return level_nodes;
  }


  /**
   * Remove node from the skip list directly.
   * Instead of searching the list, remove the nodes directly at each level
   */
  removeNode(node) {
    const self = this;

    for (let h = node.num_lvls - 1; h >= 0; h -= 1) {
      node.removeAfter(node.skipPrev[h], h);
    }

    this._trimMaxLevel(); // Not absolutely needed, but this prevents the skip height from being unnecessarily high
    self._length -= 1;
    if (game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) {
      console.log("after remove node: structure inconsistent.", self, node);
    }
  }

  /**
   * Remove data from the skip list
   * @param {SkipNode} node
   */
  remove(data) {
    // Walk each level from the top
    // - stop at the node where node.skipNext is greater than data
    // - store that node for delinking
    // - find the actual node for the data, then delink it at each level
    const self = this;

    const level_nodes = self._walkList(data);

    // We have found the node corresponding to data.
    const node = level_nodes[0].skipNext[0];
    if (self.comparator(node.data, data)) {
      console.warn("Node to remove does not contain data to remove", data, node);
      return;
    }

    // Disconnect at each height present for the node
    for (let h = node.num_lvls - 1; h >= 0; h -= 1) {
      node.removeAfter(level_nodes[h], h);
    }

    this._trimMaxLevel(); // Not absolutely needed, but this prevents the skip height from being unnecessarily high
    self._length -= 1;
    if (game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) {
      console.log("after remove: structure inconsistent.", self, node);
    }
  }

  /**
   * Trim the maximum level
   */
  _trimMaxLevel() {
    // If the start simply points to the end, then we don't need it
    for (let h = this.max_lvls - 1; h > 0; h -= 1) {
      if (this.start.skipNext[h].isSentinel) {
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
    const self = this;

    // Increase levels to match so links can be transferred
    const max_lvl = Math.max(node1.num_lvls, node2.num_lvls);
    node1.skipNext.length = max_lvl;
    node2.skipNext.length = max_lvl;

    node1.skipPrev.length = max_lvl;
    node2.skipPrev.length = max_lvl;

    for (let h = max_lvl - 1; h >= 0; h -= 1) {
      node1.swap(node2, h);
    }

    // Reset the skip array lengths to correspond to the correct height
    [node1.num_lvls, node2.num_lvls] = [node2.num_lvls, node1.num_lvls];

    node1.skipNext.length = node1.num_lvls;
    node1.skipPrev.length = node1.num_lvls;

    node2.skipNext.length = node2.num_lvls;
    node2.skipPrev.length = node2.num_lvls;

    if (game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) {
      console.log("after swap node: structure inconsistent.", self, node1, node2);
    }
  }

  /**
   * Swap two nodes based on data
   */
  swap(data1, data2) {
    const self = this;

    // Disconnect the two nodes (like remove but we are saving the connections)
    // Order matters—--removing node1 affects the links of node2

    // Remove node1
    const level_nodes1 = self._walkList(data1);
    const node1 = level_nodes1[0].skipNext[0];
    if (self.comparator(node1.data, data1)) {
      console.warn("Node to remove does not contain data to swap", data1, node1);
      return;
    }
    for (let h = node1.num_lvls - 1; h >= 0; h -= 1) {
      node1.removeAfter(level_nodes1[h], h);
    }

    // Remove node2
    const level_nodes2 = self._walkList(data2);
    const node2 = level_nodes2[0].skipNext[0];
    if (self.comparator(node2.data, data2)) {
      console.warn("Node to remove does not contain data to swap", data2, node2);
      return;
    }
    for (let h = node2.num_lvls - 1; h >= 0; h -= 1) {
      node2.removeAfter(level_nodes2[h], h);
    }

    // Insert node1 using the node2 links
    for (let h = node1.num_lvls - 1; h >= 0; h -= 1) {
      node1.insertAfter(level_nodes2[h], h);
    }

    // Insert node2 using the node1 links
    for (let h = node2.num_lvls - 1; h >= 0; h -= 1) {
      node2.insertAfter(level_nodes1[h], h);
    }

    if (game.modules.get(MODULE_ID).api.debug && !self.verifyStructure()) {
      console.log("after swap: structure inconsistent.", self, node1, node2);
    }
  }

  /**
   * Reverse a span of nodes.
   * Between start and end. Use outside-in swaps to reverse.
   */
  reverseNodes(start_node, end_node) {
    const self = this;

    if (self.comparator(start_node.data, end_node.data) > 0) {
      console.error("reverseNodes: start_node is after end_node.", start_node, end_node);
      return;
    }

    // Build an array of nodes to reverse before starting the swaps
    const nodes_to_reverse = [start_node];
    let next_node = start_node.next;
    while (next_node !== end_node && !next_node.isSentinel) {
      nodes_to_reverse.push(next_node);
      next_node = next_node.next;
    }

    // Outside-in swaps of the nodes.
    // If nodes are [2,3, 4, 5, 6] ==> [6, 3, 4, 5, 2] => [6, 5, 4, 3, 2]
    const ln = nodes_to_reverse.length;
    for (let i = 0, j = ln - 1; i < ln; i += 1, j -= 1) {
      self.swapNodes(nodes_to_reverse[i], nodes_to_reverse[j]);
    }
  }

  /**
   * Find the node immediately prior to where the data would go in the list.
   * Approximately O(log(n)) to search.
   * @param {Object} data   Data to test for position.
   * @return The node immediately prior, which may be this.start.
   */
  findPrevNode(data) {
    let curr = this.start;
    const max_iterations = 10_000;
    for (let h = this.max_lvls - 1; h >= 0; h -= 1) {
      let cmp_res = this.comparator(curr.skipNext[h].data, data); // < 0: a before b; > 0: b before a
      let iter = 0;
      while (cmp_res < 0 && iter < max_iterations) {
        iter += 1;
        curr = curr.skipNext[h];
        cmp_res = this.comparator(curr.skipNext[h].data, data);
      }
      if (iter >= max_iterations) { console.warn("remove: max_iterations exceeded."); }
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
    // Start at height 0,
    const lvls = Array.fromRange(this.max_lvls).map(elem => []); // eslint-disable-line no-unused-vars
    const iter = this.iterateNodes();
    let idx = 0;
    const hmax = this.max_lvls;
    for (const node of iter) {
      console.log(node);
      for (let h = hmax; h > 0; h -= 1) {
        let str = "";
        if (node.num_lvls >= h) {
          if (typeof node.data === "number" && isFinite(node.data)) {
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

    // Go from top level down
    let out = "\n";
    for (let i = lvls.length - 1; i >= 0; i -= 1) {
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
    const self = this;
    let okay = true;

    const hmax = self.max_lvls;
    if (self.start.skipNext.length < hmax) { console.warn(`Start skipNext length ${self.start.skipNext.length} ≠ ${hmax}`); okay = false; }

    for (let h = 1; h < hmax; h += 1) {
      const iter0 = self.iterateNodes();
      const iter_h = self.iterateNodes(h);

      let nH = iter_h.next().value;
      if (self.start.skipNext[h] !== nH && !self.start.skipNext[h].isSentinel) { console.warn(`Start skipNext at height ${h} does not point to expected node`, self.start, nH); okay = false; }

      for (const node of iter0) {
        // Check if the node's arrays are consistent with its indicated number of levels
        if (node.skipNext.length !== node.num_lvls || node.skipPrev.length !== node.num_lvls) {
          console.warn(`node has inconsistent skip heights: Levels: ${node.num_lvls}, skipNext: ${node.skipNext.length}`, self.start, nH);
          okay = false;
        }

        if (!node.skipNext[0]) {
          console.warn("node has undefined skipNext for height 0");
          okay = false;
        }

        if (!node.skipPrev[0]) {
          console.warn("node has undefined skipNext for height 0");
          okay = false;
        }

        if (node.num_lvls < (h + 1)) {
          // Continue walking along the bottom level until we find the node with the
          // requisite height
          continue;
        }

        if (!node.skipNext[h]) {
          console.warn(`node has undefined skipNext for height ${h}`);
          okay = false;
        }

        if (!node.skipPrev[h]) {
          console.warn(`node has undefined skipNext for height ${h}`);
          okay = false;
        }

        // We should be at the next node at the given height, after skipping 0+ nodes
        // from walking along the bottom level
        if (node !== nH) { console.warn(`Node at height ${h} is unexpected`, node, nH); okay = false; }
        nH = iter_h.next().value; // Go to the next node at the given height
      }
    }
    return okay;
  }


  /**
   * Iterate over the array.
   * @return {Iterator} Iterator that will return data from each node.
   */
  * iterateNodes(level = 0) {
    // For debugging
    const max_iterations = 10_000;
    let iter = 0;
    let curr = this.start.skipNext[level];
    while (curr && !curr.isSentinel && iter < max_iterations) {
      iter += 1;
      yield curr;
      curr = curr.skipNext[level];
    }

    if (iter >= max_iterations) { console.warn("Max iterations hit for inorder."); }
  }

  /**
   * Iterate over the array.
   * @return {Iterator} Iterator that will return data from each node.
   */
  * iterateData(level = 0) {
    // For debugging
    const max_iterations = 10_000;
    let iter = 0;
    let curr = this.start.skipNext[level];
    while (curr && !curr.isSentinel && iter < max_iterations) {
      iter += 1;
      yield curr.data;
      curr = curr.skipNext[level];
    }

    if (iter >= max_iterations) { console.warn("Max iterations hit for inorder."); }
  }

}

/* Test
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
