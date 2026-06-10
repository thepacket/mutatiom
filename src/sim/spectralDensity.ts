// Bath spectral density — the physical model of the proton's environment.
//
// The earlier Lindblad engine used a bare, unnamed "coupling κ" multiplying an
// Ohmic weight J(ω)=ω. This module replaces that knob with a proper, named
// spectral density carrying physical parameters, following the Caldeira–Leggett
// quantum-Brownian-motion framework that the DNA proton-tunnelling literature
// itself uses (Slocombe, Sacchi & Al-Khalili 2022; Godbeer, Al-Khalili &
// Stevenson 2015 — both model the cellular/solvent environment as a harmonic
// bath with an Ohmic spectral density).
//
// HONEST SCOPE: the *strength* of the coupling is a phenomenological parameter
// in those works too (a friction constant), not derived from first principles.
// What is principled here is the functional form and that the parameters are
// physical and named — a reorganization energy λ and a bath correlation /
// cutoff frequency ω_c — rather than an arbitrary multiplier.
//
// Two forms (atomic units; the system couples to the *reduced* proton
// coordinate u = x/a, so J has units of energy and rate = |u_ij|²·weight is a
// rate in a.u.):
//   • ohmic  : J(ω) = (πλ/ω_c)·ω·e^{−ω/ω_c}   (Ohmic with a Drude cutoff)
//   • drude  : J(ω) = 2λ ω_c ω /(ω² + ω_c²)    (overdamped Brownian / solvent)
// both normalised so the reorganization energy (1/π)∫₀^∞ J(ω)/ω dω = λ.

export type BathKind = "ohmic" | "drude";

export interface SpectralDensity {
  kind: BathKind;
  reorgEnergy: number; // λ (Hartree)
  cutoff: number; // ω_c (Hartree)
}

/** J(ω) for ω ≥ 0 (Hartree). */
export function spectralJ(sd: SpectralDensity, omega: number): number {
  const w = Math.abs(omega);
  if (sd.kind === "ohmic") {
    return ((Math.PI * sd.reorgEnergy) / sd.cutoff) * w * Math.exp(-w / sd.cutoff);
  }
  return (2 * sd.reorgEnergy * sd.cutoff * w) / (w * w + sd.cutoff * sd.cutoff);
}

// Low-frequency slope J(ω)/ω as ω→0, used for the ω→0 rate limit.
function lowFreqSlope(sd: SpectralDensity): number {
  return sd.kind === "ohmic"
    ? (Math.PI * sd.reorgEnergy) / sd.cutoff
    : (2 * sd.reorgEnergy) / sd.cutoff;
}

/**
 * Detailed-balance transition weight for a system energy change dE = E_f − E_i,
 * at temperature kT (Hartree). Emission (dE<0) ∝ J(n+1), absorption ∝ J·n, so
 * up/down = e^{−|dE|/kT} and the steady state is the Gibbs state.
 */
export function rateWeight(sd: SpectralDensity, dE: number, kT: number): number {
  const a = Math.abs(dE);
  if (kT <= 0) {
    // T = 0: only spontaneous emission.
    return dE < 0 ? spectralJ(sd, a) : 0;
  }
  if (a < 1e-12) {
    // ω→0: J(ω)(n(ω)+1) → J'(0)·kT.
    return lowFreqSlope(sd) * kT;
  }
  const J = spectralJ(sd, a);
  const n = 1 / (Math.exp(a / kT) - 1);
  return dE < 0 ? J * (n + 1) : J * n;
}

// Default environment: an Ohmic bath (matching the cited DNA studies) with a
// reorganization energy and cutoff in the range of an aqueous proton-transfer
// environment. Both are phenomenological estimates (see SCOPE above) and are
// user-adjustable in the UI.
//   λ  = 0.30 eV  — order-of-magnitude proton-transfer reorganization energy
//   ω_c = 0.10 eV — fast solvent/H-bond fluctuation scale (~7 fs correlation)
export const DEFAULT_BATH: SpectralDensity = {
  kind: "ohmic",
  reorgEnergy: 0.3 / 27.211386, // eV → Hartree
  cutoff: 0.1 / 27.211386,
};

export function bathWithReorg(lambdaEv: number, kind: BathKind = "ohmic"): SpectralDensity {
  return { kind, reorgEnergy: lambdaEv / 27.211386, cutoff: DEFAULT_BATH.cutoff };
}
