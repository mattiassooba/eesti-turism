import { useMemo, useRef, useState } from "react";
import { fetchTableMeta, fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows, toChartData } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import FilterBar from "./FilterBar";
import DataGrid from "./DataGrid";
import ChartPanel from "./ChartPanel";
import ExportButtons from "./ExportButtons";
import { useTranslation } from "../i18n/LocaleContext.jsx";

function defaultQuery(variables, initialTimeTop) {
  return variables.map((v) => {
    if (v.time) {
      return { code: v.code, selection: { filter: "top", values: [String(initialTimeTop ?? "24")] } };
    }
    if (v.elimination) {
      return { code: v.code, selection: { filter: "item", values: [v.values[0]] } };
    }
    return { code: v.code, selection: { filter: "item", values: v.values } };
  });
}

// Identifies which table a `query` state value belongs to, so the data-fetch
// effect can tell a fresh query for the current table apart from a stale
// leftover query from whichever table was previously selected.
function tableKey(path, tableId) {
  return `${path.join("/")}::${tableId}`;
}

export default function TableView({ path, tableId, title, initialTimeRangeMonths }) {
  const { t, locale } = useTranslation();
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [query, setQuery] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [dataError, setDataError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [groupField, setGroupField] = useState(null);
  const [chartType, setChartType] = useState("line");
  // Ref (not state) so the update is visible synchronously to the data-fetch
  // effect within the same commit that the metadata-reset effect runs in.
  const queryOwnerRef = useRef(null);

  useAbortableEffect(
    async (signal, isActive) => {
      setMeta(null);
      setMetaError(null);
      setDataset(null);
      setQuery(null);
      queryOwnerRef.current = null;

      try {
        const m = await fetchTableMeta(path, tableId, { signal, locale });
        if (!isActive()) return;
        setMeta(m);
        queryOwnerRef.current = tableKey(path, tableId);
        // initialTimeRangeMonths is a one-time hint carried over from the
        // dashboard's global time-range filter (e.g. via a quick-link click),
        // not a live sync — Browse has its own FilterBar for ongoing control.
        const initialTop = initialTimeRangeMonths
          ? Math.min(Number(initialTimeRangeMonths), 120)
          : undefined;
        setQuery(defaultQuery(m.variables, initialTop));
        const firstNonTime = m.variables.find((v) => !v.time);
        setGroupField(firstNonTime ? firstNonTime.code : null);
      } catch (err) {
        if (isAbortError(err)) return;
        if (isActive()) setMetaError(err.message);
      }
    },
    [path, tableId, locale]
  );

  useAbortableEffect(
    async (signal, isActive) => {
      if (!query) return;
      // Guard against the stale-query race: when `path`/`tableId` change, this
      // effect can still run in the same commit as the metadata-reset effect
      // above, seeing the *previous* table's `query` (state updates from that
      // effect haven't been applied to this closure yet). Skip firing until
      // `query` is confirmed to belong to the table currently selected.
      if (queryOwnerRef.current !== tableKey(path, tableId)) return;
      setLoading(true);
      setDataError(null);

      try {
        const d = await fetchTableData(path, tableId, query, { signal, locale });
        if (isActive()) setDataset(d);
      } catch (err) {
        if (isAbortError(err)) return;
        if (isActive()) setDataError(err.message);
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [path, tableId, query, locale]
  );

  const rows = useMemo(() => (dataset ? flattenToRows(dataset) : []), [dataset]);
  const timeField = meta?.variables.find((v) => v.time)?.code ?? null;
  const chartData = useMemo(() => {
    if (!rows.length || !timeField) return { data: [], seriesNames: [] };
    return toChartData(rows, timeField, groupField);
  }, [rows, timeField, groupField]);

  if (metaError) {
    return <div className="panel-error">{t("tableView.metaError", metaError)}</div>;
  }
  if (!meta || !query) {
    return <div className="panel-status">{t("tableView.loadingTable")}</div>;
  }

  return (
    <div className="table-view">
      <h2>{title}</h2>
      <FilterBar
        variables={meta.variables}
        query={query}
        onChange={setQuery}
        groupField={groupField}
        onGroupFieldChange={setGroupField}
      />
      {dataError && (
        <div className="panel-error">
          {t("tableView.loadError", dataError)}{" "}
          <button onClick={() => setQuery([...query])}>{t("tableView.retry")}</button>
        </div>
      )}
      {!dataset && loading && <div className="panel-status">{t("tableView.loadingData")}</div>}
      {!dataError && dataset && (
        <div className={loading ? "refetching" : ""}>
          <ChartPanel
            data={chartData.data}
            seriesNames={chartData.seriesNames}
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
          <ExportButtons rows={rows} tableId={tableId} />
          <DataGrid rows={rows} />
        </div>
      )}
    </div>
  );
}
