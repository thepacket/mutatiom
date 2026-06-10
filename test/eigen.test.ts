import { describe, it, expect } from "vitest";
import { eigSymTridiagonal } from "../src/sim/eigen";

// Build the finite-difference Hamiltonian for V(x) and diagonalise.
function solve1d(
  V: (x: number) => number,
  { mass = 1, L = 10, n = 600 } = {},
) {
  const dx = (2 * L) / (n + 1);
  const t = 1 / (2 * mass * dx * dx);
  const diag: number[] = [];
  const off: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = -L + (i + 1) * dx;
    diag.push(2 * t + V(x));
  }
  for (let i = 0; i < n - 1; i++) off.push(-t);
  return eigSymTridiagonal(diag, off);
}

describe("eigSymTridiagonal", () => {
  it("reproduces the quantum harmonic oscillator spectrum (n+½)ω", () => {
    // m = 1, ω = 1 ⇒ V = ½x², eigenvalues 0.5, 1.5, 2.5, ...
    const { values } = solve1d((x) => 0.5 * x * x);
    expect(values[0]).toBeCloseTo(0.5, 2);
    expect(values[1]).toBeCloseTo(1.5, 2);
    expect(values[2]).toBeCloseTo(2.5, 2);
    expect(values[3]).toBeCloseTo(3.5, 2);
  });

  it("returns ascending, normalised eigenvectors", () => {
    const { values, vectors } = solve1d((x) => 0.5 * x * x);
    for (let i = 1; i < 5; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    // L2 norm of the discrete eigenvector is 1.
    const norm = Math.sqrt(vectors[0].reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it("solves a tiny matrix against a hand value", () => {
    // [[2,1],[1,2]] → eigenvalues 1 and 3.
    const { values } = eigSymTridiagonal([2, 2], [1]);
    expect(values[0]).toBeCloseTo(1, 10);
    expect(values[1]).toBeCloseTo(3, 10);
  });
});
