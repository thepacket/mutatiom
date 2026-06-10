// Tunnelling observables derived from the double-well spectrum.
//
// For a (near-)symmetric double well, the two lowest eigenstates form a
// symmetric/antisymmetric pair split by Δ = E₁ − E₀. A proton prepared in
// one well is a superposition of the two; it oscillates coherently to the
// other well with period 2π/Δ. The half-period π/Δ is the canonical→tautomer
// transfer time. We report the exact (diagonalised) splitting and a WKB
// cross-check, plus a thermally-averaged transfer rate.

import { ATOMIC_TIME_TO_SECONDS, BOLTZMANN_HARTREE_PER_K } from "./constants";
import type { ProtonParams, SolveResult } from "./doubleWell";
import { potential } from "./doubleWell";

export interface TunnelingResult {
  /** Raw finite-difference ground splitting Δ = E₁ − E₀ (Hartree). */
  splitting: number;
  /** WKB semiclassical estimate of the same splitting (Hartree). */
  splittingWKB: number;
  /**
   * Best splitting estimate (Hartree). Equals the finite-difference value in
   * the resolvable regime; falls back to WKB in the deep-tunnelling regime,
   * where the FD splitting is below numerical resolution and floors out.
   */
  splittingEffective: number;
  /** False when the FD splitting is unresolvable and WKB is used instead. */
  reliableFD: boolean;
  /** Coherent transfer time π/Δ from the effective splitting (seconds). */
  transferTimeSeconds: number;
  /** Small-oscillation frequency in a well, ω (atomic units). */
  wellOmega: number;
  /** WKB barrier action θ = ∫√(2m(V−E)) dx (dimensionless, atomic units). */
  barrierAction: number;
}

// For a near-symmetric well E₁−E₀ IS the tunnelling splitting and tracks WKB
// closely. For a biased well it is instead the canonical↔tautomer *detuning*
// (≈ the bias), far larger than the tunnelling matrix element — so when FD
// exceeds WKB by more than this factor we report the WKB element instead.
const FD_WKB_MAX_RATIO = 5;

/** Curvature of V at its (left) minimum → harmonic ω = √(V''/m). */
function wellFrequency(p: ProtonParams): number {
  // V(x) = V0 (x²/a²−1)² + (bias/2)(x/a). Near x = −a the leading curvature
  // is the same as the symmetric quartic: V'' ≈ 8 V0 / a².
  const vpp = (8 * p.barrier) / (p.wellSep * p.wellSep);
  return Math.sqrt(vpp / p.mass);
}

/**
 * WKB action under the *central* barrier at energy E (numerical integral).
 *
 * Only the inter-minima region [−a, +a] (a = wellSep) is integrated: the outer
 * quartic walls are confining, not the tunnelling barrier, and — for a biased
 * well where the shallow (tautomer) minimum sits above E — we must not let the
 * forbidden region run across that whole second well, which would wildly
 * over-count the action. The barrier between the two wells is what governs the
 * canonical→tautomer transfer.
 */
function wkbAction(p: ProtonParams, E: number, dx: number): number {
  // If the energy already sits above the barrier top, there is no barrier.
  if (potential(0, p) <= E) return 0;
  let theta = 0;
  const a = p.wellSep;
  for (let x = 0; x <= a; x += dx) {
    const gap = potential(x, p) - E;
    if (gap > 0) theta += Math.sqrt(2 * p.mass * gap) * dx;
  }
  for (let x = -dx; x >= -a; x -= dx) {
    const gap = potential(x, p) - E;
    if (gap > 0) theta += Math.sqrt(2 * p.mass * gap) * dx;
  }
  return theta;
}

export function tunnelingFromSpectrum(res: SolveResult): TunnelingResult {
  const { states, params, dx } = res;
  const splitting = states.length >= 2 ? states[1].energy - states[0].energy : 0;

  const omega = wellFrequency(params);
  // Zero-point energy ~ ½ħω above the well floor sets the tunnelling energy.
  const floor = Math.min(...res.V);
  const E0est = floor + 0.5 * omega;
  const theta = wkbAction(params, E0est, dx * 0.25);
  // Standard double-well WKB splitting: Δ ≈ (ħω/π)·e^{−θ}.
  const splittingWKB = (omega / Math.PI) * Math.exp(-theta);

  // Near-symmetric: FD ≈ WKB and FD is the true splitting. Biased: FD is the
  // detuning, so fall back to the WKB tunnelling matrix element.
  const reliableFD = splittingWKB > 0 && splitting <= splittingWKB * FD_WKB_MAX_RATIO;
  const splittingEffective = reliableFD ? splitting : splittingWKB;

  const transferTimeSeconds =
    splittingEffective > 0
      ? (Math.PI / splittingEffective) * ATOMIC_TIME_TO_SECONDS
      : Infinity;

  return {
    splitting,
    splittingWKB,
    splittingEffective,
    reliableFD,
    transferTimeSeconds,
    wellOmega: omega,
    barrierAction: theta,
  };
}

/**
 * Boltzmann population of the tautomer (right) well at temperature T (Kelvin),
 * from the asymmetry bias: p ≈ 1/(1 + e^{ΔE/kT}) with ΔE the well-depth bias.
 * This is the quasi-equilibrium tautomer fraction that seeds a mutation.
 */
export function tautomerFraction(p: ProtonParams, tempK: number): number {
  const kT = BOLTZMANN_HARTREE_PER_K * tempK;
  if (kT <= 0) return p.bias > 0 ? 0 : 1;
  return 1 / (1 + Math.exp(p.bias / kT));
}
