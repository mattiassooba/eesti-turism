import { memo, useState } from "react";
import { fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import SectionFilters from "./SectionFilters";
import { CHART_COLORS, DOMESTIC_COLOR, FOREIGN_COLOR, CHART_GRID_COLOR, CHART_AXIS_COLOR } from "../theme";

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];
const REISIMINE_PATH = ["majandus", "turism-ja-majutus", "eesti-elanike-reisimine"];
const PURPOSE_CODES = ["HOL", "BSNS", "BSNS_CONF", "BSNS_O", "_O"];
const DURATION_ORDER = ["1 kuni 3 ööd", "4 kuni 7 ööd", "Üle 7 öö"];
const NAITAJA_SHORT = { TR_DOM: "Sisereisid", TR_OUT: "Välisreisid" };
const NIGHTS_CODE = { all: "OCC_NI", domestic: "OCC_NI_RES", foreign: "OCC_NI_NONRES" };
const RESIDENCY_TITLE = {
  all: "Ööbimised",
  domestic: "Eesti elanike ööbimised",
  foreign: "Väliskülastajate ööbimised",
};

// Memoized — see Dashboard.jsx for why.
function Page3Purpose() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [residency, setResidency] = useState("all");
  const [timeRangeMonths, setTimeRangeMonths] = useState("24");
  const windowSize = timeRangeMonths ? Number(timeRangeMonths) : 999;

  useAbortableEffect(
    async (signal, isActive) => {
      const nightsCode = NIGHTS_CODE[residency] ?? "OCC_NI";
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Independent queries — run concurrently instead of two sequential
        // round-trips.
        const [purposeData, durationData] = await Promise.all([
          fetchTableData(
            MAJUTUS_PATH,
            "TU133.PX",
            [
              { code: "Näitaja", selection: { filter: "item", values: [nightsCode] } },
              { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
              { code: "Reisi eesmärk", selection: { filter: "item", values: PURPOSE_CODES } },
              { code: "Vaatlusperiood", selection: { filter: "top", values: [String(windowSize)] } },
            ],
            { signal }
          ),
          fetchTableData(
            REISIMINE_PATH,
            "TU54.PX",
            [
              { code: "Näitaja", selection: { filter: "item", values: ["TR_DOM", "TR_OUT"] } },
              {
                code: "Reisi kestus",
                selection: { filter: "item", values: ["N1-3", "N4-7", "N_GT7"] },
              },
              { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
            ],
            { signal }
          ),
        ]);

        const purposeRows = flattenToRows(purposeData);
        const byMonth = new Map();
        for (const row of purposeRows) {
          const key = row.Vaatlusperiood;
          if (!byMonth.has(key)) byMonth.set(key, { x: row.Vaatlusperiood_label });
          byMonth.get(key)[row["Reisi eesmärk_label"]] = row.value;
        }
        const monthKeys = Array.from(byMonth.keys()).sort();
        const purposeChart = monthKeys.map((m) => byMonth.get(m));
        const purposeNames = Array.from(
          new Set(purposeRows.map((r) => r["Reisi eesmärk_label"]))
        );

        // Dominant purpose across the whole window, for the hero stat.
        const purposeTotals = new Map();
        for (const row of purposeRows) {
          const name = row["Reisi eesmärk_label"];
          purposeTotals.set(name, (purposeTotals.get(name) ?? 0) + (row.value ?? 0));
        }
        const purposeGrandTotal = Array.from(purposeTotals.values()).reduce((a, b) => a + b, 0);
        let topPurpose = null;
        for (const [name, value] of purposeTotals) {
          if (!topPurpose || value > topPurpose.value) topPurpose = { name, value };
        }
        const topPurposeShare =
          topPurpose && purposeGrandTotal ? (topPurpose.value / purposeGrandTotal) * 100 : null;

        const durationRows = flattenToRows(durationData);
        const byDuration = new Map();
        for (const row of durationRows) {
          const key = row["Reisi kestus_label"];
          if (!byDuration.has(key)) byDuration.set(key, { x: key });
          byDuration.get(key)[NAITAJA_SHORT[row.Näitaja] ?? row.Näitaja] = row.value;
        }
        const durationChart = DURATION_ORDER.map((d) => byDuration.get(d)).filter(Boolean);
        const durationLatestLabel = durationRows[0]?.Vaatlusperiood_label ?? "";

        if (isActive()) {
          setState({
            data: {
              purposeChart,
              purposeNames,
              topPurpose,
              topPurposeShare,
              durationChart,
              durationLatestLabel,
              windowSize: monthKeys.length,
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
    [residency, timeRangeMonths]
  );

  if (!state.data && state.loading) return <div className="panel-status">Laen…</div>;
  if (!state.data && state.error)
    return <div className="panel-error">Andmete laadimine ebaõnnestus: {state.error}</div>;

  const title = RESIDENCY_TITLE[residency] ?? RESIDENCY_TITLE.all;
  const { data } = state;

  return (
    <div className={"dashboard" + (state.loading ? " refetching" : "")}>
      <SectionFilters
        showTimeRange
        showResidency
        residency={residency}
        onResidencyChange={setResidency}
        timeRangeMonths={timeRangeMonths}
        onTimeRangeChange={setTimeRangeMonths}
      />

      {data.topPurpose && (
        <div className="hero-card">
          <div className="hero-label">Peamine reisieesmärk</div>
          <div className="hero-number hero-number-text">{data.topPurpose.name}</div>
          {data.topPurposeShare !== null && (
            <div className="hero-caption">
              {data.topPurposeShare.toFixed(0)}% kõigist ööbimistest selle akna jooksul
            </div>
          )}
        </div>
      )}

      <div className="data-card">
        <h3>
          {title} reisi eesmärgi järgi (viimased {data.windowSize} kuud)
        </h3>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={data.purposeChart}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            {data.purposeNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stackId="1"
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.75}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="data-card">
        <h3>Reisi kestus, sise- vs. välisreisid ({data.durationLatestLabel})</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.durationChart} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 12, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Bar dataKey="Sisereisid" fill={DOMESTIC_COLOR} isAnimationActive={false} />
            <Bar dataKey="Välisreisid" fill={FOREIGN_COLOR} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(Page3Purpose);
