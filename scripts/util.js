/* globals game */
'use strict';

// Utility functions
import { orient2d, orient2dfast } from "./lib/orient2d.min.js";
import { incircle, incirclefast } from "./lib/incircle.min.js";
import { MODULE_ID } from "./module.js"

// Ray.prototype.potentialIntersectionsCircle is precise to ~ 1e-10
// May be ways to address that, but for now, setting EPSILON to 1e-8
// works, so that once an intersection point is found, it is determined to be 
// on the line for any future tests, like for contains.
// See Number.EPSILON for smallest possible error number.
export const PRESET_EPSILON = 1e-8;


// Simple set of colors for drawing and debugging 
export const COLORS = {
  orange: 0xFFA500,
  yellow: 0xFFFF00,
  greenyellow: 0xADFF2F,
  blue: 0x0000FF,
  lightblue: 0xADD8E6,
  red: 0xFF0000,
  gray: 0x808080,
  black: 0x000000,
  white: 0xFFFFFF
}

 /*
  * Test if two numbers are almost equal, given a small error window.
  * See https://www.toptal.com/python/computational-geometry-in-python-from-theory-to-implementation
  * @param {Number} x         First number
  * @param {Number} y         Second number for comparison
  * @param {Number} EPSILON   Small number representing error within which the numbers 
  *                           will be considered equal
  * See Number.EPSILON for smallest possible error number.
  * Given the use in light measurements over long distances, probably make this 
  * relatively small in case comparing small angles.
  *
  * @return {Boolean} True if x and y are within the error of each other.
  */
export function almostEqual(x, y, { EPSILON = PRESET_EPSILON } = {}) {
  return Math.abs(x - y) < EPSILON;
}

/*
 * Round number to specific precision
 * e.g. round(Math.PI);
 * from: https://stackoverflow.com/questions/7342957/how-do-you-round-to-1-decimal-place-in-javascript
 * @param {Number} value      Number to round
 * @param {Number} precision  Number of decimal places to use. Can be negative.
 * @return {Number} The rounded number
 */
