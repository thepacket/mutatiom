// The double-well proton model.
//
// A Watson–Crick base pair holds its inter-strand protons in a hydrogen
// bond that, along the donor→acceptor coordinate, is a double-well
// potential: the proton sits at the canonical minimum, but can tunnel to
// the second minimum, producing a rare tautomer (the Löwdin mechanism).
//
// We model one proton coordinate with a quartic double well plus an
// optional asymmetry bias (canonical vs. tautomer are not degenerate):
//
//   V(x) = V0 · (x²/a² − 1)²  +  (bias/2)·(x/a)
//
// minima near x = ±a, barrier height ≈ V0 at x = 0. All quantities are in
// atomic units (see constants.ts).

import { eigSymTridiagonal } from "./eigen";
import { PROTON_MASS } from "./constants";

export interface ProtonParams {
  /** Reduced mass of the tunnelling particle (proton by default). */
  mass: number;
  /** Barrier height V0 (Hartree). */
  barrier: number;
  /** Half the separation of the two minima, a (Bohr). */
  wellSep: number;
  /** Energy bias favouring the canonical (left) well (Hartree). >0 deepens left. */
  bias: number;
  /** Grid half-width L; domain is [−L, L] (Bohr). */
  halfWidth: number;
  /** Number of interior grid points. */
  gridN: number;
}

export const DEFAULT_PARAMS: ProtonParams = {
  mass: PROTON_MASS,
  barrier: 0.007, // ~4.4 kcal/mol — a representative H-bond proton barrier
  wellSep: 0.75, // ~0.40 Å each side of centre (proton-transfer distance)
  bias: 0.003, // ~1.9 kcal/mol — canonical form is the deeper well
  halfWidth: 1.8,
  gridN: 401,
};

export interface EigenState {
  energy: number; // Hartree
  psi: number[]; // amplitude on the grid, L2-normalised w.r.t. dx
}

export interface SolveResult {
  x: number[]; // grid (Bohr)
  V: number[]; // potential on the grid (Hartree)
  dx: number;
  states: EigenState[];
  params: ProtonParams;
}

export function potential(x: number, p: ProtonParams): number {
  const u = x / p.wellSep;
  return p.barrier * (u * u - 1) ** 2 + 0.5 * p.bias * u;
}

/**
 * Solve the 1-D time-independent Schrödinger equation on a uniform grid by
 * 3-point finite differences, returning the lowest `numStates` eigenstates.
 */
export function solveDoubleWell(p: ProtonParams, numStates = 6): SolveResult {
  const n = p.gridN;
  const dx = (2 * p.halfWidth) / (n + 1);
  const x = new Array<number>(n);
  const V = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    x[i] = -p.halfWidth + (i + 1) * dx;
    V[i] = potential(x[i], p);
  }

  // H = -1/(2m) d²/dx² + V. 3-point Laplacian → tridiagonal.
  const t = 1 / (2 * p.mass * dx * dx);
  const diag = new Array<number>(n);
  const off = new Array<number>(n - 1);
  for (let i = 0; i < n; i++) diag[i] = 2 * t + V[i];
  for (let i = 0; i < n - 1; i++) off[i] = -t;

  const { values, vectors } = eigSymTridiagonal(diag, off);

  const states: EigenState[] = [];
  const k = Math.min(numStates, n);
  for (let s = 0; s < k; s++) {
    // Eigenvectors come out L2-normalised as discrete vectors; rescale so
    // Σ|ψ|²·dx = 1 (continuum normalisation).
    const raw = vectors[s];
    const psi = raw.map((v) => v / Math.sqrt(dx));
    states.push({ energy: values[s], psi });
  }

  return { x, V, dx, states, params: p };
}
