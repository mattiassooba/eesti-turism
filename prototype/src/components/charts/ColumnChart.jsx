import { useMemo, useState } from "react";
import { useSize, linear } from "./core.js";
import { niceTicks } from "../../data/derive.js";

// Vertical columns for annual / quarterly figures. Supports grouped or
// stacked series, sign colouring (growth rates), partial periods (hatched,
// never compared silently with complete ones) and highlighted categories.
export default function ColumnChart({
  categories,
  series,
  height = 300,
  stacked = false,
  signColors = false,
  yFormat = (v) => String(v),
  valueFormat,
  tickEvery,
  showValues = false,
  ariaLabel,
  partialLabel,
  yMax,
}) {
  const [ref, { width }] = useSize();
  const [hover, setHover] = useState(null);
  const fmtValue = valueFormat ?? yFormat;
  const narrow = width < 560;
  const padT = 24;
  const padB = 30;
  const innerH = height - padT - padB;
  const n = categories.length;

  const { y, ticks } = useMemo(() => {
    let lo = 0;
    let hi = 0;
    categories.forEach((_, i) => {
      if (stacked) {
        let pos = 0;
        let neg = 0;
        for (const s of series) {
          const v = s.values[i] ?? 0;
          if (v >= 0) pos += v;
          else neg += v;
        }
        hi = Math.max(hi, pos);
        lo = Math.min(lo, neg);
      } else {
        for (const s of series) {
          const v = s.values[i];
          if (v == null) continue;
          hi = Math.max(hi, v);
          lo = Math.min(lo, v);
        }
      }
    });
    const tk = niceTicks(lo, yMax ?? (hi || 1), narrow ? 4 : 5).filter((v) => yMax == null || v <= yMax);
    return { y: linear([tk[0], tk[tk.length - 1]], [padT + innerH, padT]), ticks: tk };
  }, [categories, series, stacked, innerH, narrow, yMax]);

  const band = n ? width / n : 0;
  const groupW = Math.min(band * 0.72, 56);
  const barW = stacked ? groupW : groupW / series.length;
  const step = tickEvery ?? Math.max(1, Math.ceil(n / (narrow ? 6 : 12)));

  return (
    <div className="chart chart--columns" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
          <defs>
            <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--sea-100)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--c-1)" strokeWidth="2" />
            </pattern>
          </defs>
          {ticks.map((tk) => (
            <g key={tk} className={"chart-grid" + (tk === 0 ? " is-zero" : "")}>
              <line x1={0} x2={width} y1={y(tk)} y2={y(tk)} />
            </g>
          ))}
          {categories.map((c, i) => {
            const cx = band * i + band / 2;
            let posAcc = 0;
            let negAcc = 0;
            return (
              <g
                key={c.key}
                className={"chart-col" + (hover === i ? " is-hover" : "") + (hover != null && hover !== i ? " is-dim" : "")}
                onPointerEnter={() => setHover(i)}
              >
                <rect x={band * i} y={padT} width={band} height={innerH} fill="transparent" />
                {series.map((s, si) => {
                  const v = s.values[i];
                  if (v == null) return null;
                  let y0;
                  let y1;
                  if (stacked) {
                    if (v >= 0) {
                      y0 = y(posAcc);
                      posAcc += v;
                      y1 = y(posAcc);
                    } else {
                      y0 = y(negAcc);
                      negAcc += v;
                      y1 = y(negAcc);
                    }
                  } else {
                    y0 = y(0);
                    y1 = y(v);
                  }
                  const bx = stacked ? cx - groupW / 2 : cx - groupW / 2 + si * barW;
                  const top = Math.min(y0, y1);
                  const h = Math.max(1, Math.abs(y1 - y0));
                  const multi = series.length > 1;
                  if (c.partial && multi) {
                    return <rect key={s.key} x={bx + (stacked ? 0 : 1)} y={top} width={Math.max(1, barW - (stacked ? 0 : 2))} height={h} fill={s.color} fillOpacity="0.38" stroke={s.color} strokeWidth="1" strokeDasharray="3 2" rx="1.5" />;
                  }
                  const fill = c.partial
                    ? "url(#hatch)"
                    : signColors
                    ? v >= 0
                      ? "var(--pos)"
                      : "var(--neg)"
                    : c.highlight
                    ? "var(--c-highlight)"
                    : c.alert
                    ? s.alertColor ?? "var(--c-muted)"
                    : s.color;
                  return <rect key={s.key} x={bx + (stacked ? 0 : 1)} y={top} width={Math.max(1, barW - (stacked ? 0 : 2))} height={h} fill={fill} rx="1.5" />;
                })}
                {showValues && !narrow && series.length === 1 && series[0].values[i] != null && (
                  <text x={cx} y={y(Math.max(0, series[0].values[i])) - 6} textAnchor="middle" className="chart-col-value">
                    {fmtValue(series[0].values[i])}
                  </text>
                )}
                {(n - 1 - i) % step === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" className="chart-xlabel">
                    {c.label}
                    {c.partial ? "*" : ""}
                  </text>
                )}
              </g>
            );
          })}
          <g aria-hidden="true" pointerEvents="none">
            {ticks.map((tk) => (
              <text key={tk} x={0} y={y(tk) - 6} className="chart-ylabel">
                {yFormat(tk)}
              </text>
            ))}
          </g>
        </svg>
      )}
      {hover != null && width > 0 && (
        <div className={"chart-tip" + (band * hover > width * 0.62 ? " is-flipped" : "")} style={{ left: band * hover + band / 2, top: padT }}>
          <p className="chart-tip-title">
            {categories[hover].title ?? categories[hover].label}
            {categories[hover].partial && partialLabel ? ` · ${partialLabel}` : ""}
          </p>
          <ul>
            {series.map((s) => (
              <li key={s.key}>
                <span className="chart-tip-swatch" style={{ background: signColors ? ((s.values[hover] ?? 0) >= 0 ? "var(--pos)" : "var(--neg)") : s.color }} />
                <span className="chart-tip-label">{s.label}</span>
                <span className="chart-tip-value num">{s.values[hover] == null ? "—" : fmtValue(s.values[hover])}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
