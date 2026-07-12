import { seasonalityColor } from "../colorScale";
import { formatNumber } from "../i18n/format";

export default function SeasonalityStrip({ months, locale = "et" }) {
  if (!months.length) return null;

  const values = months.map((m) => m.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <div className="seasonality-strip">
      {months.map((m, i) => {
        const t = (m.value - min) / range;
        const isCurrent = i === months.length - 1;
        return (
          <div
            key={m.label + i}
            className={"seasonality-cell" + (isCurrent ? " seasonality-current" : "")}
            style={{ backgroundColor: seasonalityColor(t) }}
            title={`${m.label}: ${formatNumber(m.value, locale)}`}
          />
        );
      })}
    </div>
  );
}
