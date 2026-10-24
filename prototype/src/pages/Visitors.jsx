import { useMemo, useState } from "react";
import { useApp } from "../state/AppState.jsx";
import { useTourism, useOrigins, usePurpose, PURPOSES } from "../data/datasets.js";
import { tourismSummary } from "../data/metrics.js";
import { annualTotals, completeMonthSums, at, pctChange } from "../data/derive.js";
import { regionName } from "../lib/regions.js";
import { fmtInt, fmtDec, fmtPct, fmtPeriod, fmtMonthTick, fmtYtdRange, fmtAxis, fmtCompact, parsePeriod } from "../lib/format.js";
import PageHeader from "../components/layout/PageHeader.jsx";
import RegionPicker from "../components/layout/RegionPicker.jsx";
import { Section, SectionHead, Segmented, Kpi, ScopeBadge, Source } from "../components/ui/Primitives.jsx";
import { Async, Skeleton, EmptyState } from "../components/ui/States.jsx";
import ChartFrame from "../components/charts/ChartFrame.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import ColumnChart from "../components/charts/ColumnChart.jsx";
import { BarList, SplitBar } from "../components/charts/Small.jsx";
import { COVID_BAND, useTrendSeries } from "./home/TrendSection.jsx";
import { useMarketRanking } from "./home/VisitorsSection.jsx";

// A stacked column is drawn only if every component of that year is known;
// otherwise the visible part would pose as the whole.
function completeStack(groups) {
  const years = [...new Set(groups.flatMap((g) => g.rows.map((r) => r.year)))].sort((a, b) => a - b);
  const gap = new Set(years.filter((y) => groups.some((g) => { const r = g.rows.find((x) => x.year === y); return !r || r.value == null; })));
  return groups.map((g) => ({
    k: g.k,
    rows: years.map((y) => {
      const r = g.rows.find((x) => x.year === y) ?? { year: y, partial: false };
      return gap.has(y) ? { ...r, value: null, suppressed: true } : r;
    }),
  }));
}

export function purposeShares(p, from, to, t) {
  const { sums, months } = completeMonthSums(PURPOSES.map((k) => p.get("OCC_NI", k)), from, to);
  const total = sums.reduce((a, b) => a + b, 0);
  const segs = months && total
    ? PURPOSES.map((k, j) => ({ label: t(`purpose.${k}`), value: sums[j], share: (sums[j] / total) * 100, color: PURPOSE_COLORS[k] }))
    : null;
  return { segs, months, span: to - from + 1 };
}

export const PURPOSE_COLORS = { HOL: "var(--c-1)", BSNS_CONF: "var(--c-2)", BSNS_O: "var(--c-3)", _O: "var(--c-muted)" };

// The two monthly figures follow the visitor-type and comparison toggles
// carried over from production (all / residents / foreign; a year earlier /
// previous month). Year-to-date and rolling 12 months stay all-visitor totals.
function KeyFigures({ code }) {
  const { t, locale } = useApp();
  const tourism = useTourism();
  const [who, setWho] = useState("all");
  const [cmp, setCmp] = useState("yoy");
  return (
    <Async state={tourism} height={160}>
      {(d) => {
        const s = tourismSummary(d, code);
        const idx = d.latestIdx;
        const off = cmp === "yoy" ? 12 : 1;
        const series = (ind) => (who === "all" ? d.get(ind, code) : d.get(ind, code, who));
        const g = series("OCC_ARR");
        const n = series("OCC_NI");
        const prev = fmtPeriod(d.periods[idx - off], locale);
        const whoLabel = who === "all" ? null : who === "EE" ? t("common.domestic") : t("common.foreign");
        return (
          <>
            <div className="kpi-controls">
              <Segmented
                label={t("visitorsPage.kpiWho")}
                size="s"
                value={who}
                onChange={setWho}
                options={[
                  { value: "all", label: t("visitorsPage.kpiAll") },
                  { value: "EE", label: t("common.domestic") },
                  { value: "FOR", label: t("common.foreign") },
                ]}
              />
              <Segmented
                label={t("visitorsPage.kpiCmp")}
                size="s"
                value={cmp}
                onChange={setCmp}
                options={[
                  { value: "yoy", label: t("visitorsPage.kpiYoy") },
                  { value: "mom", label: t("visitorsPage.kpiMom") },
                ]}
              />
            </div>
            <div className="kpi-row kpi-row--4">
              <Kpi
                label={t("hero.statGuests", fmtPeriod(s.period, locale))}
                meta={whoLabel}
                value={fmtInt(at(g, idx), locale)}
                delta={pctChange(at(g, idx), at(g, idx - off))}
                deltaLabel={t("common.vs", prev)}
                note={cmp === "mom" ? t("visitorsPage.momNote") : null}
              />
              <Kpi
                label={t("hero.statNights", fmtPeriod(s.period, locale))}
                meta={whoLabel}
                value={fmtInt(at(n, idx), locale)}
                delta={pctChange(at(n, idx), at(n, idx - off))}
                deltaLabel={t("common.vs", prev)}
              />
              <Kpi label={t("kpi.ytdGuests", fmtYtdRange(s.period, locale))} value={fmtInt(s.ytd.value, locale)} delta={s.ytd.change} deltaLabel={t("hero.vsSamePeriod")} />
              <Kpi label={t("kpi.r12Guests")} value={fmtInt(s.r12.value, locale)} delta={s.r12.change} deltaLabel={t("kpi.vsPrior12")} />
            </div>
          </>
        );
      }}
    </Async>
  );
}

