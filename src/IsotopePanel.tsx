import { useMemo } from "react";
import type { ProtonParams } from "./sim/doubleWell";
import { isotopeComparison } from "./sim/isotopes";

const W = 760;
const ROW_H = 54;
const PAD_L = 70;
const PAD_R = 30;

const ISO_COLOR = ["#38bdf8", "#f59e0b", "#f472b6"];

function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return "∞";
  const fs = s * 1e15;
  if (fs < 1e3) return `${fs.toFixed(1)} fs`;
  if (fs < 1e6) return `${(fs / 1e3).toFixed(2)} ps`;
  if (fs < 1e9) return `${(fs / 1e6).toFixed(2)} ns`;
  if (fs < 1e12) return `${(fs / 1e9).toFixed(2)} µs`;
  return `${(fs / 1e15).toExponential(1)} s`;
}

function fmtKie(k: number): string {
  if (!Number.isFinite(k)) return "∞";
  if (k < 100) return k.toFixed(1);
  return k.toExponential(1);
}

export function IsotopePanel({ params }: { params: ProtonParams }) {
  // The KIE always sweeps ¹H/²H/³H, so it's independent of the selected
  // particle (params.mass) — depend only on the well shape to avoid a needless
  // 3-well resolve when the proton/deuteron toggle flips.
  const data = useMemo(
    () => isotopeComparison(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.barrier, params.wellSep, params.bias, params.halfWidth, params.gridN],
  );

  const maxKie = Math.max(10, ...data.map((d) => (Number.isFinite(d.kie) ? d.kie : 0)));
  const logMax = Math.log10(maxKie);
  // Log x-axis from KIE = 1 (log 0) to maxKie.
  const x = (v: number) => PAD_L + (Math.log10(Math.max(1, v)) / logMax) * (W - PAD_L - PAD_R);

  const H = data.length * ROW_H + 50;
  const decades = Array.from({ length: Math.ceil(logMax) + 1 }, (_, i) => 10 ** i);

  return (
    <section className="iso">
      <div className="iso-head">
        <h2>Kinetic isotope effect · ¹H / ²H / ³H</h2>
        <span className="src">heavier isotope ⇒ larger θ ⇒ exponentially slower tunnelling</span>
      </div>

      <div className="iso-body">
        <svg viewBox={`0 0 ${W} ${H}`} className="isoplot">
          {/* log gridlines */}
          {decades.map((d) => (
            <g key={d}>
              <line x1={x(d)} y1={28} x2={x(d)} y2={H - 22} className="grid" />
              <text x={x(d)} y={H - 8} className="xtick">
                {d >= 1000 ? `${d / 1000}k×` : `${d}×`}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const y = 40 + i * ROW_H;
            const kieX = x(d.kie);
            const classX = x(d.classicalKie);
            return (
              <g key={d.symbol}>
                <text x={PAD_L - 12} y={y + 14} className="isolbl">
                  {d.symbol}
                </text>
                {/* quantum KIE bar */}
                <rect
                  x={PAD_L}
                  y={y}
                  width={Math.max(kieX - PAD_L, 0)}
                  height={22}
                  rx={4}
                  fill={ISO_COLOR[i]}
                  opacity={0.85}
                />
                <text x={kieX + 6} y={y + 16} className="kielbl">
                  {fmtKie(d.kie)}×
                </text>
                {/* classical (no-tunnelling) limit marker */}
                {i > 0 && (
                  <>
                    <line x1={classX} y1={y - 4} x2={classX} y2={y + 26} className="classmark" />
                    <text x={classX} y={y - 8} className="classlbl">
                      classical {d.classicalKie.toFixed(2)}×
                    </text>
                  </>
                )}
              </g>
            );
          })}
          <text x={PAD_L} y={18} className="axislbl">
            tunnelling slowdown vs ¹H (log scale) · tick = semiclassical √(m/m_H) limit
          </text>
        </svg>

        <div className="iso-side">
          {data.map((d, i) => (
            <div className="iso-stat" key={d.symbol}>
              <div className="iso-stat-name" style={{ color: ISO_COLOR[i] }}>
                {d.symbol} <span>{d.name}</span>
              </div>
              <div className="iso-stat-row">
                <span>θ</span>
                <b>{d.barrierAction.toFixed(2)}</b>
              </div>
              <div className="iso-stat-row">
                <span>transfer</span>
                <b>{fmtTime(d.transferTimeSeconds)}</b>
              </div>
              <div className="iso-stat-row">
                <span>KIE</span>
                <b>{fmtKie(d.kie)}×</b>
              </div>
            </div>
          ))}
          <p className="iso-note">
            {data[1].kie > 2 * data[1].classicalKie
              ? `²H KIE is ${(data[1].kie / data[1].classicalKie).toFixed(0)}× the classical limit — transfer is tunnelling-dominated.`
              : "KIE is near the semiclassical limit — this regime is not strongly tunnelling-dominated."}
          </p>
        </div>
      </div>
    </section>
  );
}
