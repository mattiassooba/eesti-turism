import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../state/AppState.jsx";
import { useTourism, useCapacity } from "../../data/datasets.js";
import { tourismSummary, capacitySummary } from "../../data/metrics.js";
import { COUNTY_LIST, CITY_LIST, SUBNATIONAL_CODES, regionByCode, regionName } from "../../lib/regions.js";
import { fmtInt, fmtCompact, fmtPct, fmtSignedPct, fmtPeriod, fmtDec } from "../../lib/format.js";
import { Section, SectionHead, Segmented, Source, Delta, Button } from "../../components/ui/Primitives.jsx";
import { Async } from "../../components/ui/States.jsx";
import EstoniaMap from "../../components/map/EstoniaMap.jsx";
import { BarList, seqScaleDark, divScaleDark } from "../../components/charts/Small.jsx";

export const MAP_METRICS = ["guests", "nights", "growth", "foreign", "occupancy"];

// Values for every county and city over the rolling 12 months to the
// latest month. Volumes use a log scale so Harju does not flatten the rest.
export function useMapValues(tourism, capacity, metric) {
  return useMemo(() => {
    if (!tourism) return null;
    const values = {};
    for (const code of SUBNATIONAL_CODES) {
      if (metric === "occupancy") {
        values[code] = capacity ? capacitySummary(capacity, code).roomOccR12 : null;
        continue;
      }
      const s = tourismSummary(tourism, code);
      values[code] = { guests: s.r12.value, nights: s.r12Nights.value, growth: s.r12.change, foreign: s.foreignShareR12 }[metric] ?? null;
    }
    const nums = Object.values(values).filter((v) => v != null);
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    let color;
    if (metric === "growth") {
      const m = Math.max(...nums.map(Math.abs), 1);
      color = (v) => divScaleDark(v / m);
    } else if (metric === "guests" || metric === "nights") {
      const a = Math.log(lo);
      const b = Math.log(hi);
      color = (v) => seqScaleDark((Math.log(v) - a) / (b - a || 1));
    } else {
      color = (v) => seqScaleDark((v - lo) / (hi - lo || 1));
    }
    return { values, color, lo, hi };
  }, [tourism, capacity, metric]);
}

export function metricFormat(metric, locale) {
  if (metric === "growth") return (v) => fmtSignedPct(v, locale);
  if (metric === "foreign" || metric === "occupancy") return (v) => fmtPct(v, locale);
  return (v) => fmtCompact(v, locale);
}

