// Shared Recharts label renderers — the visual language from this session's
// "Direction 9" style exploration (see the Combo Chart Styles artifact),
// now applied across every chart on the site. A white halo (paint-order
// stroke) stands in for a background chip: it keeps a label legible over a
// bar, gridline, or another series without needing to measure the
// rendered text's own bounding box the way an SVG rect-chip would.

const HALO_PROPS = {
  fill: "#101b26",
  stroke: "#fff",
  strokeWidth: 3,
  paintOrder: "stroke",
  fontWeight: 600,
};

// A value directly above a bar — for the one series per chart where a
// reader is likely to want the number without hovering. `formatter`
// receives the raw value and returns the string to display.
export function BarValueLabel({ x, y, width, value, formatter }) {
  if (value == null) return null;
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} {...HALO_PROPS}>
      {formatter(value)}
    </text>
  );
}

// A line's latest value, labeled only at its last point — every other
// point is already covered by the hover tooltip, so repeating the value
// there would just be noise. `dy` lets a later series in a multi-line
// chart nudge below its dot instead of above, so end labels at the right
// edge (where lines tend to converge) don't stack on top of each other.
export function LineEndLabel({ x, y, value, index, dataLength, formatter, dy = -10 }) {
  if (index !== dataLength - 1 || value == null) return null;
  return (
    <text x={x} y={y + dy} textAnchor="end" fontSize={11} {...HALO_PROPS}>
      {formatter(value)}
    </text>
  );
}

// A ringed-dot spec for Recharts' `dot` prop — a small marker with a white
// stroke ring, legible wherever it crosses a bar or another line.
export function ringedDot(color, r = 4) {
  return { r, fill: color, stroke: "#fff", strokeWidth: 2 };
}

// For a two-line chart with no guaranteed value ordering (e.g. domestic vs
// foreign guests — either can lead), a fixed "first line above, second
// below" offset can put
// both end labels in the same spot if the data happens to cross. Comparing
// the two series' actual last values and placing the higher one's label
// above its dot, the lower one's below, keeps them apart regardless of
// which series leads.
export function endLabelOffsets(lastValueA, lastValueB, above = -10, below = 16) {
  if (lastValueA == null || lastValueB == null) return [above, below];
  return lastValueA >= lastValueB ? [above, below] : [below, above];
}

// A dot drawn only at a series' final point, as a `dot` render-prop function
// — for a long trend line (a year-plus of months), a ring at every point
// would clutter the chart, but the endpoint still deserves a visible marker
// to anchor its end-label.
export function lastPointDot(color, dataLength, r = 4) {
  return ({ cx, cy, index }) => {
    if (index !== dataLength - 1) return null;
    return <circle key="end-dot" cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth={2} />;
  };
}
