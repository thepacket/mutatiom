import { useMemo, useState } from "react";
import {
  analyzeSequence,
  windowMean,
  pairRelaxationTimesFs,
  PAIR_PRESETS,
  pairFor,
  type Base,
} from "./sim/dna";
import { fetchBySymbol } from "./sim/ensembl";
import { GC_DATA, AT_DATA } from "./sim/basePairData";
import { bathWithReorg } from "./sim/spectralDensity";

type Metric = "susc" | "relax";

function fmtTime(fs: number): string {
  if (!Number.isFinite(fs)) return "∞";
  if (fs < 1e3) return `${fs.toFixed(0)} fs`;
  if (fs < 1e6) return `${(fs / 1e3).toFixed(1)} ps`;
  if (fs < 1e9) return `${(fs / 1e6).toFixed(1)} ns`;
  return `${(fs / 1e9).toFixed(1)} µs`;
}

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
  const [metric, setMetric] = useState<Metric>("susc");
  const [lambdaEv, setLambdaEv] = useState(0.3);

  const analysis = useMemo(() => analyzeSequence(seq, tempK), [seq, tempK]);
  const relaxTimes = useMemo(
    () => pairRelaxationTimesFs(tempK, bathWithReorg(lambdaEv)),
    [tempK, lambdaEv],
  );

  // Per-position value for the active metric.
  const series = useMemo(
    () =>
      metric === "susc"
        ? analysis.susceptibility
        : analysis.pairs.map((p) => relaxTimes[p]),
    [metric, analysis, relaxTimes],
  );

  const shown = Math.min(analysis.bases.length, MAX_SHOW);
  const smooth = useMemo(() => windowMean(series, 9), [series]);

  // Susceptibility spans many decades (G·C ~10⁻⁸ vs A·T ~10⁻¹⁰), so it is
  // shown on a log scale over a 4-decade window; relaxation time (within ~20×)
  // stays linear.
  const maxS = Math.max(...series, 1e-300);
  const logFloor = Math.log10(maxS) - 4;
  const frac = (s: number) =>
    metric === "susc"
      ? Math.max(0, Math.min(1, (Math.log10(Math.max(s, 1e-300)) - logFloor) / 4))
      : Math.max(0, Math.min(1, s / maxS));
  const bw = shown ? (W - 2 * PAD) / shown : 0;
  const bx = (i: number) => PAD + i * bw;
  const by = (s: number) => H - PAD - frac(s) * (H - 2 * PAD);

  const smoothPath = series
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
        <h2>
          DNA strand ·{" "}
          {metric === "susc" ? "tautomer susceptibility" : "relaxation time"}
        </h2>
        <span className="src">{source}</span>
        <span className="spacer" />
        <div className="seg metric">
          <button className={metric === "susc" ? "on" : ""} onClick={() => setMetric("susc")}>
            Susceptibility
          </button>
          <button className={metric === "relax" ? "on" : ""} onClick={() => setMetric("relax")}>
            Relaxation time
          </button>
        </div>
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

      {metric === "relax" && (
        <div className="dna-coupling">
          <span>Bath reorganization energy λ <b>{(lambdaEv * 1000).toFixed(0)} meV</b></span>
          <input
            type="range"
            min={0.02}
            max={1}
            step={0.01}
            value={lambdaEv}
            onChange={(e) => setLambdaEv(parseFloat(e.target.value))}
          />
          <span className="hint">
            G·C relaxes in {fmtTime(relaxTimes.GC)} · A·T in {fmtTime(relaxTimes.AT)}
          </span>
        </div>
      )}

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
              y={by(series[i])}
              width={Math.max(bw - 0.4, 0.6)}
              height={H - PAD - by(series[i])}
              fill={BASE_COLOR[b]}
              opacity={isSel ? 1 : 0.78}
              stroke={isSel ? "#fff" : cpgSet.has(i) ? "#fde047" : "none"}
              strokeWidth={isSel ? 1.4 : cpgSet.has(i) ? 1 : 0}
              onClick={() => pick(i)}
              style={{ cursor: "pointer" }}
            >
              <title>
                {`#${i + 1} ${PAIR_PRESETS[pairFor(b)].label}  ·  susceptibility ${analysis.susceptibility[i].toExponential(2)}  ·  relaxation ${fmtTime(relaxTimes[analysis.pairs[i]])}`}
              </title>
            </rect>
          );
        })}
        <path d={smoothPath} className="smooth" />
        <text x={PAD} y={18} className="ylbl">
          {metric === "susc"
            ? "tautomer fraction — log scale, 4 decades (↑ = more mutable) · yellow edge = CpG"
            : "relaxation time (↑ = slower to equilibrate) · yellow edge = CpG"}
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
            · susc {analysis.susceptibility[selected ?? 0].toExponential(2)} · relax{" "}
            {fmtTime(relaxTimes[pairFor(selBase)])} → double well below
          </span>
        )}
      </div>

      <p className="dna-cite">
        Double-well parameters from published quantum-chemistry studies:{" "}
        G·C —{" "}
        <a href={`https://doi.org/${GC_DATA.doi}`} target="_blank" rel="noreferrer">
          {GC_DATA.citation}
        </a>{" "}
        · A·T —{" "}
        <a href={`https://doi.org/${AT_DATA.doi}`} target="_blank" rel="noreferrer">
          {AT_DATA.citation}
        </a>
        . Well separation is an effective H-bond geometry estimate (see README).
      </p>
    </section>
  );
}
