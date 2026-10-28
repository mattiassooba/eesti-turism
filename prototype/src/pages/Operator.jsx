import { useMemo, useState } from "react";
import { useApp } from "../state/AppState.jsx";
import { useTourism, useCapacity, useSector, useOriginHistory } from "../data/datasets.js";
import {
  MIN_TABLE_YEAR,
  buildColumns,
  chartYears,
  yearIndexes,
  yearsIn,
  monthColLabel,
  shareChartSeries,
  occupancyChartSeries,
  originsByColumn,
} from "../data/operatorTable.js";
import { ESTONIA, COUNTY_LIST, CITY_LIST, regionName } from "../lib/regions.js";
import {
  fmtInt,
  fmtDec,
  fmtPct,
  fmtEur,
  fmtPeriod,
  fmtSignedPct,
  fmtAxis,
  fmtYtdRange,
  monthName,
  parsePeriod,
} from "../lib/format.js";
import { buildGrowthInsight, buildWageInsight } from "@prod/lib/accommodationSector.js";
import PageHeader from "../components/layout/PageHeader.jsx";
import RegionPicker from "../components/layout/RegionPicker.jsx";
import LocatorMap from "../components/map/LocatorMap.jsx";
import { Section, SectionHead, Segmented, SelectControl, ScopeBadge, NationalNotice, Kpi, ArrowLink, Delta, Source } from "../components/ui/Primitives.jsx";
import { Async, Skeleton } from "../components/ui/States.jsx";
import ChartFrame, { DataTable } from "../components/charts/ChartFrame.jsx";
import ColumnChart from "../components/charts/ColumnChart.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import ComposedChart from "../components/charts/ComposedChart.jsx";

const COVID_YEARS = new Set([2020, 2021]);
const RESIDENCY = [
  { value: "WORLD", labelKey: "operatorPage.guestsAll" },
  { value: "EE", labelKey: "common.domestic" },
  { value: "FOR", labelKey: "common.foreign" },
];

