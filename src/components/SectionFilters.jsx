const TIME_RANGE_OPTIONS = [
  { value: "12", label: "12 kuud" },
  { value: "24", label: "24 kuud" },
  { value: "60", label: "5 aastat" },
  { value: "all", label: "Kõik aeg" },
];

const RESIDENCY_TABS = [
  { key: "all", label: "Kõik külastajad" },
  { key: "domestic", label: "Eesti elanikud" },
  { key: "foreign", label: "Väliskülastajad" },
];

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
  if (!showResidency && !showTimeRange && !showDeltaMode) return null;

  return (
    <div className="operator-controls">
      {showTimeRange && (
        <label className="operator-control">
          <span>Ajavahemik</span>
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
          <span>Külastajad</span>
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
          <span>Võrdlus</span>
          <div className="pill-tabs">
            <button
              className={"pill-tab" + (deltaMode === "yoy" ? " active" : "")}
              onClick={() => onDeltaModeChange("yoy")}
            >
              Aasta tagasi (YoY)
            </button>
            <button
              className={"pill-tab" + (deltaMode === "mom" ? " active" : "")}
              onClick={() => onDeltaModeChange("mom")}
            >
              Eelmine kuu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
