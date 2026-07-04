import { Fragment } from "react";

const MONTH_LABELS = [
  "Jaan",
  "Veebr",
  "Märts",
  "Apr",
  "Mai",
  "Juuni",
  "Juuli",
  "Aug",
  "Sept",
  "Okt",
  "Nov",
  "Dets",
];

const QUIET = [77, 120, 148];
const MIDSUMMER = [217, 142, 43];

function interpolate(t) {
  const r = Math.round(QUIET[0] + (MIDSUMMER[0] - QUIET[0]) * t);
  const g = Math.round(QUIET[1] + (MIDSUMMER[1] - QUIET[1]) * t);
  const b = Math.round(QUIET[2] + (MIDSUMMER[2] - QUIET[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function SeasonalityHeatmap({ years, grid }) {
  const allValues = years.flatMap((y) => grid[y]).filter((v) => typeof v === "number");
  const max = allValues.length ? Math.max(...allValues) : 1;
  const min = allValues.length ? Math.min(...allValues) : 0;
  const range = max - min || 1;

  return (
    <div className="heatmap-wrapper">
      <div
        className="heatmap-grid"
        style={{ gridTemplateColumns: `52px repeat(${years.length}, minmax(20px, 1fr))` }}
      >
        <div className="heatmap-corner" />
        {years.map((y) => (
          <div key={y} className="heatmap-year-label">
            {y}
          </div>
        ))}
        {MONTH_LABELS.map((label, mIdx) => (
          <Fragment key={label}>
            <div className="heatmap-month-label">{label}</div>
            {years.map((y) => {
              const v = grid[y][mIdx];
              const hasValue = typeof v === "number";
              const t = hasValue ? (v - min) / range : 0;
              return (
                <div
                  key={y + "-" + mIdx}
                  className="heatmap-cell"
                  style={{ backgroundColor: hasValue ? interpolate(t) : "transparent" }}
                  title={hasValue ? `${label} ${y}: ${v.toLocaleString("et-EE")}` : ""}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
