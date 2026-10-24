import { useApp } from "../../state/AppState.jsx";
import { useSector, useResidents, DESTINATIONS } from "../../data/datasets.js";
import { regionName } from "../../lib/regions.js";
import { fmtInt, fmtDec, fmtEur, fmtPeriod, countryName, fmtCompact } from "../../lib/format.js";
import { pctChange, sumRange, lastIndex } from "../../data/derive.js";
import { Section, SectionHead, ScopeBadge, Kpi, ArrowLink, NationalNotice, Source } from "../../components/ui/Primitives.jsx";
import { Async } from "../../components/ui/States.jsx";
import ColumnChart from "../../components/charts/ColumnChart.jsx";
import { BarList } from "../../components/charts/Small.jsx";

export function SectorPreview() {
  const { t, locale, region, href } = useApp();
  const sector = useSector();
  const selected = region.kind !== "country";
  return (
    <Section id="sektor" tone="mist" labelledBy="sector-title">
      <Async state={sector} height={460}>
        {(s) => {
          const latest = s.latestRevenue;
          const growth = s.growthHighlights.latest;
          const enterprises = s.enterpriseCounts.at(-1);
          const wage = s.wageComparison.at(-1);
          const q = s.quarterly.slice(-16);
          return (
            <>
              <SectionHead
                id="sector-title"
                kicker={t("sector.kicker")}
                title={
                  growth
                    ? t("sector.title", [fmtPeriod(latest.period, locale), fmtDec(latest.valueMillionEur, locale, 1), fmtDec(Math.abs(growth.pct), locale, 1), growth.pct >= 0])
                    : t("sector.titlePlain")
                }
                lead={t("sector.lead")}
                aside={<ScopeBadge nationalOnly period={fmtPeriod(latest?.period, locale)} reason={t("sector.why")} />}
              />
              {selected && <NationalNotice regionLabel={regionName(region, locale)} text={t("sector.notice")} />}
              <div className="split-5-7">
                <div className="kpi-grid-2">
                  <Kpi
                    size="m"
                    label={t("sector.kpiRevenue", fmtPeriod(latest?.period, locale))}
                    value={locale === "et" ? `${fmtDec(latest?.valueMillionEur, locale, 1)} mln €` : `€${fmtDec(latest?.valueMillionEur, locale, 1)}M`}
                    delta={growth?.pct}
                    deltaLabel={t("sector.vsYearAgoQuarter")}
                  />
                  <Kpi size="m" label={t("sector.kpiEnterprises", enterprises?.year)} value={fmtInt(enterprises?.count, locale)} />
                  <Kpi size="m" label={t("sector.kpiWage", fmtPeriod(wage?.period, locale))} value={fmtEur(wage?.accommodation, locale, 0)} />
                  <Kpi
                    size="m"
                    label={t("sector.kpiWageAll", fmtPeriod(wage?.period, locale))}
                    value={fmtEur(wage?.allActivities, locale, 0)}
                    note={wage ? t("sector.wageGap", fmtDec((wage.accommodation / wage.allActivities) * 100, locale, 0)) : null}
                  />
                </div>
                <figure className="chart-frame chart-frame--plain">
                  <h3 className="chart-title">{t("sector.chartTitle")}</h3>
                  <ColumnChart
                    categories={q.map((p) => ({ key: p.period, label: fmtPeriod(p.period, locale), title: fmtPeriod(p.period, locale) }))}
                    series={[{ key: "rev", label: t("sector.revenue"), color: "var(--c-1)", values: q.map((p) => p.value) }]}
                    height={260}
                    yFormat={(v) => (locale === "et" ? `${fmtDec(v, locale, 0)} mln` : `${fmtDec(v, locale, 0)}M`)}
                    valueFormat={(v) => (locale === "et" ? `${fmtDec(v, locale, 1)} mln €` : `€${fmtDec(v, locale, 1)}M`)}
                    tickEvery={4}
                    ariaLabel={t("sector.chartTitle")}
                  />
                  <figcaption>
                    <Source tables={["TU410", "EM001", "PA113"]} note={t("sector.sourceNote")} />
                  </figcaption>
                </figure>
              </div>
              <ArrowLink to={href("sector")}>{t("sector.more")}</ArrowLink>
            </>
          );
        }}
      </Async>
    </Section>
  );
}

