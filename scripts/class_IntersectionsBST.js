import { BinarySearchTree } from "./class_BinarySearchTree.js";
import { almostEqual } from "./util.js";

export class IntersectionsXOrderBST extends BinarySearchTree {
 /**
  * Compare data in two nodes
  * For intersections, sort by x, then y. 
  * Equality is if the intersection is almostEqual to another
  * @param {Object} a  Node data object
  * @param {Object} b  Node data object
  * @return {-1|0|1} 
  */
  compare(a, b) {
    if(almostEqual(a.x, b.x)) {
      if(almostEqual(a.y, b.y)) { return 0; }
      return a.y < a.y ? -1 : 1;
    } else {
      return a.x < b.x ? -1 : 1; 
    }
  }
}

export class IntersectionsYOrderBST extends BinarySearchTree {
 /**
  * Compare data in two nodes
  * For sweep, sort by y, then x. 
  * Equality is if the intersection is almostEqual to another
  * @param {Object} a  Node data object
  * @param {Object} b  Node data object
  * @return {-1|0|1} 
  */
  compare(a, b) {
    if(almostEqual(a.y, b.y)) {
      if(almostEqual(a.x, b.x)) { return 0; }
      return a.x < a.x ? -1 : 1;
    } else {
      return a.y < b.y ? -1 : 1; 
    }
  }
}
