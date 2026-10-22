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
  PieChart,
  Pie,
  LabelList,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import TableSource from "./TableSource";
import DataGrid from "./DataGrid";
import { LineEndLabel, lastPointDot, endLabelOffsets } from "./ChartLabels";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { formatNumber } from "../i18n/format";
import { CHART_COLORS, CHART_GRID_COLOR, CHART_AXIS_COLOR, ALERT_COLOR, POSITIVE_COLOR } from "../theme";
import {
  computeRevenueSeries,
  computeIndexedSeries,
  computeEnterpriseCounts,
  computeHotelsVsOther,
  computeCostStructure,
  computeLatestRevenue,
  computeRevenueGrowth,
  computeGrowthHighlights,
  computeWageComparison,
  computeLatestKpis,
  buildRevenueInsight,
  buildBusinessInsight,
  buildGrowthInsight,
  buildWageInsight,
  buildCostInsight,
} from "../lib/accommodationSector.js";

// Fixed display order for EM001's 6 cost categories, paired 1:1 with
// CHART_COLORS[0..5] — matches computeCostStructure's own field order and
// the costCategories i18n labels.
const COST_KEYS = ["personnel", "resale", "materials", "energy", "rent", "other"];

const EM001_PATH = ["majandus", "ettevetete-majandusnaitajad", "ettevetete-tulud-kulud-kasum", "aastastatistika"];
const TU410_PATH = ["majandus", "turism-ja-majutus", "turismi-ja-majutuse-majandusnaitajad"];
const PA113_PATH = ["majandus", "palk-ja-toojeukulu", "palk", "luhiajastatistika"];

const EM001_ID = "EM001.PX";
const TU410_ID = "TU410.PX";
const PA113_ID = "PA113.px";

// Static — none of these queries depend on component state, so they're
// built once at module scope instead of re-created every render.
const EM001_QUERY = [
  {
    code: "Näitaja",
    selection: {
      filter: "item",
      values: ["V12110", "V11110", "CUB_C_705", "V13310", "CUB_C_100_110_120", "CUB_C_210", "CUB_C_400_410_420", "V13411"],
    },
  },
  { code: "Tegevusala", selection: { filter: "item", values: ["I55", "I551", "I552", "I553", "I559"] } },
  { code: "Tööga hõivatud isikute arv", selection: { filter: "item", values: ["TOTAL"] } },
  // EM001 has 20 annual periods; 24 safely covers all of them.
  { code: "Vaatlusperiood", selection: { filter: "top", values: ["24"] } },
];

const TU410_QUERY = [
  { code: "Näitaja", selection: { filter: "item", values: ["CUB_SERV", "CUB_SM"] } },
  { code: "Teenuse liik", selection: { filter: "item", values: ["I55"] } },
  // Last 16 quarters (~4 years) — enough for Task 6's growth chart plus the latest KPI.
  { code: "Vaatlusperiood", selection: { filter: "top", values: ["16"] } },
];

const PA113_QUERY = [
  { code: "Näitaja", selection: { filter: "item", values: ["GR_W_AVG"] } },
  { code: "Tegevusala", selection: { filter: "item", values: ["I55", "TOTAL"] } },
  // PA113 has 22 quarterly periods; 24 safely covers all of them.
  { code: "Vaatlusperiood", selection: { filter: "top", values: ["24"] } },
];

function lastOf(arr) {
  return arr?.length ? arr[arr.length - 1] : null;
}

// One short computed-insight sentence, styled like the AI-narrative blurbs
// elsewhere on the site (same card/text classes) but without the "AI-written"
// caption — this section's insight sentences are deterministic, not
// AI-generated (see the design doc).
function InsightNote({ text }) {
  if (!text) return null;
  return (
    <div className="narrative-card">
      <p className="narrative-text">{text}</p>
    </div>
  );
}

// Expandable raw-values table: the same show/hide-children toggle button
// convention Sidebar.jsx already uses for its folder tree, paired with
// DataGrid (already used by TableView.jsx for exactly this "all raw rows,
// sortable" job) instead of a hand-rolled table.
function ExpandableTable({ rows, label }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button type="button" className="table-toggle" onClick={() => setExpanded((e) => !e)}>
        {expanded ? "▾" : "▸"} {label}
      </button>
      {expanded && <DataGrid rows={rows} />}
    </div>
  );
}

