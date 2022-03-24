/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else {
		var a = factory();
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(self, function() {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./index.js":
/*!******************!*\
  !*** ./index.js ***!
  \******************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
eval("\n\nvar RBush = __webpack_require__(/*! rbush */ \"./node_modules/rbush/rbush.min.js\");\nvar Queue = __webpack_require__(/*! tinyqueue */ \"./node_modules/tinyqueue/index.js\");\nvar pointInPolygon = __webpack_require__(/*! point-in-polygon */ \"./node_modules/point-in-polygon/index.js\");\nvar orient = (__webpack_require__(/*! robust-predicates/umd/orient2d.min.js */ \"./node_modules/robust-predicates/umd/orient2d.min.js\").orient2d);\n\n// Fix for require issue in webpack https://github.com/mapbox/concaveman/issues/18\nif (Queue.default) {\n    Queue = Queue.default;\n}\n\nmodule.exports = concaveman;\nmodule.exports[\"default\"] = concaveman;\n\nfunction concaveman(points, concavity, lengthThreshold) {\n    // a relative measure of concavity; higher value means simpler hull\n    concavity = Math.max(0, concavity === undefined ? 2 : concavity);\n\n    // when a segment goes below this length threshold, it won't be drilled down further\n    lengthThreshold = lengthThreshold || 0;\n\n    // start with a convex hull of the points\n    var hull = fastConvexHull(points);\n\n    // index the points with an R-tree\n    var tree = new RBush(16);\n    tree.toBBox = function (a) {\n        return {\n            minX: a[0],\n            minY: a[1],\n            maxX: a[0],\n            maxY: a[1]\n        };\n    };\n    tree.compareMinX = function (a, b) { return a[0] - b[0]; };\n    tree.compareMinY = function (a, b) { return a[1] - b[1]; };\n\n    tree.load(points);\n\n    // turn the convex hull into a linked list and populate the initial edge queue with the nodes\n    var queue = [];\n    for (var i = 0, last; i < hull.length; i++) {\n        var p = hull[i];\n        tree.remove(p);\n        last = insertNode(p, last);\n        queue.push(last);\n    }\n\n    // index the segments with an R-tree (for intersection checks)\n    var segTree = new RBush(16);\n    for (i = 0; i < queue.length; i++) segTree.insert(updateBBox(queue[i]));\n\n    var sqConcavity = concavity * concavity;\n    var sqLenThreshold = lengthThreshold * lengthThreshold;\n\n    // process edges one by one\n    while (queue.length) {\n        var node = queue.shift();\n        var a = node.p;\n        var b = node.next.p;\n\n        // skip the edge if it's already short enough\n        var sqLen = getSqDist(a, b);\n        if (sqLen < sqLenThreshold) continue;\n\n        var maxSqLen = sqLen / sqConcavity;\n\n        // find the best connection point for the current edge to flex inward to\n        p = findCandidate(tree, node.prev.p, a, b, node.next.next.p, maxSqLen, segTree);\n\n        // if we found a connection and it satisfies our concavity measure\n        if (p && Math.min(getSqDist(p, a), getSqDist(p, b)) <= maxSqLen) {\n            // connect the edge endpoints through this point and add 2 new edges to the queue\n            queue.push(node);\n            queue.push(insertNode(p, node));\n\n            // update point and segment indexes\n            tree.remove(p);\n            segTree.remove(node);\n            segTree.insert(updateBBox(node));\n            segTree.insert(updateBBox(node.next));\n        }\n    }\n\n    // convert the resulting hull linked list to an array of points\n    node = last;\n    var concave = [];\n    do {\n        concave.push(node.p);\n        node = node.next;\n    } while (node !== last);\n\n    concave.push(node.p);\n\n    return concave;\n}\n\nfunction findCandidate(tree, a, b, c, d, maxDist, segTree) {\n    var queue = new Queue([], compareDist);\n    var node = tree.data;\n\n    // search through the point R-tree with a depth-first search using a priority queue\n    // in the order of distance to the edge (b, c)\n    while (node) {\n        for (var i = 0; i < node.children.length; i++) {\n            var child = node.children[i];\n\n            var dist = node.leaf ? sqSegDist(child, b, c) : sqSegBoxDist(b, c, child);\n            if (dist > maxDist) continue; // skip the node if it's farther than we ever need\n\n            queue.push({\n                node: child,\n                dist: dist\n            });\n        }\n\n        while (queue.length && !queue.peek().node.children) {\n            var item = queue.pop();\n            var p = item.node;\n\n            // skip all points that are as close to adjacent edges (a,b) and (c,d),\n            // and points that would introduce self-intersections when connected\n            var d0 = sqSegDist(p, a, b);\n            var d1 = sqSegDist(p, c, d);\n            if (item.dist < d0 && item.dist < d1 &&\n                noIntersections(b, p, segTree) &&\n                noIntersections(c, p, segTree)) return p;\n        }\n\n        node = queue.pop();\n        if (node) node = node.node;\n    }\n\n    return null;\n}\n\nfunction compareDist(a, b) {\n    return a.dist - b.dist;\n}\n\n// square distance from a segment bounding box to the given one\nfunction sqSegBoxDist(a, b, bbox) {\n    if (inside(a, bbox) || inside(b, bbox)) return 0;\n    var d1 = sqSegSegDist(a[0], a[1], b[0], b[1], bbox.minX, bbox.minY, bbox.maxX, bbox.minY);\n    if (d1 === 0) return 0;\n    var d2 = sqSegSegDist(a[0], a[1], b[0], b[1], bbox.minX, bbox.minY, bbox.minX, bbox.maxY);\n    if (d2 === 0) return 0;\n    var d3 = sqSegSegDist(a[0], a[1], b[0], b[1], bbox.maxX, bbox.minY, bbox.maxX, bbox.maxY);\n    if (d3 === 0) return 0;\n    var d4 = sqSegSegDist(a[0], a[1], b[0], b[1], bbox.minX, bbox.maxY, bbox.maxX, bbox.maxY);\n    if (d4 === 0) return 0;\n    return Math.min(d1, d2, d3, d4);\n}\n\nfunction inside(a, bbox) {\n    return a[0] >= bbox.minX &&\n           a[0] <= bbox.maxX &&\n           a[1] >= bbox.minY &&\n           a[1] <= bbox.maxY;\n}\n\n// check if the edge (a,b) doesn't intersect any other edges\nfunction noIntersections(a, b, segTree) {\n    var minX = Math.min(a[0], b[0]);\n    var minY = Math.min(a[1], b[1]);\n    var maxX = Math.max(a[0], b[0]);\n    var maxY = Math.max(a[1], b[1]);\n\n    var edges = segTree.search({minX: minX, minY: minY, maxX: maxX, maxY: maxY});\n    for (var i = 0; i < edges.length; i++) {\n        if (intersects(edges[i].p, edges[i].next.p, a, b)) return false;\n    }\n    return true;\n}\n\nfunction cross(p1, p2, p3) {\n    return orient(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);\n}\n\n// check if the edges (p1,q1) and (p2,q2) intersect\nfunction intersects(p1, q1, p2, q2) {\n    return p1 !== q2 && q1 !== p2 &&\n        cross(p1, q1, p2) > 0 !== cross(p1, q1, q2) > 0 &&\n        cross(p2, q2, p1) > 0 !== cross(p2, q2, q1) > 0;\n}\n\n// update the bounding box of a node's edge\nfunction updateBBox(node) {\n    var p1 = node.p;\n    var p2 = node.next.p;\n    node.minX = Math.min(p1[0], p2[0]);\n    node.minY = Math.min(p1[1], p2[1]);\n    node.maxX = Math.max(p1[0], p2[0]);\n    node.maxY = Math.max(p1[1], p2[1]);\n    return node;\n}\n\n// speed up convex hull by filtering out points inside quadrilateral formed by 4 extreme points\nfunction fastConvexHull(points) {\n    var left = points[0];\n    var top = points[0];\n    var right = points[0];\n    var bottom = points[0];\n\n    // find the leftmost, rightmost, topmost and bottommost points\n    for (var i = 0; i < points.length; i++) {\n        var p = points[i];\n        if (p[0] < left[0]) left = p;\n        if (p[0] > right[0]) right = p;\n        if (p[1] < top[1]) top = p;\n        if (p[1] > bottom[1]) bottom = p;\n    }\n\n    // filter out points that are inside the resulting quadrilateral\n    var cull = [left, top, right, bottom];\n    var filtered = cull.slice();\n    for (i = 0; i < points.length; i++) {\n        if (!pointInPolygon(points[i], cull)) filtered.push(points[i]);\n    }\n\n    // get convex hull around the filtered points\n    return convexHull(filtered);\n}\n\n// create a new node in a doubly linked list\nfunction insertNode(p, prev) {\n    var node = {\n        p: p,\n        prev: null,\n        next: null,\n        minX: 0,\n        minY: 0,\n        maxX: 0,\n        maxY: 0\n    };\n\n    if (!prev) {\n        node.prev = node;\n        node.next = node;\n\n    } else {\n        node.next = prev.next;\n        node.prev = prev;\n        prev.next.prev = node;\n        prev.next = node;\n    }\n    return node;\n}\n\n// square distance between 2 points\nfunction getSqDist(p1, p2) {\n\n    var dx = p1[0] - p2[0],\n        dy = p1[1] - p2[1];\n\n    return dx * dx + dy * dy;\n}\n\n// square distance from a point to a segment\nfunction sqSegDist(p, p1, p2) {\n\n    var x = p1[0],\n        y = p1[1],\n        dx = p2[0] - x,\n        dy = p2[1] - y;\n\n    if (dx !== 0 || dy !== 0) {\n\n        var t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);\n\n        if (t > 1) {\n            x = p2[0];\n            y = p2[1];\n\n        } else if (t > 0) {\n            x += dx * t;\n            y += dy * t;\n        }\n    }\n\n    dx = p[0] - x;\n    dy = p[1] - y;\n\n    return dx * dx + dy * dy;\n}\n\n// segment to segment distance, ported from http://geomalgorithms.com/a07-_distance.html by Dan Sunday\nfunction sqSegSegDist(x0, y0, x1, y1, x2, y2, x3, y3) {\n    var ux = x1 - x0;\n    var uy = y1 - y0;\n    var vx = x3 - x2;\n    var vy = y3 - y2;\n    var wx = x0 - x2;\n    var wy = y0 - y2;\n    var a = ux * ux + uy * uy;\n    var b = ux * vx + uy * vy;\n    var c = vx * vx + vy * vy;\n    var d = ux * wx + uy * wy;\n    var e = vx * wx + vy * wy;\n    var D = a * c - b * b;\n\n    var sc, sN, tc, tN;\n    var sD = D;\n    var tD = D;\n\n    if (D === 0) {\n        sN = 0;\n        sD = 1;\n        tN = e;\n        tD = c;\n    } else {\n        sN = b * e - c * d;\n        tN = a * e - b * d;\n        if (sN < 0) {\n            sN = 0;\n            tN = e;\n            tD = c;\n        } else if (sN > sD) {\n            sN = sD;\n            tN = e + b;\n            tD = c;\n        }\n    }\n\n    if (tN < 0.0) {\n        tN = 0.0;\n        if (-d < 0.0) sN = 0.0;\n        else if (-d > a) sN = sD;\n        else {\n            sN = -d;\n            sD = a;\n        }\n    } else if (tN > tD) {\n        tN = tD;\n        if ((-d + b) < 0.0) sN = 0;\n        else if (-d + b > a) sN = sD;\n        else {\n            sN = -d + b;\n            sD = a;\n        }\n    }\n\n    sc = sN === 0 ? 0 : sN / sD;\n    tc = tN === 0 ? 0 : tN / tD;\n\n    var cx = (1 - sc) * x0 + sc * x1;\n    var cy = (1 - sc) * y0 + sc * y1;\n    var cx2 = (1 - tc) * x2 + tc * x3;\n    var cy2 = (1 - tc) * y2 + tc * y3;\n    var dx = cx2 - cx;\n    var dy = cy2 - cy;\n\n    return dx * dx + dy * dy;\n}\n\nfunction compareByX(a, b) {\n    return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0];\n}\n\nfunction convexHull(points) {\n    points.sort(compareByX);\n\n    var lower = [];\n    for (var i = 0; i < points.length; i++) {\n        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {\n            lower.pop();\n        }\n        lower.push(points[i]);\n    }\n\n    var upper = [];\n    for (var ii = points.length - 1; ii >= 0; ii--) {\n        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[ii]) <= 0) {\n            upper.pop();\n        }\n        upper.push(points[ii]);\n    }\n\n    upper.pop();\n    lower.pop();\n    return lower.concat(upper);\n}\n\n\n//# sourceURL=webpack://concaveman/./index.js?");

/***/ }),

