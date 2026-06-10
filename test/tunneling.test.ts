import { describe, it, expect } from "vitest";
import { solveDoubleWell, DEFAULT_PARAMS } from "../src/sim/doubleWell";
import { tunnelingFromSpectrum, tautomerFraction } from "../src/sim/tunneling";

describe("double well + tunnelling", () => {
  it("symmetric well has a small positive ground splitting", () => {
    const sym = { ...DEFAULT_PARAMS, bias: 0 };
    const res = solveDoubleWell(sym);
    const t = tunnelingFromSpectrum(res);
    expect(t.splitting).toBeGreaterThan(0);
    // Splitting is far below the level spacing to the next pair.
    const gapToNext = res.states[2].energy - res.states[1].energy;
    expect(t.splitting).toBeLessThan(gapToNext);
    expect(t.transferTimeSeconds).toBeGreaterThan(0);
    expect(Number.isFinite(t.transferTimeSeconds)).toBe(true);
  });

  it("a taller barrier suppresses the splitting (slower tunnelling)", () => {
    const low = solveDoubleWell({ ...DEFAULT_PARAMS, bias: 0, barrier: 0.012 });
    const high = solveDoubleWell({ ...DEFAULT_PARAMS, bias: 0, barrier: 0.03 });
    const tl = tunnelingFromSpectrum(low);
    const th = tunnelingFromSpectrum(high);
    expect(th.splitting).toBeLessThan(tl.splitting);
    expect(th.transferTimeSeconds).toBeGreaterThan(tl.transferTimeSeconds);
  });

  it("the heavier deuteron tunnels more slowly (kinetic isotope effect)", () => {
    const proton = solveDoubleWell({ ...DEFAULT_PARAMS, bias: 0 });
    const deuteron = solveDoubleWell({
      ...DEFAULT_PARAMS,
      bias: 0,
      mass: DEFAULT_PARAMS.mass * 2,
    });
    const tp = tunnelingFromSpectrum(proton);
    const td = tunnelingFromSpectrum(deuteron);
    expect(td.splitting).toBeLessThan(tp.splitting);
  });

  it("WKB splitting tracks the exact one within an order of magnitude", () => {
    const res = solveDoubleWell({ ...DEFAULT_PARAMS, bias: 0 });
    const t = tunnelingFromSpectrum(res);
    expect(t.barrierAction).toBeGreaterThan(1); // genuine tunnelling regime
    const ratio = t.splittingWKB / t.splitting;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(3);
  });

  it("uses FD splitting for symmetric wells, WKB element for biased wells", () => {
    // Symmetric: E₁−E₀ is the tunnelling splitting and tracks WKB → trust FD.
    const sym = tunnelingFromSpectrum(
      solveDoubleWell({ ...DEFAULT_PARAMS, bias: 0 }),
    );
    expect(sym.reliableFD).toBe(true);
    expect(sym.splittingEffective).toBe(sym.splitting);

    // Biased: E₁−E₀ is the detuning (≫ the tunnelling element) → fall back to WKB.
    const biased = tunnelingFromSpectrum(
      solveDoubleWell({ ...DEFAULT_PARAMS, bias: 0.005 }),
    );
    expect(biased.reliableFD).toBe(false);
    expect(biased.splittingEffective).toBe(biased.splittingWKB);
    expect(biased.splittingEffective).toBeLessThan(biased.splitting);
  });

  it("tautomer fraction rises with temperature for a biased well", () => {
    const cold = tautomerFraction(DEFAULT_PARAMS, 100);
    const warm = tautomerFraction(DEFAULT_PARAMS, 310);
    expect(warm).toBeGreaterThan(cold);
    expect(cold).toBeGreaterThanOrEqual(0);
    expect(warm).toBeLessThanOrEqual(0.5);
  });
});
