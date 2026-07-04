const TIME_RANGE_OPTIONS = [
  { value: "12", label: "12 kuud" },
  { value: "24", label: "24 kuud" },
  { value: "60", label: "5 aastat" },
  { value: "all", label: "Kõik aeg" },
];

const RESIDENCY_OPTIONS = [
  { value: "all", label: "Kõik külastajad" },
  { value: "domestic", label: "Eesti elanikud" },
  { value: "foreign", label: "Väliskülastajad" },
];

export default function GlobalFilters({
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
    <div className="global-filters">
      {showTimeRange && (
        <label className="global-filter">
          Ajavahemik
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
        <label className="global-filter">
          Külastajad
          <select value={residency} onChange={(e) => onResidencyChange(e.target.value)}>
            {RESIDENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {showDeltaMode && (
        <label className="global-filter">
          Võrdlus
          <select value={deltaMode} onChange={(e) => onDeltaModeChange(e.target.value)}>
            <option value="yoy">Aasta tagasi (YoY)</option>
            <option value="mom">Eelmine kuu</option>
          </select>
        </label>
      )}
    </div>
  );
}