/***/ "./node_modules/point-in-polygon/flat.js":
/*!***********************************************!*\
  !*** ./node_modules/point-in-polygon/flat.js ***!
  \***********************************************/
/***/ ((module) => {

eval("module.exports = function pointInPolygonFlat (point, vs, start, end) {\n    var x = point[0], y = point[1];\n    var inside = false;\n    if (start === undefined) start = 0;\n    if (end === undefined) end = vs.length;\n    var len = (end-start)/2;\n    for (var i = 0, j = len - 1; i < len; j = i++) {\n        var xi = vs[start+i*2+0], yi = vs[start+i*2+1];\n        var xj = vs[start+j*2+0], yj = vs[start+j*2+1];\n        var intersect = ((yi > y) !== (yj > y))\n            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);\n        if (intersect) inside = !inside;\n    }\n    return inside;\n};\n\n\n//# sourceURL=webpack://concaveman/./node_modules/point-in-polygon/flat.js?");

/***/ }),

/***/ "./node_modules/point-in-polygon/index.js":
/*!************************************************!*\
  !*** ./node_modules/point-in-polygon/index.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("var pointInPolygonFlat = __webpack_require__(/*! ./flat.js */ \"./node_modules/point-in-polygon/flat.js\")\nvar pointInPolygonNested = __webpack_require__(/*! ./nested.js */ \"./node_modules/point-in-polygon/nested.js\")\n\nmodule.exports = function pointInPolygon (point, vs, start, end) {\n    if (vs.length > 0 && Array.isArray(vs[0])) {\n        return pointInPolygonNested(point, vs, start, end);\n    } else {\n        return pointInPolygonFlat(point, vs, start, end);\n    }\n}\nmodule.exports.nested = pointInPolygonNested\nmodule.exports.flat = pointInPolygonFlat\n\n\n//# sourceURL=webpack://concaveman/./node_modules/point-in-polygon/index.js?");

