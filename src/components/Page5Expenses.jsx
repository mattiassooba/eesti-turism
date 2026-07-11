import { memo, useState } from "react";
import { fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import RankedBarList from "./RankedBarList";
import TableSource from "./TableSource";
import { CHART_COLORS, CHART_GRID_COLOR, CHART_AXIS_COLOR } from "../theme";

const REISIMINE_PATH = ["majandus", "turism-ja-majutus", "eesti-elanike-reisimine"];

const TIME_RANGE_OPTIONS = [
  { value: "12", label: "12 kuud" },
  { value: "24", label: "24 kuud" },
  { value: "60", label: "5 aastat" },
  { value: "all", label: "Kõik aeg" },
];

const COST_TYPE_TABS = [
  { key: "SUM_EXP", label: "Kogukulu" },
  { key: "AVG_EXP_TRP", label: "Keskmine kulu reisi kohta" },
  { key: "AVG_EXP_NGT", label: "Keskmine kulu öö kohta" },
];

const COST_TYPE_HERO_LABEL = {
  SUM_EXP: "Sisereiside kulutused kokku",
  AVG_EXP_TRP: "Keskmine kulu reisi kohta",
  AVG_EXP_NGT: "Keskmine kulu öö kohta",
};

// Näitaja codes in TU552, in the order the breakdown chart should consider
// them before sorting by value.
const CATEGORY_LABELS = {
  EXP_TRA: "Transport",
  EXP_ACC: "Majutus",
  EXP_REST: "Toit ja jook",
  EXP_OTH: "Muu (meelelahutus, ostud, teenused)",
};

// Memoized — see Dashboard.jsx for why.
function Page5Expenses() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [timeRangeMonths, setTimeRangeMonths] = useState("24");
  const [costType, setCostType] = useState("AVG_EXP_TRP");
  // TU56's periods are quarterly, but the time-range control is defined in
  // months (shared UI language with the rest of the app) — convert here.
  const quarters = timeRangeMonths ? Math.max(Math.ceil(Number(timeRangeMonths) / 3), 4) : 999;

  useAbortableEffect(
    async (signal, isActive) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Independent queries — run concurrently instead of two sequential
        // round-trips.
        const [purposeData, categoryData] = await Promise.all([
          fetchTableData(
            REISIMINE_PATH,
            "TU56.PX",
            [
              { code: "Näitaja", selection: { filter: "item", values: ["EXP_DOM"] } },
              {
                code: "Reisi eesmärk",
                selection: { filter: "item", values: ["PROF", "PERS_HOL", "PERS_VFR", "PERS_OTH"] },
              },
              { code: "Vaatlusperiood", selection: { filter: "top", values: [String(quarters)] } },
            ],
            { signal }
          ),
          fetchTableData(
            REISIMINE_PATH,
            "TU552.px",
            [
              {
                code: "Näitaja",
                selection: {
                  filter: "item",
                  values: ["EXP", "EXP_TRA", "EXP_ACC", "EXP_REST", "EXP_OTH"],
                },
              },
              { code: "Kulu tüüp", selection: { filter: "item", values: [costType] } },
              { code: "Reisi tüüp", selection: { filter: "item", values: ["DOM"] } },
              { code: "Vaatlusperiood", selection: { filter: "top", values: ["2"] } },
            ],
            { signal }
          ),
        ]);

        const purposeRows = flattenToRows(purposeData);
        const byQuarter = new Map();
        for (const row of purposeRows) {
          const key = row.Vaatlusperiood;
          if (!byQuarter.has(key)) byQuarter.set(key, { x: row.Vaatlusperiood_label });
          byQuarter.get(key)[row["Reisi eesmärk_label"]] = row.value;
        }
        const quarterKeys = Array.from(byQuarter.keys()).sort();
        const purposeChart = quarterKeys.map((k) => byQuarter.get(k));
        const purposeNames = Array.from(new Set(purposeRows.map((r) => r["Reisi eesmärk_label"])));

        const categoryRows = flattenToRows(categoryData);
        const byYear = new Map();
        for (const row of categoryRows) {
          if (!byYear.has(row.Vaatlusperiood)) byYear.set(row.Vaatlusperiood, {});
          byYear.get(row.Vaatlusperiood)[row.Näitaja] = row.value;
        }
        const years = Array.from(byYear.keys()).sort();
        const latestYear = years[years.length - 1];
        const prevYear = years[years.length - 2];
        const latestValues = byYear.get(latestYear) ?? {};
        const prevValues = prevYear ? byYear.get(prevYear) : null;

        const heroValue = latestValues.EXP ?? 0;
        const heroDelta =
          prevValues && prevValues.EXP
            ? { pct: ((heroValue - prevValues.EXP) / prevValues.EXP) * 100, label: `vs ${prevYear}` }
            : null;

        // SUM_EXP is a national aggregate (hundreds of millions of euros) —
        // scale it down for a readable hero/bar number. The two averages are
        // already human-scale (tens to hundreds of euros).
        const categoryScale = costType === "SUM_EXP" ? 1_000_000 : 1;
        const categoryUnit = costType === "SUM_EXP" ? "mln €" : "€";
        const breakdown = Object.entries(CATEGORY_LABELS)
          .map(([code, label]) => ({
            label,
            value:
              costType === "SUM_EXP"
                ? Math.round(((latestValues[code] ?? 0) / categoryScale) * 10) / 10
                : Math.round(latestValues[code] ?? 0),
          }))
          .sort((a, b) => b.value - a.value);

        if (isActive()) {
          setState({
            data: {
              purposeChart,
              purposeNames,
              quarters: quarterKeys.length,
              heroValue,
              heroDelta,
              latestYear,
              breakdown,
              categoryUnit,
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
    [quarters, costType]
  );

  if (!state.data && state.loading) return <div className="panel-status">Laen…</div>;
  if (!state.data && state.error)
    return <div className="panel-error">Andmete laadimine ebaõnnestus: {state.error}</div>;

  const { data } = state;

  function deltaText(delta) {
    if (!delta) return null;
    return `${delta.pct >= 0 ? "▲" : "▼"} ${Math.abs(delta.pct).toFixed(1)}% ${delta.label}`;
  }

  function formatHeroValue(value) {
    if (costType === "SUM_EXP") {
      return `${(value / 1_000_000).toLocaleString("et-EE", { maximumFractionDigits: 1 })} mln €`;
    }
    return `${Math.round(value).toLocaleString("et-EE")} €`;
  }

  return (
    <div className={"dashboard" + (state.loading ? " refetching" : "")}>
      <div className="operator-controls">
        <label className="operator-control">
          <span>Ajavahemik</span>
          <select
            value={timeRangeMonths ?? "all"}
            onChange={(e) => setTimeRangeMonths(e.target.value === "all" ? null : e.target.value)}
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="operator-control">
          <span>Kulu tüüp</span>
          <div className="pill-tabs">
            {COST_TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                className={"pill-tab" + (costType === tab.key ? " active" : "")}
                onClick={() => setCostType(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-card">
        <div className="hero-label">
          {COST_TYPE_HERO_LABEL[costType]} · {data.latestYear}
        </div>
        <div className="hero-number">{formatHeroValue(data.heroValue)}</div>
        {data.heroDelta && (
          <div className={"hero-delta " + (data.heroDelta.pct >= 0 ? "delta-up" : "delta-down")}>
            {deltaText(data.heroDelta)}
          </div>
        )}
        <TableSource path={REISIMINE_PATH} ids={["TU552.px"]} dark />
      </div>

      <div className="data-card">
        <h3>Sisereiside kulutused eesmärgi järgi (eurot, viimased {data.quarters} kvartalit)</h3>
        <ResponsiveContainer width="100%" height={320}>
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
            <Tooltip content={<ChartTooltip unit="€" />} />
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
        <TableSource path={REISIMINE_PATH} ids={["TU56.PX"]} />
      </div>

      <div className="data-card">
        <h3>Kulutuste jaotus liigi järgi ({data.latestYear})</h3>
        <RankedBarList items={data.breakdown} unit={data.categoryUnit} />
        <TableSource path={REISIMINE_PATH} ids={["TU552.px"]} />
      </div>
    </div>
  );
}

export default memo(Page5Expenses);
