import { describe, it, expect } from "vitest";
import {
  spectralJ,
  rateWeight,
  bathWithReorg,
  DEFAULT_BATH,
  type SpectralDensity,
} from "../src/sim/spectralDensity";

describe("bath spectral density", () => {
  const ohmic: SpectralDensity = { kind: "ohmic", reorgEnergy: 0.01, cutoff: 0.004 };
  const drude: SpectralDensity = { kind: "drude", reorgEnergy: 0.01, cutoff: 0.004 };

  it("J(ω) ≥ 0, J(0) = 0, and peaks then decays (both forms)", () => {
    for (const sd of [ohmic, drude]) {
      expect(spectralJ(sd, 0)).toBeCloseTo(0, 12);
      expect(spectralJ(sd, sd.cutoff)).toBeGreaterThan(0);
      expect(spectralJ(sd, 50 * sd.cutoff)).toBeLessThan(spectralJ(sd, sd.cutoff));
    }
  });

  it("normalisation: (1/π)∫ J(ω)/ω dω = λ (reorganization energy)", () => {
    // Numerical integral over a wide range.
    for (const sd of [ohmic, drude]) {
      let acc = 0;
      const dω = sd.cutoff / 200;
      for (let w = dω; w < 400 * sd.cutoff; w += dω) acc += (spectralJ(sd, w) / w) * dω;
      expect(acc / Math.PI).toBeCloseTo(sd.reorgEnergy, 3);
    }
  });

  it("rateWeight obeys detailed balance (up/down = e^{−ω/kT})", () => {
    const kT = 1e-3;
    const w = 2e-3;
    for (const sd of [ohmic, drude]) {
      const down = rateWeight(sd, -w, kT); // emission
      const up = rateWeight(sd, w, kT); // absorption
      expect(up / down).toBeCloseTo(Math.exp(-w / kT), 6);
    }
  });

  it("rateWeight ω→0 limit is finite and positive", () => {
    expect(rateWeight(ohmic, 0, 1e-3)).toBeGreaterThan(0);
    expect(Number.isFinite(rateWeight(drude, 0, 1e-3))).toBe(true);
  });

  it("larger reorganization energy → larger rate weight (stronger coupling)", () => {
    const w = 1e-3;
    const kT = 1e-3;
    expect(rateWeight(bathWithReorg(0.6), -w, kT)).toBeGreaterThan(
      rateWeight(bathWithReorg(0.3), -w, kT),
    );
  });

  it("DEFAULT_BATH is an Ohmic bath with physical-scale parameters", () => {
    expect(DEFAULT_BATH.kind).toBe("ohmic");
    expect(DEFAULT_BATH.reorgEnergy).toBeGreaterThan(0);
    expect(DEFAULT_BATH.cutoff).toBeGreaterThan(0);
  });
});
