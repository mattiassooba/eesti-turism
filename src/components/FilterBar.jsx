const TIME_TOP_OPTIONS = [6, 12, 24, 48, 120];

export default function FilterBar({
  variables,
  query,
  onChange,
  groupField,
  onGroupFieldChange,
}) {
  const timeVar = variables.find((v) => v.time);
  const nonTimeVars = variables.filter((v) => !v.time);

  function updateTimeTop(code, n) {
    onChange(
      query.map((q) =>
        q.code === code ? { ...q, selection: { filter: "top", values: [String(n)] } } : q
      )
    );
  }

  function updateVariable(code, values) {
    onChange(
      query.map((q) =>
        q.code === code ? { ...q, selection: { filter: "item", values } } : q
      )
    );
  }

  return (
    <div className="filter-bar">
      {timeVar && (
        <label>
          {timeVar.text}:{" "}
          <select
            value={query.find((q) => q.code === timeVar.code)?.selection.values[0] ?? "24"}
            onChange={(e) => updateTimeTop(timeVar.code, e.target.value)}
          >
            {TIME_TOP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                last {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {nonTimeVars.map((v) => (
        <label key={v.code}>
          {v.text}:{" "}
          <select
            multiple
            value={query.find((q) => q.code === v.code)?.selection.values ?? []}
            onChange={(e) =>
              updateVariable(
                v.code,
                Array.from(e.target.selectedOptions, (o) => o.value)
              )
            }
          >
            {v.values.map((val, i) => (
              <option key={val} value={val}>
                {v.valueTexts[i]}
              </option>
            ))}
          </select>
        </label>
      ))}
      {nonTimeVars.length > 0 && (
        <label>
          Group chart by:{" "}
          <select
            value={groupField ?? ""}
            onChange={(e) => onGroupFieldChange(e.target.value || null)}
          >
            <option value="">(none)</option>
            {nonTimeVars.map((v) => (
              <option key={v.code} value={v.code}>
                {v.text}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
