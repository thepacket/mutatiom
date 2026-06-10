// Two-dimensional double-proton-transfer model.
//
// Löwdin tautomerisation is a *double* proton transfer (DPT): two protons move
// across two Watson–Crick hydrogen bonds. A 1-D reaction coordinate (the
// single-proton model in doubleWell.ts) cannot distinguish the two mechanisms:
//   • concerted  — both protons cross together (diagonal path on the 2-D PES)
//   • stepwise   — one transfers first, through a charge-separated single-proton
//                  intermediate (a "zwitterionic" corner), then the other.
//
// We model two proton coordinates (x₁, x₂), each in its own quartic double well,
// coupled so the single-transfer corners are raised (charge separation costs
// energy). With u_i = x_i/a:
//
//   V(x₁,x₂) = V₀[(u₁²−1)² + (u₂²−1)²] − g·u₁u₂ + (ΔE/4)(u₁+u₂)
//
// The four corners (u≈±1): (−,−) canonical, (+,+) tautomer (ΔE above canonical),
// (+,−)/(−,+) single-proton intermediates (2g above canonical). Larger coupling
// g raises those intermediates and favours the concerted path.
//
// Atomic units throughout. The 2-D Hilbert space is large, so we get the ground
// state by imaginary-time relaxation (no dense diagonalisation).

import { PROTON_MASS } from "./constants";

export interface Params2D {
  mass: number;
  barrier: number; // V₀ per proton (Hartree)
  wellSep: number; // a (Bohr)
  asymmetry: number; // ΔE canonical→tautomer (Hartree)
  coupling: number; // g (Hartree); raises the single-transfer corners
  halfWidth: number; // grid half-width (Bohr)
  gridN: number; // points per axis
}

export function potential2d(x1: number, x2: number, p: Params2D): number {
  const u1 = x1 / p.wellSep;
  const u2 = x2 / p.wellSep;
  return (
    p.barrier * ((u1 * u1 - 1) ** 2 + (u2 * u2 - 1) ** 2) -
    p.coupling * u1 * u2 +
    (p.asymmetry / 4) * (u1 + u2)
  );
}

export interface GroundState2D {
  N: number;
  x: number[]; // grid (Bohr), shared by both axes
  dx: number;
  V: Float64Array; // potential, row-major (i*N + j) ↔ (x1=x[i], x2=x[j])
  psi: Float64Array; // ground-state amplitude, ∑ψ²·dx² = 1
  energy: number; // ground-state energy (Hartree)
  iterations: number;
}

/**
 * Ground state of −1/(2m)∇² + V on an N×N grid by imaginary-time relaxation
 * (normalised steepest descent). Works for any potential function.
 */
