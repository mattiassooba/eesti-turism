import { useState } from "react";
import { useApp } from "../state/AppState.jsx";
import { useSector } from "../data/datasets.js";
import { regionName } from "../lib/regions.js";
import { fmtInt, fmtDec, fmtEur, fmtPct, fmtPeriod, fmtSignedPct } from "../lib/format.js";
import { COST_CATEGORY_LABELS } from "@prod/lib/accommodationSector.js";
import PageHeader from "../components/layout/PageHeader.jsx";
import { Section, SectionHead, Segmented, Kpi, ScopeBadge, NationalNotice } from "../components/ui/Primitives.jsx";
import { Async } from "../components/ui/States.jsx";
import ChartFrame from "../components/charts/ChartFrame.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import ColumnChart from "../components/charts/ColumnChart.jsx";
import { SplitBar } from "../components/charts/Small.jsx";

const COST_KEYS = ["personnel", "resale", "materials", "energy", "rent", "other"];
const COST_COLORS = { personnel: "var(--c-1)", resale: "var(--c-2)", materials: "var(--c-3)", energy: "var(--c-foreign)", rent: "var(--c-4, #7a8fa3)", other: "var(--c-muted)" };

const mln = (v, locale, d = 1) => (v == null ? "—" : locale === "et" ? `${fmtDec(v, locale, d)} mln €` : `€${fmtDec(v, locale, d)}M`);
const mlnAxis = (v, locale) => (locale === "et" ? `${fmtDec(v, locale, 0)} mln` : `${fmtDec(v, locale, 0)}M`);
const capLabel = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function KeyFigures({ s }) {
  const { t, locale } = useApp();
  const q = s.latestRevenue;
  const g = s.growthHighlights.latest;
  const ann = s.revenueSeries.at(-1);
  const annPrev = s.revenueSeries.at(-2);
  const ent = s.enterpriseCounts.at(-1);
  const w = s.wageComparison.at(-1);
  const wPrev = s.wageComparison.find((x) => w && x.period === `${Number(w.period.slice(0, 4)) - 1}${w.period.slice(4)}`);
  return (
    <div className="kpi-row kpi-row--4">
      <Kpi label={t("sector.kpiRevenue", fmtPeriod(q?.period, locale))} value={mln(q?.valueMillionEur, locale)} delta={g?.pct} deltaLabel={t("sector.vsYearAgoQuarter")} note={t("sectorPage.nominal")} />
      <Kpi
        label={t("sectorPage.kpiAnnual", ann?.year)}
        value={mln(ann ? ann.value / 1000 : null, locale, 0)}
        delta={ann && annPrev ? ((ann.value - annPrev.value) / annPrev.value) * 100 : null}
        deltaLabel={t("sectorPage.vsPrevYear", annPrev?.year)}
        note={t("sectorPage.annualNote")}
      />
      <Kpi label={t("sector.kpiEnterprises", ent?.year)} value={fmtInt(ent?.count, locale)} note={t("sectorPage.entNote")} />
      <Kpi
        label={t("sector.kpiWage", fmtPeriod(w?.period, locale))}
        value={fmtEur(w?.accommodation, locale, 0)}
        delta={w && wPrev ? ((w.accommodation - wPrev.accommodation) / wPrev.accommodation) * 100 : null}
        deltaLabel={t("sector.vsYearAgoQuarter")}
        note={w ? t("sector.wageGap", fmtDec((w.accommodation / w.allActivities) * 100, locale, 0)) : null}
      />
    </div>
  );
}

function Revenue({ s }) {
  const { t, locale } = useApp();
  const [view, setView] = useState("level");
  const q = s.quarterly.slice(-40);
  const growth = s.growthSeries.slice(-36);
  const isLevel = view === "level";
  const cats = (isLevel ? q : growth).map((p) => ({ key: p.period, label: p.period.slice(0, 4), title: fmtPeriod(p.period, locale) }));
  return (
    <ChartFrame
      title={t(isLevel ? "sectorPage.revTitle" : "sectorPage.growthTitle")}
      subtitle={t(isLevel ? "sectorPage.revSub" : "sectorPage.growthSub")}
      controls={
        <Segmented
          label={t("controls.view")}
          hideLabel
          value={view}
          onChange={setView}
          options={[
            { value: "level", label: t("sectorPage.vLevel") },
            { value: "growth", label: t("sectorPage.vGrowth") },
          ]}
        />
      }
      tables={["TU410"]}
      sourceNote={t("sectorPage.revSource")}
      table={{
        caption: t(isLevel ? "sectorPage.revTitle" : "sectorPage.growthTitle"),
        columns: [{ key: "p", label: t("table.period") }, { key: "v", label: t(isLevel ? "sector.revenue" : "sectorPage.vGrowth"), numeric: true }],
        rows: (isLevel ? q.map((p) => ({ key: p.period, p: fmtPeriod(p.period, locale), v: mln(p.value, locale) })) : growth.map((p) => ({ key: p.period, p: fmtPeriod(p.period, locale), v: fmtSignedPct(p.pct, locale) }))).reverse(),
      }}
    >
      <ColumnChart
        categories={cats.map((c) => ({ ...c, label: c.key.endsWith("Q1") ? c.label : "" }))}
        series={[
          isLevel
            ? { key: "rev", label: t("sector.revenue"), color: "var(--c-1)", values: q.map((p) => p.value) }
            : { key: "g", label: t("sectorPage.vGrowth"), color: "var(--c-1)", values: growth.map((p) => p.pct) },
        ]}
        signColors={!isLevel}
        height={320}
        yFormat={isLevel ? (v) => mlnAxis(v, locale) : (v) => `${fmtInt(v, locale)}%`}
        valueFormat={isLevel ? (v) => mln(v, locale) : (v) => fmtSignedPct(v, locale)}
        tickEvery={1}
        ariaLabel={t(isLevel ? "sectorPage.revTitle" : "sectorPage.growthTitle")}
      />
    </ChartFrame>
  );
}

