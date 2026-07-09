import { Fragment } from "react";
import { seasonalityColor } from "../colorScale";

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
                  style={{ backgroundColor: hasValue ? seasonalityColor(t) : "transparent" }}
                  title={hasValue ? `${label} ${y}: ${v.toLocaleString("et-EE")}` : ""}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="heatmap-legend">
        <span>Vaikne hooaeg</span>
        <span className="heatmap-legend-gradient" />
        <span>Tipphooaeg</span>
        {allValues.length > 0 && (
          <span className="heatmap-legend-values">
            ({min.toLocaleString("et-EE")}–{max.toLocaleString("et-EE")})
          </span>
        )}
      </div>
    </div>
  );
}
