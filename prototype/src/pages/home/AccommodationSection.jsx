import { useMemo, useState } from "react";
import { useApp } from "../../state/AppState.jsx";
import { useCapacity } from "../../data/datasets.js";
import { capacitySummary } from "../../data/metrics.js";
import { regionName } from "../../lib/regions.js";
import { fmtInt, fmtPeriod, monthName, parsePeriod, fmtDec, fmtOcc, fmtCost } from "../../lib/format.js";
import { Section, SectionHead, ScopeBadge, Kpi, Segmented, ArrowLink } from "../../components/ui/Primitives.jsx";
import { Async } from "../../components/ui/States.jsx";
import ChartFrame from "../../components/charts/ChartFrame.jsx";
import LineChart from "../../components/charts/LineChart.jsx";
import { occupancyHeadline } from "./headlines.js";

export const PROFILE_PERIODS = Array.from({ length: 12 }, (_, i) => `2000M${String(i + 1).padStart(2, "0")}`);

// Month-of-year profile: the latest year (possibly partial), the year
// before, and 2019 as the last pre-pandemic reference year.
export function useYearProfiles(data, code, indicator) {
  return useMemo(() => {
    if (!data) return null;
    const arr = data.get(indicator, code);
    const latestYear = parsePeriod(data.latest).year;
    const yearValues = (year) =>
      PROFILE_PERIODS.map((_, m) => {
        const i = data.periods.indexOf(`${year}M${String(m + 1).padStart(2, "0")}`);
        return i < 0 ? null : arr[i];
      });
    const years = [latestYear, latestYear - 1, 2019].filter((y, i, a) => a.indexOf(y) === i);
    return years.map((year, k) => ({
      key: String(year),
      label: String(year),
      values: yearValues(year),
      color: k === 0 ? "var(--c-1)" : k === 1 ? "var(--c-foreign)" : "var(--c-muted)",
      width: k === 0 ? 2.6 : 1.8,
      dash: year === 2019 ? "4 4" : undefined,
      muted: year === 2019,
    }));
  }, [data, code, indicator]);
}

export default function AccommodationSection() {
  const { t, locale, region, href } = useApp();
  const capacity = useCapacity();
  const [occ, setOcc] = useState("OCC_OR_BEDR");
  const profiles = useYearProfiles(capacity.data, region.code, occ);
  const rName = regionName(region, locale);

  return (
    <Section id="majutus" tone="paper" labelledBy="acc-title">
      <Async state={capacity} height={560}>
        {(d) => {
          const c = capacitySummary(d, region.code);
          const p = fmtPeriod(c.period, locale);
          const prev = fmtPeriod(`${parsePeriod(c.period).year - 1}M${String(parsePeriod(c.period).month).padStart(2, "0")}`, locale);
          return (
            <>
              <SectionHead
                id="acc-title"
                kicker={t("acc.kicker")}
                title={occupancyHeadline(c, locale, rName)}
                lead={t("acc.lead")}
                aside={<ScopeBadge region={rName} period={p} />}
              />
              <div className="kpi-row kpi-row--5">
                <Kpi label={t("kpi.roomOcc")} value={fmtOcc(c.roomOcc, locale)} delta={c.roomOccDiff} deltaUnit="pp" deltaLabel={t("common.vs", prev)} />
                <Kpi label={t("kpi.bedOcc")} value={fmtOcc(c.bedOcc, locale)} delta={c.bedOccDiff} deltaUnit="pp" deltaLabel={t("common.vs", prev)} />
                <Kpi label={t("kpi.cost")} value={fmtCost(c.cost, locale)} delta={c.costYoy} deltaLabel={t("common.vs", prev)} note={t("kpi.costNote")} />
                <Kpi label={t("kpi.establishments")} value={fmtInt(c.establishments, locale)} note={t("kpi.roomsBeds", [fmtInt(c.rooms, locale), fmtInt(c.beds, locale)])} />
                <Kpi label={t("kpi.bedsPerEst")} value={c.establishments ? fmtDec(c.beds / c.establishments, locale, 0) : "—"} note={t("kpi.bedsPerEstNote")} />
              </div>
              <div className="split-8-4">
                <ChartFrame
                  title={t(occ === "OCC_OR_BEDR" ? "acc.profileRoom" : "acc.profileBed", rName)}
                  subtitle={t("acc.profileSub")}
                  controls={
                    <Segmented
                      label={t("controls.metric")}
                      hideLabel
                      value={occ}
                      onChange={setOcc}
                      options={[
                        { value: "OCC_OR_BEDR", label: t("kpi.roomOccShort") },
                        { value: "OCC_OR_BEDP", label: t("kpi.bedOccShort") },
                      ]}
                    />
                  }
                  tables={["TU122"]}
                  table={{
                    caption: t("acc.profileRoom", rName),
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
                    <dt>{t("kpi.cost")}</dt>
                    <dd>{t("acc.defCost")}</dd>
                  </dl>
                  <ArrowLink to={href("accommodation")}>{t("acc.more")}</ArrowLink>
                </aside>
              </div>
            </>
          );
        }}
      </Async>
    </Section>
  );
}
