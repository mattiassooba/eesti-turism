import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import TableView from "./components/TableView";
import Dashboard from "./components/Dashboard";
import Page2Map from "./components/Page2Map";
import Page3Purpose from "./components/Page3Purpose";
import Page4Residents from "./components/Page4Residents";
import Page6Capacity from "./components/Page6Capacity";
import LazyMount from "./components/LazyMount";
import SourceFooter from "./components/SourceFooter";
import GlobalFilters from "./components/GlobalFilters";
import { useActiveSection } from "./hooks/useActiveSection";
import "./App.css";

const NAV_ITEMS = [
  { key: "dashboard", label: "Ülevaade" },
  { key: "map", label: "Kaart ja hooajalisus" },
  { key: "purpose", label: "Eesmärk ja kestus" },
  { key: "residents", label: "Residentide reisid" },
  { key: "capacity", label: "Mahutavus" },
  { key: "browse", label: "Kõik tabelid" },
];

// The five dashboard-style pages scroll past one after another on one
// continuous page; "browse" (raw table + sidebar) is a different workflow
// entirely and stays its own destination rather than a scroll section.
const SCROLL_SECTIONS = NAV_ITEMS.filter((item) => item.key !== "browse").map((item) => item.key);

export default function App() {
  const [view, setView] = useState("scroll");
  // { key, nonce } rather than a plain key string, so clicking the same
  // nav item twice always re-triggers the scroll effect below (a plain
  // string wouldn't change and React would skip the effect).
  const [scrollRequest, setScrollRequest] = useState(null);
  const [selected, setSelected] = useState(null);
  const [residency, setResidency] = useState("all");
  const [timeRangeMonths, setTimeRangeMonths] = useState("24");
  const [deltaMode, setDeltaMode] = useState("yoy");
  const mainPanelRef = useRef(null);

  const activeSection = useActiveSection(SCROLL_SECTIONS, mainPanelRef, view === "scroll");
  const activeTab = view === "browse" ? "browse" : activeSection;

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
    if (key === "browse") {
      setView("browse");
      return;
    }
    setView("scroll");
    setScrollRequest({ key, nonce: Date.now() });
  }

  const showFilters = view === "scroll";

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-nav-title">Eesti Turism</div>
        <nav className="top-nav-tabs">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={"top-nav-tab" + (activeTab === item.key ? " active" : "")}
              onClick={() => handleNavClick(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <GlobalFilters
        showResidency={showFilters}
        showTimeRange={showFilters}
        showDeltaMode={showFilters}
        residency={residency}
        onResidencyChange={setResidency}
        timeRangeMonths={timeRangeMonths}
        onTimeRangeChange={setTimeRangeMonths}
        deltaMode={deltaMode}
        onDeltaModeChange={setDeltaMode}
      />

      <div className="app-body">
        {view === "browse" && (
          <Sidebar onSelectTable={handleSelectTable} selectedTableId={selected?.tableId} />
        )}
        <main className="main-panel" ref={mainPanelRef}>
          {view === "scroll" && (
            <div className="scroll-sections">
              <section id="dashboard" className="scroll-section">
                <h2 className="scroll-section-title">Ülevaade</h2>
                <Dashboard
                  onSelectTable={handleSelectTable}
                  residency={residency}
                  timeRangeMonths={timeRangeMonths}
                  deltaMode={deltaMode}
                />
              </section>

              <section id="map" className="scroll-section">
                <h2 className="scroll-section-title">Kaart ja hooajalisus</h2>
                <LazyMount containerRef={mainPanelRef}>
                  <Page2Map residency={residency} timeRangeMonths={timeRangeMonths} />
                </LazyMount>
              </section>

              <section id="purpose" className="scroll-section">
                <h2 className="scroll-section-title">Eesmärk ja kestus</h2>
                <LazyMount containerRef={mainPanelRef}>
                  <Page3Purpose residency={residency} timeRangeMonths={timeRangeMonths} />
                </LazyMount>
              </section>

              <section id="residents" className="scroll-section">
                <h2 className="scroll-section-title">Residentide reisid</h2>
                <LazyMount containerRef={mainPanelRef}>
                  <Page4Residents timeRangeMonths={timeRangeMonths} />
                </LazyMount>
              </section>

              <section id="capacity" className="scroll-section">
                <h2 className="scroll-section-title">Mahutavus</h2>
                <LazyMount containerRef={mainPanelRef}>
                  <Page6Capacity />
                </LazyMount>
              </section>
            </div>
          )}

          {view === "browse" &&
            (selected ? (
              <TableView
                path={selected.path}
                tableId={selected.tableId}
                title={selected.title}
                initialTimeRangeMonths={timeRangeMonths}
              />
            ) : (
              <div className="panel-status">Vali tabel küljel olevast loendist.</div>
            ))}
        </main>
      </div>

      <SourceFooter />
    </div>
  );
}
