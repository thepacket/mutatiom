// Open-quantum-system (Lindblad) engine — the dissipative second simulator.
//
// The coherent model (evolve.ts) propagates an isolated proton: it oscillates
// between the wells forever with period 2π/Δ. Reality couples the proton to a
// thermal bath (the surrounding base pair, water, phonons), which decoheres
// that oscillation and drives *relaxation* to thermal equilibrium. The
// equilibrium tautomer population is the Boltzmann fraction; the new physics is
// the finite relaxation timescale to reach it — exactly what governs whether a
// mutagenic tautomer survives long enough to be fixed at replication.
//
// We truncate the double well to its lowest M energy eigenstates and evolve the
// density matrix ρ under
//   dρ/dt = −i[H,ρ] + Σ_{i→j} r_{ij}( L ρ L† − ½{L†L, ρ}),  L = |j⟩⟨i|
// with rates r_{ij} = κ |x_{ij}|² w(E_j−E_i) built from the proton-coordinate
// coupling and a bath weight w obeying detailed balance, so the steady state is
// the Gibbs state e^{−H/kT}. (Secular Redfield / quantum-optical master eqn.)
//
// Atomic units throughout; M is small (≤ ~8) so dense complex algebra is cheap.

import { BOLTZMANN_HARTREE_PER_K, ATOMIC_TIME_TO_SECONDS } from "./constants";
import type { SolveResult } from "./doubleWell";
import { prepareLeftLocalised } from "./evolve";

export interface LindbladSystem {
  M: number;
  E: number[]; // truncated eigen-energies
  /** Position matrix elements x_{mn} = ⟨m|x|n⟩ (real, symmetric). */
  xpos: number[][];
  /** Right-well projector ⟨m|Π_{x>0}|n⟩ (real, symmetric). */
  projRight: number[][];
  /** Initial left-localised coefficients c_n (real). */
  c0: number[];
}

export function buildSystem(res: SolveResult, M = 6): LindbladSystem {
  const m = Math.min(M, res.states.length);
  const { x, dx, states } = res;
  const E = states.slice(0, m).map((s) => s.energy);

  const xpos = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const projRight = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  for (let a = 0; a < m; a++) {
    for (let b = a; b < m; b++) {
      let xab = 0;
      let pab = 0;
      const pa = states[a].psi;
      const pb = states[b].psi;
      for (let i = 0; i < x.length; i++) {
        const w = pa[i] * pb[i] * dx;
        xab += w * x[i];
        if (x[i] > 0) pab += w;
      }
      xpos[a][b] = xpos[b][a] = xab;
      projRight[a][b] = projRight[b][a] = pab;
    }
  }

  // Renormalise the left-localised state within the truncated subspace so the
  // initial density matrix has unit trace (dropped high-state weight aside).
  const wp = prepareLeftLocalised(res, m);
  const c0 = wp.cRe.slice(0, m);
  const norm = Math.sqrt(c0.reduce((s, v) => s + v * v, 0)) || 1;
  for (let i = 0; i < m; i++) c0[i] /= norm;
  return { M: m, E, xpos, projRight, c0 };
}

/** Bath weight for a system energy change dE, obeying detailed balance. */
export function bathWeight(dE: number, kT: number): number {
  // Ohmic spectral density J(ω) = ω; emission ∝ (n+1), absorption ∝ n.
  if (kT <= 0) return dE < 0 ? -dE : 0; // T = 0: only spontaneous emission
  const a = Math.abs(dE);
  if (a < 1e-12) return kT; // ω→0 limit of ω·n(ω) = kT
  const n = 1 / (Math.exp(a / kT) - 1);
  return dE < 0 ? a * (n + 1) : a * n;
}

/** All incoherent transition rates r_{ij} (i→j), as a dense M×M matrix. */
export function buildRates(sys: LindbladSystem, kT: number, coupling: number): number[][] {
  const { M, E, xpos } = sys;
  const r = Array.from({ length: M }, () => new Array<number>(M).fill(0));
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < M; j++) {
      if (i === j) continue;
      r[i][j] = coupling * xpos[i][j] * xpos[i][j] * bathWeight(E[j] - E[i], kT);
    }
  }
  return r;
}

/** Thermal (Gibbs) populations p_n ∝ e^{−E_n/kT} — the Lindblad steady state. */
export function thermalPopulations(E: number[], kT: number): number[] {
  if (kT <= 0) {
    const out = E.map(() => 0);
    out[E.indexOf(Math.min(...E))] = 1;
    return out;
  }
  const e0 = Math.min(...E);
  const w = E.map((e) => Math.exp(-(e - e0) / kT));
  const z = w.reduce((s, v) => s + v, 0);
  return w.map((v) => v / z);
}

/**
 * Relaxation time of the lowest (canonical↔tautomer) pair, 1/(r₀₁+r₁₀), in
 * femtoseconds — without time-stepping. This is the timescale on which the
 * open system reaches its thermal tautomer population.
 */
export function relaxationTimeFs(res: SolveResult, tempK: number, coupling: number): number {
  const sys = buildSystem(res, 4);
  const kT = BOLTZMANN_HARTREE_PER_K * tempK;
  const rates = buildRates(sys, kT, coupling);
  const R = (rates[0]?.[1] ?? 0) + (rates[1]?.[0] ?? 0);
  return R > 0 ? (1 / R) * ATOMIC_TIME_TO_SECONDS * 1e15 : Infinity;
}

interface CMat {
  re: number[][];
  im: number[][];
}

