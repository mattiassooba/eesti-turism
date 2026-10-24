import { useApp } from "../../state/AppState.jsx";
import { useTourism } from "../../data/datasets.js";
import { tourismSummary } from "../../data/metrics.js";
import { regionName } from "../../lib/regions.js";
import { fmtInt, fmtPeriod, fmtYtdRange, fmtPct } from "../../lib/format.js";
import HeroArt from "../../components/map/HeroArt.jsx";
import { Delta, Button } from "../../components/ui/Primitives.jsx";

function HeroStat({ label, value, delta, deltaLabel, children, meta }) {
  return (
    <div className="hero-stat">
      <p className="hero-stat-label">{label}</p>
      {value != null && <p className="hero-stat-value num">{value}</p>}
      {children}
      {delta !== undefined && (
        <p className="hero-stat-foot">
          <Delta value={delta} />
          <span>{deltaLabel}</span>
        </p>
      )}
      {meta && <p className="hero-stat-meta">{meta}</p>}
    </div>
  );
}

export default function HomeHero() {
  const { t, locale, region, href } = useApp();
  const tourism = useTourism();
  const d = tourism.data;
  const s = d ? tourismSummary(d, region.code) : null;
  const isCountry = region.kind === "country";
  const name = isCountry ? t("hero.titleCountry") : `${regionName(region, locale)}.`;
  const long = !isCountry && name.length > 14;
  const period = s ? fmtPeriod(s.period, locale) : "…";
  const prev = s ? fmtPeriod(s.prevPeriod, locale) : "";

  return (
    <section className="hero" data-theme="dark" aria-labelledby="hero-title">
      <div className="hero-art-wrap">
        <HeroArt selectedCode={isCountry ? null : region.code} />
      </div>
      <div className="container hero-inner">
        <p className="hero-eyebrow">
          <span className="hero-eyebrow-dot" aria-hidden="true" />
          {t("hero.eyebrow", period)}
        </p>
        <h1 id="hero-title" className={"hero-title t-hero" + (long ? " is-long" : "")}>
          <span>{name}</span>
          <span className="hero-title-2">{t("hero.title2")}</span>
        </h1>
        <p className="hero-lede">{isCountry ? t("hero.lede") : t("hero.ledeRegion", regionName(region, locale))}</p>
        <div className="hero-actions">
          <Button to={href("home", { hash: "trendid" })} icon="arrowRight">
            {t("hero.ctaTrends")}
          </Button>
          <Button to={href("home", { hash: "piirkonnad" })} variant="ghost">
            {t("hero.ctaMap")}
          </Button>
        </div>
      </div>

      <div className="container">
        <div className={"hero-stats" + (s ? "" : " is-loading")} aria-busy={!s}>
          <HeroStat
            label={t("hero.statGuests", period)}
            value={s ? fmtInt(s.guests, locale) : "—"}
            delta={s?.guestsYoy}
            deltaLabel={t("common.vs", prev)}
          />
          <HeroStat
            label={t("hero.statNights", period)}
            value={s ? fmtInt(s.nights, locale) : "—"}
            delta={s?.nightsYoy}
            deltaLabel={t("common.vs", prev)}
          />
          <HeroStat label={t("hero.statSplit", period)}>
            {s && (
              <div className="hero-split">
                <div className="hero-split-bar" role="img" aria-label={t("hero.splitAria", [fmtPct(100 - s.foreignShare, locale), fmtPct(s.foreignShare, locale)])}>
                  <span style={{ width: `${100 - s.foreignShare}%` }} />
                  <span style={{ width: `${s.foreignShare}%` }} />
                </div>
                <div className="hero-split-legend">
                  <span>
                    <i className="sw sw--dom" />
                    {t("common.domestic")} <b className="num">{fmtPct(100 - s.foreignShare, locale, 0)}</b>
                  </span>
                  <span>
                    <i className="sw sw--for" />
                    {t("common.foreign")} <b className="num">{fmtPct(s.foreignShare, locale, 0)}</b>
                  </span>
                </div>
              </div>
            )}
          </HeroStat>
          <HeroStat
            label={t("hero.statYtd", s ? fmtYtdRange(s.period, locale) : "")}
            value={s ? fmtInt(s.ytd.value, locale) : "—"}
            delta={s?.ytd.change}
            deltaLabel={t("hero.vsSamePeriod")}
          />
        </div>
        <p className="hero-footnote">
          {t("hero.footnote")} <span className="hero-footnote-src">{t("source.prefix")} TU131</span>
        </p>
      </div>
    </section>
  );
}
