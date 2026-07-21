import { createContext, useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { countyBySlug } from "../data/counties";

// Shared across OperatorInsights' "Vali maakond" selector, the dashboard's
// AI narrative (which has a per-region variant of its blurb), and the
// newsletter PDF export (which embeds a live snapshot of whichever region
// is currently selected) — a single source of truth so all three agree on
// "the currently selected county" instead of each keeping their own copy.
//
// Derived from the URL, not stored state: /maakond/:slug and
// /en/county/:slug are real, independently indexable per-region pages, so
// the same path must always resolve to the same region for every visitor
// (including crawlers). Changing the selector navigates to the matching
// path instead of just setting local state — see OperatorInsights.jsx.
const RegionContext = createContext(null);

const DEFAULT_REGION = "EE00370000000000"; // Harju maakond

const SLUG_PATTERN_EN = /^\/en\/county\/([a-z0-9-]+)/;
const SLUG_PATTERN_ET = /^\/maakond\/([a-z0-9-]+)/;

export function RegionProvider({ children }) {
  const { pathname } = useLocation();

  const region = useMemo(() => {
    const enMatch = SLUG_PATTERN_EN.exec(pathname);
    if (enMatch) return countyBySlug(enMatch[1], "en")?.code ?? DEFAULT_REGION;
    const etMatch = SLUG_PATTERN_ET.exec(pathname);
    if (etMatch) return countyBySlug(etMatch[1], "et")?.code ?? DEFAULT_REGION;
    return DEFAULT_REGION;
  }, [pathname]);

  const value = useMemo(() => ({ region }), [region]);
  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}
