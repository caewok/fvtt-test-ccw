import {epsilon, splitter, resulterrbound, estimate, vec, sum, sum_three, scale} from './util.js';

const iccerrboundA = (10 + 96 * epsilon) * epsilon;
const iccerrboundB = (4 + 48 * epsilon) * epsilon;
const iccerrboundC = (44 + 576 * epsilon) * epsilon * epsilon;

const bc = vec(4);
const ca = vec(4);
const ab = vec(4);
const aa = vec(4);
const bb = vec(4);
const cc = vec(4);
const u = vec(4);
const v = vec(4);
const axtbc = vec(8);
const aytbc = vec(8);
const bxtca = vec(8);
const bytca = vec(8);
const cxtab = vec(8);
const cytab = vec(8);
const abt = vec(8);
const bct = vec(8);
const cat = vec(8);
const abtt = vec(4);
const bctt = vec(4);
const catt = vec(4);

const _8 = vec(8);
const _16 = vec(16);
const _16b = vec(16);
const _16c = vec(16);
const _32 = vec(32);
const _32b = vec(32);
const _48 = vec(48);
const _64 = vec(64);

let fin = vec(1152);
let fin2 = vec(1152);

function finadd(finlen, a, alen) {
    finlen = sum(finlen, fin, a, alen, fin2);
    const tmp = fin; fin = fin2; fin2 = tmp;
    return finlen;
}

