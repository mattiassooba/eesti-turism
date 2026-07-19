import { createContext, useContext, useMemo, useState } from "react";

// Shared across OperatorInsights' "Vali maakond" selector, the dashboard's
// AI narrative (which has a per-region variant of its blurb), and the
// newsletter PDF export (which embeds a live snapshot of whichever region
// is currently selected) — a single source of truth so all three agree on
// "the currently selected county" instead of each keeping their own copy.
const RegionContext = createContext(null);

const DEFAULT_REGION = "EE00370000000000"; // Harju maakond

export function RegionProvider({ children }) {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const value = useMemo(() => ({ region, setRegion }), [region]);
  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}
