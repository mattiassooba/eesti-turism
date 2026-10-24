import { useMemo, useState } from "react";
import { useApp } from "../state/AppState.jsx";
import { useCapacity, useLongRun } from "../data/datasets.js";
import { capacitySummary } from "../data/metrics.js";
import { ESTONIA, REGIONS, regionName } from "../lib/regions.js";
import { fmtInt, fmtDec, fmtPeriod, fmtPp, fmtSignedPct, fmtMonthTick, monthName, parsePeriod, fmtAxis, fmtOcc, fmtCost } from "../lib/format.js";
import PageHeader from "../components/layout/PageHeader.jsx";
import RegionPicker from "../components/layout/RegionPicker.jsx";
import { Section, SectionHead, Segmented, Kpi, ScopeBadge, NationalNotice } from "../components/ui/Primitives.jsx";
import { Async, Skeleton } from "../components/ui/States.jsx";
import ChartFrame from "../components/charts/ChartFrame.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import ColumnChart from "../components/charts/ColumnChart.jsx";
import { COVID_BAND } from "./home/TrendSection.jsx";
import { PROFILE_PERIODS, useYearProfiles } from "./home/AccommodationSection.jsx";

const OCC_OPTIONS = ["OCC_OR_BEDR", "OCC_OR_BEDP"];

function KeyFigures({ region }) {
  const { t, locale } = useApp();
  const capacity = useCapacity();
  return (
    <Async state={capacity} height={160}>
      {(d) => {
        const c = capacitySummary(d, region.code);
        const p = parsePeriod(c.period);
        const prev = fmtPeriod(`${p.year - 1}M${String(p.month).padStart(2, "0")}`, locale);
        return (
          <div className="kpi-row kpi-row--5">
            <Kpi label={t("kpi.roomOcc")} value={fmtOcc(c.roomOcc, locale)} delta={c.roomOccDiff} deltaUnit="pp" deltaLabel={t("common.vs", prev)} />
            <Kpi label={t("kpi.bedOcc")} value={fmtOcc(c.bedOcc, locale)} delta={c.bedOccDiff} deltaUnit="pp" deltaLabel={t("common.vs", prev)} />
            <Kpi label={t("kpi.cost")} value={fmtCost(c.cost, locale)} delta={c.costYoy} deltaLabel={t("common.vs", prev)} note={t("kpi.costNote")} />
            <Kpi label={t("kpi.establishments")} value={fmtInt(c.establishments, locale)} note={t("kpi.roomsBeds", [fmtInt(c.rooms, locale), fmtInt(c.beds, locale)])} />
            <Kpi label={t("kpi.bedsPerEst")} value={c.establishments ? fmtDec(c.beds / c.establishments, locale, 0) : "—"} note={t("kpi.bedsPerEstNote")} />
          </div>
        );
      }}
    </Async>
  );
}

