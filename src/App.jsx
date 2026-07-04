import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TableView from "./components/TableView";
import Dashboard from "./components/Dashboard";
import Page2Map from "./components/Page2Map";
import Page3Purpose from "./components/Page3Purpose";
import Page4Residents from "./components/Page4Residents";
import Page6Capacity from "./components/Page6Capacity";
import SourceFooter from "./components/SourceFooter";
import GlobalFilters from "./components/GlobalFilters";
import "./App.css";

const NAV_ITEMS = [
  { key: "dashboard", label: "Ülevaade" },
  { key: "map", label: "Kaart ja hooajalisus" },
  { key: "purpose", label: "Eesmärk ja kestus" },
  { key: "residents", label: "Residentide reisid" },
  { key: "capacity", label: "Mahutavus" },
  { key: "browse", label: "Kõik tabelid" },
];

// Which of the global filters apply on each page. Page6 (Mahutavus) is
// long-run/annual by design (capacity since 1992, occupancy since 2004)
// and doesn't have a monthly-granularity axis to filter by; Page4
// (Residentide reisid) is about Estonians' own domestic/outbound travel,
// a different concept from visitor residency, so the residency filter
// doesn't apply there. Browse has its own per-table filters already.
const FILTER_RELEVANCE = {
  dashboard: { residency: true, timeRange: true, deltaMode: true },
  map: { residency: true, timeRange: true, deltaMode: false },
  purpose: { residency: true, timeRange: true, deltaMode: false },
  residents: { residency: false, timeRange: true, deltaMode: false },
  capacity: { residency: false, timeRange: false, deltaMode: false },
  browse: { residency: false, timeRange: false, deltaMode: false },
};

export default function App() {
  const [view, setView] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [residency, setResidency] = useState("all");
  const [timeRangeMonths, setTimeRangeMonths] = useState("24");
  const [deltaMode, setDeltaMode] = useState("yoy");

  function handleSelectTable(path, tableId, title) {
    setSelected({ path, tableId, title });
    setView("browse");
  }

  const relevance = FILTER_RELEVANCE[view];

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-nav-title">Eesti Turism</div>
        <nav className="top-nav-tabs">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={"top-nav-tab" + (view === item.key ? " active" : "")}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <GlobalFilters
        showResidency={relevance.residency}
        showTimeRange={relevance.timeRange}
        showDeltaMode={relevance.deltaMode}
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
        <main className="main-panel">
          {view === "dashboard" && (
            <Dashboard
              onSelectTable={handleSelectTable}
              residency={residency}
              timeRangeMonths={timeRangeMonths}
              deltaMode={deltaMode}
            />
          )}
          {view === "map" && (
            <Page2Map residency={residency} timeRangeMonths={timeRangeMonths} />
          )}
          {view === "purpose" && (
            <Page3Purpose residency={residency} timeRangeMonths={timeRangeMonths} />
          )}
          {view === "residents" && <Page4Residents timeRangeMonths={timeRangeMonths} />}
          {view === "capacity" && <Page6Capacity />}
          {view === "browse" &&
            (selected ? (
              <TableView path={selected.path} tableId={selected.tableId} title={selected.title} />
            ) : (
              <div className="panel-status">Vali tabel küljel olevast loendist.</div>
            ))}
        </main>
      </div>

      <SourceFooter />
    </div>
  );
}
