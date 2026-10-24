import { useMemo, useState } from "react";
import { useApp } from "../../state/AppState.jsx";
import { useTourism } from "../../data/datasets.js";
import { seasonality, lastCompleteYear } from "../../data/metrics.js";
import { seasonGrid, summerShare } from "../../data/derive.js";
import { COUNTY_LIST, CITY_LIST, ESTONIA, regionName } from "../../lib/regions.js";
import { fmtInt, fmtPct, monthName, fmtCompact } from "../../lib/format.js";
import { Section, SectionHead, ScopeBadge, Segmented, Source } from "../../components/ui/Primitives.jsx";
import { Async } from "../../components/ui/States.jsx";
import { Heatmap, BarList, seqScale } from "../../components/charts/Small.jsx";

export default function SeasonalitySection() {
  const { t, locale, region, setRegion } = useApp();
  const tourism = useTourism();
  const [metric, setMetric] = useState("OCC_ARR");
  const [span, setSpan] = useState("all");
  const rName = regionName(region, locale);

  const grid = useMemo(() => {
    if (!tourism.data) return null;
    const rows = seasonGrid(tourism.data.get(metric, region.code), tourism.data.periods);
    return span === "all" ? rows : rows.slice(-Number(span));
  }, [tourism.data, metric, region.code, span]);

  return (
    <Section id="hooajalisus" tone="white" labelledBy="season-title">
      <Async state={tourism} height={560}>
        {(d) => {
          const { year, summerShare: share } = seasonality(d, region.code);
          const ranking = [ESTONIA, ...COUNTY_LIST, ...CITY_LIST]
            .map((r) => ({
              key: r.code,
              id: r.id,
              label: regionName(r, locale, { short: true }),
              value: summerShare(d.get("OCC_ARR", r.code), d.periods, lastCompleteYear(d.periods, d.get("OCC_ARR", r.code))),
            }))
            .filter((x) => x.value != null)
            .sort((a, b) => b.value - a.value)
            .map((x, i) => ({ ...x, rank: i + 1, color: x.key === "EE" ? "var(--ink-3)" : undefined }));
          const monthLabels = Array.from({ length: 12 }, (_, i) => monthName(i, locale, true));
          const fmt = (v) => (metric === "OCC_ARR" ? fmtInt(v, locale) : fmtInt(v, locale));
          return (
            <>
              <SectionHead
                id="season-title"
                kicker={t("season.kicker")}
                title={share != null ? t("season.title", [fmtPct(share, locale, 0), rName, year]) : t("season.titlePlain")}
                lead={t("season.lead")}
                aside={<ScopeBadge region={rName} period={t("season.period", year)} />}
              />
              <div className="split-8-4">
                <div className="season-main">
                  <div className="chart-frame-bar">
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
                    <Segmented
                      label={t("controls.range")}
                      hideLabel
                      value={span}
                      onChange={setSpan}
                      options={[
                        { value: "10", label: t("controls.r10y") },
                        { value: "all", label: t("controls.rAllYears") },
                      ]}
                    />
                  </div>
                  <Heatmap
                    rows={[...grid].reverse()}
                    colLabels={monthLabels}
                    format={(v) => fmtCompact(v, locale)}
                    scale={seqScale}
                    caption={t("season.readoutIdle")}
                    cellTitle={(row, col, v) => `${monthName(col, locale)} ${row.year}: ${fmt(v)} ${metric === "OCC_ARR" ? t("metric.guestsUnit") : t("metric.nightsUnit")}`}
                    legend={[t("season.low"), t("season.high")]}
                  />
                  <Source tables={["TU131"]} note={t("season.note")} />
                </div>
                <aside className="season-rank">
                  <h3 className="t-h3">{t("season.rankTitle")}</h3>
                  <p className="t-meta">{t("season.rankSub", year)}</p>
                  <BarList items={ranking} format={(v) => fmtPct(v, locale, 0)} highlightKey={region.code} onSelect={(it) => setRegion(it.id)} dense />
                </aside>
              </div>
            </>
          );
        }}
      </Async>
    </Section>
  );
}
