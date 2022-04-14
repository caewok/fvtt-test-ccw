//https://www.geeksforgeeks.org/implementation-binary-search-tree-javascript/

class BSTNode {
  constructor(data) {
    this.data = data;
    this.left = null;
    this.right = null;
  }
}

class BinarySearchTree {
  constructor(comparator = (a, b) => a - b) {
    this.root = null;
    this.comparator = (node1, node2) => {
      const value = comparator(node1.data, node2.data);
      if (Number.isNaN(value)) { console.error(`Comparator should evaluate to a number. Got ${value} when comparing`, node1, node2); }
      return value;
    };
  }


  insert(data) {
    const newNode = new BSTNode(data);

    // either add as root if tree is empty or find correct position
    if(!this.root) {
      this.root = newNode;
    } else {
      this._insertNode(this.root, newNode);
    }
    return newNode;
  }

 /**
  * Move over the tree recursively to find location to insert a node.
  */
  _insertNode(node, newNode) {

    const cmp_res = this.comparator(newNode, node);

    // if data is less than current node, move left
    if(cmp_res < 0) {
      if(!node.left) {
        node.left = newNode;
      } else {
        // recurse until we find a null node
        this._insertNode(node.left, newNode);
      }

    // if data is more than current node, move right
    } else {
      if(!node.right) {
        node.right = newNode;
      } else {
        this._insertNode(node.right, newNode);
      }
    }
  }

  remove(data) {
    // re-initialize root with root of a modified tree
    const nodeToRemove = new BSTNode(data);

    this.root = this._removeNode(this.root, nodeToRemove);
  }

  removeNode(node) {
    this.root = this._removeNode(this.root, node);
  }

 /**
  * Move over the tree recursively to find location to remove a node.
  */
  _removeNode(node, nodeToRemove) {
    if(node === null) return null;

    const cmp_res = this.comparator(nodeToRemove, node);
    // if data is less, move left
    if(cmp_res < 0) {
      node.left = this._removeNode(node.left, nodeToRemove);
      return node;
    } else if(cmp_res > 0){
      node.right = this._removeNode(node.right, nodeToRemove);
      return node;
    } else {
      // data is similar to root's data; delete this node

      // no children
      if(!node.left && !node.right) { return null; }

      // one child
      if(!node.left) { return node.right; }
      if(!node.right) { return node.left; }

      // two children
      const aux = this.findMinNode(node.right);
      node.data = aux.data;

      node.right = this._removeNode(node.right, aux.data);
      return node;

    }
  }

 /**
  * Inorder traversal of tree
  */
  inorder(node = this.root) {
    const res = [];
    if(!node) { return res; }

    res.push(...this.inorder(node.left));
    res.push(node.data);
    //console.log(node.data);
    res.push(...this.inorder(node.right));

    return res;
  }

 /**
  * Find the minimum node in tree, starting from given node
  */
  findMinNode(node = this.root) {
    if(!node.left) return node;
    return this.findMinNode(node.left);
  }

 /**
  * Find the maximum node in tree, starting from given node
  */
  findMaxNode(node = this.root)  {
    // right has the maximum. If nothing further left, we are done.
    if(!node.right) { return node; }
    return this.findMaxNode(node.right);
  }

 /**
  * Retrieve the node with the given data
  */
  search(data, node = this.root) {
    const nodeToFind = new BSTNode(data);
    return this._search(node, nodeToFind);
  }

  _search(node, nodeToFind) {
    if(!node) return null;

    const cmp_res = this.comparator(nodeToFind, node);

    // move left for less than
    if(cmp_res < 0) { return this._search(node.left, nodeToFind); }

    // move right for greater than
    if(cmp_res > 0) { return this._search(node.right, nodeToFind); }

    // found the data if equal
    return node;
  }

 /**
  * Retrieve the successor and predecessor for a value.
  * Can pass a node if you want to limit the search.
  */
  successorPredecessorForValue(data, node = this.root) {
    const nodeToFind = new BSTNode(data);
    return this._successorPredecessor(node, nodeToFind);
  }

 /**
  * Retrieve successor and predecessor for a node.
  * Should be node.left and node.right, but if either are undefined,
  * searches from the root for the parent.
  */
  successorPredecessorForNode(node) {
    const res = this._successorPredecessor(node, node);
    if(!res || !res.successor || !res.predecessor) {
      console.log("redoing search from root node")
      return this._successorPredecessor(this.root, node);
    } else {
      console.log("saved a root node search!")
    }
    return res;
  }

  _successorPredecessor(node, nodeToFind) {
    if(!node) return null;
    const cmp_res = this.comparator(nodeToFind, node);

    let predecessor, successor;

    if(!cmp_res) {
      // go to right-most element in the left subtree; it will be the predecessor
      if(node.left) {
        let t = node.left;
        while(t.right) { t = t.right; }
        predecessor = t;
      }

      if(node.right) {
        // go to left-most element in the right subtree; it will be the successor
        let t = node.right;
        while(t.left) { t = t.left; }
        successor = t;
      }
    } else if(cmp_res > 0) {
      // we make root as predecessor b/c we might have a situation in which value matches
      // with node. Then it won't have a left subtree to be predecessor and so we need
      // parent to be the predecessor.
      const res = this._successorPredecessor(node.right, nodeToFind);
      if(!res) return null;
      predecessor = res.predecessor || node;
      successor = res.successor;

    } else if(cmp_res < 0) {
      // we make root as successor b/c we might have a situation in which value matches
      // with node. Then it won't have a right subtree to be successor and so we need
      // parent to be the successor.
      const res = this._successorPredecessor(node.left, nodeToFind);
      if(!res) return null;
      successor = res.successor || node;
      predecessor = res.predecessor;
    }

    return { predecessor, successor };
  }

 /**
  * Swap data of two nodes without updating the tree.
  * Dangerous!
  */
  swap(node1, node2) {
    [node1.data, node2.data] = [node2.data, node1.data];
  }

}


/* testing
bst = new BinarySearchTree();
bst.insert(5);
bst.insert(10);
bst.insert(15);
bst.insert(20);
bst.insert(25);
bst.inorder()

bst = new BinarySearchTree();
bst.insert(15);
bst.insert(10);
bst.insert(25);
bst.insert(20);
bst.insert(5);
bst.inorder()



*/