function TrendBlock({ region }) {
  const { t, locale } = useApp();
  const tourism = useTourism();
  const [metric, setMetric] = useState("guests");
  const [view, setView] = useState("total");
  const [range, setRange] = useState(() => (window.matchMedia("(max-width: 560px)").matches ? "5y" : "all"));
  const trend = useTrendSeries(tourism.data, region.code, { metric, view, range });
  const rName = regionName(region, locale);
  return (
    <Async state={tourism} height={480}>
      {() => {
        const labelOf = (k) => ({ dom: t("common.domestic"), for: t("common.foreign"), total: t(`metric.${metric}`), prev: t("chart.yearEarlier") })[k];
        const series = trend.series.map((x) => ({ ...x, label: labelOf(x.key), short: x.key === "prev" ? t("chart.yearEarlierShort") : labelOf(x.key) }));
        return (
          <ChartFrame
            title={t(metric === "nights" ? "trend.chartTitleNights" : "trend.chartTitleGuests", rName)}
            subtitle={t("trend.chartSub")}
            controls={
              <>
                <Segmented label={t("controls.metric")} hideLabel value={metric} onChange={setMetric} options={[{ value: "guests", label: t("metric.guests") }, { value: "nights", label: t("metric.nights") }]} />
                <Segmented label={t("controls.view")} hideLabel value={view} onChange={setView} options={[{ value: "total", label: t("controls.vsYearEarlier") }, { value: "split", label: t("controls.domForSplit") }]} />
                <Segmented label={t("controls.range")} hideLabel value={range} onChange={setRange} options={[{ value: "2y", label: t("controls.r2y") }, { value: "5y", label: t("controls.r5y") }, { value: "all", label: t("controls.rAll") }]} />
              </>
            }
            tables={["TU131"]}
            sourceNote={t("source.establishmentsNote")}
            table={{
              caption: t("trend.chartTitleGuests", rName),
              columns: [{ key: "p", label: t("table.period") }, ...series.map((x) => ({ key: x.key, label: x.label, numeric: true }))],
              rows: trend.periods.map((p, i) => ({ key: p, p: fmtPeriod(p, locale), ...Object.fromEntries(series.map((x) => [x.key, fmtInt(x.values[i], locale)])) })).reverse(),
            }}
          >
            <LineChart
              periods={trend.periods}
              series={series}
              height={420}
              yFormat={(v) => fmtAxis(v, locale)}
              valueFormat={(v) => fmtInt(v, locale)}
              xTick={(p) => fmtMonthTick(p, locale)}
              tooltipTitle={(p) => fmtPeriod(p, locale)}
              bands={[{ ...COVID_BAND, label: t("chart.covid") }]}
              ariaLabel={t("trend.aria", rName)}
            />
          </ChartFrame>
        );
      }}
    </Async>
  );
}

