import { describe, it, expect } from "vitest";
import {
  groundState2dV,
  groundState2d,
  quadrantPopulations,
  pathwayBarriers,
  DEFAULT_PARAMS_2D,
} from "../src/sim/doubleWell2d";

describe("2-D double-proton-transfer model", () => {
  it("reproduces the 2-D harmonic-oscillator ground energy ħω (= ω)", () => {
    // m = 1, ω = 1 ⇒ V = ½(x₁²+x₂²); ground E = ω(0+0+1) = 1.
    const gs = groundState2dV((a, b) => 0.5 * (a * a + b * b), {
      mass: 1,
      halfWidth: 6,
      gridN: 80,
    });
    expect(gs.energy).toBeCloseTo(1, 1);
  });

  it("ground state is normalised (∑ψ²·dx² = 1)", () => {
    const gs = groundState2d(DEFAULT_PARAMS_2D);
    let s = 0;
    for (let k = 0; k < gs.psi.length; k++) s += gs.psi[k] ** 2 * gs.dx * gs.dx;
    expect(s).toBeCloseTo(1, 6);
  });

  it("biased ground state sits mostly in the canonical well", () => {
    const q = quadrantPopulations(groundState2d(DEFAULT_PARAMS_2D));
    expect(q.canonical + q.tautomer + q.intermediate).toBeCloseTo(1, 6);
    expect(q.canonical).toBeGreaterThan(0.8);
    expect(q.canonical).toBeGreaterThan(q.tautomer);
  });

  it("stronger coupling raises the single-transfer corners → favours concerted", () => {
    const weak = pathwayBarriers({ ...DEFAULT_PARAMS_2D, coupling: 0.0 });
    const strong = pathwayBarriers({ ...DEFAULT_PARAMS_2D, coupling: 0.06 });
    // Raising the corners pushes the stepwise barrier up.
    expect(strong.stepwiseBarrier).toBeGreaterThan(weak.stepwiseBarrier);
    expect(strong.mechanism).toBe("concerted");
  });

  it("with no coupling the stepwise path is the cheaper one", () => {
    const a = pathwayBarriers({ ...DEFAULT_PARAMS_2D, coupling: 0.0 });
    // Concerted forces both protons over their barriers at once (~2V₀);
    // stepwise crosses one at a time.
    expect(a.stepwiseBarrier).toBeLessThan(a.concertedBarrier);
    expect(a.mechanism).toBe("stepwise");
  });
});