export function round(value, precision = 0) {
  const multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Are two points basically at the same spot?
 * @param {x, y}    p1        First point
 * @param {x, y}    p2        Second point
 * @param {Number}  EPSILON   Small number representing error within which the points 
 *                              will be considered equal
 * @return {Boolean} True if points are within the error of each other.
 */
export function pointsAlmostEqual(p1, p2, { EPSILON = PRESET_EPSILON } = {}) {
  return almostEqual(p1.x, p2.x, { EPSILON }) && almostEqual(p1.y, p2.y, { EPSILON });
}

/**
 * Calculate the distance between two points in {x,y} dimensions.
 * @param {x, y} A   Point in {x, y} format.
 * @param {x, y} B   Point in {x, y} format.
 * @param {Number}  EPSILON   Small number representing error within which the distance 
 *                              will be considered 0
 * @return The distance between the two points.
 */
export function calculateDistance(A, B, { EPSILON = PRESET_EPSILON } = {}) {
  // could use pointsAlmostEqual function but this avoids double-calculating
  const dx = Math.abs(B.x - A.x); 
  const dy = Math.abs(B.y - A.y);
  if(dy < EPSILON && dx < EPSILON) { return 0; }
  if(dy < EPSILON) { return dx; }
  if(dx < EPSILON) { return dy; }

  return Math.hypot(dy, dx);
}

/**
 * Is point 3 clockwise or counterclockwise (CCW) of the line from p1 -> p2 -> p3
 * @param {x, y} p1   Point in {x, y} format.
 * @param {x, y} p2   Point in {x, y} format.
 * @param {x, y} p3   Point in {x, y} format.
 * @return {Number}  Positive if CCW, Negative if CW, 0 if in line
 */
export function orient2dPoints(p1, p2, p3) {
  if(!game.modules.get(MODULE_ID).api.use_robust_ccw) {
    return orient2dfast(p1.x, p1.y,
                        p2.x, p2.y,
                        p3.x, p3.y)
  }

  return orient2d(p1.x, p1.y,
                  p2.x, p2.y,
                  p3.x, p3.y);
}


/**
 * Same as orient2dPoints but checks for 0 and returns -1, 0, or 1
 * @param {x, y} p1   Point in {x, y} format.
 * @param {x, y} p2   Point in {x, y} format.
 * @param {x, y} p3   Point in {x, y} format.
 * @return {-1|0|1}   1 if CCW, -1 if CW, 0 if in line
 */
export function ccwPoints(p1, p2, p3, { EPSILON = PRESET_EPSILON } = {}) {
  const res = orient2dPoints(p1, p2, p3);
  if(almostEqual(res, 0, { EPSILON })) return 0;
  return res < 0 ? -1 : 1;                       
}

/**
 * Given three counter-clockwise points that define a circle, is this fourth point
 * within the circle?
 * @param {x, y} p1   Point in {x, y} format.
 * @param {x, y} p2   Point in {x, y} format.
 * @param {x, y} p3   Point in {x, y} format.
 * @param {x, y} p4   Point in {x, y} format.
 * @return {Number}   Positive if outside circle, Negative if inside, 0 if on circle
 */
export function inCirclePoints(p1, p2, p3, p4) {
  if(!p1 || !p2 || !p3 || !p4) console.warn(`${MODULE_ID}|point undefined`, p1, p2, p3, p4);

   if(!game.modules.get(MODULE_ID).api.use_robust_ccw) {
    return incirclefast(p1.x, p1.y,
                        p2.x, p2.y,
                        p3.x, p3.y,
                        p4.x, p4.y);
  }

  return incircle(p1.x, p1.y,
                  p2.x, p2.y,
                  p3.x, p3.y,
                  p4.x, p4.y);
}

/**
 * Comparable to ccw for inCirclePoints.
 * @param {x, y} p1   Point in {x, y} format.
 * @param {x, y} p2   Point in {x, y} format.
 * @param {x, y} p3   Point in {x, y} format.
 * @param {x, y} p4   Point in {x, y} format.
 * @return {1|0|-1}   1 if outside circle, -1 if inside, 0 if on circle
 */
export function outsideCircle(p1, p2, p3, p4 { EPSILON = PRESET_EPSILON }) {
  const res = inCirclePoints(p1, p2, p3, p4);
  if(almostEqual(res, 0, { EPSILON })) return 0;
  return res < 0 ? -1 : 1;
}
 


/*
 * For a quadratic equation of the form ax^2 + bx + x, get the discriminant.
 * If the discriminant is greater than 0, the roots are real and different.
 * If the discriminant is equal to 0, the roots are real and equal.
 * If the discriminant is less than 0, the roots are complex and different.
 * @param {Number} a
 * @param {Number} b
 * @param {Number} c
 * @return {Number} discriminant equal to  b^2 - 4ac.
 */
export function discriminant(a, b, c) {
  return b * b - 4 * a * c;
}

/*
 * For a quadratic equation of the form ax^2 + bx + x, get the real roots.
 * @param {Number} a
 * @param {Number} b
 * @param {Number} c
 * @return {[Number]} Either zero (if imaginary), one, or two numbers.
 */
export function rootsReal(a, b, c) {
  const discr = discriminant(a, b, c);
  if(almostEqual(discr, 0)) return [ -b/ (2 * a) ]; // single root
  if(discr > 0) {
    // two roots, real and different
    const root1 = (-b + Math.sqrt(discr)) / (2 * a);
    const root2 = (-b - Math.sqrt(discr)) / (2 * a);
    return [root1, root2];
  } 
  
  return []; // imaginary roots; don't bother calculating
}

/**
 * Swap two elements of an array
 * @param {Array} arr
 * @param {number} i    Array index
 * @param {number} j    Second array index, to swap
 * @return {Array} Note that the array is modified in place; return is for convenience
 */
export function arraySwap(arr, i, j) {
  const old_i = arr[i];
  const old_j = arr[j];
  arr[i] = old_j;
  arr[j] = old_i;
  return arr;
}

/**
 * Compare function to sort by x, then y coordinates
 * @param {x: {number}, y: {number} } a
 * @param {x: {number}, y: {number} } b
 * @return {-1|0|1}
 */
export function compareXY(a, b) {
   if(almostEqual(a.x, b.x)) {
      if(almostEqual(a.y, b.y)) { return 0; }
      return a.y < b.y ? -1 : 1;
    } else {
      return a.x < b.x ? -1 : 1; 
    }
 }
 
export function compareXY_A(a, b) {
   return compareXY(a.A, b.A);
 }

/**
 * Compare function to sort by y, then x coordinates
 * @param {x: {number}, y: {number} } a
 * @param {x: {number}, y: {number} } b
 * @return {-1|0|1}
 */
export function compareYX(a, b) {
   if(almostEqual(a.y, b.y)) {
      if(almostEqual(a.x, b.x)) { return 0; }
      return a.x < b.x ? -1 : 1;
    } else {
      return a.y < b.y ? -1 : 1; 
    }
 }
 
/**
 * Helper class that stores a Map of Arrays.
 * Used to store intersections for walls by wall id.
 */
export class MapArray extends Map {
  constructor(...args) {
    super(...args);
  }
  
 /**
  * Push an object onto the underlying array for this id.
  * @param {Object}   id
  * @param ...args    Arguments passed to Array.prototype.push
  * @return {number}  Length per Array.prototype.push
  */ 
  push(id, ...args) {
    if(!this.has(id)) { this.set(id, []); }
  
    const arr = this.get(id);
    return arr.push(...args);
  }
  
 /**
  * Pop an object from the underlying array for this id.
  * @param {Object}   id
  * @param ...args    Arguments passed to Array.prototype.pop
  * @return {Object}  Object at end of array per Array.prototype.pop
  */ 
  pop(id, ...args) {
    if(!this.has(id)) { this.set(id, []); }
  
    const arr = this.get(id);
    return arr.pop(...args);
  } 
  
 /**
  * Sort underlying array for this id.
  * @param {Object} id
  * @param ...args  Arguments passed to Array.prototype.sort
  * @return {Array} sorted array per Array.prototype.sort
  */
  sort(id, ...args) {
    if(!this.has(id)) { this.set(id, []); }
  
    const arr = this.get(id);
    return arr.sort(...args);
  } 
  

} 
