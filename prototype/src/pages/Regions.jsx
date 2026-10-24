import { useMemo, useState } from "react";
import { useApp } from "../state/AppState.jsx";
import { useTourism, useCapacity, useOrigins, usePurpose, PURPOSES, ORIGIN_CODES } from "../data/datasets.js";
import { tourismSummary, capacitySummary, seasonality } from "../data/metrics.js";
import { annualTotals, annualMeans, sumRange, sumKnown, pctChange, rolling12 } from "../data/derive.js";
import { purposeShares } from "./Visitors.jsx";
import { ESTONIA, COUNTY_LIST, CITY_LIST, REGIONS, regionName, AVAILABILITY } from "../lib/regions.js";
import { fmtInt, fmtDec, fmtPct, fmtEur, fmtPeriod, fmtMonthTick, fmtYtdRange, fmtCompact, fmtSignedPct, countryName, parsePeriod, fmtOcc, fmtCost } from "../lib/format.js";
import PageHeader from "../components/layout/PageHeader.jsx";
import RegionPicker from "../components/layout/RegionPicker.jsx";
import CompareControl from "../components/layout/CompareControl.jsx";
import LocatorMap from "../components/map/LocatorMap.jsx";
import EstoniaMap from "../components/map/EstoniaMap.jsx";
import { Section, SectionHead, Segmented, Delta, ScopeBadge, Source } from "../components/ui/Primitives.jsx";
import { Async, Skeleton } from "../components/ui/States.jsx";
import ChartFrame, { DataTable } from "../components/charts/ChartFrame.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import { SplitBar, seqScale } from "../components/charts/Small.jsx";
import Icon from "../components/ui/Icon.jsx";
import { COVID_BAND } from "./home/TrendSection.jsx";

function useSelection() {
  const { region, compare, params } = useApp();
  const vs = params.get("vs");
  const secondary = vs === "none" ? null : compare ?? (region.kind === "country" ? null : ESTONIA);
  return { primary: region, secondary };
}

