import { memo, useMemo, useState } from "react";
import { fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { LineEndLabel, lastPointDot } from "./ChartLabels";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { formatNumber } from "../i18n/format";
import { CHART_COLORS, CHART_GRID_COLOR, CHART_AXIS_COLOR } from "../theme";
import {
  computeRevenueSeries,
  computeIndexedSeries,
  computeEnterpriseCounts,
  computeHotelsVsOther,
  computeLatestRevenue,
  computeRevenueGrowth,
  computeGrowthHighlights,
  computeWageComparison,
  computeLatestKpis,
  buildRevenueInsight,
  buildBusinessInsight,
} from "../lib/accommodationSector.js";

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
        const growthHighlights = computeGrowthHighlights(computeRevenueGrowth(tu410Rows));
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
  // The exact EM001 rows Module 1's chart is built from, for its expandable
  // raw-data table.
  const revenueRawRows = useMemo(
    () => (state.data ? state.data.em001Rows.filter((r) => r.Näitaja === "V12110" && r.Tegevusala === "I55") : []),
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

  return (
    <div className={"dashboard" + (state.loading ? " refetching" : "")}>
      <h2>{t("accommodationSector.heading")}</h2>
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
        <ExpandableTable rows={revenueRawRows} label={t("accommodationSector.showDataTable")} />
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
      </div>
    </div>
  );
}

export default memo(Page7AccommodationSector);
