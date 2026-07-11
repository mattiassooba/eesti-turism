import { memo, useMemo, useState } from "react";
import { fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { CHART_COLORS, FOREIGN_COLOR, CHART_GRID_COLOR, CHART_AXIS_COLOR } from "../theme";

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];

const REGION_LABELS = {
  EE001: "Põhja-Eesti",
  EE009: "Kesk-Eesti",
  EE00A: "Kirde-Eesti",
  EE004: "Lääne-Eesti",
  EE008: "Lõuna-Eesti",
};
const REGION_OPTIONS = { EE: "Eesti tervikuna", ...REGION_LABELS };

// TU11 (bed capacity) groups by Piirkond (5 macro-regions); TU110
// (occupancy) only groups by Maakond (15 counties) — it has no Piirkond
// dimension at all. To make the occupancy chart region-aware too, this
// maps each Piirkond to its constituent maakonds so their county-level
// rows can be combined into a region figure (bed-weighted average, not a
// plain mean, since occupancy in a small county shouldn't count as much
// as occupancy in a large one).
const PIIRKOND_MAAKONDS = {
  EE001: ["EE00370000000000"], // Põhja-Eesti = Harju
  EE009: ["EE00500000000000", "EE00520000000000", "EE00600000000000", "EE00710000000000"], // Kesk-Eesti = Jõgeva, Järva, Lääne-Viru, Rapla
  EE00A: ["EE00450000000000"], // Kirde-Eesti = Ida-Viru
  EE004: ["EE00390000000000", "EE00560000000000", "EE00680000000000", "EE00740000000000"], // Lääne-Eesti = Hiiu, Lääne, Pärnu, Saare
  EE008: ["EE00640000000000", "EE00790000000000", "EE00810000000000", "EE00840000000000", "EE00870000000000"], // Lõuna-Eesti = Põlva, Tartu, Valga, Viljandi, Võru
};

function computeOccupancyChart(rows, region) {
  const byPeriod = new Map();
  for (const row of rows) {
    if (row.value === null) continue;
    if (!byPeriod.has(row.Vaatlusperiood)) {
      byPeriod.set(row.Vaatlusperiood, { label: row.Vaatlusperiood_label, maakonds: new Map() });
    }
    const bucket = byPeriod.get(row.Vaatlusperiood);
    if (!bucket.maakonds.has(row.Maakond)) bucket.maakonds.set(row.Maakond, {});
    bucket.maakonds.get(row.Maakond)[row.Näitaja] = row.value;
  }

  const periods = Array.from(byPeriod.keys()).sort();
  return periods.map((p) => {
    const bucket = byPeriod.get(p);
    if (region === "EE") {
      const ee = bucket.maakonds.get("EE");
      return { x: bucket.label, "Täituvus, %": ee?.OCC_OR_BEDP ?? null };
    }
    let weightedSum = 0;
    let totalBeds = 0;
    for (const m of bucket.maakonds.values()) {
      if (m.OCC_OR_BEDP == null || m.CAP_BEDP == null) continue;
      weightedSum += m.OCC_OR_BEDP * m.CAP_BEDP;
      totalBeds += m.CAP_BEDP;
    }
    return { x: bucket.label, "Täituvus, %": totalBeds ? weightedSum / totalBeds : null };
  });
}

