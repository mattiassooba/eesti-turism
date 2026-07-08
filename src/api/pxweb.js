const API_BASE = "https://andmed.stat.ee/api/v1/et/stat";

function buildUrl(pathSegments, tableId) {
  const parts = tableId ? [...pathSegments, tableId] : pathSegments;
  return parts.length ? `${API_BASE}/${parts.join("/")}` : API_BASE;
}

export async function fetchLevel(pathSegments, { signal } = {}) {
  const url = buildUrl(pathSegments);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch level ${url}: ${res.status}`);
  }
  return res.json();
}

export async function fetchTableMeta(pathSegments, tableId, { signal } = {}) {
  const url = buildUrl(pathSegments, tableId);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch table metadata ${url}: ${res.status}`);
  }
  return res.json();
}

export async function fetchTableData(pathSegments, tableId, query, { signal } = {}) {
  const url = buildUrl(pathSegments, tableId);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch table data ${url}: ${res.status}`);
  }
  return res.json();
}

// Search is scoped to pathSegments (e.g. the tourism folder) so results
// don't include unrelated statistics domains. The API returns each
// result's own path relative to that scope (e.g. "/eesti-elanike-reisimine"),
// which the caller must prepend pathSegments to before using with
// fetchTableMeta/fetchTableData.
export async function searchTables(pathSegments, query, { signal } = {}) {
  const url = `${buildUrl(pathSegments)}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to search tables ${url}: ${res.status}`);
  }
  return res.json();
}

// True when a caught error is just an intentionally-aborted stale request
// (a superseded fetch), not a real failure that should be shown to the user.
export function isAbortError(err) {
  return err?.name === "AbortError";
}