/***/ }),

/***/ "./node_modules/point-in-polygon/nested.js":
/*!*************************************************!*\
  !*** ./node_modules/point-in-polygon/nested.js ***!
  \*************************************************/
/***/ ((module) => {

eval("// ray-casting algorithm based on\n// https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html\n\nmodule.exports = function pointInPolygonNested (point, vs, start, end) {\n    var x = point[0], y = point[1];\n    var inside = false;\n    if (start === undefined) start = 0;\n    if (end === undefined) end = vs.length;\n    var len = end - start;\n    for (var i = 0, j = len - 1; i < len; j = i++) {\n        var xi = vs[i+start][0], yi = vs[i+start][1];\n        var xj = vs[j+start][0], yj = vs[j+start][1];\n        var intersect = ((yi > y) !== (yj > y))\n            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);\n        if (intersect) inside = !inside;\n    }\n    return inside;\n};\n\n\n//# sourceURL=webpack://concaveman/./node_modules/point-in-polygon/nested.js?");

/***/ }),

/***/ "./node_modules/rbush/rbush.min.js":
/*!*****************************************!*\
  !*** ./node_modules/rbush/rbush.min.js ***!
  \*****************************************/
/***/ (function(module) {

eval("!function(t,i){ true?module.exports=i():0}(this,function(){\"use strict\";function t(t,r,e,a,h){!function t(n,r,e,a,h){for(;a>e;){if(a-e>600){var o=a-e+1,s=r-e+1,l=Math.log(o),f=.5*Math.exp(2*l/3),u=.5*Math.sqrt(l*f*(o-f)/o)*(s-o/2<0?-1:1),m=Math.max(e,Math.floor(r-s*f/o+u)),c=Math.min(a,Math.floor(r+(o-s)*f/o+u));t(n,r,m,c,h)}var p=n[r],d=e,x=a;for(i(n,e,r),h(n[a],p)>0&&i(n,e,a);d<x;){for(i(n,d,x),d++,x--;h(n[d],p)<0;)d++;for(;h(n[x],p)>0;)x--}0===h(n[e],p)?i(n,e,x):i(n,++x,a),x<=r&&(e=x+1),r<=x&&(a=x-1)}}(t,r,e||0,a||t.length-1,h||n)}function i(t,i,n){var r=t[i];t[i]=t[n],t[n]=r}function n(t,i){return t<i?-1:t>i?1:0}var r=function(t){void 0===t&&(t=9),this._maxEntries=Math.max(4,t),this._minEntries=Math.max(2,Math.ceil(.4*this._maxEntries)),this.clear()};function e(t,i,n){if(!n)return i.indexOf(t);for(var r=0;r<i.length;r++)if(n(t,i[r]))return r;return-1}function a(t,i){h(t,0,t.children.length,i,t)}function h(t,i,n,r,e){e||(e=p(null)),e.minX=1/0,e.minY=1/0,e.maxX=-1/0,e.maxY=-1/0;for(var a=i;a<n;a++){var h=t.children[a];o(e,t.leaf?r(h):h)}return e}function o(t,i){return t.minX=Math.min(t.minX,i.minX),t.minY=Math.min(t.minY,i.minY),t.maxX=Math.max(t.maxX,i.maxX),t.maxY=Math.max(t.maxY,i.maxY),t}function s(t,i){return t.minX-i.minX}function l(t,i){return t.minY-i.minY}function f(t){return(t.maxX-t.minX)*(t.maxY-t.minY)}function u(t){return t.maxX-t.minX+(t.maxY-t.minY)}function m(t,i){return t.minX<=i.minX&&t.minY<=i.minY&&i.maxX<=t.maxX&&i.maxY<=t.maxY}function c(t,i){return i.minX<=t.maxX&&i.minY<=t.maxY&&i.maxX>=t.minX&&i.maxY>=t.minY}function p(t){return{children:t,height:1,leaf:!0,minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0}}function d(i,n,r,e,a){for(var h=[n,r];h.length;)if(!((r=h.pop())-(n=h.pop())<=e)){var o=n+Math.ceil((r-n)/e/2)*e;t(i,o,n,r,a),h.push(n,o,o,r)}}return r.prototype.all=function(){return this._all(this.data,[])},r.prototype.search=function(t){var i=this.data,n=[];if(!c(t,i))return n;for(var r=this.toBBox,e=[];i;){for(var a=0;a<i.children.length;a++){var h=i.children[a],o=i.leaf?r(h):h;c(t,o)&&(i.leaf?n.push(h):m(t,o)?this._all(h,n):e.push(h))}i=e.pop()}return n},r.prototype.collides=function(t){var i=this.data;if(!c(t,i))return!1;for(var n=[];i;){for(var r=0;r<i.children.length;r++){var e=i.children[r],a=i.leaf?this.toBBox(e):e;if(c(t,a)){if(i.leaf||m(t,a))return!0;n.push(e)}}i=n.pop()}return!1},r.prototype.load=function(t){if(!t||!t.length)return this;if(t.length<this._minEntries){for(var i=0;i<t.length;i++)this.insert(t[i]);return this}var n=this._build(t.slice(),0,t.length-1,0);if(this.data.children.length)if(this.data.height===n.height)this._splitRoot(this.data,n);else{if(this.data.height<n.height){var r=this.data;this.data=n,n=r}this._insert(n,this.data.height-n.height-1,!0)}else this.data=n;return this},r.prototype.insert=function(t){return t&&this._insert(t,this.data.height-1),this},r.prototype.clear=function(){return this.data=p([]),this},r.prototype.remove=function(t,i){if(!t)return this;for(var n,r,a,h=this.data,o=this.toBBox(t),s=[],l=[];h||s.length;){if(h||(h=s.pop(),r=s[s.length-1],n=l.pop(),a=!0),h.leaf){var f=e(t,h.children,i);if(-1!==f)return h.children.splice(f,1),s.push(h),this._condense(s),this}a||h.leaf||!m(h,o)?r?(n++,h=r.children[n],a=!1):h=null:(s.push(h),l.push(n),n=0,r=h,h=h.children[0])}return this},r.prototype.toBBox=function(t){return t},r.prototype.compareMinX=function(t,i){return t.minX-i.minX},r.prototype.compareMinY=function(t,i){return t.minY-i.minY},r.prototype.toJSON=function(){return this.data},r.prototype.fromJSON=function(t){return this.data=t,this},r.prototype._all=function(t,i){for(var n=[];t;)t.leaf?i.push.apply(i,t.children):n.push.apply(n,t.children),t=n.pop();return i},r.prototype._build=function(t,i,n,r){var e,h=n-i+1,o=this._maxEntries;if(h<=o)return a(e=p(t.slice(i,n+1)),this.toBBox),e;r||(r=Math.ceil(Math.log(h)/Math.log(o)),o=Math.ceil(h/Math.pow(o,r-1))),(e=p([])).leaf=!1,e.height=r;var s=Math.ceil(h/o),l=s*Math.ceil(Math.sqrt(o));d(t,i,n,l,this.compareMinX);for(var f=i;f<=n;f+=l){var u=Math.min(f+l-1,n);d(t,f,u,s,this.compareMinY);for(var m=f;m<=u;m+=s){var c=Math.min(m+s-1,u);e.children.push(this._build(t,m,c,r-1))}}return a(e,this.toBBox),e},r.prototype._chooseSubtree=function(t,i,n,r){for(;r.push(i),!i.leaf&&r.length-1!==n;){for(var e=1/0,a=1/0,h=void 0,o=0;o<i.children.length;o++){var s=i.children[o],l=f(s),u=(m=t,c=s,(Math.max(c.maxX,m.maxX)-Math.min(c.minX,m.minX))*(Math.max(c.maxY,m.maxY)-Math.min(c.minY,m.minY))-l);u<a?(a=u,e=l<e?l:e,h=s):u===a&&l<e&&(e=l,h=s)}i=h||i.children[0]}var m,c;return i},r.prototype._insert=function(t,i,n){var r=n?t:this.toBBox(t),e=[],a=this._chooseSubtree(r,this.data,i,e);for(a.children.push(t),o(a,r);i>=0&&e[i].children.length>this._maxEntries;)this._split(e,i),i--;this._adjustParentBBoxes(r,e,i)},r.prototype._split=function(t,i){var n=t[i],r=n.children.length,e=this._minEntries;this._chooseSplitAxis(n,e,r);var h=this._chooseSplitIndex(n,e,r),o=p(n.children.splice(h,n.children.length-h));o.height=n.height,o.leaf=n.leaf,a(n,this.toBBox),a(o,this.toBBox),i?t[i-1].children.push(o):this._splitRoot(n,o)},r.prototype._splitRoot=function(t,i){this.data=p([t,i]),this.data.height=t.height+1,this.data.leaf=!1,a(this.data,this.toBBox)},r.prototype._chooseSplitIndex=function(t,i,n){for(var r,e,a,o,s,l,u,m=1/0,c=1/0,p=i;p<=n-i;p++){var d=h(t,0,p,this.toBBox),x=h(t,p,n,this.toBBox),v=(e=d,a=x,o=void 0,s=void 0,l=void 0,u=void 0,o=Math.max(e.minX,a.minX),s=Math.max(e.minY,a.minY),l=Math.min(e.maxX,a.maxX),u=Math.min(e.maxY,a.maxY),Math.max(0,l-o)*Math.max(0,u-s)),M=f(d)+f(x);v<m?(m=v,r=p,c=M<c?M:c):v===m&&M<c&&(c=M,r=p)}return r||n-i},r.prototype._chooseSplitAxis=function(t,i,n){var r=t.leaf?this.compareMinX:s,e=t.leaf?this.compareMinY:l;this._allDistMargin(t,i,n,r)<this._allDistMargin(t,i,n,e)&&t.children.sort(r)},r.prototype._allDistMargin=function(t,i,n,r){t.children.sort(r);for(var e=this.toBBox,a=h(t,0,i,e),s=h(t,n-i,n,e),l=u(a)+u(s),f=i;f<n-i;f++){var m=t.children[f];o(a,t.leaf?e(m):m),l+=u(a)}for(var c=n-i-1;c>=i;c--){var p=t.children[c];o(s,t.leaf?e(p):p),l+=u(s)}return l},r.prototype._adjustParentBBoxes=function(t,i,n){for(var r=n;r>=0;r--)o(i[r],t)},r.prototype._condense=function(t){for(var i=t.length-1,n=void 0;i>=0;i--)0===t[i].children.length?i>0?(n=t[i-1].children).splice(n.indexOf(t[i]),1):this.clear():a(t[i],this.toBBox)},r});\n\n\n//# sourceURL=webpack://concaveman/./node_modules/rbush/rbush.min.js?");

/***/ }),

