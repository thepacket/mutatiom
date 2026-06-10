// Literature-sourced double-well parameters for DNA base-pair proton transfer.
//
// These replace the earlier hand-tuned presets with values taken from published
// quantum-chemistry / open-quantum-system studies, so the A·T vs G·C comparison
// is grounded rather than illustrative. Both source studies model the transfer
// as a 1-D asymmetric *quartic* double well — the same functional form Mutatiom
// uses (doubleWell.ts) — which makes the mapping direct.
//
// SOURCES
//  • G·C: Slocombe, Sacchi & Al-Khalili, "An open quantum systems approach to
//    proton tunnelling in DNA", Commun. Phys. 5, 109 (2022).
//    doi:10.1038/s42005-022-00881-8 (arXiv:2110.00113).
//    Reported: zero-point E₀ = 0.049 eV, forward barrier E_f = 0.704 eV,
//    canonical→tautomer asymmetry ΔE = 0.435 eV.
//  • A·T: Godbeer, Al-Khalili & Stevenson, "Modelling proton tunnelling in the
//    adenine–thymine base pair", Phys. Chem. Chem. Phys. 17, 13034 (2015).
//    doi:10.1039/c5cp00472a. Reported (1-D quartic fit, ζ = x/a, minima at ±1):
//    forward barrier E_B = 1.00 eV (8066 cm⁻¹), asymmetry ΔE = 0.572 eV
//    (4613.5 cm⁻¹, 13.19 kcal/mol).
//
// CAVEAT — well separation: neither paper states the length scale a (half the
// minima separation) numerically. We use a = 0.30 Å (transfer distance 2a ≈
// 0.6 Å), the standard proton-transfer geometry of an N–H···N / N–H···O Watson–
// Crick hydrogen bond. This is the one parameter not pinned by the two studies;
// it sets the barrier *width*. See README "Data provenance".

import type { ProtonParams } from "./doubleWell";
import { PROTON_MASS, HARTREE_TO_EV, BOHR_TO_ANGSTROM } from "./constants";

const EV_TO_HARTREE = 1 / HARTREE_TO_EV;

export interface BasePairData {
  forwardBarrierEv: number;
  asymmetryEv: number;
  zpeEv?: number;
  citation: string;
  doi: string;
}

export const GC_DATA: BasePairData = {
  forwardBarrierEv: 0.704,
  asymmetryEv: 0.435,
  zpeEv: 0.049,
  citation: "Slocombe, Sacchi & Al-Khalili, Commun. Phys. 5, 109 (2022)",
  doi: "10.1038/s42005-022-00881-8",
};

export const AT_DATA: BasePairData = {
  forwardBarrierEv: 1.0,
  asymmetryEv: 0.572,
  citation: "Godbeer, Al-Khalili & Stevenson, Phys. Chem. Chem. Phys. 17, 13034 (2015)",
  doi: "10.1039/c5cp00472a",
};

// Effective H-bond proton-transfer geometry (see CAVEAT above).
export const TRANSFER_HALF_DISTANCE_ANGSTROM = 0.3;
const WELL_SEP_BOHR = TRANSFER_HALF_DISTANCE_ANGSTROM / BOHR_TO_ANGSTROM;

/**
 * Map published (forward barrier, asymmetry) to Mutatiom's double-well
 * parameters. For V(x) = V0·(x²/a²−1)² + (bias/2)(x/a) the minima sit at
 * x ≈ ∓a with V(∓a) ≈ ∓bias/2, so:
 *   • asymmetry ΔE = V(+a) − V(−a) = bias        ⇒ bias = ΔE
 *   • forward barrier E_f = V(0) − V(−a) = V0 + bias/2 ⇒ V0 = E_f − ΔE/2
 */
export function deriveParams(data: BasePairData): ProtonParams {
  const biasEv = data.asymmetryEv;
  const v0Ev = data.forwardBarrierEv - data.asymmetryEv / 2;
  return {
    mass: PROTON_MASS,
    barrier: v0Ev * EV_TO_HARTREE,
    bias: biasEv * EV_TO_HARTREE,
    wellSep: WELL_SEP_BOHR,
    halfWidth: 1.8,
    gridN: 401,
  };
}
