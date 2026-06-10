import { describe, it, expect } from "vitest";
import {
  parseSequence,
  pairFor,
  susceptibilityAt,
  analyzeSequence,
  windowMean,
  pairRelaxationTimesFs,
  COMPLEMENT,
} from "../src/sim/dna";

describe("DNA layer", () => {
  it("parses and sanitises a sequence (FASTA-ish input)", () => {
    expect(parseSequence(">header\nacgt NNN 123 GGcc")).toEqual([
      "A", "C", "G", "T", "G", "G", "C", "C",
    ]);
  });

  it("complements are Watson–Crick", () => {
    expect(COMPLEMENT.A).toBe("T");
    expect(COMPLEMENT.G).toBe("C");
    expect(pairFor("G")).toBe("GC");
    expect(pairFor("T")).toBe("TA");
  });

  it("G·C is more tautomer-susceptible than A·T at body temperature", () => {
    const gc = susceptibilityAt("G", 310);
    const at = susceptibilityAt("A", 310);
    expect(gc).toBeGreaterThan(at);
    // Both are small, physical probabilities.
    expect(at).toBeGreaterThan(0);
    expect(gc).toBeLessThan(0.5);
  });

  it("susceptibility rises with temperature", () => {
    expect(susceptibilityAt("G", 350)).toBeGreaterThan(susceptibilityAt("G", 200));
  });

  it("analyzeSequence reports GC content, pairs, and CpG sites", () => {
    const a = analyzeSequence("GCGCAT", 310);
    expect(a.bases.length).toBe(6);
    expect(a.gcContent).toBeCloseTo(4 / 6, 6);
    expect(a.pairs[0]).toBe("GC");
    expect(a.complement.join("")).toBe("CGCGTA");
    // CpG = a C immediately followed by G: only position 1 in "GCGCAT".
    expect(a.cpgSites).toEqual([1]);
    expect(a.susceptibility.length).toBe(6);
  });

  it("pairRelaxationTimesFs: 4 keys, A·T=T·A, G·C=C·G, all finite", () => {
    const t = pairRelaxationTimesFs(310, 0.2);
    expect(Object.keys(t).sort()).toEqual(["AT", "CG", "GC", "TA"]);
    expect(t.AT).toBe(t.TA);
    expect(t.GC).toBe(t.CG);
    for (const v of Object.values(t)) {
      expect(v).toBeGreaterThan(0);
      expect(Number.isFinite(v)).toBe(true);
    }
    // A·T (higher barrier) relaxes slower than G·C.
    expect(t.AT).toBeGreaterThan(t.GC);
  });

  it("windowMean smooths and preserves length & mean", () => {
    const s = [0, 1, 0, 1, 0, 1];
    const w = windowMean(s, 3);
    expect(w.length).toBe(6);
    const mean = (arr: number[]) => arr.reduce((x, y) => x + y, 0) / arr.length;
    expect(mean(w)).toBeCloseTo(mean(s), 1);
  });
});
