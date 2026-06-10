import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PARAMS_2D,
  groundState2d,
  quadrantPopulations,
  pathwayBarriers,
} from "./sim/doubleWell2d";
import { HARTREE_TO_KCAL } from "./sim/constants";

function lerp(a: number[], b: number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
// dark navy → indigo → magenta → yellow
const STOPS = [
  [12, 16, 32],
  [60, 40, 120],
  [200, 60, 140],
  [250, 220, 90],
];
function colormap(t: number): number[] {
  const s = Math.max(0, Math.min(0.999, t)) * 3;
  const i = Math.floor(s);
  return lerp(STOPS[i], STOPS[i + 1], s - i);
}

export function DoubleWell2DPanel() {
  const [coupling, setCoupling] = useState(DEFAULT_PARAMS_2D.coupling);
  const params = useMemo(() => ({ ...DEFAULT_PARAMS_2D, coupling }), [coupling]);
  const gs = useMemo(() => groundState2d(params), [params]);
  const q = useMemo(() => quadrantPopulations(gs), [gs]);
  const paths = useMemo(() => pathwayBarriers(params), [params]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const N = gs.N;
    cv.width = N;
    cv.height = N;
    const ctx = cv.getContext("2d")!;
    const img = ctx.createImageData(N, N);

    const vCanon = Math.min(...gs.V);
    const vHi = vCanon + 1.4 * paths.concertedBarrier;
    let dMax = 0;
    for (let k = 0; k < gs.psi.length; k++) dMax = Math.max(dMax, gs.psi[k] ** 2);

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const v = gs.V[i * N + j];
        const tn = (v - vCanon) / (vHi - vCanon);
        let [r, g, b] = colormap(tn);
        // density overlay (cyan), x1 = i horizontal, x2 = j vertical (flipped)
        const d = gs.psi[i * N + j] ** 2 / dMax;
        const alpha = Math.min(1, Math.sqrt(d) * 0.95);
        r = r * (1 - alpha) + 110 * alpha;
        g = g * (1 - alpha) + 231 * alpha;
        b = b * (1 - alpha) + 255 * alpha;
        const px = i;
        const py = N - 1 - j;
        const idx = (py * N + px) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [gs, paths]);

  const L = params.halfWidth;
  const a = params.wellSep;
  // map (x1,x2) → 0..100 viewBox (x2 up)
  const px = (x1: number) => ((x1 + L) / (2 * L)) * 100;
  const py = (x2: number) => (1 - (x2 + L) / (2 * L)) * 100;

  return (
    <section className="dw2">
      <div className="dw2-head">
        <h2>Double proton transfer · 2-D</h2>
        <span className="src">two coupled H-bond protons — concerted vs stepwise</span>
      </div>

      <div className="dw2-body">
        <div className="dw2-stage">
          <canvas ref={canvasRef} className="dw2-canvas" />
          <svg viewBox="0 0 100 100" className="dw2-overlay" preserveAspectRatio="none">
            {/* paths */}
            <polyline
              points={`${px(-a)},${py(-a)} ${px(a)},${py(-a)} ${px(a)},${py(a)}`}
              className={`path step ${paths.mechanism === "stepwise" ? "win" : ""}`}
            />
            <line
              x1={px(-a)}
              y1={py(-a)}
              x2={px(a)}
              y2={py(a)}
              className={`path conc ${paths.mechanism === "concerted" ? "win" : ""}`}
            />
            {/* corner labels */}
            <text x={px(-a)} y={py(-a) - 3} className="corner">canonical</text>
            <text x={px(a)} y={py(a) + 7} className="corner taut">tautomer</text>
            <text x={px(a)} y={py(-a) - 3} className="corner spt">SPT</text>
            <text x={px(-a)} y={py(a) + 7} className="corner spt">SPT</text>
          </svg>
          <div className="dw2-axes">
            <span className="ax-x">proton 1 →</span>
            <span className="ax-y">proton 2 →</span>
          </div>
        </div>

        <div className="dw2-side">
          <label className="field">
            <span>Inter-proton coupling g <b>{(coupling * HARTREE_TO_KCAL).toFixed(1)} kcal/mol</b></span>
            <input
              type="range"
              min={0}
              max={0.06}
              step={0.002}
              value={coupling}
              onChange={(e) => setCoupling(parseFloat(e.target.value))}
            />
          </label>

          <div className="dw2-mech">
            favoured mechanism: <b className={paths.mechanism}>{paths.mechanism}</b>
          </div>
          <div className="dw2-bars">
            <Bar label="concerted (diagonal)" v={paths.concertedBarrier} win={paths.mechanism === "concerted"} />
            <Bar label="stepwise (via SPT)" v={paths.stepwiseBarrier} win={paths.mechanism === "stepwise"} />
          </div>

          <div className="dw2-pops">
            <span>canonical <b>{(q.canonical * 100).toFixed(1)}%</b></span>
            <span>tautomer <b>{(q.tautomer * 100).toExponential(1)}%</b></span>
            <span>intermediate <b>{(q.intermediate * 100).toExponential(1)}%</b></span>
          </div>

          <p className="dw2-note">
            Bright cyan = the two-proton ground-state density |ψ(x₁,x₂)|².
            Concerted is sampled as the synchronous diagonal (an upper bound; real
            concerted transition states are asynchronous and lower), so the
            mechanism flag is a qualitative model comparison.
          </p>
        </div>
      </div>
    </section>
  );
}

function Bar({ label, v, win }: { label: string; v: number; win: boolean }) {
  const kcal = v * HARTREE_TO_KCAL;
  const w = Math.max(2, Math.min(100, (kcal / 90) * 100));
  return (
    <div className="dw2-bar">
      <span className="dw2-bar-lbl">{label}</span>
      <div className="dw2-bar-track">
        <div className={`dw2-bar-fill ${win ? "win" : ""}`} style={{ width: `${w}%` }} />
      </div>
      <span className="dw2-bar-val">{kcal.toFixed(1)}</span>
    </div>
  );
}
