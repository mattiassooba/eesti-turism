import { memo, useState } from "react";
import { fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { CHART_COLORS, CHART_GRID_COLOR, CHART_AXIS_COLOR } from "../theme";

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];

const REGION_LABELS = {
  EE001: "Põhja-Eesti",
  EE009: "Kesk-Eesti",
  EE00A: "Kirde-Eesti",
  EE004: "Lääne-Eesti",
  EE008: "Lõuna-Eesti",
};

// Memoized — see Dashboard.jsx for why.
function Page6Capacity() {
  const [state, setState] = useState({ status: "loading" });

  useAbortableEffect(async (signal, isActive) => {
    try {
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
            { code: "Piirkond", selection: { filter: "item", values: ["EE"] } },
            { code: "Vaatlusperiood", selection: { filter: "top", values: ["34"] } },
          ],
          { signal }
        ),
        fetchTableData(
          MAJUTUS_PATH,
          "TU110.PX",
          [
            { code: "Näitaja", selection: { filter: "item", values: ["OCC_OR_BEDP"] } },
            { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
            { code: "Vaatlusperiood", selection: { filter: "top", values: ["22"] } },
          ],
          { signal }
        ),
      ]);

      const regionRows = flattenToRows(regionData);
      const regionChart = regionRows
        .map((r) => ({ x: REGION_LABELS[r.Piirkond] ?? r.Piirkond, Voodikohad: r.value }))
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

      const occupancyRows = flattenToRows(occupancyData);
      const occupancyChart = occupancyRows
        .map((r) => ({ x: r.Vaatlusperiood_label, "Täituvus, %": r.value }))
        .sort((a, b) => a.x.localeCompare(b.x));

      if (isActive()) {
        setState({
          status: "ready",
          regionChart,
          regionLatestLabel,
          trendChart,
          latestCapacity,
          growthMultiple,
          occupancyChart,
        });
      }
    } catch (err) {
      if (isAbortError(err)) return;
      if (isActive()) setState({ status: "error", message: err.message });
    }
  }, []);

  if (state.status === "loading") return <div className="panel-status">Laen…</div>;
  if (state.status === "error")
    return <div className="panel-error">Andmete laadimine ebaõnnestus: {state.message}</div>;

  return (
    <div className="dashboard">
      <div className="hero-card">
        <div className="hero-label">Voodikohti kokku</div>
        <div className="hero-number">
          {state.latestCapacity !== null ? state.latestCapacity.toLocaleString("et-EE") : "—"}
        </div>
        {state.growthMultiple !== null && (
          <div className="hero-delta delta-up">
            ▲ {state.growthMultiple.toFixed(1)}x rohkem kui 1992. aastal
          </div>
        )}
      </div>

      <div className="data-card">
        <h3>Voodikohad piirkonna järgi ({state.regionLatestLabel})</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={state.regionChart}>
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
            <Bar dataKey="Voodikohad" fill={CHART_COLORS[0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="tile-row-split">
        <div className="data-card">
          <h3>Voodikohtade arv, Eesti kokku (alates 1992)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={state.trendChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }}
                axisLine={{ stroke: CHART_GRID_COLOR }}
                tickLine={{ stroke: CHART_GRID_COLOR }}
                interval={4}
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
          <h3>Voodikohtade täituvus, Eesti kokku (alates 2004)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={state.occupancyChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }}
                axisLine={{ stroke: CHART_GRID_COLOR }}
                tickLine={{ stroke: CHART_GRID_COLOR }}
                interval={2}
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
    </div>
  );
}

export default memo(Page6Capacity);
