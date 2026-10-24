import { useId, useMemo, useState } from "react";
import { useSize, linear, linePath } from "./core.js";
import { niceTicks } from "../../data/derive.js";

// Columns on the left axis and one or more lines on the right — the operator
// charts that pair a volume or rate with a share, a price, or RevPAR.
export default function ComposedChart({
  categories,
  bars,
  line,
  lines,
  height = 280,
  yFormat = (v) => String(v),
  y2Format = (v) => String(v),
  valueFormat,
  value2Format,
  showBarValues = false,
  partialLabel,
  ariaLabel,
}) {
  const [ref, { width }] = useSize();
  const [hover, setHover] = useState(null);
  const hatchId = `hatch-c-${useId().replace(/:/g, "")}`;
  const fmtBar = valueFormat ?? yFormat;
  const fmtLine = value2Format ?? y2Format;
  const allLines = [...(line ? [line] : []), ...(lines ?? [])];
  const narrow = width < 560;
  const showAnyLineValues = !narrow && allLines.some((ln) => ln.showValues);
  const padT = showAnyLineValues ? 32 : 24;
  const padB = 30;
  const padR = narrow ? 36 : 44;
  const innerH = height - padT - padB;
  const innerW = Math.max(10, width - padR);
  const n = categories.length;

  const { y, ticks } = useMemo(() => {
    let lo = 0;
    let hi = 0;
    for (const v of bars.values) {
      if (v == null) continue;
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
    }
    const tk = niceTicks(lo, hi || 1, narrow ? 4 : 5);
    return { y: linear([tk[0], tk[tk.length - 1]], [padT + innerH, padT]), ticks: tk };
  }, [bars, innerH, narrow, padT]);

  const { y2, ticks2 } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const ln of allLines) {
      for (const v of ln.values) {
        if (v == null) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    if (!Number.isFinite(lo)) {
      lo = 0;
      hi = 1;
    }
    lo = Math.min(0, lo);
    const tk = niceTicks(lo, hi, narrow ? 3 : 4);
    return { y2: linear([tk[0], tk[tk.length - 1]], [padT + innerH, padT]), ticks2: tk };
  }, [allLines, innerH, narrow, padT]);

  const band = n ? innerW / n : 0;
  const barW = Math.min(band * 0.62, 48);
  const step = Math.max(1, Math.ceil(n / (narrow ? 6 : 12)));
  const linePts = allLines.map((ln) => ({
    ...ln,
    format: ln.format ?? fmtLine,
    pts: categories.map((_, i) => (ln.values[i] == null ? null : [band * i + band / 2, y2(ln.values[i])])),
  }));

  return (
    <div className="chart chart--columns" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
          <defs>
            <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--sea-100)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--c-1)" strokeWidth="2" />
            </pattern>
          </defs>
          {ticks.map((tk) => (
            <g key={tk} className={"chart-grid" + (tk === 0 ? " is-zero" : "")}>
              <line x1={0} x2={innerW} y1={y(tk)} y2={y(tk)} />
            </g>
          ))}
          {categories.map((c, i) => {
            const cx = band * i + band / 2;
            const v = bars.values[i];
            const top = v == null ? 0 : Math.min(y(0), y(v));
            const h = v == null ? 0 : Math.max(1, Math.abs(y(v) - y(0)));
            const fill = c.partial ? `url(#${hatchId})` : c.alert ? bars.alertColor ?? "var(--c-muted)" : bars.color;
            return (
              <g
                key={c.key}
                className={"chart-col" + (hover === i ? " is-hover" : "") + (hover != null && hover !== i ? " is-dim" : "")}
                onPointerEnter={() => setHover(i)}
              >
                <rect x={band * i} y={padT} width={band} height={innerH} fill="transparent" />
                {v != null && <rect x={cx - barW / 2} y={top} width={barW} height={h} fill={fill} fillOpacity={c.partial ? 1 : 1} rx="1.5" />}
                {showBarValues && !narrow && v != null && (
                  <text x={cx} y={top - 6} textAnchor="middle" className="chart-col-value">
                    {fmtBar(v)}
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
          {linePts.map((ln) => (
            <g key={ln.key}>
              <path
                d={linePath(ln.pts)}
                fill="none"
                stroke={ln.color}
                strokeWidth={ln.width ?? 2}
                strokeDasharray={ln.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="chart-line"
              />
              {ln.pts.map((p, i) =>
                p ? (
                  <g key={categories[i].key}>
                    <circle cx={p[0]} cy={p[1]} r={ln.showValues ? 3.8 : 3.5} fill={ln.color} />
                    {ln.showValues && !narrow && (
                      <text x={p[0]} y={p[1] - 9} textAnchor="middle" fill={ln.color} className="chart-line-value">
                        {ln.format(ln.values[i])}
                      </text>
                    )}
                  </g>
                ) : null
              )}
            </g>
          ))}
          <g aria-hidden="true" pointerEvents="none">
            {ticks.map((tk) => (
              <text key={tk} x={0} y={y(tk) - 6} className="chart-ylabel">
                {yFormat(tk)}
              </text>
            ))}
            {ticks2.map((tk) => (
              <text key={tk} x={width} y={y2(tk) - 6} textAnchor="end" className="chart-ylabel">
                {y2Format(tk)}
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
            <li>
              <span className="chart-tip-swatch" style={{ background: bars.color }} />
              <span className="chart-tip-label">{bars.label}</span>
              <span className="chart-tip-value num">{bars.values[hover] == null ? "—" : fmtBar(bars.values[hover])}</span>
            </li>
            {allLines.map((ln) => (
              <li key={ln.key}>
                <span className="chart-tip-swatch" style={{ background: ln.color }} />
                <span className="chart-tip-label">{ln.label}</span>
                <span className="chart-tip-value num">{ln.values[hover] == null ? "—" : (ln.format ?? fmtLine)(ln.values[hover])}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
