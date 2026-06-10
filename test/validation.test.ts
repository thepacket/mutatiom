// Validation against published quantum-chemistry / open-quantum-system results.
//
// These tests check Mutatiom's *emergent* outputs against literature numbers
// (within stated tolerances), plus one documented discrepancy. They are the
// machine-checkable half of docs/METHODS.md. Sources:
//   GC: Slocombe, Sacchi & Al-Khalili, Commun. Phys. 5, 109 (2022).
//   AT: Godbeer, Al-Khalili & Stevenson, PCCP 17, 13034 (2015).

import { describe, it, expect } from "vitest";
import { GC_DATA, deriveParams } from "../src/sim/basePairData";
import { solveDoubleWell, potential } from "../src/sim/doubleWell";
import { susceptibilityAt, pairRelaxationTimesFs } from "../src/sim/dna";
import { isotopeComparison } from "../src/sim/isotopes";
import { bathWithReorg } from "../src/sim/spectralDensity";
import { HARTREE_TO_EV } from "../src/sim/constants";

describe("validation vs literature", () => {
  const gc = deriveParams(GC_DATA);

  it("reproduces the published forward barrier by construction", () => {
    const r = solveDoubleWell(gc);
    const vMin = Math.min(...r.V);
    const fwd = (potential(0, gc) - vMin) * HARTREE_TO_EV;
    expect(fwd).toBeCloseTo(GC_DATA.forwardBarrierEv, 1); // 0.704 eV
  });

  it("canonical→tautomer gap is within ~25% of the published asymmetry", () => {
    const r = solveDoubleWell(gc, 4);
    const gapEv = (r.states[1].energy - r.states[0].energy) * HARTREE_TO_EV;
    expect(gapEv).toBeGreaterThan(0.75 * GC_DATA.asymmetryEv); // lit 0.435 eV
    expect(gapEv).toBeLessThan(1.1 * GC_DATA.asymmetryEv);
  });

  it("G·C tautomer fraction is ~10⁻⁷ (literature order of magnitude)", () => {
    const f = susceptibilityAt("G", 310);
    expect(f).toBeGreaterThan(1e-9);
    expect(f).toBeLessThan(1e-6);
  });

  it("reproduces the known mutational bias G·C ≫ A·T", () => {
    expect(susceptibilityAt("G", 310) / susceptibilityAt("A", 310)).toBeGreaterThan(50);
  });

  it("KIE far exceeds the classical limit (tunnelling-dominated)", () => {
    const iso = isotopeComparison(gc);
    expect(iso[1].kie).toBeGreaterThan(5 * iso[1].classicalKie); // ²H
    expect(iso[2].kie).toBeGreaterThan(iso[1].kie); // ³H slower still
  });

  it("canonical↔tautomer interconversion is sub-nanosecond", () => {
    const t = pairRelaxationTimesFs(310, bathWithReorg(0.3));
    expect(t.GC).toBeLessThan(1e6); // < 1 ns, in fs
    expect(t.AT).toBeLessThan(1e6);
    expect(t.AT).toBeGreaterThan(t.GC);
  });

  it("DOCUMENTED LIMITATION: ZPE exceeds the published value (quartic over-constrains curvature)", () => {
    // The single quartic ties the well curvature to (V₀, a); with a physical
    // transfer distance the curvature — hence ZPE — comes out too high. Slocombe
    // report E₀ = 0.049 eV; Mutatiom yields ~0.2 eV. Matching it would force an
    // unphysical geometry, so quantitative ZPE/rate agreement needs a more
    // flexible PES (see docs/METHODS.md "Limitations").
    const r = solveDoubleWell(gc);
    const zpe = (r.states[0].energy - Math.min(...r.V)) * HARTREE_TO_EV;
    expect(zpe).toBeGreaterThan(0.049); // i.e. NOT matching the literature value
    expect(zpe).toBeLessThan(0.4); // characterise current behaviour (~0.2 eV)
  });
});
