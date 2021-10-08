// Binary search Tree
// Used by PotentialWallList to store walls in order.

/*
Binary search adapted from: 
https://levelup.gitconnected.com/deletion-in-binary-search-tree-with-javascript-fded82e1791c

https://www.geeksforgeeks.org/implementation-binary-search-tree-javascript/
*/

// Simplistic example
/*
bst = new BinarySearchTree();
bst.insert({score: 15});
arr = [15, 25, 10, 7, 22, 17, 13, 5, 9, 27];
arr = arr.map(a => {score: a});

arr.forEach(a => bst.insert(a));
bst.inorder();
bst.remove({score: 5});
bst.inorder();
bst.remove({score: 7});  // one child
bst.inorder();
bst.remove({score: 15}); // two children
bst.inorder();

bst.findMinNode()
bst.findMaxNode()
bst.inorder();
bst.pullMinNode();
bst.inorder();
bst.pullMaxNode();
bst.inorder()


*/

/**
 * Class to represent a single node/leaf of the tree
 * @property {Object}     data  Any data object to be stored in the tree
 * @property {Node|null}  left  Pointer to left child node
 * @property {Node|null}  right Pointer to right child node     
 */
class Node {
  constructor(data){
    this.data = data;
    this.parent = null;
    this.left = null;
    this.right = null;
  }
}

/**
 * Binary search tree.
 * Each Node can branch in zero, one or two directions.
 * @property {Node|null}  root  Base node of the tree. Null if tree is empty
 */
export class BinarySearchTree {
  constructor() {
    this.root = null;
    this.count = 0; // for getting the Nth node
  }
  
  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */
  
  // ------ Basic compare, insert & remove methods -----
  
  /**
   * Compare data in two nodes
   * Left (a is lower value) is < 0
   * Right (a is higher value) is > 0
   * Equality is 0
   * @param {Object} a  Node data object
   * @param {Object} b  Node data object
   * @return {-1|0|1} 
   */
  compare(a, b) {
    return (a.score === b.score) ? 0 : 
           (a.score < b.score) ? -1 : 1; 
  }
  
  /*
   * User-facing helper method to add data to the tree.
   * @param {Object} data   Node data to insert
   */
  insert(data) {
    const newNode = new Node(data);
    
    // If tree is empty, add node as root
    if(this.root === null) {
      this.root = newNode;
    } else {
      this._insertNode(this.root, newNode);
    }
  }
  
  /*
   * Recursively walk the tree to insertion point.
   * @param {Node} node     Current location
   * @param {Node} newNode  New node to insert
   * @private
   */
  _insertNode(node, newNode) {
    const c = this.compare(newNode.data, node.data);
    
    if(c < 0) {
      // data is less than current location: move left
      if(node.left === null) {
        // left node is empty so insert here
        newNode.parent = node;
        node.left = newNode;
      } else {
        // left is not empty so keep moving left
        this._insertNode(node.left, newNode);
      }
    
    } else {
      // data is greater than current location: move right
      if(node.right === null) {
        // right node is empty so insert here
        newNode.parent = node;
        node.right = newNode;
      } else {
        // right is not empty so keep moving right
        this._insertNode(node.right, newNode);
      }
    }    
  }
  
  /*
   * User-facing helper method to remove something from the tree.
   * @param {Object} data   Node data to remove
   */
  remove(data) {
    // create a new root with the modified tree
    this.root = this._removeNode(this.root, data);
  }
  
  /*
   * Recursively walk the tree to removal point
   * @param {Node} node     Current location
   * @param {Node} key      Node data to remove
   * @private
   */
  _removeNode(node, key) {
    // if root is empty, we can stop
    if(node === null) { return; }
    
    const c = this.compare(key, node.data);
    
    if(c < 0) {
      // key to remove is less than current node: move left
      node.left = this._removeNode(node.left, key);
      return node;
    }
    
    if(c > 0) {
      // key to remove is greater than current node: move right
      node.right = this._removeNode(node.right, key);
      return node;
    }
    
    // At the right spot! Now delete.   
    // node has no children
    if(node.left === null && node.right === null) {
      
      node = null;
      return node;
    } 
    
    // node has one child
    if(node.left === null) {
      node = node.right;
      return node;
    } else if(node.right === null) {
      node = node.left;
      return node;
    } 
    
    // two children
    // find the minimum node of the right subtree
    const minRight = this.findMinNode(node.right);
    node.data = minRight.data;
    
    node.right = this._removeNode(node.right, minRight.data);
    return node;    
  } 
  
  // ------ Helper functions -----
  
 /**
  * Locate a node given a specific value
  * @param {number} value
  * @return {Node}
  */
  find(data) {
    if(!this.root) return false;
    
    let current = this.root;
    let found = false;
    
    while(current && !found) {
      const c = this.compare(data, current.data);
      if(c < 0) {
        current = current.left;
      } else if(c > 0) {
        current = current.right;
      } else {
        found = current;
      }
    }
    if(!found) return undefined;
    return found;
  } 
  
