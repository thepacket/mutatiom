import { describe, it, expect } from "vitest";
import { GC_DATA, AT_DATA, deriveParams } from "../src/sim/basePairData";
import { HARTREE_TO_EV } from "../src/sim/constants";

describe("base-pair literature data", () => {
  it("maps asymmetry → bias and (barrier − asymmetry/2) → V0 (eV→Hartree)", () => {
    const gc = deriveParams(GC_DATA);
    expect(gc.bias * HARTREE_TO_EV).toBeCloseTo(GC_DATA.asymmetryEv, 6);
    expect(gc.barrier * HARTREE_TO_EV).toBeCloseTo(
      GC_DATA.forwardBarrierEv - GC_DATA.asymmetryEv / 2,
      6,
    );
  });

  it("A·T has the higher barrier and asymmetry than G·C (known bias)", () => {
    expect(AT_DATA.forwardBarrierEv).toBeGreaterThan(GC_DATA.forwardBarrierEv);
    expect(AT_DATA.asymmetryEv).toBeGreaterThan(GC_DATA.asymmetryEv);
    expect(deriveParams(AT_DATA).barrier).toBeGreaterThan(deriveParams(GC_DATA).barrier);
  });

  it("carries a citation + DOI for the provenance trail", () => {
    for (const d of [GC_DATA, AT_DATA]) {
      expect(d.citation.length).toBeGreaterThan(10);
      expect(d.doi).toMatch(/^10\./);
    }
  });
});
