import { useEffect, useState } from "react";
import { fetchLevel, searchTables } from "../api/pxweb";

const ROOT_PATH = ["majandus"];
const ROOT_ID = "turism-ja-majutus";
const ROOT_TEXT = "Turism, majutus ja toitlustus";
const ROOT_FULL_PATH = [...ROOT_PATH, ROOT_ID];

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
      {loading && <div className="tree-status">Laen…</div>}
      {error && (
        <div className="tree-status tree-error">
          {error}{" "}
          <button onClick={loadChildren}>Proovi uuesti</button>
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
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState({ status: "idle" });

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setSearch({ status: "idle" });
      return;
    }
    let cancelled = false;
    setSearch({ status: "loading" });
    const timer = setTimeout(async () => {
      try {
        const results = await searchTables(ROOT_FULL_PATH, trimmed);
        if (!cancelled) setSearch({ status: "ready", results });
      } catch (err) {
        if (!cancelled) setSearch({ status: "error", message: err.message });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  function handleResultClick(result) {
    const relativeParts = result.path.split("/").filter(Boolean);
    onSelectTable([...ROOT_FULL_PATH, ...relativeParts], result.id, result.title);
  }

  const showResults = term.trim().length >= 2;

  return (
    <nav className="sidebar">
      <input
        type="search"
        className="sidebar-search"
        placeholder="Otsi tabelit…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      {showResults ? (
        <>
          {search.status === "loading" && <div className="tree-status">Otsin…</div>}
          {search.status === "error" && (
            <div className="tree-status tree-error">{search.message}</div>
          )}
          {search.status === "ready" &&
            (search.results.length ? (
              <ul>
                {search.results.map((result) => (
                  <li key={result.id}>
                    <button
                      className={
                        "table-leaf" + (selectedTableId === result.id ? " selected" : "")
                      }
                      onClick={() => handleResultClick(result)}
                    >
                      {result.title}
                      <span className="search-result-path">{result.path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="tree-status">Vastavaid tabeleid ei leitud.</div>
            ))}
        </>
      ) : (
        <ul>
          <FolderNode
            path={ROOT_PATH}
            id={ROOT_ID}
            text={ROOT_TEXT}
            onSelectTable={onSelectTable}
            selectedTableId={selectedTableId}
          />
        </ul>
      )}
    </nav>
  );
}