 /**
  * Locate the next adjacent node, if any
  * @param {Node} node
  * @return {Node|undefined}
  */ 
  next(node) {
    // if right node exists, go right then all the way left
    if(node.right !== null) {
      return this.findMinNode(node.right);
    }
    
    // we are at an end leaf. If this is a left leaf, the parent is the answer
    if(!node.parent) {
      // we are at root
      // right side doesn't exist so return undefined
      return undefined;
    }
    
    const c = this.compare(node, node.parent.left);
    if(c === 0) {
      // node is a left leaf. 
      return node.parent;
    }
  
    // if this is a right leaf, need to move up two parents
    if(node.parent.parent === undefined) {
      // node.parent is root
      // go right from root
      return this.findMinNode(node.parent.right);
    }
    
    // can return the parent
    return node.parent.parent;
  }
  
 /**
  * Locate the previous adjacent node, if any
  * @param {Node} node
  * @return {Node|undefined} 
  */
  previous(node) {
    // if left node exists, go left then all the way right
    if(node.left !== null) {
      return this.findMaxNode(node.left);
    }
    
    // we are at an end leaf. If this is a right leaf, the parent is the answer
    if(!node.parent) {
      // we are at root.
      // left side doesn't exist so return undefined
      return undefined;
    }
    
    const c = this.compare(node, node.parent.right);
    if(c === 0) {
      // node is a right leaf
      return node.parent;
    }
    
    // if this is a left leaf, need to move up two parents
    if(node.parent.parent === undefined) {
      // node.parent is root
      // go left from root
      return this.findMaxNode(node.parent.left);
    }
    
    // can return the parent
    return node.parent.parent; 
  }
      
 /**
  * Start at given subtree and traverse the tree
  * @param {Node} node   Node from which to traverse. Default root.
  * @return [{Object}]   Array of data in order
  */
  inorder(node = this.root) {
    if(node !== null) {
      const left = this.inorder(node.left);
      //console.log(node.data);
      const right = this.inorder(node.right);

      return left.concat(node.data, right);
    }
    return [];
  }
    
 /**
  * Get the nth node of inorder
  * @param {number} n    Number of node, inorder, to retrieve
  * @param {Node} node   Node from which to traverse. Default root.
  * @return {Object}     Data from the nth node
  */
  nthInOrder(n = 1, node = this.root) {
    this.count = n; // reset the count for this search
    return this._nthInOrder(node)?.data;
  }
  
  /**
   * Recursion for nthInOrder
   * @param {Node} node   Node from which to traverse. Default root.
   * @param {number} n    Number of node, inorder, to retrieve
   * @return {Object}     Data from the nth node
   * @private
   */
  _nthInOrder(node = this.root) {
    if(node === null) return null;
    
    if(this.count >= 0) {
      // get the left child
      const left = this._nthInOrder(node.left);
      if(left !== null) return left;

      this.count -= 1;
      
      // when the countdown is complete, get the element
      if(this.count === 0) { return node }
      
      // now get the right child
      const right = this._nthInOrder(node.right);
      if(right !== null) return right;
    }
    return null;
  }   
    
  // preorder(node)
  // postorder(node)
  
  /**
   * Get the minimum node of the tree, from a starting node
   * @param {Node} node   Staring node for the search. Search whole tree if omitted.
   */
  findMinNode(node = this.root) {
    // left has the minimum. If nothing further left, we are done
    if(node.left === null) {
      return node;
    } else {
      return this.findMinNode(node.left);
    }
  }
  
  /**
   * Get the maximum node of the tree, from a starting node
   * @param {Node} node   Starting node for the search. Search whole tree if omitted.
   */
  findMaxNode(node = this.root) {
    // right has the maximum. If nothing further left, we are done
    if(node.right === null) {
      return node;
    } else {
      return this.findMaxNode(node.right);
    }
  }
  
  /**
   * Get and remove the minimum node of the tree, from a starting node.
   * @return {Object} Data from the removed node.
   */
  pullMinNode() {
    const res = this._pullMinNode(this.root);
    this.root = res.node;
    return res.data;
  }
  
  /**
   * Get and remove the minimum node of the tree, from a starting node.
   * @param {Node} node   Starting node for the search. Search whole tree if omitted.
   * @return {node: {Node}, data: {Object}} Revised node tree and 
   *                                        data from the removed node.
   * @private
   */
  _pullMinNode(node) {
    // go right, young man!
    if(node.left === null && node.right === null) {
      return { node: null, data: node.data }
    
    } else if(node.left === null) {
      // node has one child
      return { node: node.right, data: node.data };
    } else {
      const res = this._pullMinNode(node.left);
      node.left = res.node;
      return { node: node, data: res.data };
    }
  }
  
  /**
   * Get and remove the maximum node of the tree, from a starting node.
   * @return {Object} Data from the removed node.
   */
  pullMaxNode() {
    const res = this._pullMaxNode(this.root);
    this.root = res.node;
    return res.data;
  }
  
  /**
   * Get and remove the maximum node of the tree, from a starting node.
   * @param {Node} node   Starting node for the search. Search whole tree if omitted.
   * @return {node: {Node}, data: {Object}} Revised node tree and 
   *                                        data from the removed node.
   * @private
   */
  _pullMaxNode(node) {
    // go left, young man!
    if(node.left === null && node.right === null) {
      return { node: null, data: node.data }
    
    } else if(node.right === null) {
      // node has one child
      return { node: node.left, data: node.data };
    } else {
      const res = this._pullMaxNode(node.right);
      node.right = res.node;
      return { node: node, data: res.data };
    }
  }  
}