function AnnualSplit({ region }) {
  const { t, locale } = useApp();
  const tourism = useTourism();
  const [metric, setMetric] = useState("OCC_ARR");
  return (
    <Async state={tourism} height={400}>
      {(d) => {
        const [{ rows: dom }, { rows: fr }] = completeStack([
          { k: "EE", rows: annualTotals(d.get(metric, region.code, "EE"), d.periods) },
          { k: "FOR", rows: annualTotals(d.get(metric, region.code, "FOR"), d.periods) },
        ]);
        const years = dom.map((x) => x.year);
        const gapYears = dom.filter((r) => r.suppressed).map((r) => r.year);
        const latest = parsePeriod(d.latest);
        const cats = dom.map((x) => ({ key: x.year, label: String(x.year), title: x.partial ? `${x.year} (${fmtYtdRange(d.latest, locale)})` : String(x.year), partial: x.partial }));
        return (
          <ChartFrame
            title={t("visitorsPage.annualTitle")}
            subtitle={t("visitorsPage.annualSub", latest.year)}
            controls={<Segmented label={t("controls.metric")} hideLabel value={metric} onChange={setMetric} options={[{ value: "OCC_ARR", label: t("metric.guests") }, { value: "OCC_NI", label: t("metric.nights") }]} />}
            legend={[
              { label: t("common.domestic"), color: "var(--c-domestic)", type: "bar" },
              { label: t("common.foreign"), color: "var(--c-foreign)", type: "bar" },
            ]}
            footnote={t("visitorsPage.partialNote", fmtYtdRange(d.latest, locale)) + (gapYears.length ? " " + t("suppressed.years", gapYears.join(", ")) : "")}
            tables={["TU131"]}
            table={{
              caption: t("visitorsPage.annualTitle"),
              columns: [
                { key: "y", label: t("table.year") },
                { key: "dom", label: t("common.domestic"), numeric: true },
                { key: "for", label: t("common.foreign"), numeric: true },
              ],
              rows: years.map((y, i) => ({ key: y, y: cats[i].title, dom: fmtInt(dom[i].value, locale), for: fmtInt(fr.find((f) => f.year === y)?.value, locale) })).reverse(),
            }}
          >
            <ColumnChart
              categories={cats}
              stacked
              series={[
                { key: "dom", label: t("common.domestic"), color: "var(--c-domestic)", values: years.map((y) => dom.find((x) => x.year === y)?.value ?? null) },
                { key: "for", label: t("common.foreign"), color: "var(--c-foreign)", values: years.map((y) => fr.find((x) => x.year === y)?.value ?? null) },
              ]}
              height={340}
              yFormat={(v) => fmtAxis(v, locale)}
              valueFormat={(v) => fmtInt(v, locale)}
              tickEvery={3}
              partialLabel={t("chart.partialYear")}
              ariaLabel={t("visitorsPage.annualTitle")}
            />
          </ChartFrame>
        );
      }}
    </Async>
  );
}

function Origins({ region }) {
  const { t, locale } = useApp();
  const origins = useOrigins(region.code);
  const ranking = useMarketRanking(origins.data, locale);
  const [picked, setPicked] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const focus = picked && ranking?.items.find((x) => x.key === picked) ? picked : ranking?.items[0]?.key;
  const rName = regionName(region, locale);

  const detail = useMemo(() => {
    if (!origins.data || !focus) return null;
    const o = origins.data;
    const arr = o.get("OCC_ARR", focus);
    const start = 12;
    const periods = o.periods.slice(start, o.latestIdx + 1);
    return {
      periods,
      series: [
        { key: "prev", label: t("chart.yearEarlier"), short: t("chart.yearEarlierShort"), values: periods.map((_, i) => arr[start + i - 12] ?? null), color: "var(--c-muted)", dash: "4 4", muted: true, width: 1.6 },
        { key: "cur", label: countryName(focus), short: countryName(focus), values: arr.slice(start, o.latestIdx + 1), color: "var(--c-1)", width: 2.4, area: true },
      ],
    };
    function countryName(code) {
      return ranking.items.find((x) => x.key === code)?.label ?? code;
    }
  }, [origins.data, focus, ranking, t]);

  return (
    <div className="split-5-7 origins">
      <div>
        <div className="markets-head">
          <h3 className="t-h3">{t("visitorsPage.originsRank")}</h3>
          <p className="t-meta">{ranking ? `${fmtPeriod(ranking.from, locale, { short: true })} – ${fmtPeriod(ranking.to, locale, { short: true })}` : ""}</p>
        </div>
        {!ranking ? (
          <Skeleton height={520} />
        ) : ranking.items.length ? (
          <>
            <BarList
              items={ranking.items}
              limit={showAll ? undefined : 15}
              format={(v) => fmtCompact(v, locale)}
              highlightKey={focus}
              onSelect={(it) => setPicked(it.key)}
              deltaLabel={t("visitors.colChange")}
              dense
            />
            {ranking.items.length > 15 && (
              <button type="button" className="btn btn--secondary show-more" onClick={() => setShowAll((s) => !s)}>
                {showAll ? t("visitorsPage.showLess") : t("visitorsPage.showAll", ranking.items.length)}
              </button>
            )}
          </>
        ) : (
          <EmptyState text={t("visitors.noMarkets")} />
        )}
        {ranking?.incomplete && <p className="t-meta suppressed-note">{t("suppressed.markets")}</p>}
        <Source tables={["TU131"]} note={t("visitors.marketsNote")} />
      </div>
      <div className="origins-detail">
        {detail ? (
          <ChartFrame
            title={t("visitorsPage.countryTitle", [detail.series[1].label, rName])}
            subtitle={t("visitorsPage.countrySub")}
            footnote={detail.series[1].values.some((v) => v == null) ? t("suppressed.gaps") : undefined}
            tables={["TU131"]}
            table={{
              caption: t("visitorsPage.countryTitle", [detail.series[1].label, rName]),
              columns: [{ key: "p", label: t("table.period") }, { key: "cur", label: detail.series[1].label, numeric: true }, { key: "prev", label: t("chart.yearEarlier"), numeric: true }],
              rows: detail.periods.map((p, i) => ({ key: p, p: fmtPeriod(p, locale), cur: fmtInt(detail.series[1].values[i], locale), prev: fmtInt(detail.series[0].values[i], locale) })).reverse(),
            }}
          >
            <LineChart
              periods={detail.periods}
              series={detail.series}
              height={340}
              yFormat={(v) => fmtAxis(v, locale)}
              valueFormat={(v) => fmtInt(v, locale)}
              xTick={(p) => fmtMonthTick(p, locale)}
              tooltipTitle={(p) => fmtPeriod(p, locale)}
              ariaLabel={t("visitorsPage.countryTitle", [detail.series[1].label, rName])}
            />
          </ChartFrame>
        ) : (
          <Skeleton height={420} />
        )}
        <p className="t-meta origins-hint">{t("visitorsPage.countryHint")}</p>
      </div>
    </div>
  );
}

