import { Fragment } from "react";
import { seasonalityColor } from "../colorScale";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { formatNumber } from "../i18n/format";

export default function SeasonalityHeatmap({ years, grid }) {
  const { t, locale } = useTranslation();
  const monthLabels = t("heatmap.months");
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
        {monthLabels.map((label, mIdx) => (
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
                  title={hasValue ? `${label} ${y}: ${formatNumber(v, locale)}` : ""}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="heatmap-legend">
        <span>{t("heatmap.quietSeason")}</span>
        <span className="heatmap-legend-gradient" />
        <span>{t("heatmap.peakSeason")}</span>
        {allValues.length > 0 && (
          <span className="heatmap-legend-values">
            ({formatNumber(min, locale)}–{formatNumber(max, locale)})
          </span>
        )}
      </div>
    </div>
  );
}
