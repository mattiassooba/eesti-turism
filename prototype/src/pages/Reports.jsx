import { useId, useState } from "react";
import { UNSAFE_LocationContext as LocationContext } from "react-router-dom";
import { useApp } from "../state/AppState.jsx";
import { useNarrative, useTourism, useCapacity, useResidents, useSector, useLongRun } from "../data/datasets.js";
import { COUNTY_LIST, regionName } from "../lib/regions.js";
import { fmtPeriod } from "../lib/format.js";
import { LocaleProvider } from "@prod/i18n/LocaleContext.jsx";
import { RegionProvider } from "@prod/context/RegionContext.jsx";
import NewsletterPdfButton from "@prod/components/NewsletterPdfButton.jsx";
import PageHeader from "../components/layout/PageHeader.jsx";
import { Section, SectionHead, Segmented, ScopeBadge, Source } from "../components/ui/Primitives.jsx";
import { Skeleton } from "../components/ui/States.jsx";
import Icon from "../components/ui/Icon.jsx";
import { AiSummary } from "./home/InsightsSection.jsx";

const THEMES = ["map", "purpose", "capacity", "expenses"];

function fmtDate(iso, locale) {
  return iso ? new Date(iso).toLocaleDateString(locale === "et" ? "et-EE" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

// The national, topic-by-topic highlights written by the same scheduled
// pipeline as the monthly summary.
function ThemeHighlights() {
  const { t, locale } = useApp();
  const narrative = useNarrative();
  const n = narrative.data;
  if (!n && !narrative.error) return <Skeleton height={260} />;
  const items = THEMES.map((k) => ({ k, text: n?.sections?.[k]?.[locale === "et" ? "highlightEt" : "highlightEn"] })).filter((x) => x.text);
  if (!items.length) return null;
  return (
    <div className="report-themes">
      <p className="block-label">
        {t("reportsPage.themesTitle")} <ScopeBadge nationalOnly compact />
      </p>
      <ul>
        {items.map((x) => (
          <li key={x.k}>
            <span className="report-theme-name">{t(`reportsPage.theme.${x.k}`)}</span>
            <p>{x.text}</p>
          </li>
        ))}
      </ul>
      <p className="report-themes-foot t-meta">
        <Icon name="sparkle" size={13} /> {t("reportsPage.themesFoot")}
      </p>
    </div>
  );
}

// Production's PDF generator, rendered unchanged. It reads the region from
// production's own URL scheme, so it is mounted under the legacy path for
// the region currently selected in the prototype.
function ProductionPdf() {
  const { t, locale, region } = useApp();
  const slug = locale === "en" ? region.legacySlugEn : region.legacySlugEt;
  const pathname = slug ? (locale === "en" ? `/en/county/${slug}` : `/maakond/${slug}`) : locale === "en" ? "/en" : "/";
  const explicit = region.kind !== "country";
  return (
    <div className="report-pdf">
      <div className="report-pdf-cover" aria-hidden="true">
        <span className="report-pdf-page">
          <span className="report-pdf-bar" />
          <span className="report-pdf-line report-pdf-line--l" />
          <span className="report-pdf-line" />
          <span className="report-pdf-line" />
          <span className="report-pdf-grid">
            <span />
            <span />
            <span />
          </span>
          <span className="report-pdf-line report-pdf-line--s" />
          <span className="report-pdf-line" />
        </span>
      </div>
      <div className="report-pdf-body">
        <p className="kicker">
          <span className="kicker-rule" aria-hidden="true" />
          {t("reportsPage.pdfKicker")}
        </p>
        <h3 className="t-h3">{t("reportsPage.pdfTitle", explicit ? regionName(region, locale) : null)}</h3>
        <p className="report-pdf-lead">{explicit ? t("reportsPage.pdfLeadRegion", regionName(region, locale)) : t("reportsPage.pdfLeadNational")}</p>
        <ul className="report-pdf-contents">
          {[1, 2, 3, 4].map((i) => (
            <li key={i}>
              <Icon name="check" size={16} />
              <span>{t(`reportsPage.pdfItem${i}`)}</span>
            </li>
          ))}
        </ul>
        <div className="report-pdf-action prod-embed">
          <LocationContext.Provider value={{ location: { pathname, search: "", hash: "", state: null, key: "pdf" }, navigationType: "POP" }}>
            <LocaleProvider>
              <RegionProvider>
                <NewsletterPdfButton />
              </RegionProvider>
            </LocaleProvider>
          </LocationContext.Provider>
        </div>
        <p className="report-pdf-note t-meta">{t("reportsPage.pdfNote")}</p>
      </div>
    </div>
  );
}

// Same fields as production's Mailchimp form, but nothing is sent: the
// production list IDs are still placeholders, so this is a demonstration.
function NewsletterDemo() {
  const { t, locale, region } = useApp();
  const id = useId();
  const [cadence, setCadence] = useState("monthly");
  const [lang, setLang] = useState(locale);
  const [county, setCounty] = useState(region.kind === "county" ? region.code : region.kind === "city" ? region.parent : "all");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t("reportsPage.nlEmailError"));
      return;
    }
    setError(null);
    setSent(true);
  }

  return (
    <div className="newsletter" data-theme="dark">
      <div className="newsletter-copy">
        <span className="demo-tag">{t("reportsPage.demoTag")}</span>
        <h3 className="newsletter-title">{t("reportsPage.nlTitle")}</h3>
        <p className="newsletter-lead">{t("reportsPage.nlLead")}</p>
        <ul className="newsletter-points">
          {[1, 2, 3].map((i) => (
            <li key={i}>{t(`reportsPage.nlPoint${i}`)}</li>
          ))}
        </ul>
      </div>
      {sent ? (
        <div className="newsletter-done" role="status">
          <Icon name="check" size={22} />
          <p className="newsletter-done-title">{t("reportsPage.nlDoneTitle")}</p>
          <p>{t("reportsPage.nlDoneText")}</p>
          <button type="button" className="btn btn--ghost" onClick={() => setSent(false)}>
            <span>{t("reportsPage.nlAgain")}</span>
          </button>
        </div>
      ) : (
        <form className="newsletter-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor={`${id}-email`} className="field-label">
              {t("reportsPage.nlEmail")}
            </label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("reportsPage.nlEmailPh")}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-err` : undefined}
            />
            {error && (
              <p id={`${id}-err`} className="field-error">
                {error}
              </p>
            )}
          </div>
          <div className="newsletter-options">
            <Segmented
              label={t("reportsPage.nlCadence")}
              value={cadence}
              onChange={setCadence}
              options={[
                { value: "monthly", label: t("reportsPage.nlMonthly") },
                { value: "quarterly", label: t("reportsPage.nlQuarterly") },
              ]}
            />
            <Segmented
              label={t("reportsPage.nlLang")}
              value={lang}
              onChange={setLang}
              options={[
                { value: "et", label: "Eesti keeles" },
                { value: "en", label: "In English" },
              ]}
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-county`} className="field-label">
              {t("reportsPage.nlCounty")}
            </label>
            <span className="select-shell select-shell--block">
              <select id={`${id}-county`} value={county} onChange={(e) => setCounty(e.target.value)}>
                <option value="all">{t("reportsPage.nlAll")}</option>
                {COUNTY_LIST.map((c) => (
                  <option key={c.code} value={c.code}>
                    {regionName(c, locale)}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={16} />
            </span>
          </div>
          <button type="submit" className="btn btn--light newsletter-submit">
            <span>{t("reportsPage.nlSubmit")}</span>
            <Icon name="arrowRight" size={16} />
          </button>
          <p className="newsletter-privacy t-meta">{t("reportsPage.nlPrivacy")}</p>
        </form>
      )}
    </div>
  );
}

