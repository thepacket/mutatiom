// Coherent time evolution of a proton prepared in the canonical (left) well.
//
// Expand a left-localised Gaussian in the energy eigenbasis, then propagate:
//   Ψ(x,t) = Σ_k c_k ψ_k(x) e^{−i E_k t}
// |Ψ(x,t)|² sloshes between the wells with period 2π/Δ — the visual signature
// of coherent proton tunnelling. All times in atomic units.

import type { SolveResult } from "./doubleWell";

export interface WavePacket {
  /** Expansion coefficients (complex) on the eigenbasis. */
  cRe: number[];
  cIm: number[];
  res: SolveResult;
}

/** Prepare a Gaussian localised at the left minimum, expanded in eigenstates. */
export function prepareLeftLocalised(res: SolveResult, nStates = 8): WavePacket {
  const { x, dx, states, params } = res;
  const k = Math.min(nStates, states.length);
  const x0 = -params.wellSep;
  // Width ≈ harmonic ground-state width in the well.
  const omega = Math.sqrt((8 * params.barrier) / (params.wellSep ** 2 * params.mass));
  const sigma = Math.sqrt(1 / (params.mass * omega));
  const g = x.map((xi) => Math.exp(-((xi - x0) ** 2) / (2 * sigma * sigma)));
  // Normalise the guess.
  let gn = 0;
  for (const v of g) gn += v * v * dx;
  gn = Math.sqrt(gn);
  for (let i = 0; i < g.length; i++) g[i] /= gn;

  const cRe: number[] = [];
  const cIm: number[] = [];
  for (let s = 0; s < k; s++) {
    let c = 0;
    const psi = states[s].psi;
    for (let i = 0; i < x.length; i++) c += psi[i] * g[i] * dx;
    cRe.push(c);
    cIm.push(0);
  }
  return { cRe, cIm, res };
}

/** |Ψ(x,t)|² on the grid. */
export function densityAt(wp: WavePacket, t: number): number[] {
  const { res, cRe } = wp;
  const { x, states } = wp.res;
  const n = x.length;
  const re = new Array<number>(n).fill(0);
  const im = new Array<number>(n).fill(0);
  for (let s = 0; s < cRe.length; s++) {
    const E = states[s].energy;
    const phRe = Math.cos(-E * t);
    const phIm = Math.sin(-E * t);
    const cr = cRe[s] * phRe; // c_s is real here
    const ci = cRe[s] * phIm;
    const psi = states[s].psi;
    for (let i = 0; i < n; i++) {
      re[i] += cr * psi[i];
      im[i] += ci * psi[i];
    }
  }
  const dens = new Array<number>(n);
  for (let i = 0; i < n; i++) dens[i] = re[i] * re[i] + im[i] * im[i];
  void res;
  return dens;
}

/** Probability in the right (tautomer) well, x > 0. */
export function rightPopulation(wp: WavePacket, t: number): number {
  const dens = densityAt(wp, t);
  const { x, dx } = wp.res;
  let p = 0;
  for (let i = 0; i < x.length; i++) if (x[i] > 0) p += dens[i] * dx;
  return p;
}
