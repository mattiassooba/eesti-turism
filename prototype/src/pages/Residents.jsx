import { useState } from "react";
import { useApp } from "../state/AppState.jsx";
import { useResidents, RES_PURPOSES, DESTINATIONS, ACCOM_TYPES, DURATIONS, EXP_CATEGORIES } from "../data/datasets.js";
import { regionName } from "../lib/regions.js";
import { fmtInt, fmtDec, fmtEur, fmtPeriod, countryName, fmtCompact } from "../lib/format.js";
import { pctChange, sumRange, lastIndex } from "../data/derive.js";
import PageHeader from "../components/layout/PageHeader.jsx";
import { Section, SectionHead, Segmented, Kpi, ScopeBadge, NationalNotice, Source } from "../components/ui/Primitives.jsx";
import { Async } from "../components/ui/States.jsx";
import ChartFrame from "../components/charts/ChartFrame.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import ColumnChart from "../components/charts/ColumnChart.jsx";
import { BarList, SplitBar } from "../components/charts/Small.jsx";
const PURPOSE_COLORS = { PERS_HOL: "var(--c-1)", PERS_VFR: "var(--c-3)", PROF: "var(--c-2)", PERS_OTH: "var(--c-muted)" };
const ACCOM_COLORS = { R_HOT: "var(--c-1)", R_CAMP: "var(--c-3)", R_OTH: "var(--sea-300, #8fb8d3)", NR_OWN: "var(--c-foreign)", NR_RF: "var(--c-2)", NR_OTH: "var(--c-muted)" };
const DUR_COLORS = { "N1-3": "var(--c-3)", "N4-7": "var(--c-1)", N_GT7: "var(--c-2)" };
const EXP_COLORS = { EXP_TRA: "var(--c-2)", EXP_ACC: "var(--c-1)", EXP_REST: "var(--c-3)", EXP_OTH: "var(--c-muted)" };
const Q_COVID = { from: "2020Q2", to: "2021Q4" };

const thousand = (t, v, locale) => (v == null ? "—" : t("res.thousandTrips", fmtDec(v, locale, 1)));
const mlnEur = (v, locale) => (v == null ? "—" : locale === "et" ? `${fmtDec(v / 1e6, locale, 0)} mln €` : `€${fmtDec(v / 1e6, locale, 0)}M`);

function KeyFigures({ r }) {
  const { t, locale } = useApp();
  const dom = r.trips.get("TR_DOM|TOTAL");
  const out = r.trips.get("TR_OUT|TOTAL");
  const i = lastIndex(dom);
  const p = r.trips.periods[i];
  const ds = r.domSpend.get("TOTAL");
  const di = lastIndex(ds);
  const os = r.outSpend.get("EXP_OUT");
  const oi = lastIndex(os);
  return (
    <div className="kpi-row kpi-row--4">
      <Kpi label={t("res.kpiDom", fmtPeriod(p, locale))} value={thousand(t, dom[i], locale)} delta={pctChange(dom[i], dom[i - 4])} deltaLabel={t("res.vsYearAgoQuarter")} note={t("resPage.tripsUnit")} />
      <Kpi label={t("res.kpiOut", fmtPeriod(p, locale))} value={thousand(t, out[i], locale)} delta={pctChange(out[i], out[i - 4])} deltaLabel={t("res.vsYearAgoQuarter")} note={t("resPage.tripsUnit")} />
      <Kpi label={t("res.kpiDomSpend", fmtPeriod(r.domSpend.periods[di], locale))} value={fmtEur(ds[di], locale, 0)} delta={pctChange(ds[di], ds[di - 4])} deltaLabel={t("res.vsYearAgoQuarter")} note={t("resPage.perTrip")} />
      <Kpi label={t("res.kpiOutSpend", fmtPeriod(r.outSpend.periods[oi], locale))} value={fmtEur(os[oi], locale, 0)} delta={pctChange(os[oi], os[oi - 4])} deltaLabel={t("res.vsYearAgoQuarter")} note={t("resPage.perTrip")} />
    </div>
  );
}