// ── Region chooser shown when the whole country is selected ────────────
function Chooser() {
  const { t, locale, setRegion } = useApp();
  const tourism = useTourism();
  const values = useMemo(() => {
    if (!tourism.data) return null;
    return Object.fromEntries(REGIONS.filter((r) => r.kind !== "country").map((r) => [r.code, tourismSummary(tourism.data, r.code).r12.value]));
  }, [tourism.data]);
  const nums = values ? Object.values(values).filter((v) => v != null) : [];
  const a = Math.log(Math.min(...nums));
  const b = Math.log(Math.max(...nums));
  return (
    <Section tone="white" id="vali" labelledBy="choose-title">
      <div className="chooser">
        <div className="chooser-text">
          <h2 id="choose-title" className="t-h2">
            {t("regions.chooseTitle")}
          </h2>
          <p className="t-lead">{t("regions.chooseLead")}</p>
          <ul className="chooser-list">
            {[...COUNTY_LIST, ...CITY_LIST].map((r) => (
              <li key={r.code}>
                <button type="button" onClick={() => setRegion(r.id)}>
                  {regionName(r, locale, { short: r.kind === "county" })}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="chooser-map">
          {values ? (
            <EstoniaMap
              theme="light"
              values={values}
              color={(v) => seqScale(0.12 + 0.78 * ((Math.log(v) - a) / (b - a || 1)))}
              format={(v) => fmtCompact(v, locale)}
              onSelect={(r) => setRegion(r.id)}
              metricLabel={t("regions.mapMetric")}
              ariaLabel={t("regions.mapAria")}
            />
          ) : (
            <Skeleton height={420} />
          )}
        </div>
      </div>
    </Section>
  );
}

// ── Side-by-side key figures ───────────────────────────────────────────
function CompareTable({ primary, secondary }) {
  const { t, locale } = useApp();
  const tourism = useTourism();
  const capacity = useCapacity();
  if (!tourism.data || !capacity.data) return <Skeleton height={520} />;
  const cols = [primary, secondary].filter(Boolean);
  const T = cols.map((r) => tourismSummary(tourism.data, r.code));
  const C = cols.map((r) => capacitySummary(capacity.data, r.code));
  const S = cols.map((r) => seasonality(tourism.data, r.code));
  const tp = fmtPeriod(T[0].period, locale);
  const cp = fmtPeriod(C[0].period, locale);
  const rows = [
    { group: t("regions.groupMonth", tp) },
    { label: t("kpi.guestsMonth"), v: T.map((s) => fmtInt(s.guests, locale)), d: T.map((s) => s.guestsYoy) },
    { label: t("kpi.nightsMonth"), v: T.map((s) => fmtInt(s.nights, locale)), d: T.map((s) => s.nightsYoy) },
    { label: t("kpi.foreignShare"), v: T.map((s) => fmtPct(s.foreignShare, locale)) },
    { label: t("kpi.avgStayShort"), v: T.map((s) => fmtDec(s.avgStay, locale, 2)) },
    { group: t("regions.group12", tp) },
    { label: t("kpi.guests12"), v: T.map((s) => fmtInt(s.r12.value, locale)), d: T.map((s) => s.r12.change) },
    { label: t("kpi.nights12"), v: T.map((s) => fmtInt(s.r12Nights.value, locale)), d: T.map((s) => s.r12Nights.change) },
    { label: t("kpi.foreignShare12"), v: T.map((s) => fmtPct(s.foreignShareR12, locale)) },
    { label: t("kpi.shareOfEstonia"), v: T.map((s, i) => (cols[i].kind === "country" ? "100%" : fmtPct(s.shareOfNationalR12, locale))) },
    { label: t("kpi.summerShare", S[0].year), v: S.map((s) => fmtPct(s.summerShare, locale, 0)) },
    { group: t("regions.groupAcc", cp) },
    { label: t("kpi.roomOcc"), v: C.map((c) => fmtOcc(c.roomOcc, locale)), d: C.map((c) => c.roomOccDiff), unit: "pp" },
    { label: t("kpi.bedOcc"), v: C.map((c) => fmtOcc(c.bedOcc, locale)), d: C.map((c) => c.bedOccDiff), unit: "pp" },
    { label: t("kpi.cost"), v: C.map((c) => fmtCost(c.cost, locale)), d: C.map((c) => c.costYoy) },
    { label: t("kpi.establishments"), v: C.map((c) => fmtInt(c.establishments, locale)) },
    { label: t("kpi.bedPlaces"), v: C.map((c) => fmtInt(c.beds, locale)) },
  ];
  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        <caption className="sr-only">{t("regions.compareCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{t("regions.indicator")}</span>
            </th>
            {cols.map((r, i) => (
              <th key={r.code} scope="col" className={i === 0 ? "is-primary" : "is-compare"}>
                <span className="compare-col-head">
                  <i aria-hidden="true" />
                  {regionName(r, locale, { short: r.kind === "county" })}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, k) =>
            row.group ? (
              <tr key={k} className="compare-group">
                <th scope="colgroup" colSpan={cols.length + 1}>
                  {row.group}
                </th>
              </tr>
            ) : (
              <tr key={k}>
                <th scope="row">{row.label}</th>
                {row.v.map((v, i) => (
                  <td key={i}>
                    <span className="compare-value num">{v}</span>
                    {row.d && (
                      <span className="compare-delta">
                        <Delta value={row.d[i]} size="s" unit={row.unit} />
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            )
          )}
        </tbody>
      </table>
      <p className="t-meta compare-foot">{t("regions.compareFoot")}</p>
    </div>
  );
}

// ── Index chart: rolling 12-month guests, 2019 = 100 ───────────────────
function RecoveryChart({ primary, secondary }) {
  const { t, locale } = useApp();
  const tourism = useTourism();
  const [metric, setMetric] = useState("OCC_ARR");
  return (
    <Async state={tourism} height={420}>
      {(d) => {
        const start = d.periods.indexOf("2019M12");
        const periods = d.periods.slice(start, d.latestIdx + 1);
        const series = [primary, secondary].filter(Boolean).map((r, k) => {
          const arr = d.get(metric, r.code);
          const base = rolling12(arr, start).value;
          return {
            key: r.code,
            label: regionName(r, locale),
            short: regionName(r, locale, { short: true }),
            values: periods.map((_, i) => {
              const v = rolling12(arr, start + i).value;
              return v != null && base ? (v / base) * 100 : null;
            }),
            color: k === 0 ? "var(--c-region)" : "var(--c-compare)",
            width: k === 0 ? 2.6 : 2,
          };
        });
        return (
          <ChartFrame
            title={t("regions.recoveryTitle")}
            subtitle={t("regions.recoverySub")}
            controls={
              <Segmented
                label={t("controls.metric")}
                hideLabel
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "OCC_ARR", label: t("metric.guests") },
                  { value: "OCC_NI", label: t("metric.nights") },
                ]}
              />
            }
            legend={series.map((s) => ({ label: s.label, color: s.color }))}
            tables={["TU131"]}
            sourceNote={t("regions.recoveryNote")}
            table={{
              caption: t("regions.recoveryTitle"),
              columns: [{ key: "p", label: t("table.period") }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))],
              rows: periods.map((p, i) => ({ key: p, p: fmtPeriod(p, locale), ...Object.fromEntries(series.map((s) => [s.key, fmtDec(s.values[i], locale, 1)])) })).reverse(),
            }}
          >
            <LineChart
              periods={periods}
              series={series}
              height={360}
              zero={false}
              yFormat={(v) => fmtInt(v, locale)}
              valueFormat={(v) => fmtDec(v, locale, 1)}
              xTick={(p) => fmtMonthTick(p, locale)}
              tooltipTitle={(p) => t("regions.r12To", fmtPeriod(p, locale))}
              bands={[{ ...COVID_BAND, label: t("chart.covid") }]}
              ariaLabel={t("regions.recoveryTitle")}
            />
          </ChartFrame>
        );
      }}
    </Async>
  );
}

// ── Occupancy and price, monthly, same scale for both regions ──────────
function AccommodationCompare({ primary, secondary }) {
  const { t, locale } = useApp();
  const capacity = useCapacity();
  const [metric, setMetric] = useState("OCC_OR_BEDR");
  return (
    <Async state={capacity} height={420}>
      {(d) => {
        const start = Math.max(0, d.latestIdx - 35);
        const periods = d.periods.slice(start, d.latestIdx + 1);
        const isCost = metric === "OCC_NI_COST";
        const series = [primary, secondary].filter(Boolean).map((r, k) => ({
          key: r.code,
          label: regionName(r, locale),
          short: regionName(r, locale, { short: true }),
          values: d.get(metric, r.code).slice(start, d.latestIdx + 1),
          color: k === 0 ? "var(--c-region)" : "var(--c-compare)",
          width: k === 0 ? 2.6 : 2,
        }));
        const fmt = isCost ? (v) => fmtCost(v, locale) : (v) => fmtOcc(v, locale);
        return (
          <ChartFrame
            title={t(`regions.acc.${metric}`)}
            subtitle={t("regions.accSub")}
            controls={
              <Segmented
                label={t("controls.metric")}
                hideLabel
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "OCC_OR_BEDR", label: t("kpi.roomOccShort") },
                  { value: "OCC_OR_BEDP", label: t("kpi.bedOccShort") },
                  { value: "OCC_NI_COST", label: t("regions.costShort") },
                ]}
              />
            }
            legend={series.map((s) => ({ label: s.label, color: s.color }))}
            tables={["TU122"]}
            footnote={isCost ? t("kpi.costNote") : null}
            table={{
              caption: t(`regions.acc.${metric}`),
              columns: [{ key: "p", label: t("table.period") }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))],
              rows: periods.map((p, i) => ({ key: p, p: fmtPeriod(p, locale), ...Object.fromEntries(series.map((s) => [s.key, fmt(s.values[i])])) })).reverse(),
            }}
          >
            <LineChart
              periods={periods}
              series={series}
              height={340}
              zero={!isCost}
              yMax={isCost ? undefined : 100}
              yFormat={isCost ? (v) => fmtEur(v, locale, 0) : (v) => `${v}%`}
              valueFormat={fmt}
              xTick={(p) => fmtMonthTick(p, locale)}
              tooltipTitle={(p) => fmtPeriod(p, locale)}
              ariaLabel={t(`regions.acc.${metric}`)}
            />
          </ChartFrame>
        );
      }}
    </Async>
  );
}

