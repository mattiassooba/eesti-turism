import { useState } from "react";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        onSelectTable={(path, tableId, title) => setSelected({ path, tableId, title })}
        selectedTableId={selected?.tableId}
      />
      <pre>{JSON.stringify(selected, null, 2)}</pre>
    </div>
  );
}
