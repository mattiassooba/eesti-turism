import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TableView from "./components/TableView";
import Dashboard from "./components/Dashboard";
import Page2Map from "./components/Page2Map";
import Page3Purpose from "./components/Page3Purpose";
import Page4Residents from "./components/Page4Residents";
import Page6Capacity from "./components/Page6Capacity";
import SourceFooter from "./components/SourceFooter";
import "./App.css";

const NAV_ITEMS = [
  { key: "dashboard", label: "Ülevaade" },
  { key: "map", label: "Kaart ja hooajalisus" },
  { key: "purpose", label: "Eesmärk ja kestus" },
  { key: "residents", label: "Residentide reisid" },
  { key: "capacity", label: "Mahutavus" },
  { key: "browse", label: "Kõik tabelid" },
];

export default function App() {
  const [view, setView] = useState("dashboard");
  const [selected, setSelected] = useState(null);

  function handleSelectTable(path, tableId, title) {
    setSelected({ path, tableId, title });
    setView("browse");
  }

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

      <div className="app-body">
        {view === "browse" && (
          <Sidebar onSelectTable={handleSelectTable} selectedTableId={selected?.tableId} />
        )}
        <main className="main-panel">
          {view === "dashboard" && <Dashboard onSelectTable={handleSelectTable} />}
          {view === "map" && <Page2Map />}
          {view === "purpose" && <Page3Purpose />}
          {view === "residents" && <Page4Residents />}
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
