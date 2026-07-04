import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTableMeta, fetchTableData } from "../api/pxweb";
import { flattenToRows, toChartData } from "../api/jsonStat";
import FilterBar from "./FilterBar";
import DataGrid from "./DataGrid";
import ChartPanel from "./ChartPanel";

function defaultQuery(variables) {
  return variables.map((v) => {
    if (v.time) {
      return { code: v.code, selection: { filter: "top", values: ["24"] } };
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

export default function TableView({ path, tableId, title }) {
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

  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setMetaError(null);
    setDataset(null);
    setQuery(null);
    queryOwnerRef.current = null;

    fetchTableMeta(path, tableId)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        queryOwnerRef.current = tableKey(path, tableId);
        setQuery(defaultQuery(m.variables));
        const firstNonTime = m.variables.find((v) => !v.time);
        setGroupField(firstNonTime ? firstNonTime.code : null);
      })
      .catch((err) => !cancelled && setMetaError(err.message));

    return () => {
      cancelled = true;
    };
  }, [path, tableId]);

  useEffect(() => {
    if (!query) return;
    // Guard against the stale-query race: when `path`/`tableId` change, this
    // effect can still run in the same commit as the metadata-reset effect
    // above, seeing the *previous* table's `query` (state updates from that
    // effect haven't been applied to this closure yet). Skip firing until
    // `query` is confirmed to belong to the table currently selected.
    if (queryOwnerRef.current !== tableKey(path, tableId)) return;
    let cancelled = false;
    setLoading(true);
    setDataError(null);

    fetchTableData(path, tableId, query)
      .then((d) => !cancelled && setDataset(d))
      .catch((err) => !cancelled && setDataError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [path, tableId, query]);

  const rows = useMemo(() => (dataset ? flattenToRows(dataset) : []), [dataset]);
  const timeField = meta?.variables.find((v) => v.time)?.code ?? null;
  const chartData = useMemo(() => {
    if (!rows.length || !timeField) return { data: [], seriesNames: [] };
    return toChartData(rows, timeField, groupField);
  }, [rows, timeField, groupField]);

  if (metaError) {
    return <div className="panel-error">Failed to load table: {metaError}</div>;
  }
  if (!meta || !query) {
    return <div className="panel-status">Loading table…</div>;
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
          Failed to load data: {dataError}{" "}
          <button onClick={() => setQuery([...query])}>Retry</button>
        </div>
      )}
      {loading && <div className="panel-status">Loading data…</div>}
      {!loading && !dataError && (
        <>
          <ChartPanel
            data={chartData.data}
            seriesNames={chartData.seriesNames}
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
          <DataGrid rows={rows} />
        </>
      )}
    </div>
  );
}