function Purpose({ region }) {
  const { t, locale } = useApp();
  const purpose = usePurpose(region.code);
  return (
    <Async state={purpose} height={420}>
      {(p) => {
        const i = p.latestIdx;
        const last12 = purposeShares(p, i - 11, i, t);
        const complete12 = last12.segs && last12.months === 12;
        const periods = p.periods.slice(0, i + 1);
        const series = PURPOSES.map((k) => ({ key: k, label: t(`purpose.${k}`), values: p.get("OCC_NI", k).slice(0, i + 1), color: PURPOSE_COLORS[k], width: k === "HOL" ? 2.4 : 1.8 }));
        const gaps = series.some((s) => s.values.some((v) => v == null));
        return (
          <div className="split-5-7">
            <div>
              <p className="block-label">{t("visitorsPage.purpose12", `${fmtPeriod(p.periods[i - 11], locale, { short: true })} – ${fmtPeriod(p.periods[i], locale, { short: true })}`)}</p>
              {complete12 ? <SplitBar segments={last12.segs} height={16} format={(v) => fmtCompact(v, locale)} /> : <p className="t-meta">{t("suppressed.split")}</p>}
              <p className="definition purpose-def">
                <strong>{t("visitors.defTitle")}</strong> {t("visitorsPage.purposeDef")}
              </p>
            </div>
            <ChartFrame
              title={t("visitorsPage.purposeMonthly", regionName(region, locale))}
              subtitle={t("visitorsPage.purposeMonthlySub")}
              tables={["TU133"]}
              footnote={gaps ? t("suppressed.gaps") : undefined}
              table={{
                caption: t("visitorsPage.purposeMonthly", regionName(region, locale)),
                columns: [{ key: "p", label: t("table.period") }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))],
                rows: periods.map((per, n) => ({ key: per, p: fmtPeriod(per, locale), ...Object.fromEntries(series.map((s) => [s.key, fmtInt(s.values[n], locale)])) })).reverse(),
              }}
            >
              <LineChart
                periods={periods}
                series={series}
                height={320}
                yFormat={(v) => fmtAxis(v, locale)}
                valueFormat={(v) => fmtInt(v, locale)}
                xTick={(per) => fmtMonthTick(per, locale)}
                tooltipTitle={(per) => fmtPeriod(per, locale)}
                bands={[{ ...COVID_BAND, label: t("chart.covid") }]}
                ariaLabel={t("visitorsPage.purposeMonthly", regionName(region, locale))}
              />
            </ChartFrame>
          </div>
        );
      }}
    </Async>
  );
}

