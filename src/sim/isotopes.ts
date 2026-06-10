// Kinetic isotope effect (KIE) — the experimental fingerprint of tunnelling.
//
// Replace the tunnelling proton with a heavier hydrogen isotope (²H, ³H) and
// the barrier action θ = ∫√(2m(V−E))dx grows ∝ √m, so the tunnelling splitting
// Δ ≈ (ħω/π)e^{−θ} collapses exponentially. The rate ratio
//   KIE = k(¹H)/k(X) = Δ(¹H)/Δ(X)
// far exceeds the semiclassical (no-tunnelling) limit ≈ √(m_X/m_H) whenever
// transfer is tunnelling-dominated — exactly the Löwdin regime. This is why
// deuteration measurably slows (and tritiation slows further) proton-transfer
// mutagenesis, and why a large KIE is read as evidence of quantum tunnelling.

import { PROTON_MASS, DEUTERON_MASS, TRITON_MASS } from "./constants";
import { solveDoubleWell, type ProtonParams } from "./doubleWell";
import { tunnelingFromSpectrum } from "./tunneling";

export interface Isotope {
  symbol: string;
  name: string;
  mass: number;
}

export const ISOTOPES: Isotope[] = [
  { symbol: "¹H", name: "protium", mass: PROTON_MASS },
  { symbol: "²H", name: "deuterium", mass: DEUTERON_MASS },
  { symbol: "³H", name: "tritium", mass: TRITON_MASS },
];

export interface IsotopeResult extends Isotope {
  barrierAction: number; // θ
  splitting: number; // effective tunnelling splitting (Hartree)
  transferTimeSeconds: number;
  reliableFD: boolean;
  /** k(¹H)/k(X) = Δ(¹H)/Δ(X) ≥ 1 (1 for protium itself). */
  kie: number;
  /** Semiclassical (no-tunnelling) benchmark √(m_X/m_H). */
  classicalKie: number;
}

/** Compare the lowest-isotope tunnelling observables for the given double well. */
export function isotopeComparison(params: ProtonParams): IsotopeResult[] {
  const raw = ISOTOPES.map((iso) => {
    const res = solveDoubleWell({ ...params, mass: iso.mass });
    const t = tunnelingFromSpectrum(res);
    return {
      iso,
      barrierAction: t.barrierAction,
      splitting: t.splittingEffective,
      transferTimeSeconds: t.transferTimeSeconds,
      reliableFD: t.reliableFD,
    };
  });

  const protonSplitting = raw[0].splitting;
  return raw.map((r) => ({
    ...r.iso,
    barrierAction: r.barrierAction,
    splitting: r.splitting,
    transferTimeSeconds: r.transferTimeSeconds,
    reliableFD: r.reliableFD,
    kie: r.splitting > 0 ? protonSplitting / r.splitting : Infinity,
    classicalKie: Math.sqrt(r.iso.mass / PROTON_MASS),
  }));
}