/***/ "./node_modules/robust-predicates/umd/orient2d.min.js":
/*!************************************************************!*\
  !*** ./node_modules/robust-predicates/umd/orient2d.min.js ***!
  \************************************************************/
/***/ (function(__unused_webpack_module, exports) {

eval("!function(t,e){ true?e(exports):0}(this,function(t){\"use strict\";const e=134217729,n=33306690738754706e-32;function r(t,e,n,r,o){let f,i,u,c,s=e[0],a=r[0],d=0,l=0;a>s==a>-s?(f=s,s=e[++d]):(f=a,a=r[++l]);let p=0;if(d<t&&l<n)for(a>s==a>-s?(u=f-((i=s+f)-s),s=e[++d]):(u=f-((i=a+f)-a),a=r[++l]),f=i,0!==u&&(o[p++]=u);d<t&&l<n;)a>s==a>-s?(u=f-((i=f+s)-(c=i-f))+(s-c),s=e[++d]):(u=f-((i=f+a)-(c=i-f))+(a-c),a=r[++l]),f=i,0!==u&&(o[p++]=u);for(;d<t;)u=f-((i=f+s)-(c=i-f))+(s-c),s=e[++d],f=i,0!==u&&(o[p++]=u);for(;l<n;)u=f-((i=f+a)-(c=i-f))+(a-c),a=r[++l],f=i,0!==u&&(o[p++]=u);return 0===f&&0!==p||(o[p++]=f),p}function o(t){return new Float64Array(t)}const f=33306690738754716e-32,i=22204460492503146e-32,u=11093356479670487e-47,c=o(4),s=o(8),a=o(12),d=o(16),l=o(4);t.orient2d=function(t,o,p,b,y,h){const M=(o-h)*(p-y),x=(t-y)*(b-h),j=M-x;if(0===M||0===x||M>0!=x>0)return j;const m=Math.abs(M+x);return Math.abs(j)>=f*m?j:-function(t,o,f,p,b,y,h){let M,x,j,m,_,v,w,A,F,O,P,g,k,q,z,B,C,D;const E=t-b,G=f-b,H=o-y,I=p-y;_=(z=(A=E-(w=(v=e*E)-(v-E)))*(O=I-(F=(v=e*I)-(v-I)))-((q=E*I)-w*F-A*F-w*O))-(P=z-(C=(A=H-(w=(v=e*H)-(v-H)))*(O=G-(F=(v=e*G)-(v-G)))-((B=H*G)-w*F-A*F-w*O))),c[0]=z-(P+_)+(_-C),_=(k=q-((g=q+P)-(_=g-q))+(P-_))-(P=k-B),c[1]=k-(P+_)+(_-B),_=(D=g+P)-g,c[2]=g-(D-_)+(P-_),c[3]=D;let J=function(t,e){let n=e[0];for(let r=1;r<t;r++)n+=e[r];return n}(4,c),K=i*h;if(J>=K||-J>=K)return J;if(M=t-(E+(_=t-E))+(_-b),j=f-(G+(_=f-G))+(_-b),x=o-(H+(_=o-H))+(_-y),m=p-(I+(_=p-I))+(_-y),0===M&&0===x&&0===j&&0===m)return J;if(K=u*h+n*Math.abs(J),(J+=E*m+I*M-(H*j+G*x))>=K||-J>=K)return J;_=(z=(A=M-(w=(v=e*M)-(v-M)))*(O=I-(F=(v=e*I)-(v-I)))-((q=M*I)-w*F-A*F-w*O))-(P=z-(C=(A=x-(w=(v=e*x)-(v-x)))*(O=G-(F=(v=e*G)-(v-G)))-((B=x*G)-w*F-A*F-w*O))),l[0]=z-(P+_)+(_-C),_=(k=q-((g=q+P)-(_=g-q))+(P-_))-(P=k-B),l[1]=k-(P+_)+(_-B),_=(D=g+P)-g,l[2]=g-(D-_)+(P-_),l[3]=D;const L=r(4,c,4,l,s);_=(z=(A=E-(w=(v=e*E)-(v-E)))*(O=m-(F=(v=e*m)-(v-m)))-((q=E*m)-w*F-A*F-w*O))-(P=z-(C=(A=H-(w=(v=e*H)-(v-H)))*(O=j-(F=(v=e*j)-(v-j)))-((B=H*j)-w*F-A*F-w*O))),l[0]=z-(P+_)+(_-C),_=(k=q-((g=q+P)-(_=g-q))+(P-_))-(P=k-B),l[1]=k-(P+_)+(_-B),_=(D=g+P)-g,l[2]=g-(D-_)+(P-_),l[3]=D;const N=r(L,s,4,l,a);_=(z=(A=M-(w=(v=e*M)-(v-M)))*(O=m-(F=(v=e*m)-(v-m)))-((q=M*m)-w*F-A*F-w*O))-(P=z-(C=(A=x-(w=(v=e*x)-(v-x)))*(O=j-(F=(v=e*j)-(v-j)))-((B=x*j)-w*F-A*F-w*O))),l[0]=z-(P+_)+(_-C),_=(k=q-((g=q+P)-(_=g-q))+(P-_))-(P=k-B),l[1]=k-(P+_)+(_-B),_=(D=g+P)-g,l[2]=g-(D-_)+(P-_),l[3]=D;const Q=r(N,a,4,l,d);return d[Q-1]}(t,o,p,b,y,h,m)},t.orient2dfast=function(t,e,n,r,o,f){return(e-f)*(n-o)-(t-o)*(r-f)},Object.defineProperty(t,\"__esModule\",{value:!0})});\n\n\n//# sourceURL=webpack://concaveman/./node_modules/robust-predicates/umd/orient2d.min.js?");

/***/ }),

