// Quiet-season low end is deliberately lighter than the hero card's own
// background (--sea-deep, #0f3a57) so low-value cells stay visible against
// it instead of blending in.
const QUIET = [77, 120, 148];
const MIDSUMMER = [217, 142, 43];

function interpolate(t) {
  const r = Math.round(QUIET[0] + (MIDSUMMER[0] - QUIET[0]) * t);
  const g = Math.round(QUIET[1] + (MIDSUMMER[1] - QUIET[1]) * t);
  const b = Math.round(QUIET[2] + (MIDSUMMER[2] - QUIET[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function SeasonalityStrip({ months }) {
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
            style={{ backgroundColor: interpolate(t) }}
            title={`${m.label}: ${m.value.toLocaleString("et-EE")}`}
          />
        );
      })}
    </div>
  );
}
