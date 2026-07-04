import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TableView from "./components/TableView";
import "./App.css";

export default function App() {
  const [selected, setSelected] = useState(null);

  function handleSelectTable(path, tableId, title) {
    setSelected({ path, tableId, title });
  }

  return (
    <div className="app-shell">
      <Sidebar onSelectTable={handleSelectTable} selectedTableId={selected?.tableId} />
      <main className="main-panel">
        {selected ? (
          <TableView path={selected.path} tableId={selected.tableId} title={selected.title} />
        ) : (
          <div className="panel-status">Select a table from the sidebar to begin.</div>
        )}
      </main>
    </div>
  );
}
