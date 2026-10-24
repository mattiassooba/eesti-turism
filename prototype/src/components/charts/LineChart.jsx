import { useId, useMemo, useState } from "react";
import { useSize, linear, linePath, areaPath, relaxLabels } from "./core.js";
import { niceTicks } from "../../data/derive.js";
import { parsePeriod } from "../../lib/format.js";

// Editorial time-series chart.
// - y-axis labels sit on their gridlines at the left edge (no axis line)
// - series are labelled directly at their last value instead of a legend
// - shaded annotation bands mark context periods (e.g. COVID-19 years)
// - pointer and arrow keys move a crosshair; the readout lists all series
function scaleValues(values, { zero, yMin, yMax, tickCount, innerH, padT }) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v == null) continue;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!Number.isFinite(lo)) {
    lo = 0;
    hi = 1;
  }
  if (zero) lo = Math.min(0, lo);
  if (yMax != null) hi = Math.max(hi, yMax);
  if (yMin != null) lo = Math.min(lo, yMin);
  const ticks = niceTicks(lo, hi, tickCount);
  return { y: linear([ticks[0], ticks[ticks.length - 1]], [padT + innerH, padT]), ticks };
}

export default function LineChart({
  periods,
  series,
  height = 340,
  yFormat = (v) => String(v),
  y2Format,
  valueFormat,
  xTick = (p) => p,
  tooltipTitle = (p) => p,
  zero = true,
  y2Zero = false,
  bands = [],
  endLabels = true,
  ariaLabel,
  yMax,
  yMin,
  y2Max,
  y2Min,
  compactTicks,
  focusIndex,
}) {
  const [ref, { width }] = useSize();
  const [hover, setHover] = useState(null);
  const id = useId();
  const fmtValue = valueFormat ?? yFormat;
  const fmtRight = y2Format ?? yFormat;
  const narrow = width < 560;
  const hasRight = series.some((s) => s.axis === "right");
  const padL = 0;
  const padR = endLabels ? (narrow ? 64 : 92) : hasRight ? 36 : 8;
  const padT = 22;
  const padB = 30;
  const innerW = Math.max(10, width - padL - padR);
  const innerH = height - padT - padB;
  const rightGutter = hasRight ? (narrow ? 28 : 36) : 0;
  const { y, ticks, y2, ticks2 } = useMemo(() => {
    const left = series.filter((s) => s.axis !== "right").flatMap((s) => s.values);
    const right = series.filter((s) => s.axis === "right").flatMap((s) => s.values);
    const primary = scaleValues(left, { zero, yMin, yMax, tickCount: narrow ? 4 : 5, innerH, padT });
    const secondary = scaleValues(right, { zero: y2Zero, yMin: y2Min, yMax: y2Max, tickCount: 2, innerH, padT });
    return { y: primary.y, ticks: primary.ticks, y2: secondary.y, ticks2: secondary.ticks };
  }, [series, zero, y2Zero, innerH, narrow, yMax, yMin, y2Max, y2Min]);

  const plotY = (s) => (s.axis === "right" ? y2 : y);
  const plotFormat = (s) => s.format ?? (s.axis === "right" ? fmtRight : fmtValue);

  const n = periods.length;
  const x = linear([0, Math.max(1, n - 1)], [padL, padL + Math.max(10, innerW - rightGutter)]);

  const xTicks = useMemo(() => {
    if (!n) return [];
    const first = parsePeriod(periods[0]);
    const idx = [];
    if (first?.kind === "month") {
      const years = n / 12;
      const step = years > 14 ? 4 : years > 7 ? 2 : 1;
      if (n <= 26 && !compactTicks) {
        periods.forEach((p, i) => {
          const m = parsePeriod(p).month;
          if ((m - 1) % (narrow ? 6 : 3) === 0) idx.push(i);
        });
      } else {
        periods.forEach((p, i) => {
          const pp = parsePeriod(p);
          if (pp.month === 1 && pp.year % step === 0) idx.push(i);
        });
      }
    } else if (first?.kind === "quarter") {
      const years = n / 4;
      const step = years > 12 ? 3 : years > 6 ? 2 : 1;
      periods.forEach((p, i) => {
        const pp = parsePeriod(p);
        if (pp.quarter === 1 && pp.year % step === 0) idx.push(i);
      });
    } else {
      const step = Math.ceil(n / (narrow ? 5 : 10));
      periods.forEach((_, i) => {
        if ((n - 1 - i) % step === 0) idx.push(i);
      });
    }
    return idx;
  }, [periods, n, narrow, compactTicks]);

  const paths = series.map((s) => {
    const sy = plotY(s);
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), sy(v)]));
    return { ...s, d: linePath(pts), area: s.area ? areaPath(pts, sy(Math.max((s.axis === "right" ? ticks2 : ticks)[0], 0))) : null, pts };
  });

  const labels = endLabels
    ? relaxLabels(
        paths
          .filter((s) => !s.noLabel)
          .map((s) => {
            let i = s.values.length - 1;
            while (i >= 0 && s.values[i] == null) i--;
            return i < 0 ? null : { key: s.key, y: plotY(s)(s.values[i]), x: x(i), value: s.values[i], label: s.short ?? s.label, color: s.color, format: plotFormat(s), i };
          })
          .filter(Boolean),
        28,
        padT,
        padT + innerH
      )
    : [];

  const active = hover ?? focusIndex ?? null;

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(x.invert(px));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }
  function onKey(e) {
    if (!n) return;
    const cur = hover ?? n - 1;
    if (e.key === "ArrowLeft") setHover(Math.max(0, cur - 1));
    else if (e.key === "ArrowRight") setHover(Math.min(n - 1, cur + 1));
    else if (e.key === "Home") setHover(0);
    else if (e.key === "End") setHover(n - 1);
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  }

  const tipLeft = active != null ? x(active) : 0;
  const tipFlip = active != null && tipLeft > innerW * 0.62;

  return (
    <div className="chart chart--line" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          className="chart-svg"
        >
          <defs>
            {paths
              .filter((s) => s.area)
              .map((s) => (
                <linearGradient key={s.key} id={`${id}-g-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
          </defs>
          {bands.map((b) => {
            const i0 = periods.indexOf(b.from);
            const i1 = periods.indexOf(b.to);
            if (i0 < 0 && i1 < 0) return null;
            const a = x(i0 < 0 ? 0 : i0);
            const z = x(i1 < 0 ? n - 1 : i1);
            return (
              <g key={b.label} className="chart-band">
                <rect x={a} y={padT} width={Math.max(2, z - a)} height={innerH} />
                <text x={a + 6} y={padT + 14} className="chart-band-label">
                  {b.label}
                </text>
              </g>
            );
          })}
          {ticks.map((tk) => (
            <g key={tk} className={"chart-grid" + (tk === 0 ? " is-zero" : "")}>
              <line x1={padL} x2={padL + innerW} y1={y(tk)} y2={y(tk)} />
              <text x={padL} y={y(tk) - 6} className="chart-ylabel">
                {yFormat(tk)}
              </text>
            </g>
          ))}
          {hasRight &&
            ticks2.map((tk) => (
              <text key={`r-${tk}`} x={padL + innerW} y={y2(tk) - 6} textAnchor="end" className="chart-ylabel">
                {fmtRight(tk)}
              </text>
            ))}
          {xTicks.map((i) => (
            <g key={i} className="chart-xtick">
              <line x1={x(i)} x2={x(i)} y1={padT + innerH} y2={padT + innerH + 5} />
              <text x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : "middle"}>
                {xTick(periods[i], i)}
              </text>
            </g>
          ))}
          {paths.map((s) =>
            s.area ? <path key={`a-${s.key}`} d={s.area} fill={`url(#${id}-g-${s.key})`} className="chart-area" /> : null
          )}
          {paths.map((s) => (
            <path
              key={s.key}
              d={s.d}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={"chart-line" + (s.muted ? " is-muted" : "")}
            />
          ))}
          {labels.map((l) => (
            <g key={l.key} className="chart-endlabel">
              <circle cx={l.x} cy={paths.find((p) => p.key === l.key).pts[l.i][1]} r="3.5" fill={l.color} />
              <text x={padL + innerW + 10} y={l.y - 3} fill={l.color} className="chart-endlabel-value">
                {(l.format ?? fmtValue)(l.value)}
              </text>
              <text x={padL + innerW + 10} y={l.y + 11} className="chart-endlabel-name">
                {l.label}
              </text>
            </g>
          ))}
          {active != null && (
            <g className="chart-cursor" aria-hidden="true">
              <line x1={x(active)} x2={x(active)} y1={padT} y2={padT + innerH} />
              {paths.map((s) =>
                s.values[active] != null ? <circle key={s.key} cx={x(active)} cy={plotY(s)(s.values[active])} r="4.5" stroke={s.color} /> : null
              )}
            </g>
          )}
        </svg>
      )}
      {active != null && width > 0 && (
        <div
          className={"chart-tip" + (tipFlip ? " is-flipped" : "")}
          style={{ left: tipLeft, top: padT }}
          role="status"
          aria-live="polite"
        >
          <p className="chart-tip-title">{tooltipTitle(periods[active])}</p>
          <ul>
            {series.map((s) => (
              <li key={s.key}>
                <span className="chart-tip-swatch" style={{ background: s.color, opacity: s.muted ? 0.6 : 1 }} />
                <span className="chart-tip-label">{s.label}</span>
                <span className="chart-tip-value num">{s.values[active] == null ? "—" : plotFormat(s)(s.values[active])}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
