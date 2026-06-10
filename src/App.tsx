import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PARAMS,
  solveDoubleWell,
  type ProtonParams,
} from "./sim/doubleWell";
import { tunnelingFromSpectrum, tautomerFraction } from "./sim/tunneling";
import { prepareLeftLocalised, densityAt } from "./sim/evolve";
import { PAIR_PRESETS, pairFor, type Base } from "./sim/dna";
import { DnaPanel } from "./DnaPanel";
import { LindbladPanel } from "./LindbladPanel";
import { IsotopePanel } from "./IsotopePanel";
import {
  PROTON_MASS,
  DEUTERON_MASS,
  HARTREE_TO_KCAL,
  BOHR_TO_ANGSTROM,
  ATOMIC_TIME_TO_SECONDS,
} from "./sim/constants";

const W = 760;
const H = 360;
const PAD = 44;

export function App() {
  const [params, setParams] = useState<ProtonParams>(DEFAULT_PARAMS);
  const [tempK, setTempK] = useState(310);
  const [playing, setPlaying] = useState(true);
  const [tAtomic, setTAtomic] = useState(0);
  const [selectedBase, setSelectedBase] = useState<number | null>(null);
  const [pairLabel, setPairLabel] = useState<string | null>(null);

  const pickBase = (base: Base) => {
    const preset = PAIR_PRESETS[pairFor(base)];
    setParams((p) => ({ ...preset.params, mass: p.mass }));
    setPairLabel(preset.label);
  };

  const solved = useMemo(() => solveDoubleWell(params, 6), [params]);
  const tun = useMemo(() => tunnelingFromSpectrum(solved), [solved]);
  const wp = useMemo(() => prepareLeftLocalised(solved, 8), [solved]);

  const period =
    tun.splittingEffective > 0 ? (2 * Math.PI) / tun.splittingEffective : Infinity;

  // Animation: map ~6 s of wall clock to one tunnelling period.
  const raf = useRef<number>(0);
  const last = useRef<number>(0);
  useEffect(() => {
    if (!playing || !Number.isFinite(period)) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dtWall = (now - last.current) / 1000;
      last.current = now;
      setTAtomic((t) => (t + (dtWall / 6) * period) % (2 * period));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, period]);

  const dens = useMemo(() => densityAt(wp, tAtomic), [wp, tAtomic]);

  // Coordinate maps.
  const { x, V } = solved;
  const L = params.halfWidth;
  const sx = (xi: number) => PAD + ((xi + L) / (2 * L)) * (W - 2 * PAD);
  const vMax = Math.max(...V.slice(0, x.length)) * 1.05;
  const vMin = Math.min(...V);
  const syV = (e: number) =>
    PAD + (1 - (e - vMin) / (vMax - vMin)) * (H * 0.6 - PAD);
  const densMax = Math.max(...dens, 1e-12);
  const syD = (d: number) => H - PAD - (d / densMax) * (H * 0.32);

  const pathFrom = (ys: (i: number) => number) =>
    x.map((xi, i) => `${i ? "L" : "M"}${sx(xi).toFixed(1)},${ys(i).toFixed(1)}`).join(" ");

  const vPath = pathFrom((i) => syV(V[i]));
  const densPath = pathFrom((i) => syD(dens[i]));
  const densArea = `${densPath} L${sx(x[x.length - 1]).toFixed(1)},${(H - PAD).toFixed(1)} L${sx(x[0]).toFixed(1)},${(H - PAD).toFixed(1)} Z`;

  // Lowest few eigenstates drawn at their energy.
  const stateColors = ["#e879f9", "#38bdf8", "#a3e635", "#fbbf24"];

  const transferFs = (period / 2) * ATOMIC_TIME_TO_SECONDS * 1e15;
  const tautFrac = tautomerFraction(params, tempK);
  const tNowFs = tAtomic * ATOMIC_TIME_TO_SECONDS * 1e15;

  const set = (patch: Partial<ProtonParams>) =>
    setParams((p) => ({ ...p, ...patch }));

  return (
    <div className="app">
      <header>
        <h1>
          Mutatiom <span className="sub">· quantum proton tunnelling in DNA</span>
        </h1>
        <p className="tag">
          A Watson–Crick H-bond proton in a double well. It tunnels to the
          tautomer minimum — the Löwdin route to a spontaneous point mutation.
        </p>
      </header>

      <DnaPanel
        tempK={tempK}
        onPickBase={pickBase}
        selected={selectedBase}
        onSelect={setSelectedBase}
      />

      <div className="main">
        <aside className="controls">
          <Slider
            label="Barrier height"
            value={params.barrier * HARTREE_TO_KCAL}
            min={1}
            max={12}
            step={0.1}
            unit="kcal/mol"
            onChange={(v) => set({ barrier: v / HARTREE_TO_KCAL })}
          />
          <Slider
            label="Proton-transfer distance"
            value={params.wellSep * 2 * BOHR_TO_ANGSTROM}
            min={0.3}
            max={1.2}
            step={0.01}
            unit="Å"
            onChange={(v) => set({ wellSep: v / (2 * BOHR_TO_ANGSTROM) })}
          />
          <Slider
            label="Asymmetry (canonical depth)"
            value={params.bias * HARTREE_TO_KCAL}
            min={0}
            max={6}
            step={0.1}
            unit="kcal/mol"
            onChange={(v) => set({ bias: v / HARTREE_TO_KCAL })}
          />
          <Slider
            label="Temperature"
            value={tempK}
            min={4}
            max={400}
            step={1}
            unit="K"
            onChange={setTempK}
          />
          <div className="field">
            <span>Tunnelling particle</span>
            <div className="seg">
              <button
                className={params.mass === PROTON_MASS ? "on" : ""}
                onClick={() => set({ mass: PROTON_MASS })}
              >
                Proton (¹H)
              </button>
              <button
                className={params.mass === DEUTERON_MASS ? "on" : ""}
                onClick={() => set({ mass: DEUTERON_MASS })}
              >
                Deuteron (²H)
              </button>
            </div>
          </div>
          <div className="field">
            <button className="play" onClick={() => setPlaying((p) => !p)}>
              {playing ? "❚❚ Pause" : "▶ Play"}
            </button>
            <button className="play" onClick={() => setParams(DEFAULT_PARAMS)}>
              ↺ Reset
            </button>
          </div>
        </aside>

        <section className="stage">
          <div className="stage-head">
            Proton double well{" "}
            {pairLabel ? (
              <span className="pairbadge">{pairLabel} base pair</span>
            ) : (
              <span className="pairbadge custom">custom parameters</span>
            )}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="plot">
            {/* baseline */}
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="axis" />
            <line x1={sx(0)} y1={PAD * 0.6} x2={sx(0)} y2={H - PAD} className="midline" />

            {/* potential */}
            <path d={vPath} className="vcurve" />

            {/* eigen-levels + wavefunctions */}
            {solved.states.slice(0, 4).map((st, k) => {
              const y = syV(st.energy);
              const amp = 14;
              const wf = x
                .map((xi, i) => `${i ? "L" : "M"}${sx(xi).toFixed(1)},${(y - st.psi[i] * amp / Math.sqrt(Math.max(...st.psi.map(Math.abs)))).toFixed(1)}`)
                .join(" ");
              return (
                <g key={k}>
                  <line x1={PAD} y1={y} x2={W - PAD} y2={y} className="level" />
                  <path d={wf} style={{ stroke: stateColors[k] }} className="wf" />
                </g>
              );
            })}

            {/* well labels */}
            <text x={sx(-params.wellSep)} y={H - PAD + 18} className="welllbl">
              canonical
            </text>
            <text x={sx(params.wellSep)} y={H - PAD + 18} className="welllbl taut">
              tautomer
            </text>

            {/* live density */}
            <path d={densArea} className="dens" />
          </svg>

          <div className="readout">
            <Stat label="Tunnelling splitting Δ" value={`${(tun.splittingEffective * HARTREE_TO_KCAL * 349.75).toExponential(2)} cm⁻¹`} hint={tun.reliableFD ? "E₁ − E₀" : "WKB (FD unresolvable)"} />
            <Stat label="Transfer time (½ period)" value={fmtTime(transferFs)} hint={tun.reliableFD ? "canonical → tautomer" : "WKB estimate"} />
            <Stat label="WKB barrier action θ" value={tun.barrierAction.toFixed(2)} hint="∫√(2m(V−E))dx" />
            <Stat label="Tautomer fraction" value={fmtPct(tautFrac)} hint={`Boltzmann @ ${tempK} K`} />
            <Stat label="clock" value={`t = ${tNowFs.toFixed(0)} fs`} hint="animation time" />
          </div>
        </section>
      </div>

      <LindbladPanel solved={solved} tempK={tempK} />

      <IsotopePanel params={params} />
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>
        {props.label} <b>{props.value.toFixed(2)} {props.unit}</b>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  );
}

function fmtTime(fs: number): string {
  if (!Number.isFinite(fs)) return "∞";
  if (fs < 1e3) return `${fs.toFixed(1)} fs`;
  if (fs < 1e6) return `${(fs / 1e3).toFixed(2)} ps`;
  if (fs < 1e9) return `${(fs / 1e6).toFixed(2)} ns`;
  return `${(fs / 1e15).toExponential(2)} s`;
}

function fmtPct(f: number): string {
  if (f >= 0.01) return `${(f * 100).toFixed(2)} %`;
  return `${f.toExponential(2)}`;
}
