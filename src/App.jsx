import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TableView from "./components/TableView";
import Dashboard from "./components/Dashboard";
import SourceFooter from "./components/SourceFooter";
import "./App.css";

export default function App() {
  const [view, setView] = useState("dashboard"); // "dashboard" | "browse"
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
          <button
            className={"top-nav-tab" + (view === "dashboard" ? " active" : "")}
            onClick={() => setView("dashboard")}
          >
            Ülevaade
          </button>
          <button
            className={"top-nav-tab" + (view === "browse" ? " active" : "")}
            onClick={() => setView("browse")}
          >
            Kõik tabelid
          </button>
        </nav>
      </header>

      <div className="app-body">
        {view === "browse" && (
          <Sidebar onSelectTable={handleSelectTable} selectedTableId={selected?.tableId} />
        )}
        <main className="main-panel">
          {view === "dashboard" && <Dashboard onSelectTable={handleSelectTable} />}
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