export default function MapSection() {
  const { t, locale, region, setRegion, href } = useApp();
  const tourism = useTourism();
  const capacity = useCapacity();
  const [metric, setMetric] = useState("guests");
  const [focusCode, setFocusCode] = useState(null);
  useEffect(() => setFocusCode(null), [region.code]);
  const mv = useMapValues(tourism.data, capacity.data, metric);
  const fmt = metricFormat(metric, locale);
  const focus = regionByCode(focusCode ?? (region.kind !== "country" ? region.code : COUNTY_LIST[0].code));

  return (
    <Section id="piirkonnad" tone="deep" className="section--map" labelledBy="map-title">
      <Async state={tourism} height={640}>
        {(d) => {
          const end = d.latest;
          const start = d.periods[d.latestIdx - 11];
          const range = `${fmtPeriod(start, locale, { short: true })} – ${fmtPeriod(end, locale, { short: true })}`;
          const s = tourismSummary(d, focus.code);
          const c = capacity.data ? capacitySummary(capacity.data, focus.code) : null;
          const ranking = COUNTY_LIST.map((r) => ({ key: r.code, label: regionName(r, locale, { short: true }), value: mv?.values[r.code] ?? null }))
            .filter((x) => x.value != null)
            .sort((a, b) => b.value - a.value)
            .map((x, i) => ({ ...x, rank: i + 1, color: metric === "growth" ? (x.value >= 0 ? "var(--pos-on-dark)" : "var(--neg-on-dark)") : undefined }));
          const metricLabel = t(`map.metric.${metric}`);
          return (
            <>
              <SectionHead
                id="map-title"
                kicker={t("map.kicker")}
                title={t("map.title")}
                lead={t("map.lead")}
                aside={
                  <span className="scope scope--dark">
                    <span className="scope-dot scope-dot--region" aria-hidden="true" />
                    {t("map.scope", range)}
                  </span>
                }
              />
              <div className="map-toolbar">
                <Segmented
                  label={t("controls.metric")}
                  value={metric}
                  onChange={setMetric}
                  options={MAP_METRICS.map((m) => ({ value: m, label: t(`map.metric.${m}`) }))}
                />
              </div>
              <div className="map-layout">
                <div className="map-canvas">
                  {mv && (
                    <EstoniaMap
                      values={mv.values}
                      color={mv.color}
                      format={fmt}
                      selected={focus.code}
                      onSelect={(r) => setFocusCode(r.code)}
                      metricLabel={metricLabel}
                      ariaLabel={t("map.aria", metricLabel)}
                    />
                  )}
                  {mv && (
                    <div className="map-legend" aria-hidden="true">
                      <span>{metric === "growth" ? fmt(-Math.max(Math.abs(mv.lo), Math.abs(mv.hi))) : fmt(mv.lo)}</span>
                      <span
                        className="map-legend-ramp"
                        style={{
                          background:
                            metric === "growth"
                              ? `linear-gradient(90deg, ${divScaleDark(-1)}, ${divScaleDark(0)}, ${divScaleDark(1)})`
                              : `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(seqScaleDark).join(",")})`,
                        }}
                      />
                      <span>{metric === "growth" ? fmt(Math.max(Math.abs(mv.lo), Math.abs(mv.hi))) : fmt(mv.hi)}</span>
                      {(metric === "guests" || metric === "nights") && <span className="map-legend-note">{t("map.logScale")}</span>}
                    </div>
                  )}
                  <p className="map-hint">{t("map.hint")}</p>
                </div>

                <aside className="map-panel" aria-live="polite">
                  <p className="map-panel-kicker">{focus.kind === "city" ? t("region.city") : t("region.county")}</p>
                  <h3 className="map-panel-title">{regionName(focus, locale)}</h3>
                  <dl className="map-panel-stats">
                    <div>
                      <dt>{t("map.panel.guests12")}</dt>
                      <dd className="num">{fmtInt(s.r12.value, locale)}</dd>
                      <dd>
                        <Delta value={s.r12.change} size="s" />
                      </dd>
                    </div>
                    <div>
                      <dt>{t("map.panel.nights12")}</dt>
                      <dd className="num">{fmtInt(s.r12Nights.value, locale)}</dd>
                      <dd>
                        <Delta value={s.r12Nights.change} size="s" />
                      </dd>
                    </div>
                    <div>
                      <dt>{t("map.panel.foreign12")}</dt>
                      <dd className="num">{fmtPct(s.foreignShareR12, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("map.panel.occ12")}</dt>
                      <dd className="num">{c ? fmtPct(c.roomOccR12, locale) : "—"}</dd>
                    </div>
                    <div>
                      <dt>{t("map.panel.share")}</dt>
                      <dd className="num">{fmtPct(s.shareOfNationalR12, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("map.panel.stay")}</dt>
                      <dd className="num">{fmtDec(s.r12Nights.value / s.r12.value, locale, 2)}</dd>
                    </div>
                  </dl>
                  <div className="map-panel-actions">
                    {region.code !== focus.code && (
                      <Button variant="light" onClick={() => setRegion(focus.id)} icon="locate">
                        {t("map.useRegion")}
                      </Button>
                    )}
                    <Link className="arrow-link arrow-link--light" to={`${href("regions", { keepRegion: false })}?r=${focus.id}`}>
                      <span>{t("map.openRegion")}</span>
                    </Link>
                  </div>
                  {focus.kind === "city" && <p className="map-panel-note">{t("map.cityNote", regionName(regionByCode(focus.parent) ?? focus, locale))}</p>}
                </aside>

                <div className="map-ranking">
                  <h3 className="map-ranking-title">{t("map.rankingTitle", metricLabel)}</h3>
                  <BarList items={ranking} format={fmt} highlightKey={focus.code} onSelect={(it) => setFocusCode(it.key)} dense />
                  <div className="map-cities">
                    <p className="map-cities-title">{t("map.citiesTitle")}</p>
                    {CITY_LIST.map((r) => (
                      <button key={r.code} type="button" className={"map-city-row" + (focus.code === r.code ? " is-active" : "")} onClick={() => setFocusCode(r.code)}>
                        <span>{regionName(r, locale, { short: true })}</span>
                        <span className="num">{mv?.values[r.code] != null ? fmt(mv.values[r.code]) : "—"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Source tables={metric === "occupancy" ? ["TU122"] : ["TU131"]} note={t("map.sourceNote")} />
            </>
          );
        }}
      </Async>
    </Section>
  );
}