export function ResidentsPreview() {
  const { t, locale, region, href } = useApp();
  const residents = useResidents();
  const selected = region.kind !== "country";
  return (
    <Section id="elanikud" tone="white" labelledBy="res-title">
      <Async state={residents} height={460}>
        {(r) => {
          const tp = r.trips.periods;
          const dom = r.trips.get("TR_DOM|TOTAL");
          const out = r.trips.get("TR_OUT|TOTAL");
          const i = lastIndex(dom);
          const period = tp[i];
          const ds = r.domSpend.get("TOTAL");
          const di = lastIndex(ds);
          const os = r.outSpend.get("EXP_OUT");
          const oi = lastIndex(os);
          const dp = r.destinations.periods;
          const di4 = dp.length - 1;
          const dest = DESTINATIONS.map((code) => ({
            key: code,
            label: countryName(code, locale),
            value: sumRange(r.destinations.get(code), di4 - 3, di4),
          }))
            .filter((x) => x.value != null)
            .sort((a, b) => b.value - a.value)
            .map((x, k) => ({ ...x, rank: k + 1 }));
          const r4 = (arr, j) => sumRange(arr, j - 3, j);
          return (
            <>
              <SectionHead
                id="res-title"
                kicker={t("res.kicker")}
                title={t("res.title", [fmtPeriod(period, locale), fmtDec(dom[i], locale, 0), fmtDec(out[i], locale, 0)])}
                lead={t("res.lead")}
                aside={<ScopeBadge nationalOnly period={fmtPeriod(period, locale)} reason={t("res.why")} />}
              />
              {selected && <NationalNotice regionLabel={regionName(region, locale)} text={t("res.notice")} />}
              <div className="split-7-5">
                <div className="kpi-grid-2">
                  <Kpi
                    size="m"
                    label={t("res.kpiDom", fmtPeriod(period, locale))}
                    value={t("res.thousandTrips", fmtDec(dom[i], locale, 1))}
                    delta={pctChange(dom[i], dom[i - 4])}
                    deltaLabel={t("res.vsYearAgoQuarter")}
                  />
                  <Kpi
                    size="m"
                    label={t("res.kpiOut", fmtPeriod(period, locale))}
                    value={t("res.thousandTrips", fmtDec(out[i], locale, 1))}
                    delta={pctChange(out[i], out[i - 4])}
                    deltaLabel={t("res.vsYearAgoQuarter")}
                  />
                  <Kpi
                    size="m"
                    label={t("res.kpiDomSpend", fmtPeriod(r.domSpend.periods[di], locale))}
                    value={fmtEur(ds[di], locale, 0)}
                    delta={pctChange(ds[di], ds[di - 4])}
                    deltaLabel={t("res.vsYearAgoQuarter")}
                  />
                  <Kpi
                    size="m"
                    label={t("res.kpiOutSpend", fmtPeriod(r.outSpend.periods[oi], locale))}
                    value={fmtEur(os[oi], locale, 0)}
                    delta={pctChange(os[oi], os[oi - 4])}
                    deltaLabel={t("res.vsYearAgoQuarter")}
                  />
                  <p className="kpi-grid-note t-meta">
                    {t("res.r4", [fmtCompact(r4(dom, i) * 1000, locale), fmtCompact(r4(out, i) * 1000, locale)])}
                  </p>
                </div>
                <div>
                  <h3 className="t-h3">{t("res.destTitle")}</h3>
                  <p className="t-meta">{t("res.destSub", [fmtPeriod(dp[di4 - 3], locale), fmtPeriod(dp[di4], locale)])}</p>
                  <BarList items={dest} format={(v) => t("res.thousandTrips", fmtDec(v, locale, 1))} dense />
                  <Source tables={["TU51", "TU63", "TU56", "TU661"]} note={t("res.sourceNote")} />
                </div>
              </div>
              <ArrowLink to={href("residents")}>{t("res.more")}</ArrowLink>
            </>
          );
        }}
      </Async>
    </Section>
  );
}