// ── Source markets and purpose of trip ────────────────────────────────
function MarketsAndPurpose({ primary, secondary }) {
  const { t, locale } = useApp();
  const o1 = useOrigins(primary.code);
  const o2 = useOrigins(secondary?.code ?? primary.code);
  const p1 = usePurpose(primary.code);
  const p2 = usePurpose(secondary?.code ?? primary.code);
  const shares = (o) => {
    if (!o) return null;
    const i = o.latestIdx;
    const total = sumRange(o.get("OCC_ARR", "FOR"), i - 11, i);
    return Object.fromEntries(ORIGIN_CODES.map((c) => {
      const k = sumKnown(o.get("OCC_ARR", c), i - 11, i);
      return [c, total && k.value != null ? (k.value / total) * 100 : null];
    }));
  };
  const bounds = (o) => {
    if (!o) return new Set();
    const i = o.latestIdx;
    return new Set(ORIGIN_CODES.filter((c) => sumKnown(o.get("OCC_ARR", c), i - 11, i).missing > 0));
  };
  const s1 = shares(o1.data);
  const s2 = secondary ? shares(o2.data) : null;
  const lb1 = bounds(o1.data);
  const lb2 = secondary ? bounds(o2.data) : new Set();
  const shareText = (v, lb) => (v == null ? "—" : (lb ? "≥ " : "") + fmtPct(v, locale));
  const top = s1 ? Object.entries(s1).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  const maxShare = Math.max(1, ...top.map(([c, v]) => Math.max(v ?? 0, s2?.[c] ?? 0)));
  const barW = (v) => `${((v ?? 0) / maxShare) * 100}%`;
  const purposeSplit = (p) => purposeShares(p, p.latestIdx - 11, p.latestIdx, t);
  const range = o1.data ? `${fmtPeriod(o1.data.periods[o1.data.latestIdx - 11], locale, { short: true })} – ${fmtPeriod(o1.data.periods[o1.data.latestIdx], locale, { short: true })}` : "";
  return (
    <div className="split-7-5">
      <div>
        <h3 className="t-h3">{t("regions.marketsTitle")}</h3>
        <p className="t-meta block-sub">{t("regions.marketsSub", range)}</p>
        {!s1 ? (
          <Skeleton height={360} />
        ) : (
          <div className="market-compare" role="table" aria-label={t("regions.marketsTitle")}>
            <div className="market-compare-head" role="row">
              <span role="columnheader">{t("visitors.colCountry")}</span>
              <span role="columnheader">
                <i className="dot dot--region" aria-hidden="true" />
                {regionName(primary, locale, { short: true })}
              </span>
              {secondary && (
                <span role="columnheader">
                  <i className="dot dot--compare" aria-hidden="true" />
                  {regionName(secondary, locale, { short: true })}
                </span>
              )}
            </div>
            {top.map(([code, v]) => (
              <div key={code} className="market-compare-row" role="row">
                <span role="rowheader">{countryName(code, locale)}</span>
                <span role="cell" className="market-bar">
                  <span className="market-bar-fill" style={{ width: barW(v) }} />
                  <b className="num">{shareText(v, lb1.has(code))}</b>
                </span>
                {secondary && (
                  <span role="cell" className="market-bar market-bar--compare">
                    <span className="market-bar-fill" style={{ width: barW(s2?.[code]) }} />
                    <b className="num">{shareText(s2?.[code], lb2.has(code))}</b>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {top.some(([c]) => lb1.has(c) || lb2.has(c)) && <p className="t-meta suppressed-note">{t("suppressed.markets")}</p>}
        <Source tables={["TU131"]} note={t("regions.marketsNote")} />
      </div>
      <div>
        <h3 className="t-h3">{t("regions.purposeTitle")}</h3>
        <p className="t-meta block-sub">{t("regions.purposeSub")}</p>
        {!p1.data ? (
          <Skeleton height={200} />
        ) : (
          <div className="purpose-stack">
            {[
              [primary, p1.data],
              ...(secondary ? [[secondary, p2.data]] : []),
            ].map(([r, p]) => (
              <div key={r.code} className="purpose-block">
                <p className="block-label">{regionName(r, locale)}</p>
                {!p ? (
                  <Skeleton height={60} />
                ) : purposeSplit(p).segs && purposeSplit(p).months === 12 ? (
                  <SplitBar segments={purposeSplit(p).segs} height={14} />
                ) : (
                  <p className="t-meta">{t("suppressed.split")}</p>
                )}
              </div>
            ))}
          </div>
        )}
        <Source tables={["TU133"]} note={t("regions.purposeNote")} />
      </div>
    </div>
  );
}

// ── Annual table with partial-year handling ────────────────────────────
function AnnualTable({ region }) {
  const { t, locale } = useApp();
  const tourism = useTourism();
  const capacity = useCapacity();
  if (!tourism.data || !capacity.data) return <Skeleton height={420} />;
  const d = tourism.data;
  const g = annualTotals(d.get("OCC_ARR", region.code), d.periods);
  const n = annualTotals(d.get("OCC_NI", region.code), d.periods);
  const f = annualTotals(d.get("OCC_ARR", region.code, "FOR"), d.periods);
  const occ = annualMeans(capacity.data.get("OCC_OR_BEDR", region.code), capacity.data.periods);
  const cost = annualMeans(capacity.data.get("OCC_NI_COST", region.code), capacity.data.periods);
  const latest = parsePeriod(d.latest);
  const ytdPrev = (arr, year) => {
    const i0 = d.periods.indexOf(`${year}M01`);
    return i0 < 0 ? null : sumRange(arr, i0, i0 + latest.month - 1);
  };
  const rows = g
    .filter((x) => x.year >= 2010)
    .map((x) => {
      const prev = g.find((y) => y.year === x.year - 1);
      const nn = n.find((y) => y.year === x.year);
      const ff = f.find((y) => y.year === x.year);
      const oo = occ.find((y) => y.year === x.year);
      const cc = cost.find((y) => y.year === x.year);
      const change = x.partial ? pctChange(x.value, ytdPrev(d.get("OCC_ARR", region.code), x.year - 1)) : prev ? pctChange(x.value, prev.value) : null;
      return {
        key: x.year,
        className: x.partial ? "is-partial" : undefined,
        year: x.partial ? `${x.year} (${fmtYtdRange(d.latest, locale)})` : x.year,
        guests: fmtInt(x.value, locale),
        change: change == null ? "—" : fmtSignedPct(change, locale),
        nights: fmtInt(nn?.value, locale),
        foreign: ff && x.value ? fmtPct((ff.value / x.value) * 100, locale) : "—",
        stay: nn && x.value ? fmtDec(nn.value / x.value, locale, 2) : "—",
        occ: oo ? fmtPct(oo.value, locale) : "—",
        cost: cc ? fmtEur(cc.value, locale) : "—",
      };
    })
    .reverse();
  return (
    <>
      <DataTable
        caption={t("regions.annualTitle", regionName(region, locale))}
        maxHeight={560}
        columns={[
          { key: "year", label: t("table.year") },
          { key: "guests", label: t("metric.guests"), numeric: true },
          { key: "change", label: t("regions.colChange"), numeric: true },
          { key: "nights", label: t("metric.nights"), numeric: true },
          { key: "foreign", label: t("regions.colForeign"), numeric: true },
          { key: "stay", label: t("regions.colStay"), numeric: true },
          { key: "occ", label: t("regions.colOcc"), numeric: true },
          { key: "cost", label: t("regions.colCost"), numeric: true },
        ]}
        rows={rows}
      />
      <p className="t-meta table-foot">{t("regions.annualFoot")}</p>
      <Source tables={["TU131", "TU122"]} />
    </>
  );
}

// ── All regions, sortable ─────────────────────────────────────────────
const ALL_COLS = ["guests", "change", "nights", "foreign", "stay", "occ", "cost"];
function AllRegionsTable({ primary, secondary }) {
  const { t, locale, setRegion } = useApp();
  const tourism = useTourism();
  const capacity = useCapacity();
  const [sort, setSort] = useState({ key: "guests", dir: -1 });
  const data = useMemo(() => {
    if (!tourism.data || !capacity.data) return null;
    return REGIONS.map((r) => {
      const s = tourismSummary(tourism.data, r.code);
      const c = capacitySummary(capacity.data, r.code);
      return {
        r,
        guests: s.r12.value,
        change: s.r12.change,
        nights: s.r12Nights.value,
        foreign: s.foreignShareR12,
        stay: s.r12.value ? s.r12Nights.value / s.r12.value : null,
        occ: c.roomOccR12,
        cost: c.costR12,
      };
    });
  }, [tourism.data, capacity.data]);
  if (!data) return <Skeleton height={600} />;
  const sorted = [...data].sort((a, b) => {
    if (a.r.kind === "country") return -1;
    if (b.r.kind === "country") return 1;
    return ((a[sort.key] ?? -Infinity) - (b[sort.key] ?? -Infinity)) * sort.dir;
  });
  const fmt = {
    guests: (v) => fmtInt(v, locale),
    change: (v) => (v == null ? "—" : fmtSignedPct(v, locale)),
    nights: (v) => fmtInt(v, locale),
    foreign: (v) => fmtPct(v, locale),
    stay: (v) => fmtDec(v, locale, 2),
    occ: (v) => fmtPct(v, locale),
    cost: (v) => fmtCost(v, locale),
  };
  return (
    <div className="data-table-wrap" style={{ maxHeight: "none" }} role="region" aria-label={t("regions.allTitle")} tabIndex={0}>
      <table className="data-table has-sticky-col all-regions">
        <caption className="sr-only">{t("regions.allTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("regions.colRegion")}</th>
            {ALL_COLS.map((k) => (
              <th key={k} scope="col" className="is-num" aria-sort={sort.key === k ? (sort.dir < 0 ? "descending" : "ascending") : "none"}>
                <button type="button" className="sort-btn" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : -1 }))}>
                  {t(`regions.all.${k}`)}
                  <span aria-hidden="true" className="sort-glyph">
                    {sort.key === k ? (sort.dir < 0 ? "↓" : "↑") : "↕"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.r.code}
              className={
                (row.r.code === primary.code ? "is-highlight" : "") +
                (row.r.code === secondary?.code ? " is-compare-row" : "") +
                (row.r.kind === "country" ? " is-total" : "") +
                (row.r.kind === "city" ? " is-city" : "")
              }
            >
              <th scope="row">
                <button type="button" className="row-link" onClick={() => setRegion(row.r.id)}>
                  {regionName(row.r, locale, { short: row.r.kind === "county" })}
                </button>
              </th>
              {ALL_COLS.map((k) => (
                <td key={k} className="is-num num">
                  {fmt[k](row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Availability({ region }) {
  const { t } = useApp();
  const items = [
    ["tourism", true],
    ["capacity", true],
    ["purpose", true],
    ["capacityLongRun", region.kind === "country"],
    ["residents", region.kind === "country"],
    ["sector", region.kind === "country"],
  ];
  return (
    <ul className="availability">
      {items.map(([k, ok]) => (
        <li key={k} className={ok ? "is-ok" : "is-no"}>
          <span className="availability-icon" aria-hidden="true">
            <Icon name={ok ? "check" : "info"} size={15} />
          </span>
          <span>
            <strong>{t(`avail.${k}.name`)}</strong>
            <span className="availability-tables t-meta">{AVAILABILITY[k].tables.join(", ")}</span>
            <span className="availability-text">{ok ? t(`avail.${k}.ok`) : t(`avail.${k}.no`)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Regions() {
  const { t, locale, updateParams } = useApp();
  const { primary, secondary } = useSelection();
  const isCountry = primary.kind === "country";
  const name = regionName(primary, locale);

  const tabs = [
    { id: "vordlus", label: t("regions.tabCompare") },
    { id: "trend", label: t("regions.tabTrend") },
    { id: "turud", label: t("regions.tabMarkets") },
    { id: "aastad", label: t("regions.tabAnnual") },
    { id: "koik", label: t("regions.tabAll") },
    { id: "andmed", label: t("regions.tabAvailability") },
  ];

  return (
    <>
      <PageHeader
        kicker={t("nav.regions")}
        title={isCountry ? t("regions.titleAll") : name}
        lead={isCountry ? t("regions.leadAll") : secondary ? t("regions.leadCompare", [name, regionName(secondary, locale)]) : t("regions.lead", name)}
        tabs={tabs}
        aside={
          <div className="page-controls">
            <LocatorMap code={primary.code} compareCode={secondary?.code} className="page-locator" title={name} />
            <div className="page-controls-row">
              <RegionPicker variant="page" />
              <CompareControl value={secondary} exclude={primary.code} onChange={(r) => updateParams({ vs: r ? r.id : "none" })} />
            </div>
          </div>
        }
      />
      {isCountry && <Chooser />}

      <Section id="vordlus" tone="paper" labelledBy="cmp-title">
        <SectionHead
          id="cmp-title"
          kicker={t("regions.tabCompare")}
          title={secondary ? t("regions.compareTitle", [regionName(primary, locale, { short: true }), regionName(secondary, locale, { short: true })]) : t("regions.compareTitleSingle", name)}
          lead={t("regions.compareLead")}
        />
        <CompareTable primary={primary} secondary={secondary} />
      </Section>

      <Section id="trend" tone="white" labelledBy="trend-r-title">
        <SectionHead id="trend-r-title" kicker={t("regions.tabTrend")} title={t("regions.trendTitle")} lead={t("regions.trendLead")} />
        <div className="stack-l">
          <RecoveryChart primary={primary} secondary={secondary} />
          <AccommodationCompare primary={primary} secondary={secondary} />
        </div>
      </Section>

      <Section id="turud" tone="paper" labelledBy="mk-title">
        <SectionHead id="mk-title" kicker={t("regions.tabMarkets")} title={t("regions.marketsHead")} lead={t("regions.marketsLead")} />
        <MarketsAndPurpose primary={primary} secondary={secondary} />
      </Section>

      <Section id="aastad" tone="white" labelledBy="an-title">
        <SectionHead
          id="an-title"
          kicker={t("regions.tabAnnual")}
          title={t("regions.annualTitle", name)}
          lead={t("regions.annualLead")}
          aside={<ScopeBadge region={name} period={t("regions.since2010")} />}
        />
        <AnnualTable region={primary} />
      </Section>

      <Section id="koik" tone="paper" labelledBy="all-title">
        <SectionHead id="all-title" kicker={t("regions.tabAll")} title={t("regions.allTitle")} lead={t("regions.allLead")} />
        <AllRegionsTable primary={primary} secondary={secondary} />
        <Source tables={["TU131", "TU122"]} note={t("map.sourceNote")} />
      </Section>

      <Section id="andmed" tone="white" labelledBy="av-title">
        <SectionHead id="av-title" kicker={t("regions.tabAvailability")} title={t("regions.availTitle", name)} lead={t("regions.availLead")} />
        <Availability region={primary} />
      </Section>
    </>
  );
}