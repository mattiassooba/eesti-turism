// Read-only access to Statistikaamet's public PxWeb API, through the
// production app's own service (src/api/pxweb.js) and JSON-stat flattener
// (src/api/jsonStat.js). Nothing here writes anywhere.
//
// All statistical queries are issued against the Estonian endpoint: codes
// are identical across locales and the prototype localizes every label
// itself (period names, regions via the shared dictionary, countries via
// Intl.DisplayNames), which also sidesteps the /en "top N" ordering bug
// the production service already works around.
import { useEffect, useState } from "react";
import { fetchTableData } from "@prod/api/pxweb.js";
import { flattenToRows } from "@prod/api/jsonStat.js";

export const PATHS = {
  majutus: ["majandus", "turism-ja-majutus", "majutus"],
  reisimine: ["majandus", "turism-ja-majutus", "eesti-elanike-reisimine"],
  turismMajandus: ["majandus", "turism-ja-majutus", "turismi-ja-majutuse-majandusnaitajad"],
  em001: ["majandus", "ettevetete-majandusnaitajad", "ettevetete-tulud-kulud-kasum", "aastastatistika"],
  pa113: ["majandus", "palk-ja-toojeukulu", "palk", "luhiajastatistika"],
};

const cache = new Map();

export function query(path, table, selections) {
  const key = `${path.join("/")}/${table}:${JSON.stringify(selections)}`;
  if (!cache.has(key)) {
    const q = Object.entries(selections).map(([code, sel]) => ({
      code,
      selection: Array.isArray(sel) ? { filter: "item", values: sel } : { filter: "top", values: [String(sel.top)] },
    }));
    const promise = fetchTableData(path, table, q, { locale: "et" })
      .then((ds) => ({ rows: flattenToRows(ds), updated: ds.updated ?? null }))
      .catch((err) => {
        cache.delete(key);
        throw err;
      });
    cache.set(key, promise);
  }
  return cache.get(key);
}

// Minimal async-state hook with a shared cache: every component asking for
// the same derived dataset shares one request.
const derivedCache = new Map();

export function useData(key, loader) {
  const [state, setState] = useState(() => {
    const hit = derivedCache.get(key);
    return hit?.value ? { data: hit.value, error: null, loading: false } : { data: null, error: null, loading: true };
  });

  useEffect(() => {
    if (key == null) return undefined;
    let alive = true;
    let entry = derivedCache.get(key);
    if (!entry) {
      entry = { promise: loader() };
      entry.promise.then(
        (value) => {
          entry.value = value;
        },
        () => derivedCache.delete(key)
      );
      derivedCache.set(key, entry);
    }
    if (entry.value) {
      setState({ data: entry.value, error: null, loading: false });
    } else {
      setState((s) => ({ data: s.data, error: null, loading: true }));
      entry.promise.then(
        (value) => alive && setState({ data: value, error: null, loading: false }),
        (err) => alive && setState({ data: null, error: err?.message ?? String(err), loading: false })
      );
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export function retryData(key) {
  derivedCache.delete(key);
}