function incircleadapt(ax, ay, bx, by, cx, cy, dx, dy, permanent) {
    let finlen;
    let adxtail, bdxtail, cdxtail, adytail, bdytail, cdytail;
    let axtbclen, aytbclen, bxtcalen, bytcalen, cxtablen, cytablen;
    let abtlen, bctlen, catlen;
    let abttlen, bcttlen, cattlen;
    let n1, n0;

    let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u3;

    const adx = ax - dx;
    const bdx = bx - dx;
    const cdx = cx - dx;
    const ady = ay - dy;
    const bdy = by - dy;
    const cdy = cy - dy;

    $Cross_Product(bdx, bdy, cdx, cdy, bc);
    $Cross_Product(cdx, cdy, adx, ady, ca);
    $Cross_Product(adx, ady, bdx, bdy, ab);

    finlen = sum(
        sum(
            sum(
                scale(scale(4, bc, adx, _8), _8, adx, _16), _16,
                scale(scale(4, bc, ady, _8), _8, ady, _16b), _16b, _32), _32,
            sum(
                scale(scale(4, ca, bdx, _8), _8, bdx, _16), _16,
                scale(scale(4, ca, bdy, _8), _8, bdy, _16b), _16b, _32b), _32b, _64), _64,
        sum(
            scale(scale(4, ab, cdx, _8), _8, cdx, _16), _16,
            scale(scale(4, ab, cdy, _8), _8, cdy, _16b), _16b, _32), _32, fin);

    let det = estimate(finlen, fin);
    let errbound = iccerrboundB * permanent;
    if (det >= errbound || -det >= errbound) {
        return det;
    }

    $Two_Diff_Tail(ax, dx, adx, adxtail);
    $Two_Diff_Tail(ay, dy, ady, adytail);
    $Two_Diff_Tail(bx, dx, bdx, bdxtail);
    $Two_Diff_Tail(by, dy, bdy, bdytail);
    $Two_Diff_Tail(cx, dx, cdx, cdxtail);
    $Two_Diff_Tail(cy, dy, cdy, cdytail);
    if (adxtail === 0 && bdxtail === 0 && cdxtail === 0 && adytail === 0 && bdytail === 0 && cdytail === 0) {
        return det;
    }

    errbound = iccerrboundC * permanent + resulterrbound * Math.abs(det);
    det += ((adx * adx + ady * ady) * ((bdx * cdytail + cdy * bdxtail) - (bdy * cdxtail + cdx * bdytail)) +
        2 * (adx * adxtail + ady * adytail) * (bdx * cdy - bdy * cdx)) +
        ((bdx * bdx + bdy * bdy) * ((cdx * adytail + ady * cdxtail) - (cdy * adxtail + adx * cdytail)) +
        2 * (bdx * bdxtail + bdy * bdytail) * (cdx * ady - cdy * adx)) +
        ((cdx * cdx + cdy * cdy) * ((adx * bdytail + bdy * adxtail) - (ady * bdxtail + bdx * adytail)) +
        2 * (cdx * cdxtail + cdy * cdytail) * (adx * bdy - ady * bdx));

    if (det >= errbound || -det >= errbound) {
        return det;
    }

    if (bdxtail !== 0 || bdytail !== 0 || cdxtail !== 0 || cdytail !== 0) {
        $Square_Sum(adx, ady, aa);
    }
    if (cdxtail !== 0 || cdytail !== 0 || adxtail !== 0 || adytail !== 0) {
        $Square_Sum(bdx, bdy, bb);
    }
    if (adxtail !== 0 || adytail !== 0 || bdxtail !== 0 || bdytail !== 0) {
        $Square_Sum(cdx, cdy, cc);
    }

    if (adxtail !== 0) {
        axtbclen = scale(4, bc, adxtail, axtbc);
        finlen = finadd(finlen, sum_three(
            scale(axtbclen, axtbc, 2 * adx, _16), _16,
            scale(scale(4, cc, adxtail, _8), _8, bdy, _16b), _16b,
            scale(scale(4, bb, adxtail, _8), _8, -cdy, _16c), _16c, _32, _48), _48);
    }
    if (adytail !== 0) {
        aytbclen = scale(4, bc, adytail, aytbc);
        finlen = finadd(finlen, sum_three(
            scale(aytbclen, aytbc, 2 * ady, _16), _16,
            scale(scale(4, bb, adytail, _8), _8, cdx, _16b), _16b,
            scale(scale(4, cc, adytail, _8), _8, -bdx, _16c), _16c, _32, _48), _48);
    }
    if (bdxtail !== 0) {
        bxtcalen = scale(4, ca, bdxtail, bxtca);
        finlen = finadd(finlen, sum_three(
            scale(bxtcalen, bxtca, 2 * bdx, _16), _16,
            scale(scale(4, aa, bdxtail, _8), _8, cdy, _16b), _16b,
            scale(scale(4, cc, bdxtail, _8), _8, -ady, _16c), _16c, _32, _48), _48);
    }
    if (bdytail !== 0) {
        bytcalen = scale(4, ca, bdytail, bytca);
        finlen = finadd(finlen, sum_three(
            scale(bytcalen, bytca, 2 * bdy, _16), _16,
            scale(scale(4, cc, bdytail, _8), _8, adx, _16b), _16b,
            scale(scale(4, aa, bdytail, _8), _8, -cdx, _16c), _16c, _32, _48), _48);
    }
    if (cdxtail !== 0) {
        cxtablen = scale(4, ab, cdxtail, cxtab);
        finlen = finadd(finlen, sum_three(
            scale(cxtablen, cxtab, 2 * cdx, _16), _16,
            scale(scale(4, bb, cdxtail, _8), _8, ady, _16b), _16b,
            scale(scale(4, aa, cdxtail, _8), _8, -bdy, _16c), _16c, _32, _48), _48);
    }
    if (cdytail !== 0) {
        cytablen = scale(4, ab, cdytail, cytab);
        finlen = finadd(finlen, sum_three(
            scale(cytablen, cytab, 2 * cdy, _16), _16,
            scale(scale(4, aa, cdytail, _8), _8, bdx, _16b), _16b,
            scale(scale(4, bb, cdytail, _8), _8, -adx, _16c), _16c, _32, _48), _48);
    }

    if (adxtail !== 0 || adytail !== 0) {
        if (bdxtail !== 0 || bdytail !== 0 || cdxtail !== 0 || cdytail !== 0) {
            $Two_Product_Sum(bdxtail, cdy, bdx, cdytail, u);
            $Two_Product_Sum(cdxtail, -bdy, cdx, -bdytail, v);
            bctlen = sum(4, u, 4, v, bct);
            $Cross_Product(bdxtail, bdytail, cdxtail, cdytail, bctt);
            bcttlen = 4;
        } else {
            bct[0] = 0;
            bctlen = 1;
            bctt[0] = 0;
            bcttlen = 1;
        }
        if (adxtail !== 0) {
            const len = scale(bctlen, bct, adxtail, _16c);
            finlen = finadd(finlen, sum(
                scale(axtbclen, axtbc, adxtail, _16), _16,
                scale(len, _16c, 2 * adx, _32), _32, _48), _48);

            const len2 = scale(bcttlen, bctt, adxtail, _8);
            finlen = finadd(finlen, sum_three(
                scale(len2, _8, 2 * adx, _16), _16,
                scale(len2, _8, adxtail, _16b), _16b,
                scale(len, _16c, adxtail, _32), _32, _32b, _64), _64);

            if (bdytail !== 0) {
                finlen = finadd(finlen, scale(scale(4, cc, adxtail, _8), _8, bdytail, _16), _16);
            }
            if (cdytail !== 0) {
                finlen = finadd(finlen, scale(scale(4, bb, -adxtail, _8), _8, cdytail, _16), _16);
            }
        }
        if (adytail !== 0) {
            const len = scale(bctlen, bct, adytail, _16c);
            finlen = finadd(finlen, sum(
                scale(aytbclen, aytbc, adytail, _16), _16,
                scale(len, _16c, 2 * ady, _32), _32, _48), _48);

            const len2 = scale(bcttlen, bctt, adytail, _8);
            finlen = finadd(finlen, sum_three(
                scale(len2, _8, 2 * ady, _16), _16,
                scale(len2, _8, adytail, _16b), _16b,
                scale(len, _16c, adytail, _32), _32, _32b, _64), _64);
        }
    }
    if (bdxtail !== 0 || bdytail !== 0) {
        if (cdxtail !== 0 || cdytail !== 0 || adxtail !== 0 || adytail !== 0) {
            $Two_Product_Sum(cdxtail, ady, cdx, adytail, u);
            n1 = -cdy;
            n0 = -cdytail;
            $Two_Product_Sum(adxtail, n1, adx, n0, v);
            catlen = sum(4, u, 4, v, cat);
            $Cross_Product(cdxtail, cdytail, adxtail, adytail, catt);
            cattlen = 4;
        } else {
            cat[0] = 0;
            catlen = 1;
            catt[0] = 0;
            cattlen = 1;
        }
        if (bdxtail !== 0) {
            const len = scale(catlen, cat, bdxtail, _16c);
            finlen = finadd(finlen, sum(
                scale(bxtcalen, bxtca, bdxtail, _16), _16,
                scale(len, _16c, 2 * bdx, _32), _32, _48), _48);

            const len2 = scale(cattlen, catt, bdxtail, _8);
            finlen = finadd(finlen, sum_three(
                scale(len2, _8, 2 * bdx, _16), _16,
                scale(len2, _8, bdxtail, _16b), _16b,
                scale(len, _16c, bdxtail, _32), _32, _32b, _64), _64);

            if (cdytail !== 0) {
                finlen = finadd(finlen, scale(scale(4, aa, bdxtail, _8), _8, cdytail, _16), _16);
            }
            if (adytail !== 0) {
                finlen = finadd(finlen, scale(scale(4, cc, -bdxtail, _8), _8, adytail, _16), _16);
            }
        }
        if (bdytail !== 0) {
            const len = scale(catlen, cat, bdytail, _16c);
            finlen = finadd(finlen, sum(
                scale(bytcalen, bytca, bdytail, _16), _16,
                scale(len, _16c, 2 * bdy, _32), _32, _48), _48);

            const len2 = scale(cattlen, catt, bdytail, _8);
            finlen = finadd(finlen, sum_three(
                scale(len2, _8, 2 * bdy, _16), _16,
                scale(len2, _8, bdytail, _16b), _16b,
                scale(len, _16c, bdytail, _32), _32,  _32b, _64), _64);
        }
    }
    if (cdxtail !== 0 || cdytail !== 0) {
        if (adxtail !== 0 || adytail !== 0 || bdxtail !== 0 || bdytail !== 0) {
            $Two_Product_Sum(adxtail, bdy, adx, bdytail, u);
            n1 = -ady;
            n0 = -adytail;
            $Two_Product_Sum(bdxtail, n1, bdx, n0, v);
            abtlen = sum(4, u, 4, v, abt);
            $Cross_Product(adxtail, adytail, bdxtail, bdytail, abtt);
            abttlen = 4;
        } else {
            abt[0] = 0;
            abtlen = 1;
            abtt[0] = 0;
            abttlen = 1;
        }
        if (cdxtail !== 0) {
            const len = scale(abtlen, abt, cdxtail, _16c);
            finlen = finadd(finlen, sum(
                scale(cxtablen, cxtab, cdxtail, _16), _16,
                scale(len, _16c, 2 * cdx, _32), _32, _48), _48);

            const len2 = scale(abttlen, abtt, cdxtail, _8);
            finlen = finadd(finlen, sum_three(
                scale(len2, _8, 2 * cdx, _16), _16,
                scale(len2, _8, cdxtail, _16b), _16b,
                scale(len, _16c, cdxtail, _32), _32, _32b, _64), _64);

            if (adytail !== 0) {
                finlen = finadd(finlen, scale(scale(4, bb, cdxtail, _8), _8, adytail, _16), _16);
            }
            if (bdytail !== 0) {
                finlen = finadd(finlen, scale(scale(4, aa, -cdxtail, _8), _8, bdytail, _16), _16);
            }
        }
        if (cdytail !== 0) {
            const len = scale(abtlen, abt, cdytail, _16c);
            finlen = finadd(finlen, sum(
                scale(cytablen, cytab, cdytail, _16), _16,
                scale(len, _16c, 2 * cdy, _32), _32, _48), _48);

            const len2 = scale(abttlen, abtt, cdytail, _8);
            finlen = finadd(finlen, sum_three(
                scale(len2, _8, 2 * cdy, _16), _16,
                scale(len2, _8, cdytail, _16b), _16b,
                scale(len, _16c, cdytail, _32), _32, _32b, _64), _64);
        }
    }

    return fin[finlen - 1];
}

