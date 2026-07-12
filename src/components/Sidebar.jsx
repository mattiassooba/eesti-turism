import { useEffect, useRef, useState } from "react";
import { fetchLevel, searchTables, isAbortError } from "../api/pxweb";
import { useTranslation } from "../i18n/LocaleContext.jsx";

const ROOT_PATH = ["majandus"];
const ROOT_ID = "turism-ja-majutus";
const ROOT_FULL_PATH = [...ROOT_PATH, ROOT_ID];

function FolderNode({ path, id, text, onSelectTable, selectedTableId, locale, t }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Not effect-driven (loadChildren fires from a click handler), so
  // cancellation is wired by hand: abort any in-flight request of this
  // node's own before starting a new one, and on unmount.
  const controllerRef = useRef(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  // A locale switch invalidates any already-fetched children (they're
  // cached in the wrong language) — collapse and drop the cache so the
  // next expand re-fetches in the new language, rather than silently
  // showing stale-language labels.
  useEffect(() => {
    setChildren(null);
    setExpanded(false);
  }, [locale]);

  const fullPath = [...path, id];

  async function loadChildren() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchLevel(fullPath, { signal: controller.signal, locale });
      setChildren(items);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
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
      {loading && <div className="tree-status">{t("sidebar.loading")}</div>}
      {error && (
        <div className="tree-status tree-error">
          {error}{" "}
          <button onClick={loadChildren}>{t("sidebar.retry")}</button>
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
                locale={locale}
                t={t}
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
  const { t, locale } = useTranslation();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState({ status: "idle" });

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setSearch({ status: "idle" });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setSearch({ status: "loading" });
    const timer = setTimeout(async () => {
      try {
        const results = await searchTables(ROOT_FULL_PATH, trimmed, { signal: controller.signal, locale });
        if (!cancelled) setSearch({ status: "ready", results });
      } catch (err) {
        if (isAbortError(err)) return;
        if (!cancelled) setSearch({ status: "error", message: err.message });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, locale]);

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
        placeholder={t("sidebar.searchPlaceholder")}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      {showResults ? (
        <>
          {search.status === "loading" && <div className="tree-status">{t("sidebar.searching")}</div>}
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
              <div className="tree-status">{t("sidebar.noResults")}</div>
            ))}
        </>
      ) : (
        <ul>
          <FolderNode
            path={ROOT_PATH}
            id={ROOT_ID}
            text={t("sidebar.rootText")}
            onSelectTable={onSelectTable}
            selectedTableId={selectedTableId}
            locale={locale}
            t={t}
          />
        </ul>
      )}
    </nav>
  );
}
