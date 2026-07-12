import { useTranslation } from "../i18n/LocaleContext.jsx";

// Local, per-section filter row — styled like Majutusettevõtja vaade's own
// controls (pill select + pill tabs) rather than the old single global bar,
// since each scroll section now owns its own residency/time-range/delta
// state instead of sharing one global value across all of them.
export default function SectionFilters({
  showResidency,
  showTimeRange,
  showDeltaMode,
  residency,
  onResidencyChange,
  timeRangeMonths,
  onTimeRangeChange,
  deltaMode,
  onDeltaModeChange,
}) {
  const { t } = useTranslation();
  const TIME_RANGE_OPTIONS = [
    { value: "12", label: t("filters.time12") },
    { value: "24", label: t("filters.time24") },
    { value: "60", label: t("filters.time60") },
    { value: "all", label: t("filters.timeAll") },
  ];
  const RESIDENCY_TABS = [
    { key: "all", label: t("filters.residencyAll") },
    { key: "domestic", label: t("filters.residencyDomestic") },
    { key: "foreign", label: t("filters.residencyForeign") },
  ];

  if (!showResidency && !showTimeRange && !showDeltaMode) return null;

  return (
    <div className="operator-controls">
      {showTimeRange && (
        <label className="operator-control">
          <span>{t("filters.timeRange")}</span>
          <select
            value={timeRangeMonths ?? "all"}
            onChange={(e) => onTimeRangeChange(e.target.value === "all" ? null : e.target.value)}
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {showResidency && (
        <div className="operator-control">
          <span>{t("filters.residency")}</span>
          <div className="pill-tabs">
            {RESIDENCY_TABS.map((tab) => (
              <button
                key={tab.key}
                className={"pill-tab" + (residency === tab.key ? " active" : "")}
                onClick={() => onResidencyChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showDeltaMode && (
        <div className="operator-control">
          <span>{t("filters.comparison")}</span>
          <div className="pill-tabs">
            <button
              className={"pill-tab" + (deltaMode === "yoy" ? " active" : "")}
              onClick={() => onDeltaModeChange("yoy")}
            >
              {t("filters.yoy")}
            </button>
            <button
              className={"pill-tab" + (deltaMode === "mom" ? " active" : "")}
              onClick={() => onDeltaModeChange("mom")}
            >
              {t("filters.mom")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
