import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import TableView from "./components/TableView";
import Dashboard from "./components/Dashboard";
import Page2Map from "./components/Page2Map";
import Page3Purpose from "./components/Page3Purpose";
import Page4Residents from "./components/Page4Residents";
import Page5Expenses from "./components/Page5Expenses";
import Page6Capacity from "./components/Page6Capacity";
import LazyMount from "./components/LazyMount";
import NewsletterSignup from "./components/NewsletterSignup";
import SourceFooter from "./components/SourceFooter";
import SectionRail from "./components/SectionRail";
import { useActiveSection } from "./hooks/useActiveSection";
import { useTranslation } from "./i18n/LocaleContext.jsx";
import "./App.css";

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];

export default function App() {
  const { t, locale, setLocale } = useTranslation();

  // Top bar only carries the three distinct destinations now: the scroll
  // entry point, and the two pages that aren't part of the scroll at all.
  // The sections within the scroll (map/purpose/capacity) moved to the
  // SectionRail floating on the right, alongside Ülevaade itself so the
  // rail always shows a current position even while at the very top.
  const TOP_NAV_ITEMS = useMemo(
    () => [
      { key: "dashboard", label: t("nav.dashboard") },
      { key: "residents", label: t("nav.residents") },
      { key: "browse", label: t("nav.browse") },
    ],
    [t]
  );

  const RAIL_ITEMS = useMemo(
    () => [
      { key: "dashboard", label: t("nav.dashboard") },
      { key: "map", label: t("nav.map") },
      { key: "purpose", label: t("nav.purpose") },
      { key: "capacity", label: t("nav.capacity") },
      { key: "expenses", label: t("nav.expenses") },
    ],
    [t]
  );

  // Ülevaade, Kaart ja hooajalisus, Eesmärk ja kestus, Mahutavus, and
  // Reisikulutused scroll past one another on one continuous page (by
  // request, Reisikulutused sits here despite being about residents' own
  // spending rather than visitors to Estonia, unlike Residentide reisid).
  // Residentide reisid and Kõik tabelid are each their own destination
  // instead — Residents because it's a different subject from the rest of
  // the scroll and shouldn't load by default when the site opens; Browse
  // because it's a different workflow (raw table + sidebar) entirely.
  const SCROLL_SECTIONS = useMemo(() => RAIL_ITEMS.map((item) => item.key), [RAIL_ITEMS]);

  const QUICK_LINKS = useMemo(
    () => [
      { tableId: "TU121.PX", title: t("app.quickLink1") },
      { tableId: "TU122.PX", title: t("app.quickLink2") },
      { tableId: "TU11.PX", title: t("app.quickLink3") },
      { tableId: "TU131.PX", title: t("app.quickLink4") },
    ],
    [t]
  );

  const [view, setView] = useState("scroll");
  // { key, nonce } rather than a plain key string, so clicking the same
  // nav item twice always re-triggers the scroll effect below (a plain
  // string wouldn't change and React would skip the effect).
  const [scrollRequest, setScrollRequest] = useState(null);
  const [selected, setSelected] = useState(null);
  const mainPanelRef = useRef(null);

  const activeSection = useActiveSection(SCROLL_SECTIONS, mainPanelRef, view === "scroll");
  const activeTab = view === "scroll" ? activeSection : view;

  useEffect(() => {
    if (!scrollRequest || view !== "scroll") return;
    const el = document.getElementById(scrollRequest.key);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "start" });

    // Sections below the click target can still be lazy-loading and
    // growing for a couple of seconds after the click, at unpredictable
    // moments (each section's own fetch resolves independently) — which
    // shifts the target's actual position out from under it, since
    // scrollIntoView only aims at where it was the instant it was called.
    // Keep re-aligning (no animation, so it doesn't fight the initial
    // smooth scroll) until it settles, or the user takes over by
    // scrolling themselves.
    const realign = () => el.scrollIntoView({ block: "start" });
    const interval = setInterval(realign, 200);
    const stopSoon = setTimeout(() => clearInterval(interval), 3000);
    const container = mainPanelRef.current;
    const stopOnUserScroll = () => clearInterval(interval);
    container?.addEventListener("wheel", stopOnUserScroll, { passive: true, once: true });
    container?.addEventListener("touchmove", stopOnUserScroll, { passive: true, once: true });

    return () => {
      clearInterval(interval);
      clearTimeout(stopSoon);
      container?.removeEventListener("wheel", stopOnUserScroll);
      container?.removeEventListener("touchmove", stopOnUserScroll);
    };
  }, [scrollRequest, view]);

  // Stable reference: this is passed as a prop into Dashboard, which is
  // wrapped in memo() specifically so the frequent activeSection updates
  // from scrolling don't cascade into re-rendering the dashboard's dozen
  // chart instances — a new function identity on every render would
  // defeat that regardless of the memo wrapper.
  const handleSelectTable = useCallback((path, tableId, title) => {
    setSelected({ path, tableId, title });
    setView("browse");
  }, []);

  function handleNavClick(key) {
    if (key === "browse" || key === "residents") {
      setView(key);
      return;
    }
    setView("scroll");
    setScrollRequest({ key, nonce: Date.now() });
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-nav-title">{t("app.brand")}</div>
        <nav className="top-nav-tabs">
          {TOP_NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={"top-nav-tab" + (activeTab === item.key ? " active" : "")}
              onClick={() => handleNavClick(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="pill-tabs locale-switch">
          <button
            className={"pill-tab" + (locale === "et" ? " active" : "")}
            onClick={() => setLocale("et")}
          >
            ET
          </button>
          <button
            className={"pill-tab" + (locale === "en" ? " active" : "")}
            onClick={() => setLocale("en")}
          >
            EN
          </button>
        </div>
      </header>

      {view === "scroll" && (
        <SectionRail items={RAIL_ITEMS} activeKey={activeSection} onSelect={handleNavClick} />
      )}

      <div className="app-body">
        {view === "browse" && (
          <Sidebar onSelectTable={handleSelectTable} selectedTableId={selected?.tableId} />
        )}
        <main className="main-panel" ref={mainPanelRef}>
          {view === "scroll" && (
            <div className="scroll-sections">
              <section id="dashboard" className="scroll-section">
                <h2 className="scroll-section-title">{t("nav.dashboard")}</h2>
                <Dashboard />
              </section>

              <section id="map" className="scroll-section">
                <h2 className="scroll-section-title">{t("nav.map")}</h2>
                <LazyMount containerRef={mainPanelRef}>
                  <Page2Map />
                </LazyMount>
              </section>

              <section id="purpose" className="scroll-section">
                <h2 className="scroll-section-title">{t("nav.purpose")}</h2>
                <LazyMount containerRef={mainPanelRef}>
                  <Page3Purpose />
                </LazyMount>
              </section>

              <section id="capacity" className="scroll-section">
                <h2 className="scroll-section-title">{t("nav.capacity")}</h2>
                <LazyMount containerRef={mainPanelRef}>
                  <Page6Capacity />
                </LazyMount>
              </section>

              <section id="expenses" className="scroll-section">
                <h2 className="scroll-section-title">{t("nav.expenses")}</h2>
                <LazyMount containerRef={mainPanelRef}>
                  <Page5Expenses />
                </LazyMount>
              </section>
            </div>
          )}

          {view === "residents" && (
            <div className="scroll-section">
              <h2 className="scroll-section-title">{t("nav.residents")}</h2>
              <Page4Residents />
            </div>
          )}

          {view === "browse" &&
            (selected ? (
              <TableView path={selected.path} tableId={selected.tableId} title={selected.title} />
            ) : (
              <div className="dashboard">
                <div className="panel-status">{t("app.chooseTable")}</div>
                <div className="quick-links">
                  <div className="quick-links-label">{t("app.quickLinks")}</div>
                  <div className="quick-links-grid">
                    {QUICK_LINKS.map((link) => (
                      <button
                        key={link.tableId}
                        className="quick-link-card"
                        onClick={() => handleSelectTable(MAJUTUS_PATH, link.tableId, link.title)}
                      >
                        {link.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
        </main>
      </div>

      <NewsletterSignup />
      <SourceFooter />
    </div>
  );
}
