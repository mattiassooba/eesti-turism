import { useId, useState } from "react";
import { useApp } from "../../state/AppState.jsx";
import Icon from "../ui/Icon.jsx";
import { Source } from "../ui/Primitives.jsx";

// Common frame for every chart: title, optional insight sentence, controls,
// legend, the chart itself, then source + an accessible table alternative.
export default function ChartFrame({
  title,
  subtitle,
  insight,
  controls,
  legend,
  tables,
  sourceNote,
  table,
  children,
  plain,
  id,
  footnote,
  scope,
}) {
  const { t } = useApp();
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  return (
    <figure className={"chart-frame" + (plain ? " chart-frame--plain" : "")} id={id}>
      {(title || scope) && (
        <div className="chart-frame-head">
          <div>
            {title && <h3 className="chart-title">{title}</h3>}
            {subtitle && <p className="chart-subtitle">{subtitle}</p>}
          </div>
          {scope && <div className="chart-frame-scope">{scope}</div>}
        </div>
      )}
      {insight && <p className="chart-insight">{insight}</p>}
      {(controls || legend) && (
        <div className="chart-frame-bar">
          {legend && <Legend items={legend} />}
          {controls && <div className="chart-controls">{controls}</div>}
        </div>
      )}
      <div className="chart-frame-body">{showTable && table ? <DataTable {...table} id={tableId} /> : children}</div>
      {footnote && <p className="chart-footnote">{footnote}</p>}
      <figcaption className="chart-frame-foot">
        {tables && <Source tables={tables} note={sourceNote} />}
        {table && (
          <button type="button" className="table-toggle" aria-expanded={showTable} aria-controls={tableId} onClick={() => setShowTable((s) => !s)}>
            <Icon name={showTable ? "chart" : "table"} size={15} />
            {showTable ? t("chart.showChart") : t("chart.showTable")}
          </button>
        )}
      </figcaption>
    </figure>
  );
}

export function Legend({ items }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className={"legend-swatch legend-swatch--" + (it.type ?? "line")} style={{ "--c": it.color }} data-dash={it.dash ? "1" : undefined} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function DataTable({ columns, rows, caption, id, maxHeight = 420, firstColSticky = true }) {
  return (
    <div className="data-table-wrap" style={{ maxHeight }} id={id} tabIndex={0} role="region" aria-label={caption}>
      <table className={"data-table" + (firstColSticky ? " has-sticky-col" : "")}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? "is-num" : ""}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key ?? i} className={r.className}>
              {columns.map((c, ci) =>
                ci === 0 ? (
                  <th key={c.key} scope="row">
                    {r[c.key]}
                  </th>
                ) : (
                  <td key={c.key} className={c.numeric ? "is-num num" : ""}>
                    {r[c.key]}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