/***/ "./node_modules/tinyqueue/index.js":
/*!*****************************************!*\
  !*** ./node_modules/tinyqueue/index.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ TinyQueue)\n/* harmony export */ });\n\nclass TinyQueue {\n    constructor(data = [], compare = defaultCompare) {\n        this.data = data;\n        this.length = this.data.length;\n        this.compare = compare;\n\n        if (this.length > 0) {\n            for (let i = (this.length >> 1) - 1; i >= 0; i--) this._down(i);\n        }\n    }\n\n    push(item) {\n        this.data.push(item);\n        this.length++;\n        this._up(this.length - 1);\n    }\n\n    pop() {\n        if (this.length === 0) return undefined;\n\n        const top = this.data[0];\n        const bottom = this.data.pop();\n        this.length--;\n\n        if (this.length > 0) {\n            this.data[0] = bottom;\n            this._down(0);\n        }\n\n        return top;\n    }\n\n    peek() {\n        return this.data[0];\n    }\n\n    _up(pos) {\n        const {data, compare} = this;\n        const item = data[pos];\n\n        while (pos > 0) {\n            const parent = (pos - 1) >> 1;\n            const current = data[parent];\n            if (compare(item, current) >= 0) break;\n            data[pos] = current;\n            pos = parent;\n        }\n\n        data[pos] = item;\n    }\n\n    _down(pos) {\n        const {data, compare} = this;\n        const halfLength = this.length >> 1;\n        const item = data[pos];\n\n        while (pos < halfLength) {\n            let left = (pos << 1) + 1;\n            let best = data[left];\n            const right = left + 1;\n\n            if (right < this.length && compare(data[right], best) < 0) {\n                left = right;\n                best = data[right];\n            }\n            if (compare(best, item) >= 0) break;\n\n            data[pos] = best;\n            pos = left;\n        }\n\n        data[pos] = item;\n    }\n}\n\nfunction defaultCompare(a, b) {\n    return a < b ? -1 : a > b ? 1 : 0;\n}\n\n\n//# sourceURL=webpack://concaveman/./node_modules/tinyqueue/index.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./index.js");
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});