function StayLength({ region }) {
  const { t, locale } = useApp();
  const tourism = useTourism();
  return (
    <Async state={tourism} height={380}>
      {(d) => {
        const start = Math.max(0, d.latestIdx - 59);
        const periods = d.periods.slice(start, d.latestIdx + 1);
        const ratio = (res) => periods.map((_, k) => {
          const g = d.get("OCC_ARR", region.code, res)[start + k];
          const n = d.get("OCC_NI", region.code, res)[start + k];
          return g ? n / g : null;
        });
        const series = [
          { key: "EE", label: t("common.domestic"), values: ratio("EE"), color: "var(--c-domestic)", width: 2.2 },
          { key: "FOR", label: t("common.foreign"), values: ratio("FOR"), color: "var(--c-foreign)", width: 2.2 },
        ];
        return (
          <ChartFrame
            title={t("visitorsPage.stayTitle", regionName(region, locale))}
            subtitle={t("visitorsPage.staySub")}
            tables={["TU131"]}
            table={{
              caption: t("visitorsPage.stayTitle", regionName(region, locale)),
              columns: [{ key: "p", label: t("table.period") }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))],
              rows: periods.map((p, i) => ({ key: p, p: fmtPeriod(p, locale), ...Object.fromEntries(series.map((s) => [s.key, fmtDec(s.values[i], locale, 2)])) })).reverse(),
            }}
          >
            <LineChart
              periods={periods}
              series={series}
              height={300}
              zero={false}
              yFormat={(v) => fmtDec(v, locale, 1)}
              valueFormat={(v) => fmtDec(v, locale, 2)}
              xTick={(p) => fmtMonthTick(p, locale)}
              tooltipTitle={(p) => fmtPeriod(p, locale)}
              ariaLabel={t("visitorsPage.stayTitle", regionName(region, locale))}
            />
          </ChartFrame>
        );
      }}
    </Async>
  );
}

export default function Visitors() {
  const { t, locale, region } = useApp();
  const rName = regionName(region, locale);
  const tourism = useTourism();
  const tabs = [
    { id: "trend", label: t("visitorsPage.tabTrend") },
    { id: "jaotus", label: t("visitorsPage.tabSplit") },
    { id: "paritolu", label: t("visitorsPage.tabOrigins") },
    { id: "eesmark", label: t("visitorsPage.tabPurpose") },
    { id: "kestus", label: t("visitorsPage.tabStay") },
  ];
  return (
    <>
      <PageHeader
        kicker={t("nav.visitors")}
        title={t("visitorsPage.title", rName)}
        lead={t("visitorsPage.lead")}
        tabs={tabs}
        aside={
          <div className="page-controls">
            <ScopeBadge region={rName} period={tourism.data ? fmtPeriod(tourism.data.latest, locale) : "…"} />
            <RegionPicker variant="page" />
          </div>
        }
      />
      <Section id="trend" tone="paper" labelledBy="v-trend">
        <SectionHead id="v-trend" kicker={t("visitorsPage.tabTrend")} title={t("visitorsPage.trendTitle")} lead={t("trend.lead")} />
        <KeyFigures code={region.code} />
        <TrendBlock region={region} />
      </Section>
      <Section id="jaotus" tone="white" labelledBy="v-split">
        <SectionHead id="v-split" kicker={t("visitorsPage.tabSplit")} title={t("visitorsPage.splitTitle")} lead={t("visitorsPage.splitLead")} />
        <AnnualSplit region={region} />
      </Section>
      <Section id="paritolu" tone="paper" labelledBy="v-orig">
        <SectionHead id="v-orig" kicker={t("visitorsPage.tabOrigins")} title={t("visitorsPage.originsTitle")} lead={t("visitorsPage.originsLead")} />
        <Origins region={region} />
      </Section>
      <Section id="eesmark" tone="white" labelledBy="v-purp">
        <SectionHead id="v-purp" kicker={t("visitorsPage.tabPurpose")} title={t("visitorsPage.purposeTitle")} lead={t("visitorsPage.purposeLead")} />
        <Purpose region={region} />
      </Section>
      <Section id="kestus" tone="paper" labelledBy="v-stay">
        <SectionHead id="v-stay" kicker={t("visitorsPage.tabStay")} title={t("visitorsPage.stayHead")} lead={t("visitorsPage.stayLead")} />
        <StayLength region={region} />
      </Section>
    </>
  );
}