function Trips({ r }) {
  const { t, locale } = useApp();
  const [view, setView] = useState("total");
  const [range, setRange] = useState("10y");
  const all = r.trips.periods;
  const start = range === "all" ? 0 : Math.max(0, all.length - 40);
  const periods = all.slice(start);
  const cut = (arr) => arr.slice(start);
  const series =
    view === "total"
      ? [
          { key: "dom", label: t("resPage.domTrips"), values: cut(r.trips.get("TR_DOM|TOTAL")), color: "var(--c-domestic)", width: 2.4 },
          { key: "out", label: t("resPage.outTrips"), values: cut(r.trips.get("TR_OUT|TOTAL")), color: "var(--c-foreign)", width: 2.4 },
        ]
      : RES_PURPOSES.map((k) => ({ key: k, label: t(`resPage.purpose.${k}`), values: cut(r.trips.get(`${view === "dom" ? "TR_DOM" : "TR_OUT"}|${k}`)), color: PURPOSE_COLORS[k], width: k === "PERS_HOL" ? 2.4 : 1.8 }));
  const title = view === "total" ? t("resPage.tripsTitle") : t(view === "dom" ? "resPage.tripsDomPurpose" : "resPage.tripsOutPurpose");
  return (
    <ChartFrame
      title={title}
      subtitle={t("resPage.tripsSub")}
      controls={
        <>
          <Segmented
            label={t("controls.view")}
            hideLabel
            value={view}
            onChange={setView}
            options={[
              { value: "total", label: t("resPage.vTotal") },
              { value: "dom", label: t("resPage.vDomPurpose") },
              { value: "out", label: t("resPage.vOutPurpose") },
            ]}
          />
          <Segmented
            label={t("controls.range")}
            hideLabel
            value={range}
            onChange={setRange}
            options={[
              { value: "10y", label: t("accPage.r10y") },
              { value: "all", label: t("accPage.rAll", all[0]?.slice(0, 4)) },
            ]}
          />
        </>
      }
      tables={["TU51"]}
      table={{
        caption: title,
        columns: [{ key: "p", label: t("table.period") }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))],
        rows: periods.map((p, i) => ({ key: p, p: fmtPeriod(p, locale), ...Object.fromEntries(series.map((s) => [s.key, fmtDec(s.values[i], locale, 1)])) })).reverse(),
      }}
    >
      <LineChart
        periods={periods}
        series={series}
        height={360}
        yFormat={(v) => fmtInt(v, locale)}
        valueFormat={(v) => thousand(t, v, locale)}
        xTick={(p) => (p.endsWith("Q1") ? p.slice(0, 4) : "")}
        tooltipTitle={(p) => fmtPeriod(p, locale)}
        bands={[{ ...Q_COVID, label: t("chart.covid") }]}
        ariaLabel={title}
      />
    </ChartFrame>
  );
}

