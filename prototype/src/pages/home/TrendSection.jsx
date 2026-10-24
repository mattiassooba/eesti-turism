import { useMemo, useState } from "react";
import { useApp } from "../../state/AppState.jsx";
import { useTourism } from "../../data/datasets.js";
import { tourismSummary } from "../../data/metrics.js";
import { regionName } from "../../lib/regions.js";
import { fmtInt, fmtPeriod, fmtMonthTick, fmtAxis, fmtYtdRange, fmtDec } from "../../lib/format.js";
import { Section, SectionHead, Segmented, ScopeBadge, Kpi, ArrowLink } from "../../components/ui/Primitives.jsx";
import { Async } from "../../components/ui/States.jsx";
import ChartFrame from "../../components/charts/ChartFrame.jsx";
import LineChart from "../../components/charts/LineChart.jsx";
import { trendHeadline } from "./headlines.js";

export const COVID_BAND = { from: "2020M03", to: "2021M12" };

export function useTrendSeries(data, code, { metric, view, range }) {
  return useMemo(() => {
    if (!data) return null;
    const ind = metric === "nights" ? "OCC_NI" : "OCC_ARR";
    const end = data.latestIdx;
    const len = range === "all" ? end + 1 : range === "5y" ? 60 : 24;
    const start = Math.max(0, end - len + 1);
    const periods = data.periods.slice(start, end + 1);
    const total = data.get(ind, code);
    if (view === "split") {
      return {
        periods,
        series: [
          { key: "dom", label: "domestic", values: data.get(ind, code, "EE").slice(start, end + 1), color: "var(--c-domestic)", width: 2.2 },
          { key: "for", label: "foreign", values: data.get(ind, code, "FOR").slice(start, end + 1), color: "var(--c-foreign)", width: 2.2 },
        ],
      };
    }
    return {
      periods,
      series: [
        {
          key: "prev",
          label: "prev",
          values: periods.map((_, i) => total[start + i - 12] ?? null),
          color: "var(--c-muted)",
          dash: "4 4",
          width: 1.6,
          muted: true,
        },
        { key: "total", label: "total", values: total.slice(start, end + 1), color: "var(--c-1)", width: 2.4, area: true },
      ],
    };
  }, [data, code, metric, view, range]);
}

export default function TrendSection() {
  const { t, locale, region, href } = useApp();
  const tourism = useTourism();
  const [metric, setMetric] = useState("guests");
  const [view, setView] = useState("total");
  const [range, setRange] = useState("5y");
  const trend = useTrendSeries(tourism.data, region.code, { metric, view, range });
  const rName = regionName(region, locale);

  return (
    <Section id="trendid" tone="paper" labelledBy="trend-title">
      <Async state={tourism} height={560}>
        {(d) => {
          const s = tourismSummary(d, region.code);
          const labelOf = (k) =>
            ({
              dom: t("common.domestic"),
              for: t("common.foreign"),
              total: metric === "nights" ? t("metric.nights") : t("metric.guests"),
              prev: t("chart.yearEarlier"),
            })[k];
          const series = trend.series.map((x) => ({ ...x, label: labelOf(x.key), short: x.key === "prev" ? t("chart.yearEarlierShort") : labelOf(x.key) }));
          return (
            <>
              <SectionHead
                id="trend-title"
                kicker={t("trend.kicker")}
                title={trendHeadline(s, locale, rName, region.kind === "country")}
                lead={t("trend.lead")}
                aside={<ScopeBadge region={rName} period={fmtPeriod(s.period, locale)} />}
              />
              <div className="split-7-5">
                <ChartFrame
                  title={t(metric === "nights" ? "trend.chartTitleNights" : "trend.chartTitleGuests", rName)}
                  subtitle={t("trend.chartSub")}
                  controls={
                    <>
                      <Segmented
                        label={t("controls.metric")}
                        hideLabel
                        value={metric}
                        onChange={setMetric}
                        options={[
                          { value: "guests", label: t("metric.guests") },
                          { value: "nights", label: t("metric.nights") },
                        ]}
                      />
                      <Segmented
                        label={t("controls.view")}
                        hideLabel
                        value={view}
                        onChange={setView}
                        options={[
                          { value: "total", label: t("controls.vsYearEarlier") },
                          { value: "split", label: t("controls.domForSplit") },
                        ]}
                      />
                      <Segmented
                        label={t("controls.range")}
                        hideLabel
                        value={range}
                        onChange={setRange}
                        options={[
                          { value: "2y", label: t("controls.r2y") },
                          { value: "5y", label: t("controls.r5y") },
                          { value: "all", label: t("controls.rAll") },
                        ]}
                      />
                    </>
                  }
                  tables={["TU131"]}
                  sourceNote={t("source.establishmentsNote")}
                  table={{
                    caption: t(metric === "nights" ? "trend.chartTitleNights" : "trend.chartTitleGuests", rName),
                    columns: [{ key: "p", label: t("table.period") }, ...series.map((x) => ({ key: x.key, label: x.label, numeric: true }))],
                    rows: [...trend.periods]
                      .map((p, i) => ({ key: p, p: fmtPeriod(p, locale), ...Object.fromEntries(series.map((x) => [x.key, fmtInt(x.values[i], locale)])) }))
                      .reverse(),
                  }}
                >
                  <LineChart
                    periods={trend.periods}
                    series={series}
                    height={380}
                    yFormat={(v) => fmtAxis(v, locale)}
                    valueFormat={(v) => fmtInt(v, locale)}
                    xTick={(p) => fmtMonthTick(p, locale)}
                    tooltipTitle={(p) => fmtPeriod(p, locale)}
                    bands={[{ ...COVID_BAND, label: t("chart.covid") }]}
                    ariaLabel={t("trend.aria", rName)}
                  />
                </ChartFrame>
                <aside className="kpi-stack" aria-label={t("trend.asideLabel")}>
                  <Kpi
                    size="m"
                    label={t("kpi.ytdGuests", fmtYtdRange(s.period, locale))}
                    value={fmtInt(s.ytd.value, locale)}
                    delta={s.ytd.change}
                    deltaLabel={t("hero.vsSamePeriod")}
                  />
                  <Kpi
                    size="m"
                    label={t("kpi.r12Guests")}
                    value={fmtInt(s.r12.value, locale)}
                    delta={s.r12.change}
                    deltaLabel={t("kpi.vsPrior12")}
                  />
                  <Kpi
                    size="m"
                    label={t("kpi.avgStay", fmtPeriod(s.period, locale))}
                    value={fmtDec(s.avgStay, locale, 2)}
                    note={t("kpi.avgStayNote", fmtDec(s.avgStayPrev, locale, 2))}
                  />
                  <ArrowLink to={href("visitors")}>{t("trend.more")}</ArrowLink>
                </aside>
              </div>
            </>
          );
        }}
      </Async>
    </Section>
  );
}
