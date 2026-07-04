import { useEffect, useState } from "react";
import { fetchTableData } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import SeasonalityStrip from "./SeasonalityStrip";

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];

// The 15 real Estonian maakonds (non-overlapping). TU131's Maakond dimension
// also includes an "Eesti" total and city-level sub-splits (e.g. Tallinn is
// a subset of Harju maakond) — using only these 15 avoids double-counting.
const REAL_COUNTY_CODES = [
  "EE00370000000000", // Harju
  "EE00390000000000", // Hiiu
  "EE00450000000000", // Ida-Viru
  "EE00500000000000", // Jõgeva
  "EE00520000000000", // Järva
  "EE00560000000000", // Lääne
  "EE00600000000000", // Lääne-Viru
  "EE00640000000000", // Põlva
  "EE00680000000000", // Pärnu
  "EE00710000000000", // Rapla
  "EE00740000000000", // Saare
  "EE00790000000000", // Tartu
  "EE00810000000000", // Valga
  "EE00840000000000", // Viljandi
  "EE00870000000000", // Võru
];

const QUICK_LINKS = [
  { tableId: "TU121.PX", title: "TU121: MAJUTATUD (KUUD)" },
  { tableId: "TU122.PX", title: "TU122: MAJUTAMINE MAAKONNA JÄRGI (KUUD)" },
  { tableId: "TU11.PX", title: "TU11: MAJUTUSKOHTADE MAHUTAVUS PIIRKONNA JÄRGI" },
  {
    tableId: "TU131.PX",
    title: "TU131: MAJUTATUD JA MAJUTATUTE ÖÖBIMISED MAAKONNA JA ELUKOHARIIGI JÄRGI (KUUD)",
  },
];

export default function Dashboard({ onSelectTable }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const tu121 = await fetchTableData(MAJUTUS_PATH, "TU121.PX", [
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["13"] } },
        ]);
        const tu121Rows = flattenToRows(tu121);

        const byPeriod = new Map();
        for (const row of tu121Rows) {
          if (!byPeriod.has(row.Vaatlusperiood)) {
            byPeriod.set(row.Vaatlusperiood, { label: row.Vaatlusperiood_label });
          }
          byPeriod.get(row.Vaatlusperiood)[row.Näitaja] = row.value;
        }
        const periods = Array.from(byPeriod.keys()).sort();
        const latestKey = periods[periods.length - 1];
        const prevKey = periods[periods.length - 2];
        const latest = byPeriod.get(latestKey);
        const prev = prevKey ? byPeriod.get(prevKey) : null;

        const months = periods.slice(-12).map((key) => ({
          label: byPeriod.get(key).label,
          value: byPeriod.get(key).OCC_ARR ?? 0,
        }));

        const total = latest.OCC_ARR ?? 0;
        const prevTotal = prev?.OCC_ARR ?? null;
        const deltaPct = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : null;

        const tu131 = await fetchTableData(MAJUTUS_PATH, "TU131.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
          { code: "Maakond", selection: { filter: "item", values: REAL_COUNTY_CODES } },
          { code: "Elukohariik", selection: { filter: "item", values: ["WORLD"] } },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
        ]);
        const tu131Rows = flattenToRows(tu131);
        let topCounty = null;
        for (const row of tu131Rows) {
          if (!topCounty || row.value > topCounty.value) {
            topCounty = { label: row.Maakond_label, value: row.value };
          }
        }

        if (!cancelled) {
          setState({
            status: "ready",
            latestLabel: latest.label,
            total,
            deltaPct,
            residents: latest.OCC_ARR_RES ?? 0,
            nonResidents: latest.OCC_ARR_NONRES ?? 0,
            months,
            topCounty,
          });
        }
      } catch (err) {
        if (!cancelled) setState({ status: "error", message: err.message });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <div className="panel-status">Laen ülevaadet…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="panel-error">Ülevaate laadimine ebaõnnestus: {state.message}</div>
    );
  }

  const deltaText =
    state.deltaPct === null
      ? null
      : `${state.deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(state.deltaPct).toFixed(1)}% eelmisest kuust`;

  return (
    <div className="dashboard">
      <div className="hero-card">
        <div className="hero-label">Majutatud külastajad · {state.latestLabel}</div>
        <div className="hero-number">{state.total.toLocaleString("et-EE")}</div>
        {deltaText && (
          <div className={"hero-delta " + (state.deltaPct >= 0 ? "delta-up" : "delta-down")}>
            {deltaText}
          </div>
        )}
        <SeasonalityStrip months={state.months} />
      </div>

      <div className="tile-row">
        <div className="stat-tile">
          <div className="tile-label">Eesti elanikud</div>
          <div className="tile-number">{state.residents.toLocaleString("et-EE")}</div>
        </div>
        <div className="stat-tile">
          <div className="tile-label">Väliskülastajad</div>
          <div className="tile-number">{state.nonResidents.toLocaleString("et-EE")}</div>
        </div>
        <div className="stat-tile">
          <div className="tile-label">Enim külastatud maakond</div>
          <div className="tile-number tile-number-small">{state.topCounty?.label ?? "—"}</div>
        </div>
      </div>

      <div className="quick-links">
        <div className="quick-links-label">Kiirvalik</div>
        <div className="quick-links-grid">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.tableId}
              className="quick-link-card"
              onClick={() => onSelectTable(MAJUTUS_PATH, link.tableId, link.title)}
            >
              {link.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
