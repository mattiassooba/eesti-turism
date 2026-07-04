const API_BASE = "https://andmed.stat.ee/api/v1/et/stat";

function buildUrl(pathSegments, tableId) {
  const parts = tableId ? [...pathSegments, tableId] : pathSegments;
  return parts.length ? `${API_BASE}/${parts.join("/")}` : API_BASE;
}

export async function fetchLevel(pathSegments) {
  const url = buildUrl(pathSegments);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch level ${url}: ${res.status}`);
  }
  return res.json();
}

export async function fetchTableMeta(pathSegments, tableId) {
  const url = buildUrl(pathSegments, tableId);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch table metadata ${url}: ${res.status}`);
  }
  return res.json();
}

export async function fetchTableData(pathSegments, tableId, query) {
  const url = buildUrl(pathSegments, tableId);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch table data ${url}: ${res.status}`);
  }
  return res.json();
}
