import { useMemo } from "react";
import { useApp } from "../../state/AppState.jsx";
import { useTourism, useOrigins, ORIGIN_CODES } from "../../data/datasets.js";
import { tourismSummary } from "../../data/metrics.js";
import { sumRange, sumKnown, pctChange } from "../../data/derive.js";
import { regionName } from "../../lib/regions.js";
import { fmtInt, fmtPeriod, fmtCompact, countryName, fmtPct } from "../../lib/format.js";
import { Section, SectionHead, ScopeBadge, Source, ArrowLink } from "../../components/ui/Primitives.jsx";
import { Async, Skeleton, EmptyState } from "../../components/ui/States.jsx";
import { BarList, SplitBar, Sparkline } from "../../components/charts/Small.jsx";

export function useMarketRanking(origins, locale) {
  return useMemo(() => {
    if (!origins) return null;
    const i = origins.latestIdx;
    const items = ORIGIN_CODES.map((code) => {
      const arr = origins.get("OCC_ARR", code);
      const known = sumKnown(arr, i - 11, i);
      const prev = sumRange(arr, i - 23, i - 12);
      const complete = known.missing === 0;
      return {
        key: code,
        label: countryName(code, locale, origins.labels[code]),
        value: known.value,
        missing: known.missing,
        lowerBound: !complete,
        delta: complete ? pctChange(known.value, prev) : null,
      };
    })
      .filter((x) => x.value != null && x.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((x, k) => ({ ...x, rank: k + 1 }));
    const total = sumRange(origins.get("OCC_ARR", "FOR"), i - 11, i);
    return { items, total, incomplete: items.some((x) => x.lowerBound), from: origins.periods[Math.max(0, i - 11)], to: origins.periods[i] };
  }, [origins, locale]);
}

export default function VisitorsSection() {
  const { t, locale, region, href } = useApp();
  const tourism = useTourism();
  const origins = useOrigins(region.code);
  const ranking = useMarketRanking(origins.data, locale);
  const rName = regionName(region, locale);

  return (
    <Section id="kulastajad" tone="white" labelledBy="visitors-title">
      <Async state={tourism} height={520}>
        {(d) => {
          const s = tourismSummary(d, region.code);
          const top = ranking?.items[0];
          const shareSeries = d.periods.slice(d.latestIdx - 35, d.latestIdx + 1).map((_, k) => {
            const i = d.latestIdx - 35 + k;
            const g = d.get("OCC_ARR", region.code)[i];
            const f = d.get("OCC_ARR", region.code, "FOR")[i];
            return g ? (f / g) * 100 : null;
          });
          return (
            <>
              <SectionHead
                id="visitors-title"
                kicker={t("visitors.kicker")}
                title={t("visitors.title")}
                lead={top && !top.lowerBound && ranking.total ? t("visitors.lead", [rName, top.label, fmtPct((top.value / ranking.total) * 100, locale, 0)]) : t("visitors.leadPlain")}
                aside={<ScopeBadge region={rName} period={t("common.last12")} />}
              />
              <div className="split-5-7">
                <div className="composition">
                  <div className="composition-block">
                    <p className="block-label">{t("visitors.splitMonth", fmtPeriod(s.period, locale))}</p>
                    <SplitBar
                      height={18}
                      segments={[
                        { label: t("common.domestic"), value: s.domestic, color: "var(--c-domestic)" },
                        { label: t("common.foreign"), value: s.foreign, color: "var(--c-foreign)" },
                      ]}
                      format={(v) => fmtInt(v, locale)}
                    />
                  </div>
                  <div className="composition-block">
                    <p className="block-label">{t("visitors.split12")}</p>
                    <SplitBar
                      height={18}
                      segments={[
                        { label: t("common.domestic"), value: s.r12Domestic, color: "var(--c-domestic)" },
                        { label: t("common.foreign"), value: s.r12Foreign, color: "var(--c-foreign)" },
                      ]}
                      format={(v) => fmtInt(v, locale)}
                    />
                  </div>
                  <div className="composition-block">
                    <p className="block-label">{t("visitors.foreignShareTrend")}</p>
                    <div className="share-spark">
                      <Sparkline values={shareSeries} height={64} color="var(--c-foreign)" />
                      <p className="share-spark-value num">{fmtPct(s.foreignShare, locale)}</p>
                    </div>
                    <p className="t-meta">{t("visitors.foreignShareNote")}</p>
                  </div>
                  <p className="definition">
                    <strong>{t("visitors.defTitle")}</strong> {t("visitors.def")}
                  </p>
                </div>
                <div className="markets">
                  <div className="markets-head">
                    <h3 className="t-h3">{t("visitors.marketsTitle")}</h3>
                    <p className="t-meta">{ranking ? `${fmtPeriod(ranking.from, locale, { short: true })} – ${fmtPeriod(ranking.to, locale, { short: true })}` : ""}</p>
                  </div>
                  {!ranking ? (
                    <Skeleton height={420} />
                  ) : ranking.items.length ? (
                    <>
                      <div className="barlist-headrow" aria-hidden="true">
                        <span>{t("visitors.colCountry")}</span>
                        <span>{t("visitors.colGuests")}</span>
                        <span>{t("visitors.colChange")}</span>
                      </div>
                      <BarList items={ranking.items} limit={10} format={(v) => fmtCompact(v, locale)} deltaLabel={t("visitors.colChange")} />
                    </>
                  ) : (
                    <EmptyState text={t("visitors.noMarkets")} />
                  )}
                  {ranking?.items.slice(0, 10).some((x) => x.lowerBound) && <p className="t-meta suppressed-note">{t("suppressed.markets")}</p>}
                  <Source tables={["TU131"]} note={t("visitors.marketsNote")} />
                  <ArrowLink to={href("visitors", { hash: "paritolu" })}>{t("visitors.more")}</ArrowLink>
                </div>
              </div>
            </>
          );
        }}
      </Async>
    </Section>
  );
}
