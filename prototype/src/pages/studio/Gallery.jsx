import { useState } from "react";
import { useApp } from "../../state/AppState.jsx";
import { pathFor } from "../../lib/routes.js";
import { regionById, regionName } from "../../lib/regions.js";
import { Button, ArrowLink, Segmented, SelectControl, Delta, Kpi, ScopeBadge, Source, Insight, NationalNotice } from "../../components/ui/Primitives.jsx";
import { Skeleton, EmptyState, ErrorState, UnavailableState } from "../../components/ui/States.jsx";

function Group({ title, children, dark }) {
  return (
    <section className={"gallery-group" + (dark ? " gallery-group--dark" : "")} data-theme={dark ? "dark" : undefined}>
      <h3 className="block-label">{title}</h3>
      <div className="gallery-row">{children}</div>
    </section>
  );
}

export function Components() {
  const { t, href, locale } = useApp();
  const [seg, setSeg] = useState("guests");
  const [sel, setSel] = useState("12");
  const c = (k) => t(`studio.components.${k}`);
  const sample = regionName(regionById("parnu"), locale);
  return (
    <div className="gallery">
      <p className="demo-tag">{c("demo")}</p>
      <div className="gallery-grid">
        <Group title={c("buttons")}>
          <Button>{c("primary")}</Button>
          <Button variant="secondary">{c("secondary")}</Button>
          <Button variant="ghost">{c("ghost")}</Button>
          <ArrowLink to={href("home")}>{c("link")}</ArrowLink>
        </Group>
        <Group title={c("buttons")} dark>
          <Button>{c("primary")}</Button>
          <Button variant="ghost">{c("ghost")}</Button>
          <ArrowLink to={href("home")} tone="light">
            {c("link")}
          </ArrowLink>
        </Group>
        <Group title={c("controls")}>
          <Segmented
            label={t("controls.metric")}
            value={seg}
            onChange={setSeg}
            options={[
              { value: "guests", label: t("metric.guests") },
              { value: "nights", label: t("metric.nights") },
            ]}
          />
          <SelectControl
            label={t("controls.range")}
            value={sel}
            onChange={setSel}
            options={[
              { value: "12", label: "12" },
              { value: "24", label: "24" },
              { value: "60", label: "60" },
            ]}
          />
        </Group>
        <Group title={c("figures")}>
          <div className="gallery-kpi">
            <Kpi label={c("kpiLabel")} value="123 456" delta={4.2} deltaLabel={c("kpiDelta")} />
          </div>
          <div className="gallery-deltas">
            <Delta value={6.4} />
            <Delta value={-3.1} />
            <Delta value={0.01} />
            <Delta value={2.5} unit="pp" />
          </div>
        </Group>
        <Group title={c("scope")}>
          <ScopeBadge region={sample} period="DEMO" />
          <ScopeBadge nationalOnly reason={c("noticeText")} />
          <Source tables={["TU131", "TU122"]} />
        </Group>
        <Group title={c("insights")}>
          <div className="gallery-insights">
            <Insight kind="computed" meta="DEMO DATA">
              {c("insightText")}
            </Insight>
            <Insight kind="ai" meta="DEMO DATA">
              {c("aiText")}
            </Insight>
          </div>
        </Group>
      </div>
      <NationalNotice regionLabel={sample} text={c("noticeText")} />
      <h3 className="block-label">{c("states")}</h3>
      <div className="gallery-states">
        <Skeleton height={180} label={c("loading")} />
        <EmptyState title={c("empty")} text={c("emptyText")} height={180} />
        <ErrorState height={180} />
        <UnavailableState title={c("unavailable")} text={c("unavailableText")} height={180} />
      </div>
    </div>
  );
}

const DEVICES = [
  { key: "phone", w: 390, h: 844, scale: 0.62 },
  { key: "tablet", w: 820, h: 1180, scale: 0.44 },
  { key: "laptop", w: 1280, h: 800, scale: 0.48 },
];
const PAGES = ["home", "regions", "visitors", "accommodation", "sector", "residents", "data", "reports"];

export function Responsive() {
  const { t, locale } = useApp();
  const [page, setPage] = useState("home");
  const src = pathFor(page, locale);
  return (
    <div className="responsive">
      <SelectControl
        label={t("studio.responsive.page")}
        value={page}
        onChange={setPage}
        options={PAGES.map((p) => ({ value: p, label: p === "home" ? t("nav.overview") : p === "accommodation" ? t("nav.accommodationPerf") : p === "data" ? t("nav.tables") : t(`nav.${p}`) }))}
      />
      <div className="device-row">
        {DEVICES.map((d) => (
          <figure key={d.key} className={`device device--${d.key}`}>
            <div className="device-frame" style={{ width: d.w * d.scale, height: d.h * d.scale }}>
              <iframe
                title={`${t(`studio.responsive.${d.key}`)} · ${src}`}
                src={src}
                width={d.w}
                height={d.h}
                loading="lazy"
                style={{ transform: `scale(${d.scale})` }}
              />
            </div>
            <figcaption>
              <span>{t(`studio.responsive.${d.key}`)}</span>
              <a href={src} target="_blank" rel="noreferrer">
                {t("studio.responsive.open")}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
