import {
  exp,
  inv,
  mul,
  div,
  polyEval,
  polyMul,
  polyDerivative,
  polyTrim,
} from './gf256';

/**
 * One iteration of the polynomial long division that produces the EC
 * codewords. The Division view renders these objects directly; it never
 * recomputes, so the picture and the arithmetic cannot drift apart.
 */
export interface DivisionStep {
  iteration: number;
  /** The data byte fed in on this iteration. */
  dataByte: number;
  /** The GF(256) element being eliminated: dataByte XOR the register head. */
  leadTerm: number;
  /** generator × leadTerm, highest degree first, length eccLen + 1. */
  generatorMultiple: Uint8Array;
  remainderBefore: Uint8Array;
  remainderAfter: Uint8Array;
}

const generatorCache = new Map<number, Uint8Array>();

/**
 * The generator polynomial for `degree` EC codewords:
 *   (x - α^0)(x - α^1) … (x - α^(degree-1))
 * Monic, highest degree first, so g[0] === 1 and length === degree + 1.
 */
export function generatorPoly(degree: number): Uint8Array {
  const cached = generatorCache.get(degree);
  if (cached) return cached;
  let g = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    g = polyMul(g, new Uint8Array([1, exp(i)]));
  }
  generatorCache.set(degree, g);
  return g;
}

export interface RsEncodeResult {
  ecc: Uint8Array;
  trace: DivisionStep[];
}

/**
 * Reed-Solomon encode. The loop is the LFSR form of long division: the ecc
 * register holds the running remainder, and each data byte shifts it once.
 * Pass `trace: true` only for the block the Division view is showing.
 */
export function rsEncode(data: Uint8Array, eccLen: number, trace = false): RsEncodeResult {
  const gen = generatorPoly(eccLen);
  const ecc = new Uint8Array(eccLen);
  const steps: DivisionStep[] = [];

  for (let i = 0; i < data.length; i++) {
    const remainderBefore = trace ? ecc.slice() : ecc;
    const leadTerm = data[i] ^ ecc[0];

    ecc.copyWithin(0, 1);
    ecc[eccLen - 1] = 0;

    if (leadTerm !== 0) {
      for (let j = 0; j < eccLen; j++) ecc[j] ^= mul(gen[j + 1], leadTerm);
    }

    if (trace) {
      const generatorMultiple = new Uint8Array(eccLen + 1);
      for (let j = 0; j <= eccLen; j++) generatorMultiple[j] = mul(gen[j], leadTerm);
      steps.push({
        iteration: i,
        dataByte: data[i],
        leadTerm,
        generatorMultiple,
        remainderBefore: remainderBefore.slice(),
        remainderAfter: ecc.slice(),
      });
    }
  }

  return { ecc, trace: steps };
}

export interface RsDecodeResult {
  /** The corrected codewords (data followed by ecc), or the input if clean. */
  corrected: Uint8Array;
  /** Indices into `corrected` that were repaired. */
  errorPositions: number[];
  /** Syndromes, for display. All zero means the block was already clean. */
  syndromes: Uint8Array;
  failed: boolean;
}

/**
 * Decode one interleave block: syndromes, Berlekamp-Massey, Chien search,
 * Forney. Returns failed=true when the errors exceed eccLen/2 and the block
 * cannot be located — which is exactly the boundary the damage lab pushes at.
 */
export function rsDecode(received: Uint8Array, eccLen: number): RsDecodeResult {
  const out = received.slice();
  const syndromes = new Uint8Array(eccLen);
  let hasError = false;

  for (let i = 0; i < eccLen; i++) {
    syndromes[i] = polyEval(received, exp(i));
    if (syndromes[i] !== 0) hasError = true;
  }

  if (!hasError) {
    return { corrected: out, errorPositions: [], syndromes, failed: false };
  }

  // Berlekamp-Massey. Polynomials here are lowest-degree-first, which is the
  // natural order for the recurrence; they are reversed before Chien search.
  let sigma = new Uint8Array([1]);
  let prev = new Uint8Array([1]);
  let shift = 1;
  let b = 1;

  for (let n = 0; n < eccLen; n++) {
    let delta = syndromes[n];
    for (let i = 1; i < sigma.length; i++) {
      delta ^= mul(sigma[i], syndromes[n - i]);
    }

    if (delta === 0) {
      shift++;
      continue;
    }

    const scaled = new Uint8Array(prev.length + shift);
    const factor = div(delta, b);
    for (let i = 0; i < prev.length; i++) scaled[i + shift] = mul(prev[i], factor);

    const next = new Uint8Array(Math.max(sigma.length, scaled.length));
    next.set(sigma);
    for (let i = 0; i < scaled.length; i++) next[i] ^= scaled[i];

    if (2 * (sigma.length - 1) <= n) {
      prev = sigma;
      b = delta;
      shift = 1;
    } else {
      shift++;
    }
    sigma = next;
  }

  const errorCount = sigma.length - 1;
  if (errorCount === 0 || errorCount * 2 > eccLen) {
    return { corrected: out, errorPositions: [], syndromes, failed: true };
  }

  // Chien search: the roots of sigma are the inverses of the error locators.
  const n = received.length;
  const positions: number[] = [];
  for (let i = 0; i < n; i++) {
    // Position i counts from the high-degree end, so its locator is α^(n-1-i).
    const xInv = exp(255 - ((n - 1 - i) % 255));
    let sum = 0;
    for (let j = 0; j < sigma.length; j++) sum ^= mul(sigma[j], expPow(xInv, j));
    if (sum === 0) positions.push(i);
  }

  if (positions.length !== errorCount) {
    return { corrected: out, errorPositions: [], syndromes, failed: true };
  }

  // Forney. omega = (syndromePoly × sigma) mod x^eccLen.
  const sigmaHigh = polyTrim(reverse(sigma));
  const syndromePoly = reverse(syndromes); // highest degree first
  const product = polyMul(syndromePoly, sigmaHigh);
  const omega = product.slice(Math.max(0, product.length - eccLen));
  const sigmaPrime = polyDerivative(sigmaHigh);

  for (const pos of positions) {
    const locator = exp((n - 1 - pos) % 255);
    const xInv = inv(locator);
    const num = polyEval(omega, xInv);
    const den = polyEval(sigmaPrime, xInv);
    if (den === 0) {
      return { corrected: out, errorPositions: [], syndromes, failed: true };
    }
    const magnitude = mul(locator, div(num, den));
    out[pos] ^= magnitude;
  }

  // Verify: a corrected block must have all-zero syndromes.
  for (let i = 0; i < eccLen; i++) {
    if (polyEval(out, exp(i)) !== 0) {
      return { corrected: received.slice(), errorPositions: [], syndromes, failed: true };
    }
  }

  return { corrected: out, errorPositions: positions, syndromes, failed: false };
}

function expPow(base: number, power: number): number {
  let acc = 1;
  for (let i = 0; i < power; i++) acc = mul(acc, base);
  return acc;
}

function reverse(p: Uint8Array): Uint8Array {
  const out = new Uint8Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = p[p.length - 1 - i];
  return out;
}
