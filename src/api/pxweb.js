// PxWeb supports a locale segment in the URL path (/et/ or /en/) that's a
// pure prefix swap — dimension codes and category codes are identical
// between locales, only human-readable text/valueTexts/label fields
// translate. Confirmed against the live API before relying on this.
function apiBase(locale) {
  return `https://andmed.stat.ee/api/v1/${locale === "en" ? "en" : "et"}/stat`;
}

function buildUrl(pathSegments, tableId, locale) {
  const parts = tableId ? [...pathSegments, tableId] : pathSegments;
  return parts.length ? `${apiBase(locale)}/${parts.join("/")}` : apiBase(locale);
}

export async function fetchLevel(pathSegments, { signal, locale } = {}) {
  const url = buildUrl(pathSegments, undefined, locale);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch level ${url}: ${res.status}`);
  }
  return res.json();
}

export async function fetchTableMeta(pathSegments, tableId, { signal, locale } = {}) {
  const url = buildUrl(pathSegments, tableId, locale);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch table metadata ${url}: ${res.status}`);
  }
  return res.json();
}

async function postTableData(pathSegments, tableId, query, { signal, locale } = {}) {
  const url = buildUrl(pathSegments, tableId, locale);
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

export async function fetchTableData(pathSegments, tableId, query, { signal, locale } = {}) {
  const periodSelector = query.find((q) => q.code === "Vaatlusperiood");

  // Statistikaamet's own API has a locale-specific bug: a "top" filter on
  // Vaatlusperiood returns the OLDEST N periods under /en/ instead of the
  // newest N (confirmed against the live API — /et/ for the identical
  // query correctly returns the most recent periods). Work around it by
  // resolving the correct period codes via /et/ first (where "top"
  // behaves correctly), then re-issuing the real query with those exact
  // codes pinned via "item" instead of "top" — this is invisible to every
  // caller, none of which need to know the workaround exists.
  if (locale === "en" && periodSelector?.selection?.filter === "top") {
    const probe = await postTableData(pathSegments, tableId, query, { signal, locale: "et" });
    const periodCodes = Object.keys(probe?.dimension?.Vaatlusperiood?.category?.index ?? {});
    if (periodCodes.length) {
      const pinnedQuery = query.map((q) =>
        q.code === "Vaatlusperiood" ? { ...q, selection: { filter: "item", values: periodCodes } } : q
      );
      return postTableData(pathSegments, tableId, pinnedQuery, { signal, locale });
    }
  }

  return postTableData(pathSegments, tableId, query, { signal, locale });
}

// Search is scoped to pathSegments (e.g. the tourism folder) so results
// don't include unrelated statistics domains. The API returns each
// result's own path relative to that scope (e.g. "/eesti-elanike-reisimine"),
// which the caller must prepend pathSegments to before using with
// fetchTableMeta/fetchTableData.
export async function searchTables(pathSegments, query, { signal, locale } = {}) {
  const url = `${buildUrl(pathSegments, undefined, locale)}?query=${encodeURIComponent(query)}`;
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
