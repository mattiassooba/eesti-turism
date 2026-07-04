function formatValue(value, unit) {
  if (typeof value !== "number") return value;
  return value.toLocaleString("et-EE") + (unit ? ` ${unit}` : "");
}

export default function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-label">{label}</div>}
      {payload.map((entry) => (
        <div key={entry.dataKey ?? entry.name} className="chart-tooltip-row">
          <span className="chart-tooltip-swatch" style={{ backgroundColor: entry.color }} />
          <span className="chart-tooltip-name">{entry.name}</span>
          <span className="chart-tooltip-value">{formatValue(entry.value, unit)}</span>
        </div>
      ))}
    </div>
  );
}