function Occupancy({ region }) {
  const { t, locale } = useApp();
  const capacity = useCapacity();
  const [occ, setOcc] = useState("OCC_OR_BEDR");
  const [range, setRange] = useState("10y");
  const profiles = useYearProfiles(capacity.data, region.code, occ);
  const rName = regionName(region, locale);
  const occLabel = (k) => t(k === "OCC_OR_BEDR" ? "kpi.roomOccShort" : "kpi.bedOccShort");
  const control = (
    <Segmented label={t("controls.metric")} hideLabel value={occ} onChange={setOcc} options={OCC_OPTIONS.map((k) => ({ value: k, label: occLabel(k) }))} />
  );
  return (
    <Async state={capacity} height={520}>
      {(d) => {
        const end = d.latestIdx;
        const start = range === "all" ? 0 : Math.max(0, end - 119);
        const periods = d.periods.slice(start, end + 1);
        const series = OCC_OPTIONS.map((k) => ({
          key: k,
          label: occLabel(k),
          values: d.get(k, region.code).slice(start, end + 1),
          color: k === "OCC_OR_BEDR" ? "var(--c-1)" : "var(--c-foreign)",
          width: k === occ ? 2.4 : 1.6,
          muted: k !== occ,
        }));
        return (
          <div className="stack-l">
            <div className="split-8-4">
              <ChartFrame
                title={t(occ === "OCC_OR_BEDR" ? "acc.profileRoom" : "acc.profileBed", rName)}
                subtitle={t("acc.profileSub")}
                controls={control}
                tables={["TU122"]}
                table={{
                  caption: t(occ === "OCC_OR_BEDR" ? "acc.profileRoom" : "acc.profileBed", rName),
                  columns: [{ key: "m", label: t("table.month") }, ...profiles.map((s) => ({ key: s.key, label: s.label, numeric: true }))],
                  rows: PROFILE_PERIODS.map((_, i) => ({ key: i, m: monthName(i, locale), ...Object.fromEntries(profiles.map((s) => [s.key, fmtOcc(s.values[i], locale)])) })),
                }}
              >
                <LineChart
                  periods={PROFILE_PERIODS}
                  series={profiles}
                  height={340}
                  yFormat={(v) => `${v}%`}
                  valueFormat={(v) => fmtOcc(v, locale)}
                  xTick={(code) => monthName(parsePeriod(code).month - 1, locale, true)}
                  tooltipTitle={(code) => monthName(parsePeriod(code).month - 1, locale)}
                  yMax={100}
                  ariaLabel={t("acc.profileAria", rName)}
                />
              </ChartFrame>
              <aside className="definitions" aria-label={t("acc.defsLabel")}>
                <h3 className="t-label">{t("acc.defsLabel")}</h3>
                <dl>
                  <dt>{t("kpi.roomOcc")}</dt>
                  <dd>{t("acc.defRoom")}</dd>
                  <dt>{t("kpi.bedOcc")}</dt>
                  <dd>{t("acc.defBed")}</dd>
                </dl>
              </aside>
            </div>
            <ChartFrame
              title={t("accPage.longTitle", rName)}
              subtitle={t("accPage.longSub")}
              controls={
                <Segmented label={t("controls.range")} hideLabel value={range} onChange={setRange} options={[{ value: "10y", label: t("accPage.r10y") }, { value: "all", label: t("accPage.rAll", parsePeriod(d.periods[0]).year) }]} />
              }
              tables={["TU122"]}
              table={{
                caption: t("accPage.longTitle", rName),
                columns: [{ key: "p", label: t("table.period") }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))],
                rows: periods.map((per, i) => ({ key: per, p: fmtPeriod(per, locale), ...Object.fromEntries(series.map((s) => [s.key, fmtOcc(s.values[i], locale)])) })).reverse(),
              }}
            >
              <LineChart
                periods={periods}
                series={series}
                height={320}
                yFormat={(v) => `${v}%`}
                valueFormat={(v) => fmtOcc(v, locale)}
                xTick={(per) => fmtMonthTick(per, locale)}
                tooltipTitle={(per) => fmtPeriod(per, locale)}
                bands={[{ ...COVID_BAND, label: t("chart.covid") }]}
                yMax={100}
                ariaLabel={t("accPage.longTitle", rName)}
              />
            </ChartFrame>
          </div>
        );
      }}
    </Async>
  );
}

function Price({ region }) {
  const { t, locale } = useApp();
  const capacity = useCapacity();
  const rName = regionName(region, locale);
  return (
    <Async state={capacity} height={440}>
      {(d) => {
        const end = d.latestIdx;
        const start = Math.max(12, end - 59);
        const arr = d.get("OCC_NI_COST", region.code);
        const periods = d.periods.slice(start, end + 1);
        const series = [
          { key: "prev", label: t("chart.yearEarlier"), short: t("chart.yearEarlierShort"), values: periods.map((_, i) => arr[start + i - 12] ?? null), color: "var(--c-muted)", dash: "4 4", muted: true, width: 1.6 },
          { key: "cur", label: t("kpi.cost"), short: t("accPage.costShort"), values: arr.slice(start, end + 1), color: "var(--c-1)", width: 2.4, area: true },
        ];
        return (
          <div className="split-8-4">
            <ChartFrame
              title={t("accPage.priceTitle", rName)}
              subtitle={t("accPage.priceSub")}
              tables={["TU122"]}
              table={{
                caption: t("accPage.priceTitle", rName),
                columns: [{ key: "p", label: t("table.period") }, { key: "cur", label: t("kpi.cost"), numeric: true }, { key: "prev", label: t("chart.yearEarlier"), numeric: true }],
                rows: periods.map((per, i) => ({ key: per, p: fmtPeriod(per, locale), cur: fmtCost(series[1].values[i], locale), prev: fmtCost(series[0].values[i], locale) })).reverse(),
              }}
            >
              <LineChart
                periods={periods}
                series={series}
                height={320}
                zero={false}
                yFormat={(v) => `${fmtInt(v, locale)} €`}
                valueFormat={(v) => fmtCost(v, locale)}
                xTick={(per) => fmtMonthTick(per, locale)}
                tooltipTitle={(per) => fmtPeriod(per, locale)}
                ariaLabel={t("accPage.priceTitle", rName)}
              />
            </ChartFrame>
            <aside className="definitions" aria-label={t("accPage.priceDefTitle")}>
              <h3 className="t-label">{t("accPage.priceDefTitle")}</h3>
              <dl>
                <dt>{t("kpi.cost")}</dt>
                <dd>{t("acc.defCost")}</dd>
                <dt>{t("accPage.notAdr")}</dt>
                <dd>{t("accPage.notAdrText")}</dd>
              </dl>
            </aside>
          </div>
        );
      }}
    </Async>
  );
}