function lastFilled(periods, values) {
  for (let i = periods.length - 1; i >= 0; i--) if (values[i] != null) return periods[i];
  return null;
}

// Latest published period per dataset, read from the live API — nothing here
// is hardcoded, so the table is always as fresh as the data it describes.
function Freshness() {
  const { t, locale } = useApp();
  const tourism = useTourism();
  const capacity = useCapacity();
  const residents = useResidents();
  const sector = useSector();
  const longRun = useLongRun();
  const narrative = useNarrative();
  const p = (code) => (code ? fmtPeriod(code, locale) : null);
  const rows = [
    { key: "tourism", tables: ["TU131", "TU133"], freq: "month", latest: p(tourism.data?.latest), state: tourism },
    { key: "capacity", tables: ["TU122"], freq: "month", latest: p(capacity.data?.latest), state: capacity },
    { key: "longrun", tables: ["TU11"], freq: "year", latest: longRun.data ? lastFilled(longRun.data.periods, longRun.data.get("CAP_BEDR")) : null, state: longRun },
    {
      key: "residents",
      tables: ["TU51", "TU63", "TU56", "TU661"],
      freq: "quarter",
      latest: residents.data ? p(lastFilled(residents.data.trips.periods, residents.data.trips.get("TR_DOM|TOTAL"))) : null,
      state: residents,
    },
    { key: "revenue", tables: ["TU410"], freq: "quarter", latest: p(sector.data?.latestRevenue?.period), state: sector },
    { key: "economics", tables: ["EM001"], freq: "year", latest: sector.data?.latestYear, state: sector },
    { key: "wages", tables: ["PA113"], freq: "quarter", latest: p(sector.data?.wageComparison.at(-1)?.period), state: sector },
    { key: "ai", tables: [], freq: "month", latest: narrative.data ? `${narrative.data.periodLabel?.[locale] ?? p(narrative.data.period)} · ${fmtDate(narrative.data.generatedAt, locale)}` : null, state: narrative },
  ];
  return (
    <div className="data-table-wrap freshness">
      <table className="data-table">
        <caption className="sr-only">{t("reportsPage.freshTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("reportsPage.freshDataset")}</th>
            <th scope="col">{t("reportsPage.freshTables")}</th>
            <th scope="col">{t("reportsPage.freshFreq")}</th>
            <th scope="col">{t("reportsPage.freshLatest")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{t(`reportsPage.fresh.${r.key}`)}</th>
              <td className="freshness-tables">{r.tables.length ? r.tables.join(", ") : t("reportsPage.freshPipeline")}</td>
              <td>{t(`reportsPage.freq.${r.freq}`)}</td>
              <td className="num">{r.latest ?? (r.state.error ? t("reportsPage.freshError") : "…")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const { t, locale, region } = useApp();
  const narrative = useNarrative();
  const tabs = [
    { id: "kokkuvote", label: t("reportsPage.tabSummary") },
    { id: "pdf", label: t("reportsPage.tabPdf") },
    { id: "uudiskiri", label: t("reportsPage.tabNews") },
    { id: "uuendused", label: t("reportsPage.tabFresh") },
  ];
  return (
    <>
      <PageHeader
        kicker={t("nav.reports")}
        title={t("reportsPage.title")}
        lead={t("reportsPage.lead")}
        tabs={tabs}
        aside={
          <div className="page-controls">
            <ScopeBadge region={regionName(region, locale)} period={narrative.data ? narrative.data.periodLabel?.[locale] ?? fmtPeriod(narrative.data.period, locale) : "…"} />
          </div>
        }
      />
      <Section id="kokkuvote" tone="paper" labelledBy="r-sum">
        <SectionHead id="r-sum" kicker={t("reportsPage.tabSummary")} title={t("reportsPage.sumHead")} lead={t("reportsPage.sumLead")} />
        <div className="split-7-5 report-summary">
          <AiSummary code={region.code} />
          <ThemeHighlights />
        </div>
      </Section>
      <Section id="pdf" tone="white" labelledBy="r-pdf">
        <SectionHead id="r-pdf" kicker={t("reportsPage.tabPdf")} title={t("reportsPage.pdfHead")} lead={t("reportsPage.pdfHeadLead")} />
        <ProductionPdf />
      </Section>
      <Section id="uudiskiri" tone="paper" labelledBy="r-news">
        <SectionHead id="r-news" kicker={t("reportsPage.tabNews")} title={t("reportsPage.nlHead")} lead={t("reportsPage.nlHeadLead")} />
        <NewsletterDemo />
      </Section>
      <Section id="uuendused" tone="white" labelledBy="r-fresh">
        <SectionHead id="r-fresh" kicker={t("reportsPage.tabFresh")} title={t("reportsPage.freshTitle")} lead={t("reportsPage.freshLead")} />
        <Freshness />
        <Source tables={["TU131", "TU122", "TU11", "TU51", "TU410", "EM001", "PA113"]} />
      </Section>
    </>
  );
}