export function groundState2dV(
  Vfunc: (x1: number, x2: number) => number,
  opts: { mass: number; halfWidth: number; gridN: number },
): GroundState2D {
  const N = opts.gridN;
  const L = opts.halfWidth;
  const dx = (2 * L) / (N + 1);
  const x = new Array<number>(N);
  for (let i = 0; i < N; i++) x[i] = -L + (i + 1) * dx;

  const V = new Float64Array(N * N);
  let vMax = -Infinity;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const v = Vfunc(x[i], x[j]);
      V[i * N + j] = v;
      if (v > vMax) vMax = v;
    }

  const t = 1 / (2 * opts.mass * dx * dx); // kinetic coefficient
  // Imaginary-time step, stable for the explicit (1 − dτH) map: dτ < 2/λ_max,
  // λ_max ≈ 4t + V_max.
  const dtau = 0.8 / (4 * t + Math.max(vMax, 0));

  // Initialise positive (overlaps the ground state) and normalise.
  let psi = new Float64Array(N * N).fill(1);
  const norm = (a: Float64Array) => {
    let s = 0;
    for (let k = 0; k < a.length; k++) s += a[k] * a[k];
    s = Math.sqrt(s * dx * dx);
    for (let k = 0; k < a.length; k++) a[k] /= s;
  };
  norm(psi);

  // Hψ into out.
  const Hpsi = new Float64Array(N * N);
  const applyH = (a: Float64Array, out: Float64Array) => {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const c = i * N + j;
        const up = i > 0 ? a[c - N] : 0;
        const dn = i < N - 1 ? a[c + N] : 0;
        const lf = j > 0 ? a[c - 1] : 0;
        const rt = j < N - 1 ? a[c + 1] : 0;
        out[c] = -t * (up + dn + lf + rt - 4 * a[c]) + V[c] * a[c];
      }
    }
  };
  const energy = (a: Float64Array): number => {
    applyH(a, Hpsi);
    let e = 0;
    for (let k = 0; k < a.length; k++) e += a[k] * Hpsi[k];
    return e * dx * dx;
  };

  let prevE = Infinity;
  let it = 0;
  const maxIt = 6000;
  for (; it < maxIt; it++) {
    applyH(psi, Hpsi);
    const next = new Float64Array(N * N);
    for (let k = 0; k < psi.length; k++) next[k] = psi[k] - dtau * Hpsi[k];
    norm(next);
    psi = next;
    if (it % 100 === 0) {
      const e = energy(psi);
      if (Math.abs(e - prevE) < 1e-8) {
        it++;
        break;
      }
      prevE = e;
    }
  }

  return { N, x, dx, V, psi, energy: energy(psi), iterations: it };
}

export const DEFAULT_PARAMS_2D: Params2D = {
  mass: PROTON_MASS,
  barrier: 0.018, // ~G·C-scale single-proton barrier
  wellSep: 0.567,
  asymmetry: 0.016, // ~0.435 eV
  coupling: 0.01,
  halfWidth: 1.5,
  gridN: 64,
};

export function groundState2d(p: Params2D): GroundState2D {
  return groundState2dV((a, b) => potential2d(a, b, p), {
    mass: p.mass,
    halfWidth: p.halfWidth,
    gridN: p.gridN,
  });
}

export interface QuadrantPops {
  canonical: number; // x1<0, x2<0
  tautomer: number; // x1>0, x2>0
  intermediate: number; // single-proton-transferred corners
}

export function quadrantPopulations(gs: GroundState2D): QuadrantPops {
  const { N, x, psi, dx } = gs;
  let c = 0;
  let ta = 0;
  let im = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const p = psi[i * N + j] ** 2 * dx * dx;
      const left = x[i] < 0;
      const down = x[j] < 0;
      if (left && down) c += p;
      else if (!left && !down) ta += p;
      else im += p;
    }
  return { canonical: c, tautomer: ta, intermediate: im };
}

export interface PathwayAnalysis {
  concertedBarrier: number; // Hartree, above canonical minimum
  stepwiseBarrier: number; // Hartree, above canonical minimum
  mechanism: "concerted" | "stepwise";
}

/** Compare the concerted (diagonal) and stepwise (via a corner) path barriers. */
export function pathwayBarriers(p: Params2D, samples = 200): PathwayAnalysis {
  const a = p.wellSep;
  const vCanon = potential2d(-a, -a, p);
  const maxAlong = (f: (s: number) => [number, number]) => {
    let m = -Infinity;
    for (let k = 0; k <= samples; k++) {
      const [x1, x2] = f(k / samples);
      m = Math.max(m, potential2d(x1, x2, p));
    }
    return m;
  };
  // Concerted: straight diagonal (−a,−a) → (+a,+a).
  const concerted = maxAlong((s) => [-a + 2 * a * s, -a + 2 * a * s]) - vCanon;
  // Stepwise: (−a,−a) → (+a,−a) → (+a,+a), through a single-transfer corner.
  const stepwise =
    maxAlong((s) =>
      s < 0.5
        ? [-a + 2 * a * (2 * s), -a]
        : [a, -a + 2 * a * (2 * s - 1)],
    ) - vCanon;
  return {
    concertedBarrier: concerted,
    stepwiseBarrier: stepwise,
    mechanism: concerted <= stepwise ? "concerted" : "stepwise",
  };
}