const CAP_METRICS = [
  { key: "CAP_ESTA", label: "kpi.establishments" },
  { key: "CAP_BEDR", label: "accPage.rooms" },
  { key: "CAP_BEDP", label: "accPage.beds" },
];

function Capacity({ region }) {
  const { t, locale } = useApp();
  const capacity = useCapacity();
  const longRun = useLongRun();
  const [metric, setMetric] = useState("CAP_BEDP");
  const rName = regionName(region, locale);
  const mLabel = t(CAP_METRICS.find((m) => m.key === metric).label);
  const control = <Segmented label={t("controls.metric")} hideLabel value={metric} onChange={setMetric} options={CAP_METRICS.map((m) => ({ value: m.key, label: t(m.label) }))} />;
  return (
    <div className="stack-l">
      <Async state={capacity} height={400}>
        {(d) => {
          const end = d.latestIdx;
          const start = Math.max(0, end - 119);
          const periods = d.periods.slice(start, end + 1);
          const values = d.get(metric, region.code).slice(start, end + 1);
          return (
            <ChartFrame
              title={t("accPage.capTitle", [mLabel, rName])}
              subtitle={t("accPage.capSub")}
              controls={control}
              tables={["TU122"]}
              table={{
                caption: t("accPage.capTitle", [mLabel, rName]),
                columns: [{ key: "p", label: t("table.period") }, { key: "v", label: mLabel, numeric: true }],
                rows: periods.map((per, i) => ({ key: per, p: fmtPeriod(per, locale), v: fmtInt(values[i], locale) })).reverse(),
              }}
            >
              <LineChart
                periods={periods}
                series={[{ key: "v", label: mLabel, values, color: "var(--c-1)", width: 2.2, area: true }]}
                height={300}
                yFormat={(v) => fmtAxis(v, locale)}
                valueFormat={(v) => fmtInt(v, locale)}
                xTick={(per) => fmtMonthTick(per, locale)}
                tooltipTitle={(per) => fmtPeriod(per, locale)}
                bands={[{ ...COVID_BAND, label: t("chart.covid") }]}
                ariaLabel={t("accPage.capTitle", [mLabel, rName])}
              />
            </ChartFrame>
          );
        }}
      </Async>
      <div>
        {region.kind !== "country" && <NationalNotice regionLabel={rName} text={t("accPage.longRunNational")} />}
        <Async state={longRun} height={360}>
          {(l) => {
            const values = l.get(metric);
            const cats = l.periods.map((y) => ({ key: y, label: y }));
            return (
              <ChartFrame
                title={t("accPage.longRunTitle", [mLabel, l.periods[0]])}
                subtitle={t("accPage.longRunSub")}
                scope={<ScopeBadge nationalOnly region={regionName(ESTONIA, locale)} period={`${l.periods[0]}–${l.periods.at(-1)}`} compact />}
                tables={["TU11"]}
                table={{
                  caption: t("accPage.longRunTitle", [mLabel, l.periods[0]]),
                  columns: [{ key: "y", label: t("table.year") }, { key: "v", label: mLabel, numeric: true }],
                  rows: l.periods.map((y, i) => ({ key: y, y, v: fmtInt(values[i], locale) })).reverse(),
                }}
              >
                <ColumnChart
                  categories={cats}
                  series={[{ key: "v", label: mLabel, color: "var(--c-2)", values }]}
                  height={280}
                  yFormat={(v) => fmtAxis(v, locale)}
                  valueFormat={(v) => fmtInt(v, locale)}
                  tickEvery={4}
                  ariaLabel={t("accPage.longRunTitle", [mLabel, l.periods[0]])}
                />
              </ChartFrame>
            );
          }}
        </Async>
      </div>
    </div>
  );
}

const RANK_COLS = ["roomOcc", "roomOccDiff", "bedOcc", "cost", "costYoy", "establishments", "beds"];