function rhs(rho: CMat, E: number[], rates: number[][], M: number): CMat {
  const dre = Array.from({ length: M }, () => new Array<number>(M).fill(0));
  const dim = Array.from({ length: M }, () => new Array<number>(M).fill(0));

  // Coherent part: −i[H,ρ]_{ab} = −i(E_a − E_b) ρ_{ab}.
  for (let a = 0; a < M; a++) {
    for (let b = 0; b < M; b++) {
      const w = E[a] - E[b];
      // −i·w·(re + i·im) = w·im − i·w·re
      dre[a][b] += w * rho.im[a][b];
      dim[a][b] += -w * rho.re[a][b];
    }
  }

  // Dissipator: for each i→j with rate r, population flows i→j and every
  // coherence touching i is damped at r/2.
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < M; j++) {
      const r = rates[i][j];
      if (r === 0 || i === j) continue;
      dre[j][j] += r * rho.re[i][i]; // gain: ρ_ii → ρ_jj
      for (let b = 0; b < M; b++) {
        dre[i][b] -= 0.5 * r * rho.re[i][b];
        dim[i][b] -= 0.5 * r * rho.im[i][b];
        dre[b][i] -= 0.5 * r * rho.re[b][i];
        dim[b][i] -= 0.5 * r * rho.im[b][i];
      }
    }
  }
  return { re: dre, im: dim };
}

function axpy(y: CMat, a: number, x: CMat, M: number): CMat {
  const re = Array.from({ length: M }, () => new Array<number>(M).fill(0));
  const im = Array.from({ length: M }, () => new Array<number>(M).fill(0));
  for (let p = 0; p < M; p++)
    for (let q = 0; q < M; q++) {
      re[p][q] = y.re[p][q] + a * x.re[p][q];
      im[p][q] = y.im[p][q] + a * x.im[p][q];
    }
  return { re, im };
}

export interface LindbladTrajectory {
  timesFs: number[];
  popRight: number[]; // tautomer-well population vs time
  popCanonical: number[]; // left-well population vs time
  levels: number[][]; // per-eigenstate populations vs time
  steadyRight: number; // equilibrium tautomer fraction
  relaxTimeFs: number; // 1/(r_{01}+r_{10}) for the lowest pair
}

export interface LindbladOptions {
  M?: number;
  tempK: number;
  coupling: number;
  tMaxFs?: number;
  samples?: number;
}

function rightPop(rho: CMat, projRight: number[][], M: number): number {
  let p = 0;
  for (let a = 0; a < M; a++)
    for (let b = 0; b < M; b++) p += rho.re[a][b] * projRight[a][b];
  return p;
}

export function evolveLindblad(res: SolveResult, opts: LindbladOptions): LindbladTrajectory {
  const sys = buildSystem(res, opts.M ?? 4);
  const { M, E, c0, projRight } = sys;
  const kT = BOLTZMANN_HARTREE_PER_K * opts.tempK;
  const rates = buildRates(sys, kT, opts.coupling);

  // Lowest-pair relaxation rate sets the natural timescale.
  const R01 = (rates[0]?.[1] ?? 0) + (rates[1]?.[0] ?? 0);
  const relaxTimeAtomic = R01 > 0 ? 1 / R01 : Infinity;
  const tMaxAtomic = opts.tMaxFs
    ? opts.tMaxFs / (ATOMIC_TIME_TO_SECONDS * 1e15)
    : Number.isFinite(relaxTimeAtomic)
      ? 6 * relaxTimeAtomic
      : 1e5;

  const samples = opts.samples ?? 200;
  // Step must resolve the fastest coherence and the fastest rate.
  const maxW = Math.max(1e-6, E[M - 1] - E[0]);
  let maxR = 0;
  for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) maxR = Math.max(maxR, rates[i][j]);
  const dt = Math.min((2 * Math.PI) / maxW / 40, maxR > 0 ? 0.1 / maxR : Infinity, tMaxAtomic / 500);
  const stepsPerSample = Math.max(1, Math.ceil(tMaxAtomic / samples / dt));

  // Initial ρ = |ψ_L⟩⟨ψ_L|.
  let rho: CMat = {
    re: Array.from({ length: M }, (_, a) => Array.from({ length: M }, (_, b) => c0[a] * c0[b])),
    im: Array.from({ length: M }, () => new Array<number>(M).fill(0)),
  };

  const timesFs: number[] = [];
  const popRight: number[] = [];
  const popCanonical: number[] = [];
  const levels: number[][] = [];
  const toFs = ATOMIC_TIME_TO_SECONDS * 1e15;

  let t = 0;
  const record = () => {
    timesFs.push(t * toFs);
    const pr = rightPop(rho, projRight, M);
    popRight.push(pr);
    popCanonical.push(1 - pr);
    levels.push(Array.from({ length: M }, (_, k) => rho.re[k][k]));
  };
  record();

  for (let s = 0; s < samples; s++) {
    for (let k = 0; k < stepsPerSample; k++) {
      // RK4
      const k1 = rhs(rho, E, rates, M);
      const k2 = rhs(axpy(rho, dt / 2, k1, M), E, rates, M);
      const k3 = rhs(axpy(rho, dt / 2, k2, M), E, rates, M);
      const k4 = rhs(axpy(rho, dt, k3, M), E, rates, M);
      let next = axpy(rho, dt / 6, k1, M);
      next = axpy(next, dt / 3, k2, M);
      next = axpy(next, dt / 3, k3, M);
      next = axpy(next, dt / 6, k4, M);
      rho = next;
      t += dt;
    }
    record();
  }

  const thermal = thermalPopulations(E, kT);
  let steadyRight = 0;
  for (let a = 0; a < M; a++) steadyRight += thermal[a] * projRight[a][a];

  return {
    timesFs,
    popRight,
    popCanonical,
    levels,
    steadyRight,
    relaxTimeFs: relaxTimeAtomic * toFs,
  };
}
