import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS } from "../src/sim/doubleWell";
import { isotopeComparison, ISOTOPES } from "../src/sim/isotopes";

describe("kinetic isotope effect", () => {
  const r = isotopeComparison(DEFAULT_PARAMS);

  it("returns one result per isotope, protium first with KIE = 1", () => {
    expect(r.map((x) => x.symbol)).toEqual(["¹H", "²H", "³H"]);
    expect(r[0].kie).toBeCloseTo(1, 6);
  });

  it("barrier action grows roughly as √m", () => {
    // θ_D/θ_H ≈ √2 (slightly above, since heavier ⇒ lower ZPE ⇒ wider barrier).
    const ratio = r[1].barrierAction / r[0].barrierAction;
    expect(ratio).toBeGreaterThan(1.3); // at least the pure √2 mass scaling
    expect(ratio).toBeLessThan(2.1); // a bit above √2 from the ZPE shift
  });

  it("heavier isotopes tunnel slower (KIE > 1, monotonic)", () => {
    expect(r[1].kie).toBeGreaterThan(1);
    expect(r[2].kie).toBeGreaterThan(r[1].kie);
    expect(r[2].transferTimeSeconds).toBeGreaterThan(r[1].transferTimeSeconds);
    expect(r[1].transferTimeSeconds).toBeGreaterThan(r[0].transferTimeSeconds);
  });

  it("KIE exceeds the semiclassical √(m/m_H) limit (tunnelling signature)", () => {
    expect(r[1].kie).toBeGreaterThan(r[1].classicalKie);
    expect(ISOTOPES[1].mass).toBeGreaterThan(ISOTOPES[0].mass);
  });

  it("a taller/wider barrier amplifies the KIE", () => {
    const thin = isotopeComparison({ ...DEFAULT_PARAMS, barrier: 0.006, wellSep: 0.6 });
    const thick = isotopeComparison({ ...DEFAULT_PARAMS, barrier: 0.012, wellSep: 0.85 });
    expect(thick[1].kie).toBeGreaterThan(thin[1].kie);
  });
});
