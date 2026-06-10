import { describe, it, expect } from "vitest";
import { solveDoubleWell, DEFAULT_PARAMS } from "../src/sim/doubleWell";
import { tunnelingFromSpectrum } from "../src/sim/tunneling";
import { prepareLeftLocalised, densityAt, rightPopulation } from "../src/sim/evolve";

describe("coherent tunnelling evolution", () => {
  const sym = { ...DEFAULT_PARAMS, bias: 0 };
  const res = solveDoubleWell(sym);
  const wp = prepareLeftLocalised(res, 8);

  it("starts localised in the canonical (left) well", () => {
    expect(rightPopulation(wp, 0)).toBeLessThan(0.15);
  });

  it("conserves total probability over time", () => {
    for (const t of [0, 1e4, 5e4, 1e5]) {
      const dens = densityAt(wp, t);
      const norm = dens.reduce((s, d) => s + d * res.dx, 0);
      expect(norm).toBeCloseTo(1, 2);
    }
  });

  it("tunnels to the tautomer well after half a period", () => {
    const { splitting } = tunnelingFromSpectrum(res);
    const halfPeriod = Math.PI / splitting;
    expect(rightPopulation(wp, halfPeriod)).toBeGreaterThan(0.6);
  });
});
