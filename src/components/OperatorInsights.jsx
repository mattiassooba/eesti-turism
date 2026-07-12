import { memo, useMemo, useState } from "react";
import { fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import RankedBarList from "./RankedBarList";
import TableSource from "./TableSource";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { formatNumber } from "../i18n/format";
import { COUNTIES, CITIES } from "../data/counties";
import { CHART_COLORS, FOREIGN_COLOR, CHART_GRID_COLOR, CHART_AXIS_COLOR } from "../theme";

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];

// The 15 real maakonds plus the 3 major cities Statistikaamet breaks out
// separately (each is a subset of its own maakond, e.g. Tallinn sits inside
// Harju) — offered together in one selector since an operator may want
// either granularity, matching how Statistikaamet itself publishes both.
const REGION_CODES = [...COUNTIES, ...CITIES].map((c) => c.code);

const RESIDENCY_CODE = { all: "WORLD", domestic: "EE", foreign: "FOR" };

function yoy(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function fmtInt(n, locale) {
  return n == null ? "—" : formatNumber(Math.round(n), locale);
}
function fmtPct(n, digits = 1) {
  return n == null ? "—" : `${n.toFixed(digits)}%`;
}
function fmtEur(n) {
  return n == null ? "—" : `${n.toFixed(2)} €`;
}
function fmtDelta(n) {
  if (n == null) return "—";
  return `${n >= 0 ? "▲" : "▼"} ${Math.abs(n).toFixed(1)}%`;
}
function deltaClass(n) {
  if (n == null) return "";
  return n >= 0 ? "delta-up-text" : "delta-down-text";
}

// Sums `field` across `periods` for one region, skipping suppressed
// (null) cells rather than treating them as zero — same rule the rest of
// the app follows to avoid misreporting withheld data as "confirmed zero".
function sumField(periodMap, periods) {
  if (!periodMap) return null;
  let sum = 0;
  let any = false;
  for (const p of periods) {
    const v = periodMap.get(p);
    if (v != null) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : null;
}

// CAP_ESTA/CAP_BEDR are stock counts (how many establishments/rooms exist
// right now), so an annual figure should be the latest month's value, not
// a sum. OCC_OR_BEDR/OCC_NI_COST are rates, so a simple average across the
// year's available months approximates the annual figure.
function avgAndLast(capByPeriod, periods, field) {
  if (!capByPeriod) return { avg: null, last: null };
  let sum = 0;
  let count = 0;
  let last = null;
  for (const p of periods) {
    const v = capByPeriod.get(p)?.[field];
    if (v != null) {
      sum += v;
      count++;
      last = v;
    }
  }
  return { avg: count ? sum / count : null, last };
}

// Memoized — takes no props, so on a page where an unrelated ancestor
// state update (e.g. scroll-driven active-tab tracking) triggers frequent
// re-renders, this large table+chart section has zero reason to ever
// re-render in response.
function OperatorInsights() {
  const { t, locale } = useTranslation();
  const REGION_LABELS = useMemo(
    () => Object.fromEntries([...COUNTIES, ...CITIES].map((c) => [c.code, c[locale]])),
    [locale]
  );
  const ORIGIN_COUNTRY_LABELS = t("codes.country");
  const RESIDENCY_TABS = [
    { key: "all", label: t("filters.residencyAll") },
    { key: "domestic", label: t("filters.residencyDomestic") },
    { key: "foreign", label: t("filters.residencyForeign") },
  ];
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [region, setRegion] = useState("EE00370000000000");
  const [residency, setResidency] = useState("all");
  const [yearsToShow, setYearsToShow] = useState(10);
  const [origins, setOrigins] = useState({ data: null, loading: true, error: null });

  // Independent of region/residency/yearsToShow — those are all applied
  // client-side to this one broad fetch, so switching them never refetches
  // (locale still does, since translated labels come from this same fetch).
  useAbortableEffect(
    async (signal, isActive) => {
      try {
        const [guestData, capData] = await Promise.all([
          fetchTableData(
            MAJUTUS_PATH,
            "TU131.PX",
            [
              { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
              { code: "Maakond", selection: { filter: "item", values: ["EE", ...REGION_CODES] } },
              {
                code: "Elukohariik",
                selection: { filter: "item", values: ["WORLD", "EE", "FOR"] },
              },
              { code: "Vaatlusperiood", selection: { filter: "top", values: ["256"] } },
            ],
            { signal, locale }
          ),
          fetchTableData(
            MAJUTUS_PATH,
            "TU122.PX",
            [
              {
                code: "Näitaja",
                selection: { filter: "item", values: ["CAP_ESTA", "CAP_BEDR", "OCC_OR_BEDR", "OCC_NI_COST"] },
              },
              { code: "Maakond", selection: { filter: "item", values: ["EE", ...REGION_CODES] } },
              { code: "Vaatlusperiood", selection: { filter: "top", values: ["256"] } },
            ],
            { signal, locale }
          ),
        ]);

        if (isActive()) {
          setState({
            data: { guestRows: flattenToRows(guestData), capRows: flattenToRows(capData) },
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

  useAbortableEffect(
    async (signal, isActive) => {
      setOrigins((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const originData = await fetchTableData(
          MAJUTUS_PATH,
          "TU131.PX",
          [
            { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
            { code: "Maakond", selection: { filter: "item", values: [region] } },
            {
              code: "Elukohariik",
              selection: { filter: "item", values: Object.keys(ORIGIN_COUNTRY_LABELS) },
            },
            // Full history (not just the latest year) so the table below can
            // show a top-5 ranking per year, not only the latest 12 months.
            { code: "Vaatlusperiood", selection: { filter: "top", values: ["256"] } },
          ],
          { signal, locale }
        );
        if (isActive()) {
          setOrigins({ data: flattenToRows(originData), loading: false, error: null });
        }
      } catch (err) {
        if (isAbortError(err)) return;
        if (isActive()) setOrigins((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    },
    [region, locale]
  );

  function rankCountries(rows, limit = 5) {
    const totals = new Map();
    for (const row of rows) {
      if (row.value === null) continue;
      totals.set(row.Elukohariik, (totals.get(row.Elukohariik) ?? 0) + row.value);
    }
    return Array.from(totals.entries())
      .map(([code, value]) => ({ label: ORIGIN_COUNTRY_LABELS[code] ?? code, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  const originsTop5ByYear = useMemo(() => {
    if (!origins.data) return null;
    const byYear = new Map();
    for (const row of origins.data) {
      const year = row.Vaatlusperiood.split("M")[0];
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(row);
    }
    const result = new Map();
    for (const [year, rows] of byYear) {
      result.set(year, rankCountries(rows));
    }
    return result;
  }, [origins.data]);

  const indexed = useMemo(() => {
    if (!state.data) return null;
    const { guestRows, capRows } = state.data;

    const guestsByRegion = new Map();
    for (const row of guestRows) {
      if (row.value === null) continue;
      if (!guestsByRegion.has(row.Maakond)) guestsByRegion.set(row.Maakond, new Map());
      const regionMap = guestsByRegion.get(row.Maakond);
      if (!regionMap.has(row.Elukohariik)) regionMap.set(row.Elukohariik, new Map());
      regionMap.get(row.Elukohariik).set(row.Vaatlusperiood, row.value);
    }

    const capByRegion = new Map();
    for (const row of capRows) {
      if (!capByRegion.has(row.Maakond)) capByRegion.set(row.Maakond, new Map());
      const regionMap = capByRegion.get(row.Maakond);
      if (!regionMap.has(row.Vaatlusperiood)) regionMap.set(row.Vaatlusperiood, {});
      if (row.value !== null) regionMap.get(row.Vaatlusperiood)[row.Näitaja] = row.value;
    }

    const allPeriods = Array.from(new Set(guestRows.map((r) => r.Vaatlusperiood))).sort();
    const periodLabels = new Map(guestRows.map((r) => [r.Vaatlusperiood, r.Vaatlusperiood_label]));

    return { guestsByRegion, capByRegion, allPeriods, periodLabels };
  }, [state.data]);

  const latestOriginsTop5 = useMemo(() => {
    if (!origins.data || !indexed) return null;
    const last12 = new Set(indexed.allPeriods.slice(-12));
    return rankCountries(origins.data.filter((row) => last12.has(row.Vaatlusperiood)));
  }, [origins.data, indexed]);

  const view = useMemo(() => {
    if (!indexed) return null;
    const { guestsByRegion, capByRegion, allPeriods, periodLabels } = indexed;
    const residencyCode = RESIDENCY_CODE[residency];

    const yearToPeriods = new Map();
    for (const p of allPeriods) {
      const year = p.split("M")[0];
      if (!yearToPeriods.has(year)) yearToPeriods.set(year, []);
      yearToPeriods.get(year).push(p);
    }
    const years = Array.from(yearToPeriods.keys()).sort();

    function buildYearly(regionCode) {
      const guestMap = guestsByRegion.get(regionCode)?.get(residencyCode);
      const nationalGuestMap = guestsByRegion.get("EE")?.get(residencyCode);
      const capMap = capByRegion.get(regionCode);

      return years.map((year, i) => {
        const periods = yearToPeriods.get(year);
        // A partial current year is compared against the same number of
        // months in the prior year, not a full 12 — otherwise "2026 so
        // far" would read as a crash against "all of 2025".
        const prevPeriods = i > 0 ? yearToPeriods.get(years[i - 1]).slice(0, periods.length) : null;

        const accommodated = sumField(guestMap, periods);
        const prevAccommodated = prevPeriods ? sumField(guestMap, prevPeriods) : null;
        const nationalAccommodated = sumField(nationalGuestMap, periods);

        const esta = avgAndLast(capMap, periods, "CAP_ESTA").last;
        const rooms = avgAndLast(capMap, periods, "CAP_BEDR").last;
        const occ = avgAndLast(capMap, periods, "OCC_OR_BEDR").avg;
        const arr = avgAndLast(capMap, periods, "OCC_NI_COST").avg;
        const prevOcc = prevPeriods ? avgAndLast(capMap, prevPeriods, "OCC_OR_BEDR").avg : null;
        const prevArr = prevPeriods ? avgAndLast(capMap, prevPeriods, "OCC_NI_COST").avg : null;

        const revpar = arr != null && occ != null ? arr * (occ / 100) : null;
        const prevRevpar = prevArr != null && prevOcc != null ? prevArr * (prevOcc / 100) : null;

        return {
          year,
          partial: periods.length < 12,
          accommodated,
          accommodatedYoy: yoy(accommodated, prevAccommodated),
          share: accommodated != null && nationalAccommodated ? (accommodated / nationalAccommodated) * 100 : null,
          esta,
          rooms,
          occ,
          arr,
          arrYoy: yoy(arr, prevArr),
          revpar,
          revparYoy: yoy(revpar, prevRevpar),
        };
      });
    }

    const nationalYearlyAll = buildYearly("EE");
    const regionYearlyAll = buildYearly(region);

    const visibleYears = Math.min(yearsToShow, years.length);
    const nationalYearly = nationalYearlyAll.slice(-visibleYears);
    const regionYearly = regionYearlyAll.slice(-visibleYears);

    const latestPeriod = allPeriods[allPeriods.length - 1];
    const [latestYear, latestMonthStr] = latestPeriod.split("M");
    const prevYearPeriod = `${Number(latestYear) - 1}M${latestMonthStr}`;

    function monthlySnapshot(regionCode) {
      const guestMap = guestsByRegion.get(regionCode)?.get(residencyCode);
      const capMap = capByRegion.get(regionCode);
      const cur = sumField(guestMap, [latestPeriod]);
      const prev = sumField(guestMap, [prevYearPeriod]);
      const capCur = capMap?.get(latestPeriod) ?? {};
      const capPrev = capMap?.get(prevYearPeriod) ?? {};
      const occCur = capCur.OCC_OR_BEDR ?? null;
      const occPrev = capPrev.OCC_OR_BEDR ?? null;
      const arrCur = capCur.OCC_NI_COST ?? null;
      const arrPrev = capPrev.OCC_NI_COST ?? null;
      const revparCur = arrCur != null && occCur != null ? arrCur * (occCur / 100) : null;
      const revparPrev = arrPrev != null && occPrev != null ? arrPrev * (occPrev / 100) : null;
      return {
        accommodated: cur,
        accommodatedYoy: yoy(cur, prev),
        esta: capCur.CAP_ESTA ?? null,
        rooms: capCur.CAP_BEDR ?? null,
        occ: occCur,
        arr: arrCur,
        arrYoy: yoy(arrCur, arrPrev),
        revpar: revparCur,
        revparYoy: yoy(revparCur, revparPrev),
      };
    }

    const regionLabel = REGION_LABELS[region];
    const shareKey = t("operator.shareOf", regionLabel);
    const occupancyKey = t("operator.occupancyPct");
    const avgNightRateKey = t("operator.avgNightRate");
    const revparKey = t("operator.revpar");
    const totalEstoniaKey = t("operator.totalEstonia");
    const trendChart = nationalYearly.map((r, i) => ({
      x: r.year,
      [totalEstoniaKey]: r.accommodated,
      [shareKey]: regionYearly[i]?.share ?? null,
    }));
    const kpiChart = regionYearly.map((r) => ({
      x: r.year,
      [occupancyKey]: r.occ != null ? Number(r.occ.toFixed(1)) : null,
      [avgNightRateKey]: r.arr != null ? Number(r.arr.toFixed(2)) : null,
      [revparKey]: r.revpar != null ? Number(r.revpar.toFixed(2)) : null,
    }));

    return {
      maxYears: years.length,
      nationalYearly,
      regionYearly,
      nationalMonthly: monthlySnapshot("EE"),
      regionMonthly: monthlySnapshot(region),
      latestLabel: periodLabels.get(latestPeriod) ?? latestPeriod,
      prevLabel: periodLabels.get(prevYearPeriod) ?? prevYearPeriod,
      trendChart,
      kpiChart,
      shareKey,
      occupancyKey,
      avgNightRateKey,
      revparKey,
      totalEstoniaKey,
    };
  }, [indexed, region, residency, yearsToShow, locale, t, REGION_LABELS]);

  if (!state.data && state.loading) {
    return <div className="panel-status">{t("operator.loading")}</div>;
  }
  if (!state.data && state.error) {
    return <div className="panel-error">{t("operator.loadError", state.error)}</div>;
  }
  if (!view) return null;

  const regionLabel = REGION_LABELS[region];

  return (
    <section className={"operator-section" + (state.loading ? " refetching" : "")}>
      <div className="operator-header">
        <h2>{t("operator.heading")}</h2>
        <p className="operator-intro">{t("operator.intro")}</p>
      </div>

      <div className="operator-controls">
        <label className="operator-control">
          <span>{t("operator.regionLabel")}</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {REGION_CODES.map((code) => (
              <option key={code} value={code}>
                {REGION_LABELS[code]}
              </option>
            ))}
          </select>
        </label>

        <div className="operator-control">
          <span>{t("operator.guestsLabel")}</span>
          <div className="pill-tabs">
            {RESIDENCY_TABS.map((tab) => (
              <button
                key={tab.key}
                className={"pill-tab" + (residency === tab.key ? " active" : "")}
                onClick={() => setResidency(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <label className="operator-control operator-control-slider">
          <span>{t("operator.lastYears", yearsToShow)}</span>
          <input
            type="range"
            min={3}
            max={view.maxYears}
            value={yearsToShow}
            onChange={(e) => setYearsToShow(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="data-card">
        <h3>
          {t("operator.yearlyHeading", [
            regionLabel,
            view.nationalYearly[0]?.year,
            view.nationalYearly[view.nationalYearly.length - 1]?.year,
          ])}
        </h3>

        <div className="tile-row-split">
          <div className="operator-chart">
            <div className="operator-chart-title">{t("operator.trendChartTitle", regionLabel)}</div>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={view.trendChart} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis
                  dataKey="x"
                  tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={{ stroke: CHART_GRID_COLOR }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={{ stroke: CHART_GRID_COLOR }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={{ stroke: CHART_GRID_COLOR }}
                  unit="%"
                />
                <Tooltip content={<ChartTooltip locale={locale} />} />
                <Legend />
                <Bar yAxisId="left" dataKey={view.totalEstoniaKey} fill={CHART_COLORS[0]} isAnimationActive={false} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={view.shareKey}
                  stroke={FOREIGN_COLOR}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="operator-chart">
            <div className="operator-chart-title">{t("operator.kpiChartTitle", regionLabel)}</div>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={view.kpiChart} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis
                  dataKey="x"
                  tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={{ stroke: CHART_GRID_COLOR }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={{ stroke: CHART_GRID_COLOR }}
                  unit="%"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={{ stroke: CHART_GRID_COLOR }}
                  unit="€"
                />
                <Tooltip content={<ChartTooltip locale={locale} />} />
                <Legend />
                <Bar yAxisId="left" dataKey={view.occupancyKey} fill={CHART_COLORS[2]} isAnimationActive={false} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={view.avgNightRateKey}
                  stroke={CHART_COLORS[1]}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={view.revparKey}
                  stroke={CHART_COLORS[3]}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="data-grid-wrapper">
          <table className="data-grid operator-table operator-table-transposed">
            <thead>
              <tr>
                <th>{t("operator.thIndicator")}</th>
                {view.nationalYearly.map((r) => (
                  <th key={r.year}>
                    {r.year}
                    {r.partial ? " *" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{t("operator.accommodatedEstonia")}</th>
                {view.nationalYearly.map((r) => (
                  <td key={r.year}>{fmtInt(r.accommodated, locale)}</td>
                ))}
              </tr>
              <tr className="operator-subrow">
                <th>{t("operator.yoyChange")}</th>
                {view.nationalYearly.map((r) => (
                  <td key={r.year} className={deltaClass(r.accommodatedYoy)}>
                    {fmtDelta(r.accommodatedYoy)}
                  </td>
                ))}
              </tr>
              <tr>
                <th>{t("operator.accommodatedRegion", regionLabel)}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year}>{fmtInt(r.accommodated, locale)}</td>
                ))}
              </tr>
              <tr className="operator-subrow">
                <th>{t("operator.yoyChange")}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year} className={deltaClass(r.accommodatedYoy)}>
                    {fmtDelta(r.accommodatedYoy)}
                  </td>
                ))}
              </tr>
              <tr>
                <th>{t("operator.shareOfEstonia", regionLabel)}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year}>{fmtPct(r.share)}</td>
                ))}
              </tr>
              <tr>
                <th>{t("operator.establishments")}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year}>{fmtInt(r.esta, locale)}</td>
                ))}
              </tr>
              <tr>
                <th>{t("operator.rooms")}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year}>{fmtInt(r.rooms, locale)}</td>
                ))}
              </tr>
              <tr>
                <th>{t("operator.occupancy")}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year}>{fmtPct(r.occ)}</td>
                ))}
              </tr>
              <tr>
                <th>{t("operator.arr")}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year}>{fmtEur(r.arr)}</td>
                ))}
              </tr>
              <tr className="operator-subrow">
                <th>{t("operator.yoyChange")}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year} className={deltaClass(r.arrYoy)}>
                    {fmtDelta(r.arrYoy)}
                  </td>
                ))}
              </tr>
              <tr>
                <th>{t("operator.revparStar")}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year}>{fmtEur(r.revpar)}</td>
                ))}
              </tr>
              <tr className="operator-subrow">
                <th>{t("operator.yoyChange")}</th>
                {view.regionYearly.map((r) => (
                  <td key={r.year} className={deltaClass(r.revparYoy)}>
                    {fmtDelta(r.revparYoy)}
                  </td>
                ))}
              </tr>
              {[0, 1, 2, 3, 4].map((rank) => (
                <tr key={`origin-${rank}`} className={rank > 0 ? "operator-subrow" : undefined}>
                  <th>{t("operator.topOriginCountry", rank + 1)}</th>
                  {view.regionYearly.map((r) => {
                    const item = originsTop5ByYear?.get(r.year)?.[rank];
                    return (
                      <td key={r.year}>
                        {item ? `${item.label} (${fmtInt(item.value, locale)})` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="operator-footnote">{t("operator.footnote")}</div>
        <TableSource path={MAJUTUS_PATH} ids={["TU131.PX", "TU122.PX"]} />
      </div>

      <div className="tile-row-split">
        <div className="data-card">
          <h3>{t("operator.snapshotHeading", [t("operator.estoniaLabel"), view.latestLabel, view.prevLabel])}</h3>
          <MonthlySnapshotTable snapshot={view.nationalMonthly} locale={locale} t={t} />
          <TableSource path={MAJUTUS_PATH} ids={["TU131.PX", "TU122.PX"]} />
        </div>
        <div className="data-card">
          <h3>
            {t("operator.snapshotHeading", [regionLabel, view.latestLabel, view.prevLabel])}
          </h3>
          <MonthlySnapshotTable snapshot={view.regionMonthly} locale={locale} t={t} />
          <TableSource path={MAJUTUS_PATH} ids={["TU131.PX", "TU122.PX"]} />
        </div>
      </div>

      <div className="data-card">
        <h3>{t("operator.topOriginsHeading", regionLabel)}</h3>
        {!latestOriginsTop5 && origins.loading && <div className="panel-status">{t("operator.loading")}</div>}
        {!latestOriginsTop5 && origins.error && (
          <div className="panel-error">{t("operator.loadError", origins.error)}</div>
        )}
        {latestOriginsTop5 && (
          <div className={origins.loading ? "refetching" : ""}>
            {latestOriginsTop5.length ? (
              <RankedBarList items={latestOriginsTop5} unit={t("common.guests")} locale={locale} />
            ) : (
              <div className="panel-status">{t("operator.noRegionData")}</div>
            )}
          </div>
        )}
        <TableSource path={MAJUTUS_PATH} ids={["TU131.PX"]} />
      </div>
    </section>
  );
}

export default memo(OperatorInsights);

function MonthlySnapshotTable({ snapshot, locale, t }) {
  return (
    <table className="data-grid operator-table operator-table-compact">
      <tbody>
        <tr>
          <th>{t("operator.accommodated")}</th>
          <td>{fmtInt(snapshot.accommodated, locale)}</td>
          <td className={deltaClass(snapshot.accommodatedYoy)}>{fmtDelta(snapshot.accommodatedYoy)}</td>
        </tr>
        <tr>
          <th>{t("operator.establishments")}</th>
          <td>{fmtInt(snapshot.esta, locale)}</td>
          <td>—</td>
        </tr>
        <tr>
          <th>{t("operator.rooms")}</th>
          <td>{fmtInt(snapshot.rooms, locale)}</td>
          <td>—</td>
        </tr>
        <tr>
          <th>{t("operator.occupancy")}</th>
          <td>{fmtPct(snapshot.occ)}</td>
          <td>—</td>
        </tr>
        <tr>
          <th>{t("operator.arr")}</th>
          <td>{fmtEur(snapshot.arr)}</td>
          <td className={deltaClass(snapshot.arrYoy)}>{fmtDelta(snapshot.arrYoy)}</td>
        </tr>
        <tr>
          <th>{t("operator.revparStar")}</th>
          <td>{fmtEur(snapshot.revpar)}</td>
          <td className={deltaClass(snapshot.revparYoy)}>{fmtDelta(snapshot.revparYoy)}</td>
        </tr>
      </tbody>
    </table>
  );
}
