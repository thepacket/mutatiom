import { useMemo, useState } from "react";
import { analyzeSequence, windowMean, PAIR_PRESETS, pairFor, type Base } from "./sim/dna";
import { fetchBySymbol } from "./sim/ensembl";

const BASE_COLOR: Record<Base, string> = {
  A: "#f59e0b",
  T: "#22c55e",
  G: "#3b82f6",
  C: "#ef4444",
};

const EXAMPLES: { name: string; seq: string }[] = [
  {
    name: "GC-rich",
    seq: "GCGCGGCCGCGCGGGCCGCGCGGCCGCGCGGCCGCGCGGCCGCGCGGGCCGCGC",
  },
  {
    name: "AT-rich",
    seq: "ATATAAATTATAAATTTATATAAATTATTAAATATAAATTATAAATTTATATAA",
  },
  {
    name: "CpG island",
    seq: "GCGCGCATGCGCGCATATGCGCGCATGCGCGCGCATATGCGCGCATGCGCGCAT",
  },
];

const W = 760;
const H = 150;
const PAD = 36;
const MAX_SHOW = 300;

export function DnaPanel({
  tempK,
  onPickBase,
  selected,
  onSelect,
}: {
  tempK: number;
  onPickBase: (base: Base) => void;
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const [seq, setSeq] = useState(EXAMPLES[2].seq);
  const [symbol, setSymbol] = useState("TP53");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState("CpG island (synthetic)");

  const analysis = useMemo(() => analyzeSequence(seq, tempK), [seq, tempK]);
  const shown = Math.min(analysis.bases.length, MAX_SHOW);
  const smooth = useMemo(
    () => windowMean(analysis.susceptibility, 9),
    [analysis.susceptibility],
  );

  const maxS = Math.max(...analysis.susceptibility, 1e-12);
  const bw = shown ? (W - 2 * PAD) / shown : 0;
  const bx = (i: number) => PAD + i * bw;
  const by = (s: number) => H - PAD - (s / maxS) * (H - 2 * PAD);

  const smoothPath = analysis.susceptibility
    .slice(0, shown)
    .map((_, i) => `${i ? "L" : "M"}${(bx(i) + bw / 2).toFixed(1)},${by(smooth[i]).toFixed(1)}`)
    .join(" ");

  const cpgSet = new Set(analysis.cpgSites);

  async function loadGene() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetchBySymbol("human", symbol.trim());
      setSeq(r.sequence);
      setSource(r.source);
      onSelect(0);
      onPickBase(r.sequence[0] as Base);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function pick(i: number) {
    onSelect(i);
    onPickBase(analysis.bases[i]);
  }

  const selBase = selected != null ? analysis.bases[selected] : null;

  return (
    <section className="dna">
      <div className="dna-head">
        <h2>DNA strand · tautomer susceptibility</h2>
        <span className="src">{source}</span>
      </div>

      <div className="dna-controls">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.name}
            onClick={() => {
              setSeq(ex.seq);
              setSource(`${ex.name} (synthetic)`);
              setErr(null);
            }}
          >
            {ex.name}
          </button>
        ))}
        <span className="spacer" />
        <input
          className="gene"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="gene symbol e.g. TP53"
          onKeyDown={(e) => e.key === "Enter" && loadGene()}
        />
        <button className="fetch" onClick={loadGene} disabled={busy}>
          {busy ? "…" : "Fetch (Ensembl human)"}
        </button>
      </div>

      <textarea
        className="seqbox"
        value={seq}
        spellCheck={false}
        onChange={(e) => {
          setSeq(e.target.value);
          setSource("pasted sequence");
          setErr(null);
        }}
        placeholder="Paste a DNA sequence (ACGT) or FASTA…"
      />
      {err && <div className="dna-err">Ensembl: {err}</div>}

      <svg viewBox={`0 0 ${W} ${H}`} className="track">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="axis" />
        {Array.from({ length: shown }, (_, i) => {
          const b = analysis.bases[i];
          const isSel = i === selected;
          return (
            <rect
              key={i}
              x={bx(i)}
              y={by(analysis.susceptibility[i])}
              width={Math.max(bw - 0.4, 0.6)}
              height={H - PAD - by(analysis.susceptibility[i])}
              fill={BASE_COLOR[b]}
              opacity={isSel ? 1 : 0.78}
              stroke={isSel ? "#fff" : cpgSet.has(i) ? "#fde047" : "none"}
              strokeWidth={isSel ? 1.4 : cpgSet.has(i) ? 1 : 0}
              onClick={() => pick(i)}
              style={{ cursor: "pointer" }}
            >
              <title>
                {`#${i + 1} ${PAIR_PRESETS[pairFor(b)].label}  susceptibility ${analysis.susceptibility[i].toExponential(2)}`}
              </title>
            </rect>
          );
        })}
        <path d={smoothPath} className="smooth" />
        <text x={PAD} y={18} className="ylbl">
          tautomer fraction (↑ = more mutable) · yellow edge = CpG
        </text>
      </svg>

      <div className="dna-stats">
        <span>length <b>{analysis.bases.length}</b> bp{analysis.bases.length > MAX_SHOW && ` (showing ${MAX_SHOW})`}</span>
        <span>GC <b>{(analysis.gcContent * 100).toFixed(0)}%</b></span>
        <span>CpG sites <b>{analysis.cpgSites.length}</b></span>
        {selBase && (
          <span className="sel">
            selected #{(selected ?? 0) + 1}:{" "}
            <b style={{ color: BASE_COLOR[selBase] }}>
              {PAIR_PRESETS[pairFor(selBase)].label}
            </b>{" "}
            → double well below
          </span>
        )}
      </div>
    </section>
  );
}