export function incircle(ax, ay, bx, by, cx, cy, dx, dy) {
    const adx = ax - dx;
    const bdx = bx - dx;
    const cdx = cx - dx;
    const ady = ay - dy;
    const bdy = by - dy;
    const cdy = cy - dy;

    const bdxcdy = bdx * cdy;
    const cdxbdy = cdx * bdy;
    const alift = adx * adx + ady * ady;

    const cdxady = cdx * ady;
    const adxcdy = adx * cdy;
    const blift = bdx * bdx + bdy * bdy;

    const adxbdy = adx * bdy;
    const bdxady = bdx * ady;
    const clift = cdx * cdx + cdy * cdy;

    const det =
        alift * (bdxcdy - cdxbdy) +
        blift * (cdxady - adxcdy) +
        clift * (adxbdy - bdxady);

    const permanent =
        (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * alift +
        (Math.abs(cdxady) + Math.abs(adxcdy)) * blift +
        (Math.abs(adxbdy) + Math.abs(bdxady)) * clift;

    const errbound = iccerrboundA * permanent;

    if (det > errbound || -det > errbound) {
        return det;
    }
    return incircleadapt(ax, ay, bx, by, cx, cy, dx, dy, permanent);
}

export function incirclefast(ax, ay, bx, by, cx, cy, dx, dy) {
    const adx = ax - dx;
    const ady = ay - dy;
    const bdx = bx - dx;
    const bdy = by - dy;
    const cdx = cx - dx;
    const cdy = cy - dy;

    const abdet = adx * bdy - bdx * ady;
    const bcdet = bdx * cdy - cdx * bdy;
    const cadet = cdx * ady - adx * cdy;
    const alift = adx * adx + ady * ady;
    const blift = bdx * bdx + bdy * bdy;
    const clift = cdx * cdx + cdy * cdy;

    return alift * bcdet + blift * cadet + clift * abdet;
}