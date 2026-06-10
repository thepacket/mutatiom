import { useMemo, useState } from "react";
import type { SolveResult } from "./sim/doubleWell";
import { evolveLindblad } from "./sim/lindblad";
import { bathWithReorg } from "./sim/spectralDensity";

const W = 760;
const H = 280;
const PAD = 46;

function fmtTime(fs: number): string {
  if (!Number.isFinite(fs)) return "∞";
  if (fs < 1e3) return `${fs.toFixed(0)} fs`;
  if (fs < 1e6) return `${(fs / 1e3).toFixed(2)} ps`;
  if (fs < 1e9) return `${(fs / 1e6).toFixed(2)} ns`;
  return `${(fs / 1e9).toFixed(2)} µs`;
}

export function LindbladPanel({ solved, tempK }: { solved: SolveResult; tempK: number }) {
  const [lambdaEv, setLambdaEv] = useState(0.3);

  const traj = useMemo(
    () => evolveLindblad(solved, { tempK, bath: bathWithReorg(lambdaEv), samples: 200 }),
    [solved, tempK, lambdaEv],
  );

  const tMax = traj.timesFs[traj.timesFs.length - 1] || 1;
  const sx = (t: number) => PAD + (t / tMax) * (W - 2 * PAD);
  const sy = (p: number) => PAD + (1 - p) * (H - 2 * PAD);

  const line = (ys: number[]) =>
    traj.timesFs.map((t, i) => `${i ? "L" : "M"}${sx(t).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join(" ");

  const canonPath = line(traj.popCanonical);
  const tautPath = line(traj.popRight);
  const steadyY = sy(traj.steadyRight);

  return (
    <section className="lind">
      <div className="lind-head">
        <h2>Open-system relaxation · Lindblad</h2>
        <span className="src">
          proton + thermal bath → decoheres &amp; relaxes to equilibrium
        </span>
      </div>

      <div className="lind-body">
        <svg viewBox={`0 0 ${W} ${H}`} className="lindplot">
          {/* axes */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="axis" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} className="axis" />
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line x1={PAD - 4} y1={sy(p)} x2={W - PAD} y2={sy(p)} className="grid" />
              <text x={PAD - 8} y={sy(p) + 3} className="ytick">{p}</text>
            </g>
          ))}

          {/* steady-state (Boltzmann) tautomer line */}
          <line x1={PAD} y1={steadyY} x2={W - PAD} y2={steadyY} className="steady" />
          <text x={W - PAD} y={steadyY - 5} className="steadylbl">
            equilibrium {(traj.steadyRight * 100).toFixed(2)}%
          </text>

          {/* curves */}
          <path d={canonPath} className="canon" />
          <path d={tautPath} className="taut" />

          <text x={W - PAD} y={H - PAD + 18} className="xlbl">
            time → {fmtTime(tMax)}
          </text>
          <text x={PAD} y={PAD - 14} className="ylbl">
            well population
          </text>
        </svg>

        <div className="lind-side">
          <label className="field">
            <span>
              Bath reorganization energy λ <b>{(lambdaEv * 1000).toFixed(0)} meV</b>
            </span>
            <input
              type="range"
              min={0.02}
              max={1}
              step={0.01}
              value={lambdaEv}
              onChange={(e) => setLambdaEv(parseFloat(e.target.value))}
            />
            <span className="sub">Ohmic Caldeira–Leggett bath (phenomenological strength)</span>
          </label>

          <div className="legend">
            <span><i className="sw canon" /> canonical</span>
            <span><i className="sw taut" /> tautomer</span>
            <span><i className="sw steady" /> equilibrium</span>
          </div>

          <div className="lind-stats">
            <div className="stat">
              <div className="stat-label">Relaxation time</div>
              <div className="stat-value">{fmtTime(traj.relaxTimeFs)}</div>
              <div className="stat-hint">1 / (r₀₁ + r₁₀)</div>
            </div>
            <div className="stat">
              <div className="stat-label">Equilibrium tautomer</div>
              <div className="stat-value">{(traj.steadyRight * 100).toFixed(2)} %</div>
              <div className="stat-hint">Gibbs steady state @ {tempK} K</div>
            </div>
          </div>

          <p className="lind-note">
            The coherent model oscillates forever; coupling to the bath decoheres
            it and drives relaxation to the thermal population — the timescale
            that decides whether a mutagenic tautomer survives to replication.
          </p>
        </div>
      </div>
    </section>
  );
}