function Spending({ r }) {
  const { t, locale } = useApp();
  const e = r.expType;
  const years = e.periods;
  const last = years.length - 1;
  const g = (ind, kind, type) => e.get(`${ind}|${kind}|${type}`);
  const catSegs = (type) =>
    EXP_CATEGORIES.map((k) => ({ label: t(`resPage.exp.${k}`), value: g(k, "SUM_EXP", type)[last], color: EXP_COLORS[k] }));
  const avgRows = [
    { key: "trip", label: t("resPage.avgTrip"), dom: g("EXP", "AVG_EXP_TRP", "DOM")[last], out: g("EXP", "AVG_EXP_TRP", "OUT")[last] },
    { key: "night", label: t("resPage.avgNight"), dom: g("EXP", "AVG_EXP_NGT", "DOM")[last], out: g("EXP", "AVG_EXP_NGT", "OUT")[last] },
    { key: "acc", label: t("resPage.avgAccNight"), dom: g("EXP_ACC", "AVG_EXP_NGT", "DOM")[last], out: g("EXP_ACC", "AVG_EXP_NGT", "OUT")[last] },
  ];
  return (
    <div className="stack-l">
      <div className="split-7-5">
        <ChartFrame
          title={t("resPage.spendTitle")}
          subtitle={t("resPage.spendSub")}
          legend={[
            { label: t("resPage.domTrips"), color: "var(--c-domestic)", type: "bar" },
            { label: t("resPage.outTrips"), color: "var(--c-foreign)", type: "bar" },
          ]}
          tables={["TU552"]}
          table={{
            caption: t("resPage.spendTitle"),
            columns: [
              { key: "y", label: t("table.year") },
              { key: "d", label: t("resPage.domTrips"), numeric: true },
              { key: "o", label: t("resPage.outTrips"), numeric: true },
            ],
            rows: years.map((y, i) => ({ key: y, y, d: mlnEur(g("EXP", "SUM_EXP", "DOM")[i], locale), o: mlnEur(g("EXP", "SUM_EXP", "OUT")[i], locale) })).reverse(),
          }}
        >
          <ColumnChart
            categories={years.map((y) => ({ key: y, label: y }))}
            series={[
              { key: "d", label: t("resPage.domTrips"), color: "var(--c-domestic)", values: g("EXP", "SUM_EXP", "DOM").map((v) => (v == null ? null : v / 1e6)) },
              { key: "o", label: t("resPage.outTrips"), color: "var(--c-foreign)", values: g("EXP", "SUM_EXP", "OUT").map((v) => (v == null ? null : v / 1e6)) },
            ]}
            height={300}
            yFormat={(v) => (locale === "et" ? `${fmtInt(v, locale)} mln` : `${fmtInt(v, locale)}M`)}
            valueFormat={(v) => mlnEur(v * 1e6, locale)}
            ariaLabel={t("resPage.spendTitle")}
          />
        </ChartFrame>
        <div>
          <h3 className="t-h3">{t("resPage.avgTitle", years[last])}</h3>
          <div className="data-table-wrap" style={{ maxHeight: "none", marginTop: "var(--s-4)" }}>
            <table className="data-table">
              <caption className="sr-only">{t("resPage.avgTitle", years[last])}</caption>
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col" className="is-num">{t("resPage.domShort")}</th>
                  <th scope="col" className="is-num">{t("resPage.outShort")}</th>
                </tr>
              </thead>
              <tbody>
                {avgRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td className="is-num num">{fmtEur(row.dom, locale, 0)}</td>
                    <td className="is-num num">{fmtEur(row.out, locale, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Source tables={["TU552"]} note={t("resPage.avgNote")} />
        </div>
      </div>
      <div className="split-6-6">
        <div>
          <p className="block-label">{t("resPage.catDom", years[last])}</p>
          <SplitBar segments={catSegs("DOM")} height={16} format={(v) => mlnEur(v, locale)} />
        </div>
        <div>
          <p className="block-label">{t("resPage.catOut", years[last])}</p>
          <SplitBar segments={catSegs("OUT")} height={16} format={(v) => mlnEur(v, locale)} />
        </div>
      </div>
    </div>
  );
}

function Destinations({ r }) {
  const { t, locale } = useApp();
  const dp = r.destinations.periods;
  const j = dp.length - 1;
  const items = DESTINATIONS.map((code) => {
    const value = sumRange(r.destinations.get(code), j - 3, j);
    const prev = sumRange(r.destinations.get(code), j - 7, j - 4);
    return { key: code, label: countryName(code, locale), value, delta: pctChange(value, prev) };
  })
    .filter((x) => x.value != null)
    .sort((a, b) => b.value - a.value)
    .map((x, k) => ({ ...x, rank: k + 1 }));
  const total = sumRange(r.destinations.get("TOTAL"), j - 3, j);
  const listed = items.length === DESTINATIONS.length ? items.reduce((s, x) => s + x.value, 0) : null;
  return (
    <div className="split-7-5">
      <div>
        <p className="t-meta block-sub">{t("res.destSub", [fmtPeriod(dp[j - 3], locale), fmtPeriod(dp[j], locale)])}</p>
        <BarList items={items} format={(v) => thousand(t, v, locale)} deltaLabel={t("resPage.vsPrev4")} />
        <Source tables={["TU63"]} note={t("resPage.destNote")} />
      </div>
      <aside className="definitions">
        <h3 className="t-label">{t("resPage.destOtherTitle")}</h3>
        <p className="big-num num">{total && listed ? fmtDec(((total - listed) / total) * 100, locale, 0) + "%" : "—"}</p>
        <p className="t-meta">{t("resPage.destOther", fmtCompact(total * 1000, locale))}</p>
      </aside>
    </div>
  );
}

function StayAndLodging({ r }) {
  const { t, locale } = useApp();
  const du = r.duration;
  const ac = r.accommodation;
  const dRange = `${fmtPeriod(du.periods[Math.max(0, du.periods.length - 4)], locale)} – ${fmtPeriod(du.periods.at(-1), locale)}`;
  const aP = fmtPeriod(ac.periods.at(-1), locale);
  const durSegs = (ind) =>
    DURATIONS.map((k) => ({ label: t(`resPage.dur.${k}`), value: sumRange(du.get(`${ind}|${k}`), du.periods.length - 4, du.periods.length - 1), color: DUR_COLORS[k] }));
  const accSegs = (ind) => {
    const segs = ACCOM_TYPES.map((k) => ({ label: t(`resPage.acc.${k}`), value: ac.get(`${ind}|${k}`).at(-1), color: ACCOM_COLORS[k] }));
    const total = ac.get(`${ind}|TOTAL`).at(-1);
    const missing = segs.filter((s) => s.value == null);
    if (!missing.length || total == null) return segs;
    const known = segs.filter((s) => s.value != null);
    const rest = total - known.reduce((a, s) => a + s.value, 0);
    return [...known, { label: t("resPage.unpublished", missing.map((s) => s.label).join(", ")), value: Math.max(0, rest), color: "var(--line-2)" }];
  };
  const ok = (segs) => segs.every((s) => s.value != null);
  const block = (label, segs, fmt) => (
    <div className="composition-block">
      <p className="block-label">{label}</p>
      {ok(segs) ? <SplitBar segments={segs} height={14} format={fmt} /> : <p className="t-meta">{t("suppressed.split")}</p>}
    </div>
  );
  return (
    <div className="split-6-6">
      <div className="composition">
        <h3 className="t-h3">{t("resPage.durTitle")}</h3>
        <p className="t-meta block-sub">{t("resPage.durSub", dRange)}</p>
        {block(t("resPage.domTrips"), durSegs("TR_DOM"), (v) => thousand(t, v, locale))}
        {block(t("resPage.outTrips"), durSegs("TR_OUT"), (v) => thousand(t, v, locale))}
        <Source tables={["TU54"]} />
      </div>
      <div className="composition">
        <h3 className="t-h3">{t("resPage.accTitle")}</h3>
        <p className="t-meta block-sub">{t("resPage.accSub", aP)}</p>
        {block(t("resPage.domNights"), accSegs("N_DOM"), (v) => t("resPage.thousandNights", fmtDec(v, locale, 0)))}
        {block(t("resPage.outNights"), accSegs("N_OUT"), (v) => t("resPage.thousandNights", fmtDec(v, locale, 0)))}
        <Source tables={["TU551"]} />
      </div>
    </div>
  );
}

export default function Residents() {
  const { t, locale, region } = useApp();
  const residents = useResidents();
  const tabs = [
    { id: "reisid", label: t("resPage.tabTrips") },
    { id: "kulutused", label: t("resPage.tabSpend") },
    { id: "sihtriigid", label: t("resPage.tabDest") },
    { id: "kestus", label: t("resPage.tabStay") },
  ];
  const period = residents.data ? residents.data.trips.periods[lastIndex(residents.data.trips.get("TR_DOM|TOTAL"))] : null;
  return (
    <>
      <PageHeader
        kicker={t("nav.residents")}
        title={t("resPage.title")}
        lead={t("res.lead")}
        tabs={tabs}
        aside={
          <div className="page-controls">
            <ScopeBadge nationalOnly period={period ? fmtPeriod(period, locale) : "…"} reason={t("res.why")} />
          </div>
        }
      />
      <Async state={residents} height={900}>
        {(r) => (
          <>
            <Section id="reisid" tone="paper" labelledBy="r-trips">
              {region.kind !== "country" && <NationalNotice regionLabel={regionName(region, locale)} text={t("res.notice")} />}
              <SectionHead id="r-trips" kicker={t("resPage.tabTrips")} title={t("resPage.tripsHead")} lead={t("resPage.tripsLead")} />
              <div className="definition res-def">
                <strong>{t("resPage.notSameTitle")}</strong> {t("resPage.notSame")}
              </div>
              <KeyFigures r={r} />
              <Trips r={r} />
            </Section>
            <Section id="kulutused" tone="white" labelledBy="r-spend">
              <SectionHead id="r-spend" kicker={t("resPage.tabSpend")} title={t("resPage.spendHead")} lead={t("resPage.spendLead")} />
              <Spending r={r} />
            </Section>
            <Section id="sihtriigid" tone="paper" labelledBy="r-dest">
              <SectionHead id="r-dest" kicker={t("resPage.tabDest")} title={t("res.destTitle")} lead={t("resPage.destLead")} />
              <Destinations r={r} />
            </Section>
            <Section id="kestus" tone="white" labelledBy="r-stay">
              <SectionHead id="r-stay" kicker={t("resPage.tabStay")} title={t("resPage.stayHead")} lead={t("resPage.stayLead")} />
              <StayAndLodging r={r} />
            </Section>
          </>
        )}
      </Async>
    </>
  );
}