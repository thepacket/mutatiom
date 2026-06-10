// The DNA layer: map a base sequence onto the proton double-well model.
//
// Each Watson–Crick base pair holds inter-strand protons in hydrogen bonds:
// A·T has two, G·C has three. A proton can tunnel across a bond to the
// acceptor, producing a rare tautomer (A*, T*, G*, C*) — the Löwdin route to a
// spontaneous point mutation. G·C pairs are the more tautomer-prone (lower
// asymmetry / well-studied double proton transfer), so a GC-rich stretch is
// intrinsically more mutable under this mechanism.
//
// Per base pair we attach a double-well preset (derived from published
// quantum-chemistry barriers/asymmetries — see basePairData.ts for the citation
// trail) and read off its thermal tautomer fraction as a *susceptibility*
// score. The values are grounded in the literature, not hand-tuned; the well
// separation is the one effective geometric parameter (see basePairData CAVEAT).

import type { ProtonParams } from "./doubleWell";
import { solveDoubleWell } from "./doubleWell";
import { tautomerFraction } from "./tunneling";
import { relaxationTimeFs } from "./lindblad";
import { GC_DATA, AT_DATA, deriveParams } from "./basePairData";

export type Base = "A" | "C" | "G" | "T";
export type PairType = "AT" | "TA" | "GC" | "CG";

export const COMPLEMENT: Record<Base, Base> = {
  A: "T",
  T: "A",
  G: "C",
  C: "G",
};

export interface PairPreset {
  hbonds: number;
  label: string; // e.g. "G≡C"
  params: ProtonParams;
}

// Derived from published barriers/asymmetries (basePairData.ts). G·C has the
// lower asymmetry (≈0.435 eV) and barrier, so it is the more tautomer-prone
// pair; A·T (≈0.572 eV asymmetry, ~1 eV barrier) is far rarer — matching the
// known mutational bias.
const GC_PARAMS: ProtonParams = deriveParams(GC_DATA);
const AT_PARAMS: ProtonParams = deriveParams(AT_DATA);

export const PAIR_PRESETS: Record<PairType, PairPreset> = {
  AT: { hbonds: 2, label: "A=T", params: AT_PARAMS },
  TA: { hbonds: 2, label: "T=A", params: AT_PARAMS },
  GC: { hbonds: 3, label: "G≡C", params: GC_PARAMS },
  CG: { hbonds: 3, label: "C≡G", params: GC_PARAMS },
};

/** Keep only A/C/G/T (uppercased); drop whitespace, numbers, FASTA headers. */
export function parseSequence(raw: string): Base[] {
  const out: Base[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith(">") || line.startsWith(";")) continue; // FASTA header/comment
    for (const ch of line.toUpperCase()) {
      if (ch === "A" || ch === "C" || ch === "G" || ch === "T") out.push(ch);
    }
  }
  return out;
}

/** Pair type for a top-strand base (paired with its complement). */
export function pairFor(base: Base): PairType {
  return (base + COMPLEMENT[base]) as PairType;
}

/** Tautomer-susceptibility score for one position at temperature T (Kelvin). */
export function susceptibilityAt(base: Base, tempK: number): number {
  return tautomerFraction(PAIR_PRESETS[pairFor(base)].params, tempK);
}

export interface SequenceAnalysis {
  bases: Base[];
  complement: Base[];
  pairs: PairType[];
  susceptibility: number[]; // per position
  gcContent: number; // fraction G+C
  /** Indices of CpG dinucleotides (a known mutational hotspot motif). */
  cpgSites: number[];
}

export function analyzeSequence(raw: string, tempK: number): SequenceAnalysis {
  const bases = parseSequence(raw);
  const complement = bases.map((b) => COMPLEMENT[b]);
  const pairs = bases.map(pairFor);
  const susceptibility = bases.map((b) => susceptibilityAt(b, tempK));
  const gc = bases.filter((b) => b === "G" || b === "C").length;
  const cpgSites: number[] = [];
  for (let i = 0; i < bases.length - 1; i++) {
    if (bases[i] === "C" && bases[i + 1] === "G") cpgSites.push(i);
  }
  return {
    bases,
    complement,
    pairs,
    susceptibility,
    gcContent: bases.length ? gc / bases.length : 0,
    cpgSites,
  };
}

/**
 * Open-system relaxation time (fs) for each pair type at temperature T and
 * bath coupling κ. Only two distinct presets (A·T, G·C) exist, so the double
 * well is solved at most twice — cheap enough to call per render.
 */
export function pairRelaxationTimesFs(
  tempK: number,
  coupling: number,
): Record<PairType, number> {
  const gc = relaxationTimeFs(solveDoubleWell(GC_PARAMS), tempK, coupling);
  const at = relaxationTimeFs(solveDoubleWell(AT_PARAMS), tempK, coupling);
  return { GC: gc, CG: gc, AT: at, TA: at };
}

/** Centred sliding-window mean of a per-position series (regional smoothing). */
export function windowMean(series: number[], window: number): number[] {
  const n = series.length;
  if (window <= 1 || n === 0) return series.slice();
  const half = Math.floor(window / 2);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      s += series[j];
      c++;
    }
    out[i] = s / c;
  }
  return out;
}