const axisTick = { fontSize: 11, fill: CHART_AXIS_COLOR };
const axisLine = { stroke: CHART_GRID_COLOR };

// Memoized — see Dashboard.jsx for why.
function Page7AccommodationSector() {
  const { t, locale } = useTranslation();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [indexed, setIndexed] = useState(false);
  const [costHistoryExpanded, setCostHistoryExpanded] = useState(false);

  useAbortableEffect(
    async (signal, isActive) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        // Independent queries (3 different tables) — run concurrently
        // instead of paying for three sequential round-trips.
        const [em001Data, tu410Data, pa113Data] = await Promise.all([
          fetchTableData(EM001_PATH, EM001_ID, EM001_QUERY, { signal, locale }),
          fetchTableData(TU410_PATH, TU410_ID, TU410_QUERY, { signal, locale }),
          fetchTableData(PA113_PATH, PA113_ID, PA113_QUERY, { signal, locale }),
        ]);

        const em001Rows = flattenToRows(em001Data);
        const tu410Rows = flattenToRows(tu410Data);
        const pa113Rows = flattenToRows(pa113Data);

        const revenueSeries = computeRevenueSeries(em001Rows);
        const enterpriseCounts = computeEnterpriseCounts(em001Rows);
        const hotelsVsOther = computeHotelsVsOther(em001Rows);

        const latestRevenue = computeLatestRevenue(tu410Rows);
        // Stored separately from growthHighlights — Module 3's bar chart
        // needs the full series, while the highlights only summarize it.
        const growthSeries = computeRevenueGrowth(tu410Rows);
        const growthHighlights = computeGrowthHighlights(growthSeries);
        const wageComparison = computeWageComparison(pa113Rows);

        const kpis = computeLatestKpis({ latestRevenue, growthHighlights, enterpriseCounts, wageComparison });

        if (isActive()) {
          setState({
            data: {
              em001Rows,
              revenueSeries,
              enterpriseCounts,
              hotelsVsOther,
              latestRevenue,
              growthSeries,
              growthHighlights,
              wageComparison,
              kpis,
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
    [locale]
  );

  // EM001's turnover is in thousand euros (its native unit) — converted to
  // million euros here for display, reused by both Module 1's line chart and
  // Module 2's bar chart (same series, two chart types).
  const revenueChartData = useMemo(
    () => (state.data ? state.data.revenueSeries.map((p) => ({ year: p.year, value: p.value / 1000 })) : []),
    [state.data]
  );
  // Indexing is unit-invariant, so this runs on the un-converted (thousand-€)
  // series straight from the lib — the ratio to the 2011 base year is
  // identical either way.
  const indexedChartData = useMemo(
    () => (state.data ? computeIndexedSeries(state.data.revenueSeries, "2011") : []),
    [state.data]
  );
  // The EM001 rows both Module 1 and Module 2's charts are built from
  // (revenue series, enterprise counts, hotels-vs-other split) — one
  // combined expandable table covers all three instead of a separate table
  // per module, since they're all slices of the same source table.
  const combinedRawRows = useMemo(
    () =>
      state.data
        ? state.data.em001Rows.filter(
            (r) =>
              (r.Näitaja === "V12110" || r.Näitaja === "V11110") &&
              ["I55", "I551", "I552", "I553", "I559"].includes(r.Tegevusala)
          )
        : [],
    [state.data]
  );

  if (!state.data && state.loading) return <div className="panel-status">{t("common.loading")}</div>;
  if (!state.data && state.error) return <div className="panel-error">{t("common.loadError", state.error)}</div>;

  const { data } = state;
  const { kpis } = data;
  const latestEnterprise = lastOf(data.enterpriseCounts);
  const latestWage = lastOf(data.wageComparison);
  // Each KPI tile shows the period of ITS OWN source, not a shared "as of"
  // date — EM001 is annual, TU410/PA113 are quarterly, so these can and do
  // differ (see the design doc's "never imply the same reporting period"
  // rule). The human-readable label comes straight from the already-computed
  // intermediate result (Statistikaamet's own Vaatlusperiood_label), not a
  // locally-reformatted period code.
  const periodLabels = {
    revenue: data.latestRevenue?.label ?? null,
    revenueYoy: data.growthHighlights?.latest?.label ?? null,
    businessCount: latestEnterprise?.year ?? null,
    avgWage: latestWage?.label ?? null,
  };

  const revenueInsight = buildRevenueInsight(data.latestRevenue, data.growthHighlights, locale);
  const businessInsight = buildBusinessInsight(data.enterpriseCounts, data.hotelsVsOther, locale);

  const activeRevenueChartData = indexed ? indexedChartData : revenueChartData;
  const activeRevenueDataKey = indexed ? "index" : "value";

  // Module 3: Growth.
  const { latest: latestGrowth, strongestIncrease, strongestDecline } = data.growthHighlights ?? {};
  const growthInsight = buildGrowthInsight(data.growthHighlights, locale);

  // Module 4: Wages. Which series (accommodation vs. the Estonia-wide
  // average) is ahead varies by period — no guaranteed ordering — so the
  // two end labels' placement is decided from the actual last values, the
  // same endLabelOffsets convention Page4Residents.jsx/Page2Map.jsx use.
  const wageInsight = buildWageInsight(data.wageComparison, locale);
  const wageEndDy = endLabelOffsets(latestWage?.accommodation, latestWage?.allActivities);

  // Module 5: Cost structure. EM001's cost-breakdown indicators are fetched
  // for every year revenueSeries covers, so the latest revenueSeries year
  // is also the latest year with a full cost breakdown.
  const latestEM001Year = lastOf(data.revenueSeries)?.year ?? null;
  const costStructure = latestEM001Year ? computeCostStructure(data.em001Rows, latestEM001Year) : null;
  const costInsight = buildCostInsight(costStructure, locale);
  const costChartData = costStructure
    ? COST_KEYS.map((key) => ({ key, name: t(`accommodationSector.costCategories.${key}`), value: costStructure[key] / 1000 }))
    : [];
  // Optional stacked-over-time view (expandable, not a second always-visible
  // chart) — reuses computeCostStructure per revenueSeries year instead of
  // re-deriving which years have cost data from scratch.
  const costHistoryChart = data.revenueSeries
    .map((p) => {
      const cs = computeCostStructure(data.em001Rows, p.year);
      if (!cs) return null;
      const row = { year: p.year };
      COST_KEYS.forEach((key) => {
        row[key] = cs[key] / 1000;
      });
      return row;
    })
    .filter(Boolean);

  return (
    <div className={"dashboard" + (state.loading ? " refetching" : "")}>
      <p className="operator-intro">{t("accommodationSector.subheading")}</p>
      <p className="operator-footnote">{t("accommodationSector.nationalOnlyNote")}</p>

      <div className="tile-row">
        <div className="stat-tile">
          <div className="tile-label">
            {t("accommodationSector.kpi.revenue")}
            {periodLabels.revenue ? ` — ${periodLabels.revenue}` : ""}
          </div>
          <div className="tile-number">
            {kpis.revenue ? `${formatNumber(kpis.revenue.value, locale, { maximumFractionDigits: 1 })} mln €` : "—"}
          </div>
        </div>

        <div className="stat-tile">
          <div className="tile-label">
            {t("accommodationSector.kpi.revenueYoy")}
            {periodLabels.revenueYoy ? ` — ${periodLabels.revenueYoy}` : ""}
          </div>
          <div
            className={
              "tile-number " + (kpis.revenueYoy ? (kpis.revenueYoy.value >= 0 ? "delta-up-text" : "delta-down-text") : "")
            }
          >
            {kpis.revenueYoy
              ? `${kpis.revenueYoy.value >= 0 ? "▲" : "▼"} ${formatNumber(Math.abs(kpis.revenueYoy.value), locale, { maximumFractionDigits: 1 })}%`
              : "—"}
          </div>
        </div>

        <div className="stat-tile">
          <div className="tile-label">
            {t("accommodationSector.kpi.businesses")}
            {periodLabels.businessCount ? ` — ${periodLabels.businessCount}` : ""}
          </div>
          <div className="tile-number">{kpis.businessCount ? formatNumber(kpis.businessCount.value, locale) : "—"}</div>
        </div>

        <div className="stat-tile">
          <div className="tile-label">
            {t("accommodationSector.kpi.avgWage")}
            {periodLabels.avgWage ? ` — ${periodLabels.avgWage}` : ""}
          </div>
          <div className="tile-number">
            {kpis.avgWage ? `${formatNumber(kpis.avgWage.value, locale, { maximumFractionDigits: 0 })} €` : "—"}
          </div>
        </div>
      </div>

      {/* Module 1: Revenue */}
      <div className="data-card">
        <h3>{t("accommodationSector.revenueHeading")}</h3>
        <InsightNote text={revenueInsight} />

        <div className="operator-controls">
          <div className="operator-control">
            <div className="pill-tabs">
              <button
                type="button"
                className={"pill-tab" + (indexed ? " active" : "")}
                aria-pressed={indexed}
                onClick={() => setIndexed((v) => !v)}
              >
                {t("accommodationSector.revenueIndexToggle")}
              </button>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={activeRevenueChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="year" tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
            <YAxis tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
            <Tooltip content={<ChartTooltip locale={locale} unit={indexed ? undefined : "mln €"} />} />
            <Line
              type="monotone"
              dataKey={activeRevenueDataKey}
              stroke={CHART_COLORS[0]}
              dot={lastPointDot(CHART_COLORS[0], activeRevenueChartData.length)}
              isAnimationActive={false}
            >
              <LabelList
                dataKey={activeRevenueDataKey}
                content={(props) => (
                  <LineEndLabel
                    {...props}
                    dataLength={activeRevenueChartData.length}
                    formatter={(v) =>
                      indexed
                        ? formatNumber(v, locale, { maximumFractionDigits: 0 })
                        : `${formatNumber(v, locale, { maximumFractionDigits: 1 })} mln €`
                    }
                  />
                )}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
        <TableSource path={EM001_PATH} ids={[EM001_ID]} />
      </div>

      {/* Module 2: Businesses and turnover */}
      <div className="data-card">
        <h3>{t("accommodationSector.businessesHeading")}</h3>
        <InsightNote text={businessInsight} />

        <div className="tile-row-split">
          <div>
            <div className="hero-label">{t("accommodationSector.kpi.revenue")}</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }} axisLine={axisLine} tickLine={axisLine} />
                <YAxis tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
                <Tooltip content={<ChartTooltip locale={locale} unit="mln €" />} />
                <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="hero-label">{t("accommodationSector.kpi.businesses")}</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.enterpriseCounts} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }} axisLine={axisLine} tickLine={axisLine} />
                <YAxis tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
                <Tooltip content={<ChartTooltip locale={locale} />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLORS[2]}
                  dot={lastPointDot(CHART_COLORS[2], data.enterpriseCounts.length)}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="count"
                    content={(props) => (
                      <LineEndLabel {...props} dataLength={data.enterpriseCounts.length} formatter={(v) => formatNumber(v, locale)} />
                    )}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.hotelsVsOther} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }} axisLine={axisLine} tickLine={axisLine} />
            <YAxis tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
            <Tooltip content={<ChartTooltip locale={locale} />} />
            <Legend />
            <Bar dataKey="hotels" name={t("accommodationSector.hotels")} stackId="hv" fill={CHART_COLORS[0]} isAnimationActive={false} />
            <Bar
              dataKey="other"
              name={t("accommodationSector.otherAccommodation")}
              stackId="hv"
              fill={CHART_COLORS[1]}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>

        <TableSource path={EM001_PATH} ids={[EM001_ID]} />
        <ExpandableTable rows={combinedRawRows} label={t("accommodationSector.showDataTable")} />
      </div>

      {/* Module 3: Growth */}
      <div className="data-card">
        <h3>{t("accommodationSector.growthHeading")}</h3>
        <InsightNote text={growthInsight} />

        <div className="tile-row">
          <div>
            <div className="tile-label">
              {t("accommodationSector.growthLatest")}
              {latestGrowth?.label ? ` — ${latestGrowth.label}` : ""}
            </div>
            <div className={"tile-delta " + (latestGrowth ? (latestGrowth.pct >= 0 ? "delta-up-text" : "delta-down-text") : "")}>
              {latestGrowth
                ? `${latestGrowth.pct >= 0 ? "▲" : "▼"} ${formatNumber(Math.abs(latestGrowth.pct), locale, { maximumFractionDigits: 1 })}%`
                : "—"}
            </div>
          </div>
          <div>
            <div className="tile-label">
              {t("accommodationSector.growthStrongestIncrease")}
              {strongestIncrease?.label ? ` — ${strongestIncrease.label}` : ""}
            </div>
            <div className={"tile-delta " + (strongestIncrease ? "delta-up-text" : "")}>
              {strongestIncrease ? `▲ ${formatNumber(strongestIncrease.pct, locale, { maximumFractionDigits: 1 })}%` : "—"}
            </div>
          </div>
          <div>
            <div className="tile-label">
              {t("accommodationSector.growthStrongestDecline")}
              {strongestDecline?.label ? ` — ${strongestDecline.label}` : ""}
            </div>
            <div className={"tile-delta " + (strongestDecline ? "delta-down-text" : "")}>
              {strongestDecline
                ? `▼ ${formatNumber(Math.abs(strongestDecline.pct), locale, { maximumFractionDigits: 1 })}%`
                : "—"}
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.growthSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }}
              axisLine={axisLine}
              tickLine={axisLine}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis tick={axisTick} axisLine={axisLine} tickLine={axisLine} unit="%" />
            <Tooltip content={<ChartTooltip locale={locale} unit="%" />} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.growthSeries.map((p) => (
                <Cell key={p.period} fill={p.pct >= 0 ? POSITIVE_COLOR : ALERT_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <TableSource path={TU410_PATH} ids={[TU410_ID]} />
      </div>

      {/* Module 4: Wages */}
      <div className="data-card">
        <h3>{t("accommodationSector.wagesHeading")}</h3>
        <InsightNote text={wageInsight} />

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.wageComparison} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }}
              axisLine={axisLine}
              tickLine={axisLine}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis tick={axisTick} axisLine={axisLine} tickLine={axisLine} unit="€" />
            <Tooltip content={<ChartTooltip locale={locale} unit="€" />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="accommodation"
              name={t("accommodationSector.wagesAccommodation")}
              stroke={CHART_COLORS[0]}
              dot={lastPointDot(CHART_COLORS[0], data.wageComparison.length)}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="accommodation"
                content={(props) => (
                  <LineEndLabel
                    {...props}
                    dataLength={data.wageComparison.length}
                    formatter={(v) => `${formatNumber(v, locale, { maximumFractionDigits: 0 })} €`}
                    dy={wageEndDy[0]}
                  />
                )}
              />
            </Line>
            <Line
              type="monotone"
              dataKey="allActivities"
              name={t("accommodationSector.wagesAllActivities")}
              stroke={CHART_COLORS[2]}
              dot={lastPointDot(CHART_COLORS[2], data.wageComparison.length)}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="allActivities"
                content={(props) => (
                  <LineEndLabel
                    {...props}
                    dataLength={data.wageComparison.length}
                    formatter={(v) => `${formatNumber(v, locale, { maximumFractionDigits: 0 })} €`}
                    dy={wageEndDy[1]}
                  />
                )}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
        <TableSource path={PA113_PATH} ids={[PA113_ID]} />
      </div>

      {/* Module 5: Cost structure */}
      <div className="data-card">
        <h3>
          {t("accommodationSector.costHeading")}
          {latestEM001Year ? ` — ${latestEM001Year}` : ""}
        </h3>
        <InsightNote text={costInsight} />

        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Tooltip content={<ChartTooltip locale={locale} unit="mln €" />} />
            <Legend />
            <Pie
              data={costChartData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {costChartData.map((entry, i) => (
                <Cell key={entry.key} fill={CHART_COLORS[i]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <TableSource path={EM001_PATH} ids={[EM001_ID]} />

        {costHistoryChart.length > 1 && (
          <div>
            <button
              type="button"
              className="table-toggle"
              onClick={() => setCostHistoryExpanded((e) => !e)}
            >
              {costHistoryExpanded ? "▾" : "▸"} {t("accommodationSector.costHistoryToggle")}
            </button>
            {costHistoryExpanded && (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={costHistoryChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }} axisLine={axisLine} tickLine={axisLine} />
                  <YAxis tick={axisTick} axisLine={axisLine} tickLine={axisLine} />
                  <Tooltip content={<ChartTooltip locale={locale} unit="mln €" />} />
                  <Legend />
                  {COST_KEYS.map((key, i) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={t(`accommodationSector.costCategories.${key}`)}
                      stackId="cost"
                      fill={CHART_COLORS[i]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Page7AccommodationSector);
