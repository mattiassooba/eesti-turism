export default function SplitBar({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <div className="split-bar">
      <div className="split-bar-track">
        {segments.map((s) => (
          <div
            key={s.label}
            className="split-bar-segment"
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
          />
        ))}
      </div>
      <div className="split-bar-legend">
        {segments.map((s) => (
          <span key={s.label} className="split-bar-legend-item">
            <span className="split-bar-swatch" style={{ backgroundColor: s.color }} />
            {s.label} · {Math.round((s.value / total) * 100)}% ({s.value.toLocaleString("et-EE")})
          </span>
        ))}
      </div>
    </div>
  );
}
