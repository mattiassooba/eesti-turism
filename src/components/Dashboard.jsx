import { memo, useState } from "react";
import { fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import SeasonalityStrip from "./SeasonalityStrip";
import SplitBar from "./SplitBar";
import Sparkline from "./Sparkline";
import OperatorInsights from "./OperatorInsights";
import { DOMESTIC_COLOR, FOREIGN_COLOR } from "../theme";

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

const RESIDENCY = {
  all: { code: "WORLD", guestsLabel: "Majutatud külastajad", nightsLabel: "Ööbimised" },
  domestic: { code: "EE", guestsLabel: "Eesti elanikud", nightsLabel: "Eesti elanike ööbimised" },
  foreign: {
    code: "FOR",
    guestsLabel: "Väliskülastajad",
    nightsLabel: "Väliskülastajate ööbimised",
  },
};

function periodDelta(series, latestIndex, offset, label) {
  const compareIndex = latestIndex - offset;
  if (compareIndex < 0) return null;
  const latest = series[latestIndex];
  const compare = series[compareIndex];
  if (!compare) return null;
  return { pct: ((latest - compare) / compare) * 100, label };
}

// Memoized — on this scrolling single-page layout, an ancestor state
// update unrelated to this section's own props (e.g. scroll-driven
// active-tab tracking) shouldn't re-render this section's charts/table.
function Dashboard({ onSelectTable, residency, timeRangeMonths, deltaMode }) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useAbortableEffect(
    async (signal, isActive) => {
      const fetchCount = timeRangeMonths ? Math.max(Number(timeRangeMonths), 25) : 999;
      const residencyCode = RESIDENCY[residency]?.code ?? "WORLD";
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Independent queries — run concurrently instead of two sequential
        // round-trips.
        const [national, county] = await Promise.all([
          fetchTableData(
            MAJUTUS_PATH,
            "TU131.PX",
            [
              { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR", "OCC_NI"] } },
              { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
              {
                code: "Elukohariik",
                selection: { filter: "item", values: ["WORLD", "EE", "FOR"] },
              },
              { code: "Vaatlusperiood", selection: { filter: "top", values: [String(fetchCount)] } },
            ],
            { signal }
          ),
          fetchTableData(
            MAJUTUS_PATH,
            "TU131.PX",
            [
              { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
              { code: "Maakond", selection: { filter: "item", values: REAL_COUNTY_CODES } },
              { code: "Elukohariik", selection: { filter: "item", values: [residencyCode] } },
              { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
            ],
            { signal }
          ),
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

        const guestsSeries = periods.map((p) => byPeriod.get(p)[`OCC_ARR_${residencyCode}`] ?? 0);
        const nightsSeries = periods.map((p) => byPeriod.get(p)[`OCC_NI_${residencyCode}`] ?? 0);

        const totalGuests = latest[`OCC_ARR_${residencyCode}`] ?? 0;
        const totalNights = latest[`OCC_NI_${residencyCode}`] ?? 0;
        const domesticGuests = latest.OCC_ARR_EE ?? 0;
        const foreignGuests = latest.OCC_ARR_FOR ?? 0;
        const avgNightsPerGuest = totalGuests ? totalNights / totalGuests : 0;

        const months = periods.slice(-12).map((p) => ({
          label: byPeriod.get(p).label,
          value: byPeriod.get(p)[`OCC_ARR_${residencyCode}`] ?? 0,
        }));
        const sparkWindow = timeRangeMonths ? Number(timeRangeMonths) : periods.length;
        const nightsSparkline = periods.slice(-sparkWindow).map((p) => ({
          value: byPeriod.get(p)[`OCC_NI_${residencyCode}`] ?? 0,
        }));

        const deltaOffset = deltaMode === "mom" ? 1 : 12;
        const deltaCompareLabel = deltaMode === "mom" ? "eelmine kuu" : "aasta tagasi";

        const countyRows = flattenToRows(county);
        let topCounty = null;
        for (const row of countyRows) {
          if (row.value === null) continue;
          if (!topCounty || row.value > topCounty.value) {
            topCounty = { label: row.Maakond_label, value: row.value };
          }
        }

        if (isActive()) {
          setState({
            data: {
              latestLabel: latest.label,
              totalGuests,
              totalNights,
              domesticGuests,
              foreignGuests,
              avgNightsPerGuest,
              guestsDelta: periodDelta(guestsSeries, latestIdx, deltaOffset, deltaCompareLabel),
              nightsDelta: periodDelta(nightsSeries, latestIdx, deltaOffset, deltaCompareLabel),
              months,
              nightsSparkline,
              sparkWindow,
              topCounty,
            },
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (isAbortError(err)) return;
        if (isActive()) setState((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    },
    [residency, timeRangeMonths, deltaMode]
  );

  if (!state.data && state.loading) {
    return <div className="panel-status">Laen ülevaadet…</div>;
  }
  if (!state.data && state.error) {
    return <div className="panel-error">Ülevaate laadimine ebaõnnestus: {state.error}</div>;
  }

  const labels = RESIDENCY[residency] ?? RESIDENCY.all;
  const data = state.data;

  function deltaText(delta) {
    if (!delta) return null;
    return `${delta.pct >= 0 ? "▲" : "▼"} ${Math.abs(delta.pct).toFixed(1)}% vs ${delta.label}`;
  }

  return (
    <div className={"dashboard" + (state.loading ? " refetching" : "")}>
      <div className="kpi-row">
        <div className="hero-card">
          <div className="hero-label">
            {labels.guestsLabel} · {data.latestLabel}
          </div>
          <div className="hero-number">{data.totalGuests.toLocaleString("et-EE")}</div>
          {data.guestsDelta && (
            <div className={"hero-delta " + (data.guestsDelta.pct >= 0 ? "delta-up" : "delta-down")}>
              {deltaText(data.guestsDelta)}
            </div>
          )}
          <SeasonalityStrip months={data.months} />
          <div className="seasonality-legend">
            <span>Vaikne hooaeg</span>
            <span className="seasonality-legend-gradient" />
            <span>Tipphooaeg</span>
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-label">
            {labels.nightsLabel} · {data.latestLabel}
          </div>
          <div className="hero-number">{data.totalNights.toLocaleString("et-EE")}</div>
          {data.nightsDelta && (
            <div className={"hero-delta " + (data.nightsDelta.pct >= 0 ? "delta-up" : "delta-down")}>
              {deltaText(data.nightsDelta)}
            </div>
          )}
          <Sparkline data={data.nightsSparkline} />
          <div className="hero-caption">Viimased {data.sparkWindow} kuud</div>
        </div>
      </div>

      {residency === "all" && (
        <SplitBar
          segments={[
            { label: "Eesti elanikud", value: data.domesticGuests, color: DOMESTIC_COLOR },
            { label: "Väliskülastajad", value: data.foreignGuests, color: FOREIGN_COLOR },
          ]}
        />
      )}

      <div className="tile-row">
        <div className="stat-tile">
          <div className="tile-label">Enim külastatud maakond</div>
          <div className="tile-number tile-number-small">{data.topCounty?.label ?? "—"}</div>
        </div>
        <div className="stat-tile">
          <div className="tile-label">Keskmine ööbimiste arv külastaja kohta</div>
          <div className="tile-number">{data.avgNightsPerGuest.toFixed(2)}</div>
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

      <OperatorInsights />
    </div>
  );
}

export default memo(Dashboard);
