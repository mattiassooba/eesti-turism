import { useEffect, useState } from "react";
import { fetchTableData } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import SeasonalityStrip from "./SeasonalityStrip";
import SplitBar from "./SplitBar";
import Sparkline from "./Sparkline";

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

function yoyDelta(series, latestIndex) {
  const yearAgoIndex = latestIndex - 12;
  if (yearAgoIndex < 0) return null;
  const latest = series[latestIndex];
  const yearAgo = series[yearAgoIndex];
  if (!yearAgo) return null;
  return ((latest - yearAgo) / yearAgo) * 100;
}

export default function Dashboard({ onSelectTable }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const national = await fetchTableData(MAJUTUS_PATH, "TU131.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR", "OCC_NI"] } },
          { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
          {
            code: "Elukohariik",
            selection: { filter: "item", values: ["WORLD", "EE", "FOR"] },
          },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["25"] } },
        ]);
        const rows = flattenToRows(national);

        const byPeriod = new Map();
        for (const row of rows) {
          if (!byPeriod.has(row.Vaatlusperiood)) {
            byPeriod.set(row.Vaatlusperiood, { label: row.Vaatlusperiood_label });
          }
          const bucket = byPeriod.get(row.Vaatlusperiood);
          const key = `${row.Näitaja}_${row.Elukohariik}`;
          bucket[key] = row.value;
        }
        const periods = Array.from(byPeriod.keys()).sort();
        const latestIdx = periods.length - 1;
        const latest = byPeriod.get(periods[latestIdx]);

        const guestsSeries = periods.map((p) => byPeriod.get(p).OCC_ARR_WORLD ?? 0);
        const nightsSeries = periods.map((p) => byPeriod.get(p).OCC_NI_WORLD ?? 0);

        const totalGuests = latest.OCC_ARR_WORLD ?? 0;
        const totalNights = latest.OCC_NI_WORLD ?? 0;
        const domesticGuests = latest.OCC_ARR_EE ?? 0;
        const foreignGuests = latest.OCC_ARR_FOR ?? 0;
        const avgNightsPerGuest = totalGuests ? totalNights / totalGuests : 0;

        const months = periods.slice(-12).map((p) => ({
          label: byPeriod.get(p).label,
          value: byPeriod.get(p).OCC_ARR_WORLD ?? 0,
        }));
        const nightsSparkline = periods.slice(-24).map((p) => ({
          value: byPeriod.get(p).OCC_NI_WORLD ?? 0,
        }));

        const county = await fetchTableData(MAJUTUS_PATH, "TU131.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
          { code: "Maakond", selection: { filter: "item", values: REAL_COUNTY_CODES } },
          { code: "Elukohariik", selection: { filter: "item", values: ["WORLD"] } },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
        ]);
        const countyRows = flattenToRows(county);
        let topCounty = null;
        for (const row of countyRows) {
          if (!topCounty || row.value > topCounty.value) {
            topCounty = { label: row.Maakond_label, value: row.value };
          }
        }

        if (!cancelled) {
          setState({
            status: "ready",
            latestLabel: latest.label,
            totalGuests,
            totalNights,
            domesticGuests,
            foreignGuests,
            avgNightsPerGuest,
            guestsYoy: yoyDelta(guestsSeries, latestIdx),
            nightsYoy: yoyDelta(nightsSeries, latestIdx),
            months,
            nightsSparkline,
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
    return <div className="panel-error">Ülevaate laadimine ebaõnnestus: {state.message}</div>;
  }

  function deltaLabel(pct) {
    if (pct === null) return null;
    return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}% vs eelmine aasta`;
  }

  return (
    <div className="dashboard">
      <div className="kpi-row">
        <div className="hero-card">
          <div className="hero-label">Majutatud külastajad · {state.latestLabel}</div>
          <div className="hero-number">{state.totalGuests.toLocaleString("et-EE")}</div>
          {state.guestsYoy !== null && (
            <div className={"hero-delta " + (state.guestsYoy >= 0 ? "delta-up" : "delta-down")}>
              {deltaLabel(state.guestsYoy)}
            </div>
          )}
          <SeasonalityStrip months={state.months} />
        </div>

        <div className="hero-card">
          <div className="hero-label">Ööbimised · {state.latestLabel}</div>
          <div className="hero-number">{state.totalNights.toLocaleString("et-EE")}</div>
          {state.nightsYoy !== null && (
            <div className={"hero-delta " + (state.nightsYoy >= 0 ? "delta-up" : "delta-down")}>
              {deltaLabel(state.nightsYoy)}
            </div>
          )}
          <Sparkline data={state.nightsSparkline} />
          <div className="hero-caption">Viimased 24 kuud</div>
        </div>
      </div>

      <SplitBar
        segments={[
          { label: "Eesti elanikud", value: state.domesticGuests, color: "#5b6b7a" },
          { label: "Väliskülastajad", value: state.foreignGuests, color: "#d98e2b" },
        ]}
      />

      <div className="tile-row">
        <div className="stat-tile">
          <div className="tile-label">Enim külastatud maakond</div>
          <div className="tile-number tile-number-small">{state.topCounty?.label ?? "—"}</div>
        </div>
        <div className="stat-tile">
          <div className="tile-label">Keskmine ööbimiste arv külastaja kohta</div>
          <div className="tile-number">{state.avgNightsPerGuest.toFixed(2)}</div>
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
