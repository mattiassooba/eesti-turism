import { useApp } from "../../state/AppState.jsx";
import { useTourism, useCapacity, useOrigins, useNarrative } from "../../data/datasets.js";
import { tourismSummary, capacitySummary } from "../../data/metrics.js";
import { COUNTY_LIST, regionName } from "../../lib/regions.js";
import { fmtPct, fmtSignedPct, fmtPeriod, fmtCompact } from "../../lib/format.js";
import { Section, SectionHead, Insight } from "../../components/ui/Primitives.jsx";
import { Skeleton } from "../../components/ui/States.jsx";
import { useMarketRanking } from "./VisitorsSection.jsx";
import { etLocative } from "./headlines.js";
import Icon from "../../components/ui/Icon.jsx";

const MIN_MARKET = 5000; // ignore tiny markets whose % swings are noise
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function narrativeFor(n, code, locale) {
  if (!n?.sections) return null;
  const byRegion = n.sections.dashboardByRegion?.[code];
  const text = (code === "EE" ? n.sections.dashboard : byRegion)?.[locale];
  return text ?? null;
}

export function AiSummary({ code, compact }) {
  const { t, locale } = useApp();
  const narrative = useNarrative();
  const n = narrative.data;
  const text = narrativeFor(n, code, locale);
  if (!narrative.data && !narrative.error) return <Skeleton height={180} />;
  if (!text) return null;
  const generated = n.generatedAt ? new Date(n.generatedAt).toLocaleDateString(locale === "et" ? "et-EE" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <article className={"ai-summary" + (compact ? " ai-summary--compact" : "")}>
      <header className="ai-summary-head">
        <span className="ai-badge">
          <Icon name="sparkle" size={14} />
          {t("insight.ai")}
        </span>
        <span className="t-meta">{t("ai.period", n.periodLabel?.[locale] ?? fmtPeriod(n.period, locale))}</span>
      </header>
      <p className="ai-summary-text">{text}</p>
      <p className="ai-summary-foot t-meta">{t("ai.disclaimer", generated)}</p>
    </article>
  );
}

export default function InsightsSection() {
  const { t, locale, region, href } = useApp();
  const tourism = useTourism();
  const capacity = useCapacity();
  const origins = useOrigins(region.code);
  const ranking = useMarketRanking(origins.data, locale);
  const rName = regionName(region, locale);
  const where = (r) => (locale === "et" ? etLocative(regionName(r, "et")) : regionName(r, "en"));

  const computed = [];
  if (tourism.data) {
    const d = tourism.data;
    const movers = COUNTY_LIST.map((r) => ({ r, s: tourismSummary(d, r.code) }))
      .filter((x) => x.s.r12.change != null)
      .sort((a, b) => b.s.r12.change - a.s.r12.change);
    const top = movers[0];
    const bottom = movers[movers.length - 1];
    const range = `${fmtPeriod(d.periods[d.latestIdx - 11], locale, { short: true })} – ${fmtPeriod(d.latest, locale, { short: true })}`;
    if (top && bottom) {
      computed.push({
        key: "movers",
        text: t("insights.movers", [where(top.r), fmtSignedPct(top.s.r12.change, locale), where(bottom.r), fmtSignedPct(bottom.s.r12.change, locale)]),
        meta: t("insights.metaR12", range),
        to: href("regions"),
        toLabel: t("insights.toRegions"),
      });
    }
  }
  if (ranking) {
    const growers = ranking.items.filter((x) => x.value >= MIN_MARKET && x.delta != null).sort((a, b) => b.delta - a.delta);
    const g = growers[0];
    if (g) {
      computed.push({
        key: "market",
        text: t("insights.market", [g.label, fmtSignedPct(g.delta, locale), fmtCompact(g.value, locale), rName]),
        meta: t("insights.metaMarket", fmtCompact(MIN_MARKET, locale)),
        to: href("visitors", { hash: "paritolu" }),
        toLabel: t("insights.toMarkets"),
      });
    }
  }
  if (capacity.data) {
    const c = capacity.data;
    const occ = COUNTY_LIST.map((r) => ({ r, v: capacitySummary(c, r.code).roomOcc })).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
    if (occ.length) {
      computed.push({
        key: "occ",
        text: t("insights.occupancy", [capFirst(fmtPeriod(c.latest, locale)), where(occ[0].r), fmtPct(occ[0].v, locale), where(occ.at(-1).r), fmtPct(occ.at(-1).v, locale)]),
        meta: t("insights.metaOcc"),
        to: href("accommodation"),
        toLabel: t("insights.toAcc"),
      });
    }
  }

  return (
    <Section id="tahelepanekud" tone="paper" labelledBy="ins-title">
      <SectionHead id="ins-title" kicker={t("insights.kicker")} title={t("insights.title")} lead={t("insights.lead")} />
      <div className="insights-layout">
        <AiSummary code={region.code} />
        <div className="insights-grid">
          {computed.length === 0 && <Skeleton height={200} />}
          {computed.map((c) => (
            <Insight key={c.key} kind="computed" meta={c.meta} to={c.to} toLabel={c.toLabel}>
              {c.text}
            </Insight>
          ))}
        </div>
      </div>
    </Section>
  );
}
