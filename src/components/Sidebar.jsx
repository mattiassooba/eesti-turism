import { useState } from "react";
import { fetchLevel } from "../api/pxweb";

const ROOT_PATH = ["majandus"];
const ROOT_ID = "turism-ja-majutus";
const ROOT_TEXT = "Turism, majutus ja toitlustus";

function FolderNode({ path, id, text, onSelectTable, selectedTableId }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fullPath = [...path, id];

  async function loadChildren() {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchLevel(fullPath);
      setChildren(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    if (!expanded && children === null) {
      await loadChildren();
    }
    setExpanded((e) => !e);
  }

  return (
    <li>
      <button className="folder-toggle" onClick={toggle}>
        {expanded ? "▾" : "▸"} {text}
      </button>
      {loading && <div className="tree-status">Loading…</div>}
      {error && (
        <div className="tree-status tree-error">
          {error}{" "}
          <button onClick={loadChildren}>Retry</button>
        </div>
      )}
      {expanded && children && (
        <ul>
          {children.map((child) =>
            child.type === "l" ? (
              <FolderNode
                key={child.id}
                path={fullPath}
                id={child.id}
                text={child.text}
                onSelectTable={onSelectTable}
                selectedTableId={selectedTableId}
              />
            ) : (
              <li key={child.id}>
                <button
                  className={
                    "table-leaf" + (selectedTableId === child.id ? " selected" : "")
                  }
                  onClick={() => onSelectTable(fullPath, child.id, child.text)}
                >
                  {child.text}
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </li>
  );
}

export default function Sidebar({ onSelectTable, selectedTableId }) {
  return (
    <nav className="sidebar">
      <ul>
        <FolderNode
          path={ROOT_PATH}
          id={ROOT_ID}
          text={ROOT_TEXT}
          onSelectTable={onSelectTable}
          selectedTableId={selectedTableId}
        />
      </ul>
    </nav>
  );
}
