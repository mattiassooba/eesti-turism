import { useState } from "react";
import { useSize, linear, linePath, areaPath } from "./core.js";
import { Delta } from "../ui/Primitives.jsx";
import { useApp } from "../../state/AppState.jsx";
import { fmtPct } from "../../lib/format.js";

// Ranked horizontal bars as HTML — crisp text at every size, wraps long
// labels gracefully, and reads naturally to screen readers as a list.
export function BarList({ items, format, max, showShare, total, highlightKey, onSelect, limit, columns, deltaLabel, dense }) {
  const { locale } = useApp();
  const top = max ?? Math.max(...items.map((i) => i.value ?? 0), 1);
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <ol className={"barlist" + (dense ? " barlist--dense" : "") + (columns ? " barlist--cols" : "")}>
      {shown.map((it, i) => {
        const pct = it.value != null ? (it.value / top) * 100 : 0;
        const Tag = onSelect ? "button" : "div";
        return (
          <li key={it.key} className={"barlist-row" + (it.key === highlightKey ? " is-highlight" : "")}>
            <Tag className="barlist-inner" {...(onSelect ? { type: "button", onClick: () => onSelect(it), "aria-pressed": it.key === highlightKey } : {})}>
              <span className="barlist-rank num" aria-hidden="true">
                {it.rank ?? i + 1}
              </span>
              <span className="barlist-label">{it.label}</span>
              <span className="barlist-value num" title={it.lowerBound && it.boundTitle ? it.boundTitle : undefined}>
                {it.lowerBound ? "≥ " : ""}
                {format(it.value)}
              </span>
              {it.delta !== undefined && (
                <span className="barlist-delta">
                  <Delta value={it.delta} size="s" srPrefix={deltaLabel} />
                </span>
              )}
              {showShare && total ? <span className="barlist-share num">{fmtPct((it.value / total) * 100, locale)}</span> : null}
              <span className="barlist-track" aria-hidden="true">
                <span className="barlist-fill" style={{ width: `${Math.max(0.5, pct)}%`, background: it.color }} />
              </span>
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}

export function SplitBar({ segments, format, height = 14 }) {
  const { locale } = useApp();
  const total = segments.reduce((s, x) => s + (x.value ?? 0), 0) || 1;
  return (
    <div className="splitbar">
      <div className="splitbar-track" style={{ height }} role="img" aria-label={segments.map((s) => `${s.label} ${((s.value / total) * 100).toFixed(1)}%`).join(", ")}>
        {segments.map((s) => (
          <span key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="splitbar-legend">
        {segments.map((s) => (
          <div key={s.label} className="splitbar-item">
            <span className="splitbar-swatch" style={{ background: s.color }} />
            <span className="splitbar-label">{s.label}</span>
            <span className="splitbar-pct num">{fmtPct((s.value / total) * 100, locale)}</span>
            {format && <span className="splitbar-value num">{format(s.value)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values, height = 40, color = "var(--c-1)", area = true, highlightLast = true }) {
  const [ref, { width }] = useSize();
  const vals = values.filter((v) => v != null);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = linear([0, Math.max(1, values.length - 1)], [2, Math.max(4, width - 4)]);
  const y = linear([lo, hi === lo ? lo + 1 : hi], [height - 3, 3]);
  const pts = values.map((v, i) => (v == null ? null : [x(i), y(v)]));
  let li = values.length - 1;
  while (li >= 0 && values[li] == null) li--;
  return (
    <div className="sparkline" ref={ref} style={{ height }} aria-hidden="true">
      {width > 0 && (
        <svg width={width} height={height}>
          {area && <path d={areaPath(pts, height)} fill={color} opacity="0.12" />}
          <path d={linePath(pts)} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
          {highlightLast && li >= 0 && <circle cx={x(li)} cy={y(values[li])} r="3" fill={color} />}
        </svg>
      )}
    </div>
  );
}

// Year × month heatmap. Colour encodes value (sequential, single hue);
// the readout above the grid states the exact figure on hover/focus.
export function Heatmap({ rows, colLabels, format, scale, rowLabel = (r) => r.year, cellTitle, caption, legend }) {
  const [hover, setHover] = useState(null);
  const all = rows.flatMap((r) => r.values).filter((v) => v != null);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const color = (v) => (v == null ? null : scale((v - lo) / (hi - lo || 1)));
  const readout = hover ? cellTitle(hover.row, hover.col, hover.value) : caption;
  return (
    <div className="heatmap" onPointerLeave={() => setHover(null)}>
      <p className="heatmap-readout" aria-live="polite">
        {readout}
      </p>
      <div className="heatmap-scroll">
        <div className="heatmap-grid" style={{ "--cols": colLabels.length }}>
          <span />
          {colLabels.map((c) => (
            <span key={c} className="heatmap-col">
              {c}
            </span>
          ))}
          {rows.map((r) => (
            <div key={rowLabel(r)} className="heatmap-row" role="row">
              <span className="heatmap-rowlabel num">{rowLabel(r)}</span>
              {r.values.map((v, ci) => (
                <span
                  key={ci}
                  className={"heatmap-cell" + (v == null ? " is-empty" : "") + (hover && hover.row === r && hover.col === ci ? " is-hover" : "")}
                  style={{ background: color(v) ?? undefined }}
                  onPointerEnter={() => v != null && setHover({ row: r, col: ci, value: v })}
                  title={v == null ? undefined : cellTitle(r, ci, v)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {legend && (
        <div className="heatmap-legend">
          <span>{legend[0]}</span>
          <span className="heatmap-legend-ramp" style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((tt) => scale(tt)).join(",")})` }} />
          <span>{legend[1]}</span>
          {format && (
            <span className="heatmap-legend-range num">
              {format(lo)} – {format(hi)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Sequential single-hue ramp: shore mist → Baltic blue → deep navy.
const RAMP = [
  [236, 242, 246],
  [198, 223, 235],
  [138, 190, 216],
  [59, 128, 171],
  [31, 61, 90],
  [15, 33, 51],
];
export function seqScale(t) {
  const tt = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(tt));
  const f = tt - i;
  const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Same ramp for dark backgrounds: deep water → bright shallows.
const RAMP_DARK = [
  [26, 52, 76],
  [36, 77, 108],
  [52, 112, 150],
  [92, 157, 194],
  [154, 198, 220],
  [222, 238, 246],
];
export function seqScaleDark(t) {
  const tt = Math.max(0, Math.min(1, t)) * (RAMP_DARK.length - 1);
  const i = Math.min(RAMP_DARK.length - 2, Math.floor(tt));
  const f = tt - i;
  const c = RAMP_DARK[i].map((v, k) => Math.round(v + (RAMP_DARK[i + 1][k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Diverging ramp for change rates (red ← neutral → green-blue).
export function divScaleDark(t) {
  // t in [-1, 1]
  const neg = [240, 153, 141];
  const mid = [44, 70, 96];
  const pos = [127, 204, 163];
  const a = Math.max(-1, Math.min(1, t));
  const [from, to, f] = a < 0 ? [mid, neg, -a] : [mid, pos, a];
  const c = from.map((v, k) => Math.round(v + (to[k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