function Enterprises({ s }) {
  const { t, locale } = useApp();
  const years = s.revenueSeries.map((p) => p.year);
  const hv = s.hotelsVsOther;
  return (
    <div className="split-6-6">
      <ChartFrame
        title={t("sectorPage.annualTitle")}
        subtitle={t("sectorPage.annualSub")}
        tables={["EM001"]}
        table={{
          caption: t("sectorPage.annualTitle"),
          columns: [{ key: "y", label: t("table.year") }, { key: "v", label: t("sector.revenue"), numeric: true }],
          rows: s.revenueSeries.map((p) => ({ key: p.year, y: p.year, v: mln(p.value / 1000, locale) })).reverse(),
        }}
      >
        <ColumnChart
          categories={years.map((y) => ({ key: y, label: y }))}
          series={[{ key: "v", label: t("sector.revenue"), color: "var(--c-1)", values: s.revenueSeries.map((p) => p.value / 1000) }]}
          height={280}
          yFormat={(v) => mlnAxis(v, locale)}
          valueFormat={(v) => mln(v, locale)}
          tickEvery={2}
          ariaLabel={t("sectorPage.annualTitle")}
        />
      </ChartFrame>
      <ChartFrame
        title={t("sectorPage.entTitle")}
        subtitle={t("sectorPage.entSub")}
        legend={[
          { label: t("sectorPage.hotels"), color: "var(--c-1)", type: "bar" },
          { label: t("sectorPage.otherAcc"), color: "var(--c-3)", type: "bar" },
        ]}
        tables={["EM001"]}
        table={{
          caption: t("sectorPage.entTitle"),
          columns: [
            { key: "y", label: t("table.year") },
            { key: "h", label: t("sectorPage.hotels"), numeric: true },
            { key: "o", label: t("sectorPage.otherAcc"), numeric: true },
          ],
          rows: hv.map((p) => ({ key: p.year, y: p.year, h: fmtInt(p.hotels, locale), o: fmtInt(p.other, locale) })).reverse(),
        }}
      >
        <ColumnChart
          categories={hv.map((p) => ({ key: p.year, label: p.year }))}
          stacked
          series={[
            { key: "h", label: t("sectorPage.hotels"), color: "var(--c-1)", values: hv.map((p) => p.hotels) },
            { key: "o", label: t("sectorPage.otherAcc"), color: "var(--c-3)", values: hv.map((p) => p.other) },
          ]}
          height={280}
          yFormat={(v) => fmtInt(v, locale)}
          valueFormat={(v) => fmtInt(v, locale)}
          tickEvery={2}
          ariaLabel={t("sectorPage.entTitle")}
        />
      </ChartFrame>
    </div>
  );
}

function Costs({ s }) {
  const { t, locale } = useApp();
  const lang = locale === "en" ? "en" : "et";
  const byYear = s.costByYear.filter((x) => x.cost.other >= 0);
  const [year, setYear] = useState(null);
  const sel = byYear.find((x) => x.year === year) ?? byYear.at(-1);
  if (!sel) return null;
  const c = sel.cost;
  const segs = COST_KEYS.map((k) => ({ label: capLabel(COST_CATEGORY_LABELS[k][lang]), value: c[k], color: COST_COLORS[k] }));
  return (
    <div className="split-5-7">
      <div>
        <Segmented label={t("table.year")} size="s" value={sel.year} onChange={setYear} options={byYear.slice(-5).map((x) => ({ value: x.year, label: x.year }))} />
        <p className="block-label cost-total">{t("sectorPage.costTotal", [sel.year, mln(c.total / 1000, locale)])}</p>
        <SplitBar segments={segs} height={18} format={(v) => mln(v / 1000, locale)} />
        <p className="definition purpose-def">
          <strong>{t("visitors.defTitle")}</strong> {t("sectorPage.costDef")}
        </p>
      </div>
      <ChartFrame
        title={t("sectorPage.costTrend")}
        subtitle={t("sectorPage.costTrendSub")}
        legend={COST_KEYS.map((k) => ({ label: capLabel(COST_CATEGORY_LABELS[k][lang]), color: COST_COLORS[k], type: "bar" }))}
        tables={["EM001"]}
        table={{
          caption: t("sectorPage.costTrend"),
          columns: [{ key: "y", label: t("table.year") }, ...COST_KEYS.map((k) => ({ key: k, label: capLabel(COST_CATEGORY_LABELS[k][lang]), numeric: true }))],
          rows: byYear.map((x) => ({ key: x.year, y: x.year, ...Object.fromEntries(COST_KEYS.map((k) => [k, fmtPct((x.cost[k] / x.cost.total) * 100, locale)])) })).reverse(),
        }}
      >
        <ColumnChart
          categories={byYear.map((x) => ({ key: x.year, label: x.year, highlight: false }))}
          stacked
          series={COST_KEYS.map((k) => ({ key: k, label: capLabel(COST_CATEGORY_LABELS[k][lang]), color: COST_COLORS[k], values: byYear.map((x) => (x.cost[k] / x.cost.total) * 100) }))}
          height={280}
          yMax={100}
          yFormat={(v) => `${v}%`}
          valueFormat={(v) => fmtPct(v, locale)}
          tickEvery={2}
          ariaLabel={t("sectorPage.costTrend")}
        />
      </ChartFrame>
    </div>
  );
}

