import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TableView from "./components/TableView";

export default function App() {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        onSelectTable={(path, tableId, title) => setSelected({ path, tableId, title })}
        selectedTableId={selected?.tableId}
      />
      <main style={{ flex: 1, padding: 16 }}>
        {selected ? (
          <TableView path={selected.path} tableId={selected.tableId} title={selected.title} />
        ) : (
          <div>Select a table from the sidebar to begin.</div>
        )}
      </main>
    </div>
  );
}