function RegionRanking({ region }) {
  const { t, locale, setRegion } = useApp();
  const capacity = useCapacity();
  const [sort, setSort] = useState({ key: "roomOcc", dir: -1 });
  const rows = useMemo(() => (capacity.data ? REGIONS.map((r) => ({ r, ...capacitySummary(capacity.data, r.code) })) : null), [capacity.data]);
  if (!rows) return <Skeleton height={600} />;
  const sorted = [...rows].sort((a, b) => {
    if (a.r.kind === "country") return -1;
    if (b.r.kind === "country") return 1;
    return ((a[sort.key] ?? -Infinity) - (b[sort.key] ?? -Infinity)) * sort.dir;
  });
  const fmt = {
    roomOcc: (v) => fmtOcc(v, locale),
    roomOccDiff: (v) => (v == null ? "—" : fmtPp(v, locale)),
    bedOcc: (v) => fmtOcc(v, locale),
    cost: (v) => fmtCost(v, locale),
    costYoy: (v) => (v == null ? "—" : fmtSignedPct(v, locale)),
    establishments: (v) => fmtInt(v, locale),
    beds: (v) => fmtInt(v, locale),
  };
  return (
    <>
      <p className="t-meta block-sub">{t("accPage.rankSub", fmtPeriod(rows[0].period, locale))}</p>
      <div className="data-table-wrap" style={{ maxHeight: "none" }} role="region" aria-label={t("accPage.rankTitle")} tabIndex={0}>
        <table className="data-table has-sticky-col all-regions">
          <caption className="sr-only">{t("accPage.rankTitle")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("regions.colRegion")}</th>
              {RANK_COLS.map((k) => (
                <th key={k} scope="col" className="is-num" aria-sort={sort.key === k ? (sort.dir < 0 ? "descending" : "ascending") : "none"}>
                  <button type="button" className="sort-btn" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : -1 }))}>
                    {t(`accPage.col.${k}`)}
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
              <tr key={row.r.code} className={(row.r.code === region.code ? "is-highlight" : "") + (row.r.kind === "country" ? " is-total" : "") + (row.r.kind === "city" ? " is-city" : "")}>
                <th scope="row">
                  <button type="button" className="row-link" onClick={() => setRegion(row.r.id)}>
                    {regionName(row.r, locale, { short: row.r.kind === "county" })}
                  </button>
                </th>
                {RANK_COLS.map((k) => (
                  <td key={k} className="is-num num">
                    {fmt[k](row[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="t-meta block-note">{t("accPage.rankNote")}</p>
    </>
  );
}

export default function Accommodation() {
  const { t, locale, region } = useApp();
  const capacity = useCapacity();
  const rName = regionName(region, locale);
  const tabs = [
    { id: "taituvus", label: t("accPage.tabOcc") },
    { id: "hind", label: t("accPage.tabPrice") },
    { id: "mahutavus", label: t("accPage.tabCap") },
    { id: "vordlus", label: t("accPage.tabRank") },
  ];
  return (
    <>
      <PageHeader
        kicker={t("nav.accommodation")}
        title={t("accPage.title", rName)}
        lead={t("accPage.lead")}
        tabs={tabs}
        aside={
          <div className="page-controls">
            <ScopeBadge region={rName} period={capacity.data ? fmtPeriod(capacity.data.latest, locale) : "…"} />
            <RegionPicker variant="page" />
          </div>
        }
      />
      <Section id="taituvus" tone="paper" labelledBy="a-occ">
        <SectionHead id="a-occ" kicker={t("accPage.tabOcc")} title={t("accPage.occTitle")} lead={t("acc.lead")} />
        <KeyFigures region={region} />
        <Occupancy region={region} />
      </Section>
      <Section id="hind" tone="white" labelledBy="a-price">
        <SectionHead id="a-price" kicker={t("accPage.tabPrice")} title={t("accPage.priceHead")} lead={t("accPage.priceLead")} />
        <Price region={region} />
      </Section>
      <Section id="mahutavus" tone="paper" labelledBy="a-cap">
        <SectionHead id="a-cap" kicker={t("accPage.tabCap")} title={t("accPage.capHead")} lead={t("accPage.capLead")} />
        <Capacity region={region} />
      </Section>
      <Section id="vordlus" tone="white" labelledBy="a-rank">
        <SectionHead id="a-rank" kicker={t("accPage.tabRank")} title={t("accPage.rankTitle")} lead={t("accPage.rankLead")} />
        <RegionRanking region={region} />
      </Section>
    </>
  );
}