function Wages({ s }) {
  const { t, locale } = useApp();
  const w = s.wageComparison;
  const periods = w.map((x) => x.period);
  const series = [
    { key: "all", label: t("sectorPage.wageAll"), short: t("sectorPage.wageAllShort"), values: w.map((x) => x.allActivities), color: "var(--c-muted)", width: 1.8, dash: "4 4" },
    { key: "acc", label: t("sectorPage.wageAcc"), short: t("sectorPage.wageAccShort"), values: w.map((x) => x.accommodation), color: "var(--c-1)", width: 2.4 },
  ];
  const qTick = (p) => (p.endsWith("Q1") ? p.slice(0, 4) : "");
  return (
    <ChartFrame
      title={t("sectorPage.wageTitle")}
      subtitle={t("sectorPage.wageSub")}
      tables={["PA113"]}
      table={{
        caption: t("sectorPage.wageTitle"),
        columns: [{ key: "p", label: t("table.period") }, ...series.map((x) => ({ key: x.key, label: x.label, numeric: true })), { key: "r", label: t("sectorPage.ratio"), numeric: true }],
        rows: w.map((x) => ({ key: x.period, p: fmtPeriod(x.period, locale), all: fmtEur(x.allActivities, locale, 0), acc: fmtEur(x.accommodation, locale, 0), r: fmtPct((x.accommodation / x.allActivities) * 100, locale, 0) })).reverse(),
      }}
    >
      <LineChart
        periods={periods}
        series={series}
        height={300}
        zero={false}
        yFormat={(v) => `${fmtInt(v, locale)} €`}
        valueFormat={(v) => fmtEur(v, locale, 0)}
        xTick={qTick}
        tooltipTitle={(p) => fmtPeriod(p, locale)}
        ariaLabel={t("sectorPage.wageTitle")}
      />
    </ChartFrame>
  );
}

export default function Sector() {
  const { t, locale, region } = useApp();
  const sector = useSector();
  const tabs = [
    { id: "kaive", label: t("sectorPage.tabRev") },
    { id: "ettevotted", label: t("sectorPage.tabEnt") },
    { id: "kulud", label: t("sectorPage.tabCost") },
    { id: "palgad", label: t("sectorPage.tabWage") },
  ];
  return (
    <>
      <PageHeader
        kicker={t("nav.sector")}
        title={t("sectorPage.title")}
        lead={t("sector.lead")}
        tabs={tabs}
        aside={
          <div className="page-controls">
            <ScopeBadge nationalOnly period={sector.data ? fmtPeriod(sector.data.latestRevenue?.period, locale) : "…"} reason={t("sector.why")} />
          </div>
        }
      />
      <Async state={sector} height={900}>
        {(s) => (
          <>
            <Section id="kaive" tone="paper" labelledBy="s-rev">
              {region.kind !== "country" && <NationalNotice regionLabel={regionName(region, locale)} text={t("sector.notice")} />}
              <SectionHead id="s-rev" kicker={t("sectorPage.tabRev")} title={t("sectorPage.revHead")} lead={t("sectorPage.revLead")} />
              <KeyFigures s={s} />
              <Revenue s={s} />
            </Section>
            <Section id="ettevotted" tone="white" labelledBy="s-ent">
              <SectionHead id="s-ent" kicker={t("sectorPage.tabEnt")} title={t("sectorPage.entHead")} lead={t("sectorPage.entLead")} />
              <Enterprises s={s} />
            </Section>
            <Section id="kulud" tone="paper" labelledBy="s-cost">
              <SectionHead id="s-cost" kicker={t("sectorPage.tabCost")} title={t("sectorPage.costHead")} lead={t("sectorPage.costLead")} />
              <Costs s={s} />
            </Section>
            <Section id="palgad" tone="white" labelledBy="s-wage">
              <SectionHead id="s-wage" kicker={t("sectorPage.tabWage")} title={t("sectorPage.wageHead")} lead={t("sectorPage.wageLead")} />
              <Wages s={s} />
            </Section>
          </>
        )}
      </Async>
    </>
  );
}