function fmtTableNum(n, locale) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${fmtDec(n / 1e6, locale, 1)}${locale === "et" ? " milj." : "M"}`;
  if (abs >= 1e3) return `${fmtDec(n / 1e3, locale, 1)}${locale === "et" ? " tuh." : "k"}`;
  return fmtInt(n, locale);
}

function YearlyTable({ columns, accommodatedLabel, shareLabel, originsByKey, locale, t }) {
  const colDefs = [
    { key: "indicator", label: t("operatorPage.thIndicator") },
    ...columns.map((c) => ({ key: c.key, label: c.partial ? `${c.label} *` : c.label, numeric: true })),
  ];
  const cell = (rowKey, render) => Object.fromEntries(columns.map((c) => [c.key, render(c)]));
  const rows = [
    { key: "acc", indicator: accommodatedLabel, ...cell("acc", (c) => fmtTableNum(c.accommodated, locale)) },
    {
      key: "accYoy",
      className: "is-sub",
      indicator: t("operatorPage.yoyChange"),
      ...cell("accYoy", (c) => <Delta value={c.accommodatedYoy} size="s" />),
    },
    { key: "cum", indicator: t("operatorPage.cumulativeThrough", monthName((parsePeriod(columns.at(-1)?.key)?.month ?? 1) - 1, locale, true)), ...cell("cum", (c) => fmtTableNum(c.cumulative, locale)) },
    {
      key: "cumYoy",
      className: "is-sub",
      indicator: t("operatorPage.yoyChange"),
      ...cell("cumYoy", (c) => <Delta value={c.cumulativeYoy} size="s" />),
    },
    ...(shareLabel
      ? [{ key: "share", indicator: shareLabel, ...cell("share", (c) => fmtPct(c.share, locale)) }]
      : []),
    { key: "dom", indicator: t("operatorPage.domesticShare"), ...cell("dom", (c) => fmtPct(c.domesticShare, locale)) },
    { key: "esta", indicator: t("operatorPage.establishments"), ...cell("esta", (c) => fmtTableNum(c.esta, locale)) },
    { key: "rooms", indicator: t("operatorPage.rooms"), ...cell("rooms", (c) => fmtTableNum(c.rooms, locale)) },
    { key: "occ", indicator: t("operatorPage.occupancy"), ...cell("occ", (c) => fmtPct(c.occ, locale)) },
    { key: "arr", indicator: t("operatorPage.arr"), ...cell("arr", (c) => fmtEur(c.arr, locale, c.arr != null && Number.isInteger(c.arr) ? 0 : 2)) },
    {
      key: "arrYoy",
      className: "is-sub",
      indicator: t("operatorPage.yoyChange"),
      ...cell("arrYoy", (c) => <Delta value={c.arrYoy} size="s" />),
    },
    { key: "revpar", indicator: t("operatorPage.revpar"), ...cell("revpar", (c) => fmtEur(c.revpar, locale, 2)) },
    ...[0, 1, 2, 3, 4].map((rank) => ({
      key: `o${rank}`,
      className: rank === 0 ? "is-origin" : "is-sub is-origin",
      indicator: t("operatorPage.topOrigin", rank + 1),
      ...cell(`o${rank}`, (c) => {
        const item = originsByKey?.get(c.key)?.[rank];
        if (!item) return "—";
        return (
          <>
            {item.label}
            <span className="op-subvalue"> ({fmtTableNum(item.value, locale)})</span>
          </>
        );
      }),
    })),
  ];
  const shown = originsByKey ? rows : rows.filter((r) => !r.className?.includes("is-origin"));
  return <DataTable caption={accommodatedLabel} maxHeight={720} columns={colDefs} rows={shown} />;
}

function Controls({ residency, setResidency, yearsToShow, setYearsToShow, maxYears }) {
  const { t, locale, region, setRegion } = useApp();
  const options = [ESTONIA, ...COUNTY_LIST, ...CITY_LIST].map((r) => ({
    value: r.id,
    label: regionName(r, locale, { short: r.kind === "county" }),
  }));
  return (
    <div className="op-controls">
      <SelectControl label={t("operatorPage.regionLabel")} value={region.id} onChange={setRegion} options={options} />
      <Segmented
        label={t("operatorPage.guestsLabel")}
        value={residency}
        onChange={setResidency}
        options={RESIDENCY.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
      />
      <label className="years-slider">
        <span className="control-label">{t("operatorPage.lastYears", yearsToShow)}</span>
        <input type="range" min={3} max={Math.max(3, maxYears)} value={yearsToShow} onChange={(e) => setYearsToShow(Number(e.target.value))} />
      </label>
    </div>
  );
}

function NationalBlock({ tourism, capacity, residency, locale, t }) {
  const columns = useMemo(
    () => buildColumns({ tourism, capacity, code: "EE", res: residency, latest: tourism.latest, locale }),
    [tourism, capacity, residency, locale]
  );
  if (!columns.length) return null;
  return (
    <div id="operator-yearly-national">
      <div className="data-grid-wrapper">
        <YearlyTable columns={columns} accommodatedLabel={t("operatorPage.accommodatedEstonia")} locale={locale} t={t} />
      </div>
      <p className="t-meta table-foot">{t("operatorPage.footnote")}</p>
      <Source tables={["TU131", "TU122"]} />
    </div>
  );
}

function RegionBlock({ tourism, capacity, origins, region, residency, yearsToShow, locale, t }) {
  const name = regionName(region, locale);
  const isCountry = region.kind === "country";
  const columns = useMemo(
    () => buildColumns({ tourism, capacity, code: region.code, res: residency, latest: tourism.latest, locale }),
    [tourism, capacity, region, residency, locale]
  );
  const years = chartYears(tourism, yearsToShow);
  const latestP = parsePeriod(tourism.latest);
  const cats = years.map((y) => {
    const ix = yearIndexes(tourism.periods, y);
    return {
      key: String(y),
      label: String(y),
      title: ix.length < 12 ? `${y} (${fmtYtdRange(tourism.latest, locale)})` : String(y),
      partial: ix.length < 12,
      alert: COVID_YEARS.has(y),
    };
  });
  const shareSeries = shareChartSeries({ tourism, code: region.code, years, res: residency });
  const eeGuests = shareSeries.national;
  const share = shareSeries.sharePct;
  const { occ, arr: cost, revpar } = occupancyChartSeries({ capacity, code: region.code, years });

  const originsByKey = useMemo(() => (origins ? originsByColumn(origins, columns, locale) : null), [origins, columns, locale]);

  if (!columns.length) return null;
  const range = [columns[0].label, columns[columns.length - 1].label];

  return (
    <div id="operator-yearly-card" className="stack-l">
      <div className="split-6-6 tile-row-split">
        <ChartFrame
          title={t("operatorPage.trendTitle", name)}
          subtitle={t("operatorPage.trendSub")}
          legend={[
            { label: t("operatorPage.totalEstonia"), color: "var(--c-1)", type: "bar" },
            ...(!isCountry ? [{ label: t("operatorPage.shareOf", name), color: "var(--c-foreign)", type: "line" }] : []),
          ]}
          tables={["TU131"]}
          table={{
            caption: t("operatorPage.trendTitle", name),
            columns: [
              { key: "y", label: t("table.year") },
              { key: "ee", label: t("operatorPage.totalEstonia"), numeric: true },
              ...(!isCountry ? [{ key: "s", label: t("operatorPage.shareOf", name), numeric: true }] : []),
            ],
            rows: years.map((y, i) => ({
              key: y,
              y: cats[i].title,
              ee: fmtInt(eeGuests[i], locale),
              s: fmtPct(share[i], locale),
            })).reverse(),
          }}
        >
          <ComposedChart
            categories={cats}
            bars={{ key: "ee", label: t("operatorPage.totalEstonia"), color: "var(--c-1)", values: eeGuests, alertColor: "var(--neg)" }}
            line={{ key: "s", label: t("operatorPage.shareOf", name), color: "var(--c-foreign)", values: isCountry ? eeGuests.map(() => 100) : share }}
            yFormat={(v) => fmtAxis(v, locale)}
            y2Format={(v) => fmtPct(v, locale, 0)}
            valueFormat={(v) => fmtInt(v, locale)}
            value2Format={(v) => fmtPct(v, locale)}
            partialLabel={t("chart.partialYear")}
            ariaLabel={t("operatorPage.trendTitle", name)}
          />
        </ChartFrame>
        <ChartFrame
          title={t("operatorPage.kpiTitle", name)}
          subtitle={t("operatorPage.kpiSub")}
          legend={[
            { label: t("operatorPage.occupancyPct"), color: "var(--c-3)", type: "bar" },
            { label: t("operatorPage.revparShort"), color: "var(--c-1)", type: "line" },
            { label: t("operatorPage.avgNightRate"), color: "var(--c-2)", type: "line" },
          ]}
          tables={["TU122"]}
          table={{
            caption: t("operatorPage.kpiTitle", name),
            columns: [
              { key: "y", label: t("table.year") },
              { key: "o", label: t("operatorPage.occupancy"), numeric: true },
              { key: "c", label: t("operatorPage.arr"), numeric: true },
              { key: "r", label: t("operatorPage.revparShort"), numeric: true },
            ],
            rows: years.map((y, i) => ({ key: y, y: cats[i].title, o: fmtPct(occ[i], locale), c: fmtEur(cost[i], locale), r: fmtEur(revpar[i], locale, 2) })).reverse(),
          }}
        >
          <ComposedChart
            categories={cats}
            bars={{ key: "o", label: t("operatorPage.occupancyPct"), color: "var(--c-3)", values: occ, alertColor: "var(--neg)" }}
            line={{ key: "c", label: t("operatorPage.avgNightRate"), color: "var(--c-2)", values: cost }}
            lines={[
              {
                key: "revpar",
                label: t("operatorPage.revparShort"),
                color: "var(--c-1)",
                width: 2.4,
                values: revpar,
                showValues: true,
                format: (v) => fmtEur(v, locale, 0),
              },
            ]}
            yFormat={(v) => `${fmtInt(v, locale)}%`}
            y2Format={(v) => `${fmtInt(v, locale)} €`}
            valueFormat={(v) => fmtPct(v, locale)}
            value2Format={(v) => fmtEur(v, locale)}
            partialLabel={t("chart.partialYear")}
            ariaLabel={t("operatorPage.kpiTitle", name)}
          />
        </ChartFrame>
      </div>
      <div>
        <h3 className="chart-title">{t("operatorPage.yearlyHeading", [name, range[0], range[1]])}</h3>
        <p className="t-meta block-sub">{latestP ? t("operatorPage.nationalLead") : null}</p>
        <div className="data-grid-wrapper">
          <YearlyTable
            columns={columns}
            accommodatedLabel={t("operatorPage.accommodatedRegion", name)}
            shareLabel={isCountry ? null : t("operatorPage.shareOfEstonia", name)}
            originsByKey={originsByKey}
            locale={locale}
            t={t}
          />
        </div>
        <p className="t-meta table-foot">{t("operatorPage.footnote")}</p>
        <Source tables={["TU131", "TU122"]} />
      </div>
    </div>
  );
}

function GrowthBlock({ s }) {
  const { t, locale, href } = useApp();
  const growth = s.growthSeries.slice(-36);
  const h = s.growthHighlights;
  const sentence = buildGrowthInsight(h, locale);
  return (
    <>
      {sentence && <p className="chart-insight op-sentence">{sentence}</p>}
      <div className="kpi-row kpi-row--3">
        <Kpi label={t("operatorPage.latestChange")} value={fmtSignedPct(h.latest?.pct, locale)} note={h.latest ? fmtPeriod(h.latest.period, locale) : null} />
        <Kpi label={t("operatorPage.strongestUp")} value={fmtSignedPct(h.strongestIncrease?.pct, locale)} note={h.strongestIncrease ? fmtPeriod(h.strongestIncrease.period, locale) : null} />
        <Kpi label={t("operatorPage.strongestDown")} value={fmtSignedPct(h.strongestDecline?.pct, locale)} note={h.strongestDecline ? fmtPeriod(h.strongestDecline.period, locale) : null} />
      </div>
      <ChartFrame
        title={t("sectorPage.growthTitle")}
        subtitle={t("sectorPage.growthSub")}
        tables={["TU410"]}
        sourceNote={t("sectorPage.revSource")}
        table={{
          caption: t("sectorPage.growthTitle"),
          columns: [
            { key: "p", label: t("table.period") },
            { key: "v", label: t("sectorPage.vGrowth"), numeric: true },
          ],
          rows: growth.map((p) => ({ key: p.period, p: fmtPeriod(p.period, locale), v: fmtSignedPct(p.pct, locale) })).reverse(),
        }}
      >
        <ColumnChart
          categories={growth.map((p) => ({ key: p.period, label: p.period.endsWith("Q1") ? p.period.slice(0, 4) : "", title: fmtPeriod(p.period, locale) }))}
          series={[{ key: "g", label: t("sectorPage.vGrowth"), color: "var(--c-1)", values: growth.map((p) => p.pct) }]}
          signColors
          height={300}
          yFormat={(v) => `${fmtInt(v, locale)}%`}
          valueFormat={(v) => fmtSignedPct(v, locale)}
          ariaLabel={t("sectorPage.growthTitle")}
        />
      </ChartFrame>
      <div className="op-more">
        <ArrowLink to={href("sector")}>{t("operatorPage.toSector")}</ArrowLink>
      </div>
    </>
  );
}

function WageBlock({ s }) {
  const { t, locale, href } = useApp();
  const w = s.wageComparison;
  const sentence = buildWageInsight(w, locale);
  const series = [
    { key: "all", label: t("sectorPage.wageAll"), short: t("sectorPage.wageAllShort"), values: w.map((x) => x.allActivities), color: "var(--c-muted)", width: 1.8 },
    { key: "acc", label: t("sectorPage.wageAcc"), short: t("sectorPage.wageAccShort"), values: w.map((x) => x.accommodation), color: "var(--c-1)", width: 2.4 },
    { key: "share", label: t("sectorPage.wageShare"), short: t("sectorPage.wageShareShort"), values: w.map((x) => x.share), color: "var(--c-2)", width: 1.8, dash: "4 4", axis: "right" },
  ];
  return (
    <>
      {sentence && <p className="chart-insight op-sentence">{sentence}</p>}
      <ChartFrame
        title={t("sectorPage.wageTitle")}
        subtitle={t("sectorPage.wageSub")}
        tables={["PA113"]}
        table={{
          caption: t("sectorPage.wageTitle"),
          columns: [
            { key: "p", label: t("table.period") },
            ...series.map((x) => ({ key: x.key, label: x.label, numeric: true })),
          ],
          rows: w
            .map((x) => ({
              key: x.period,
              p: fmtPeriod(x.period, locale),
              all: fmtEur(x.allActivities, locale, 0),
              acc: fmtEur(x.accommodation, locale, 0),
              share: fmtPct(x.share, locale, 0),
            }))
            .reverse(),
        }}
      >
        <LineChart
          periods={w.map((x) => x.period)}
          series={series}
          height={300}
          zero={false}
          y2Zero
          y2Min={0}
          y2Max={100}
          yFormat={(v) => `${fmtInt(v, locale)} €`}
          y2Format={(v) => `${fmtInt(v, locale)}%`}
          valueFormat={(v) => fmtEur(v, locale, 0)}
          xTick={(p) => (p.endsWith("Q1") ? p.slice(0, 4) : "")}
          tooltipTitle={(p) => fmtPeriod(p, locale)}
          ariaLabel={t("sectorPage.wageTitle")}
        />
      </ChartFrame>
      <div className="op-more">
        <ArrowLink to={href("sector", { hash: "palgad" })}>{t("operatorPage.toSector")}</ArrowLink>
      </div>
    </>
  );
}

export default function Operator() {
  const { t, locale, region } = useApp();
  const tourism = useTourism();
  const capacity = useCapacity();
  const sector = useSector();
  const origins = useOriginHistory(region.code);
  const [residency, setResidency] = useState("WORLD");
  const [yearsToShow, setYearsToShow] = useState(10);
  const maxYears = tourism.data ? yearsIn(tourism.data.periods).length : 10;
  const name = regionName(region, locale);
  const tabs = [
    { id: "eesti", label: t("operatorPage.tabNational") },
    { id: "piirkond", label: t("operatorPage.tabRegion") },
    { id: "kaive", label: t("operatorPage.tabGrowth") },
    { id: "palgad", label: t("operatorPage.tabWages") },
  ];

  return (
    <>
      <PageHeader
        kicker={t("nav.operator")}
        title={t("operatorPage.title")}
        lead={t("operatorPage.lead")}
        tabs={tabs}
        aside={
          <div className="page-controls">
            <LocatorMap code={region.code} className="page-locator" title={name} />
            <div className="page-controls-row">
              <RegionPicker variant="page" />
              <ScopeBadge region={name} period={tourism.data ? fmtPeriod(tourism.data.latest, locale) : "…"} />
            </div>
          </div>
        }
      />

      <Section id="eesti" tone="paper" labelledBy="op-nat">
        <SectionHead id="op-nat" kicker={t("operatorPage.tabNational")} title={t("operatorPage.nationalHead")} lead={t("operatorPage.nationalLead")} />
        <Controls residency={residency} setResidency={setResidency} yearsToShow={yearsToShow} setYearsToShow={setYearsToShow} maxYears={maxYears} />
        <Async
          state={{
            data: tourism.data && capacity.data ? { tourism: tourism.data, capacity: capacity.data } : null,
            error: tourism.error || capacity.error,
          }}
          height={420}
        >
          {({ tourism: d, capacity: c }) => (
            <>
              <h3 className="chart-title">
                {t("operatorPage.nationalHeading", [
                  String(MIN_TABLE_YEAR),
                  monthColLabel(d.latest, locale),
                ])}
              </h3>
              <NationalBlock tourism={d} capacity={c} residency={residency} locale={locale} t={t} />
            </>
          )}
        </Async>
      </Section>

      <Section id="piirkond" tone="white" labelledBy="op-reg">
        <SectionHead
          id="op-reg"
          kicker={t("operatorPage.tabRegion")}
          title={t("operatorPage.regionHead")}
          lead={region.kind === "country" ? t("operatorPage.pickRegion") : t("operatorPage.regionLead")}
          aside={<ScopeBadge region={name} period={tourism.data ? fmtPeriod(tourism.data.latest, locale) : "…"} />}
        />
        {tourism.data && capacity.data ? (
          <RegionBlock
            tourism={tourism.data}
            capacity={capacity.data}
            origins={origins.data}
            region={region}
            residency={residency}
            yearsToShow={yearsToShow}
            locale={locale}
            t={t}
          />
        ) : (
          <Skeleton height={640} />
        )}
      </Section>

      <Section id="kaive" tone="paper" labelledBy="op-growth">
        {region.kind !== "country" && <NationalNotice regionLabel={name} text={t("sector.notice")} />}
        <SectionHead
          id="op-growth"
          kicker={t("operatorPage.tabGrowth")}
          title={t("operatorPage.growthHead")}
          lead={t("operatorPage.growthLead")}
          aside={<ScopeBadge nationalOnly period={sector.data ? fmtPeriod(sector.data.latestRevenue?.period, locale) : "…"} reason={t("sector.why")} />}
        />
        <Async state={sector} height={480}>
          {(s) => <GrowthBlock s={s} />}
        </Async>
      </Section>

      <Section id="palgad" tone="white" labelledBy="op-wage">
        {region.kind !== "country" && <NationalNotice regionLabel={name} text={t("sector.notice")} />}
        <SectionHead
          id="op-wage"
          kicker={t("operatorPage.tabWages")}
          title={t("operatorPage.wageHead")}
          lead={t("operatorPage.wageLead")}
          aside={<ScopeBadge nationalOnly period={sector.data?.wageComparison.at(-1) ? fmtPeriod(sector.data.wageComparison.at(-1).period, locale) : "…"} reason={t("sector.why")} />}
        />
        <Async state={sector} height={420}>
          {(s) => <WageBlock s={s} />}
        </Async>
      </Section>
    </>
  );
}