// Memoized — see Dashboard.jsx for why.
function Page6Capacity() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [region, setRegion] = useState("EE");
  const [yearsToShow, setYearsToShow] = useState(15);

  useAbortableEffect(
    async (signal, isActive) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const occupancyMaakonds = region === "EE" ? ["EE"] : PIIRKOND_MAAKONDS[region];
        // Independent queries (different Piirkond/table combinations, no
        // data dependency between them) — run concurrently instead of
        // paying for three sequential round-trips.
        const [regionData, trendData, occupancyData] = await Promise.all([
          fetchTableData(
            MAJUTUS_PATH,
            "TU11.PX",
            [
              { code: "Näitaja", selection: { filter: "item", values: ["CAP_BEDP"] } },
              {
                code: "Piirkond",
                selection: { filter: "item", values: Object.keys(REGION_LABELS) },
              },
              { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
            ],
            { signal }
          ),
          fetchTableData(
            MAJUTUS_PATH,
            "TU11.PX",
            [
              { code: "Näitaja", selection: { filter: "item", values: ["CAP_BEDP"] } },
              { code: "Piirkond", selection: { filter: "item", values: [region] } },
              { code: "Vaatlusperiood", selection: { filter: "top", values: ["34"] } },
            ],
            { signal }
          ),
          fetchTableData(
            MAJUTUS_PATH,
            "TU110.PX",
            [
              {
                code: "Näitaja",
                selection: { filter: "item", values: ["CAP_BEDP", "OCC_OR_BEDP"] },
              },
              { code: "Maakond", selection: { filter: "item", values: occupancyMaakonds } },
              { code: "Vaatlusperiood", selection: { filter: "top", values: ["22"] } },
            ],
            { signal }
          ),
        ]);

        const regionRows = flattenToRows(regionData);
        const regionChart = regionRows
          .map((r) => ({ x: REGION_LABELS[r.Piirkond] ?? r.Piirkond, Voodikohad: r.value, code: r.Piirkond }))
          .sort((a, b) => b.Voodikohad - a.Voodikohad);
        const regionLatestLabel = regionRows[0]?.Vaatlusperiood_label ?? "";

        const trendRows = flattenToRows(trendData);
        const trendChart = trendRows
          .map((r) => ({ x: r.Vaatlusperiood_label, Voodikohad: r.value }))
          .sort((a, b) => a.x.localeCompare(b.x));
        const firstCapacity = trendChart[0]?.Voodikohad ?? null;
        const latestCapacity = trendChart[trendChart.length - 1]?.Voodikohad ?? null;
        const growthMultiple =
          firstCapacity && latestCapacity ? latestCapacity / firstCapacity : null;

        const occupancyChart = computeOccupancyChart(flattenToRows(occupancyData), region);

        if (isActive()) {
          setState({
            data: {
              regionChart,
              regionLatestLabel,
              trendChart,
              latestCapacity,
              growthMultiple,
              occupancyChart,
            },
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (isAbortError(err)) return;
        if (isActive()) setState((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    },
    [region]
  );

  const maxYears = state.data ? Math.max(state.data.trendChart.length, 5) : 34;
  const visibleTrend = useMemo(
    () => (state.data ? state.data.trendChart.slice(-yearsToShow) : []),
    [state.data, yearsToShow]
  );
  const visibleOccupancy = useMemo(
    () => (state.data ? state.data.occupancyChart.slice(-yearsToShow) : []),
    [state.data, yearsToShow]
  );

  if (!state.data && state.loading) return <div className="panel-status">Laen…</div>;
  if (!state.data && state.error)
    return <div className="panel-error">Andmete laadimine ebaõnnestus: {state.error}</div>;

  const { data } = state;
  const regionLabel = REGION_OPTIONS[region];
  const regionSuffix = region === "EE" ? "Eesti kokku" : regionLabel;

  return (
    <div className={"dashboard" + (state.loading ? " refetching" : "")}>
      <div className="operator-controls">
        <label className="operator-control">
          <span>Piirkond</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {Object.entries(REGION_OPTIONS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="operator-control operator-control-slider">
          <span>Viimased {yearsToShow} aastat</span>
          <input
            type="range"
            min={5}
            max={maxYears}
            value={yearsToShow}
            onChange={(e) => setYearsToShow(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="hero-card">
        <div className="hero-label">
          Voodikohti kokku{region !== "EE" ? ` — ${regionLabel}` : ""}
        </div>
        <div className="hero-number">
          {data.latestCapacity !== null ? data.latestCapacity.toLocaleString("et-EE") : "—"}
        </div>
        {data.growthMultiple !== null && (
          <div className="hero-delta delta-up">
            ▲ {data.growthMultiple.toFixed(1)}x rohkem kui 1992. aastal
          </div>
        )}
      </div>

      <div className="data-card">
        <h3>Voodikohad piirkonna järgi ({data.regionLatestLabel})</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.regionChart}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="Voodikohad" isAnimationActive={false}>
              {data.regionChart.map((entry) => (
                <Cell key={entry.code} fill={entry.code === region ? FOREIGN_COLOR : CHART_COLORS[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="tile-row-split">
        <div className="data-card">
          <h3>Voodikohtade arv, {regionSuffix} (alates 1992)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={visibleTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }}
                axisLine={{ stroke: CHART_GRID_COLOR }}
                tickLine={{ stroke: CHART_GRID_COLOR }}
                interval={Math.max(Math.floor(visibleTrend.length / 8), 0)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                axisLine={{ stroke: CHART_GRID_COLOR }}
                tickLine={{ stroke: CHART_GRID_COLOR }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="Voodikohad"
                stroke={CHART_COLORS[3]}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="data-card">
          <h3>Voodikohtade täituvus, {regionSuffix} (alates 2004)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={visibleOccupancy} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }}
                axisLine={{ stroke: CHART_GRID_COLOR }}
                tickLine={{ stroke: CHART_GRID_COLOR }}
                interval={Math.max(Math.floor(visibleOccupancy.length / 8), 0)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                axisLine={{ stroke: CHART_GRID_COLOR }}
                tickLine={{ stroke: CHART_GRID_COLOR }}
                unit="%"
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="Täituvus, %"
                stroke={CHART_COLORS[1]}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {region !== "EE" && (
        <div className="operator-footnote">
          Piirkonna täituvus on maakondade voodikohtadega kaalutud keskmine (Statistikaamet ei
          avalda täituvust piirkonna, vaid ainult maakonna tasemel).
        </div>
      )}
    </div>
  );
}

export default memo(Page6Capacity);
