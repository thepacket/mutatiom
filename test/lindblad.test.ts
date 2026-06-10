import { describe, it, expect } from "vitest";
import { solveDoubleWell, DEFAULT_PARAMS } from "../src/sim/doubleWell";
import {
  buildSystem,
  bathWeight,
  buildRates,
  thermalPopulations,
  evolveLindblad,
  relaxationTimeFs,
} from "../src/sim/lindblad";
import { BOLTZMANN_HARTREE_PER_K } from "../src/sim/constants";

describe("Lindblad open-system engine", () => {
  const res = solveDoubleWell(DEFAULT_PARAMS); // biased default (G·C-like)

  it("bath weight obeys detailed balance (up/down = e^{−ω/kT})", () => {
    const kT = 1e-3;
    const w = 2e-3;
    const down = bathWeight(-w, kT); // emission
    const up = bathWeight(w, kT); // absorption
    expect(up / down).toBeCloseTo(Math.exp(-w / kT), 6);
  });

  it("bath weight is finite and equals kT at ω→0", () => {
    expect(bathWeight(0, 1e-3)).toBeCloseTo(1e-3, 9);
  });

  it("rate ratio reproduces Boltzmann between the lowest pair", () => {
    const sys = buildSystem(res, 4);
    const kT = BOLTZMANN_HARTREE_PER_K * 310;
    const rates = buildRates(sys, kT, 0.1);
    const dE = sys.E[1] - sys.E[0];
    // up(0→1)/down(1→0) = e^{−dE/kT}
    expect(rates[0][1] / rates[1][0]).toBeCloseTo(Math.exp(-dE / kT), 6);
  });

  it("thermalPopulations is normalised and favours the ground state", () => {
    const p = thermalPopulations([0, 0.001, 0.002], 1e-3);
    expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 10);
    expect(p[0]).toBeGreaterThan(p[1]);
    expect(p[1]).toBeGreaterThan(p[2]);
  });

  it("conserves trace (Σ level populations = 1) throughout", () => {
    const traj = evolveLindblad(res, { tempK: 310, coupling: 0.2, samples: 60 });
    for (const lv of traj.levels) {
      const tr = lv.reduce((s, v) => s + v, 0);
      expect(tr).toBeCloseTo(1, 4);
      for (const p of lv) expect(p).toBeGreaterThan(-1e-6); // positivity
    }
  });

  it("relaxes to the Boltzmann tautomer fraction (steady state)", () => {
    const traj = evolveLindblad(res, { tempK: 310, coupling: 0.3, samples: 200 });
    const finalRight = traj.popRight[traj.popRight.length - 1];
    expect(finalRight).toBeCloseTo(traj.steadyRight, 2);
    // Started canonical-localised, ends near equilibrium.
    expect(traj.popRight[0]).toBeLessThan(finalRight);
  });

  it("warmer bath drives a larger steady-state tautomer population", () => {
    const cold = evolveLindblad(res, { tempK: 150, coupling: 0.3, samples: 120 });
    const warm = evolveLindblad(res, { tempK: 350, coupling: 0.3, samples: 120 });
    expect(warm.steadyRight).toBeGreaterThan(cold.steadyRight);
  });

  it("reports a finite relaxation time", () => {
    const traj = evolveLindblad(res, { tempK: 310, coupling: 0.2, samples: 40 });
    expect(traj.relaxTimeFs).toBeGreaterThan(0);
    expect(Number.isFinite(traj.relaxTimeFs)).toBe(true);
  });

  it("relaxationTimeFs matches the evolved trajectory's value and scales with κ", () => {
    const direct = relaxationTimeFs(res, 310, 0.2);
    const traj = evolveLindblad(res, { tempK: 310, coupling: 0.2, samples: 20 });
    expect(direct).toBeCloseTo(traj.relaxTimeFs, 3);
    // Stronger coupling ⇒ faster relaxation (shorter time), τ ∝ 1/κ.
    expect(relaxationTimeFs(res, 310, 0.4)).toBeLessThan(direct);
  });
});
