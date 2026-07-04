import { useEffect, useState } from "react";
import { fetchTableData } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import EstoniaMap from "./EstoniaMap";
import SeasonalityHeatmap from "./SeasonalityHeatmap";
import RankedBarList from "./RankedBarList";

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];

const REAL_COUNTY_CODES = [
  "EE00370000000000",
  "EE00390000000000",
  "EE00450000000000",
  "EE00500000000000",
  "EE00520000000000",
  "EE00560000000000",
  "EE00600000000000",
  "EE00640000000000",
  "EE00680000000000",
  "EE00710000000000",
  "EE00740000000000",
  "EE00790000000000",
  "EE00810000000000",
  "EE00840000000000",
  "EE00870000000000",
];

// Statistikaamet's Maakond code ("EE" + MKOOD + 10 zeros) → the map
// GeoJSON's MKOOD (e.g. "EE00370000000000" → "0037").
function toMkood(statCode) {
  return statCode.slice(2, 6);
}

const ORIGIN_COUNTRY_LABELS = {
  FI: "Soome",
  LV: "Läti",
  DE: "Saksamaa",
  SE: "Rootsi",
  RU: "Venemaa",
  LT: "Leedu",
  NO: "Norra",
  UK: "Suurbritannia",
  US: "Ameerika Ühendriigid",
  FR: "Prantsusmaa",
  NL: "Holland",
  PL: "Poola",
  IT: "Itaalia",
  ES: "Hispaania",
  DK: "Taani",
};

export default function Page2Map() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const countyData = await fetchTableData(MAJUTUS_PATH, "TU131.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_NI"] } },
          { code: "Maakond", selection: { filter: "item", values: REAL_COUNTY_CODES } },
          { code: "Elukohariik", selection: { filter: "item", values: ["WORLD"] } },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["12"] } },
        ]);
        const countyRows = flattenToRows(countyData);
        const countyTotals = {};
        for (const row of countyRows) {
          if (row.value === null) continue;
          const mkood = toMkood(row.Maakond);
          countyTotals[mkood] = (countyTotals[mkood] ?? 0) + row.value;
        }

        const historyData = await fetchTableData(MAJUTUS_PATH, "TU131.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
          { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
          { code: "Elukohariik", selection: { filter: "item", values: ["EE", "FOR"] } },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["256"] } },
        ]);
        const historyRows = flattenToRows(historyData);

        const byPeriod = new Map();
        for (const row of historyRows) {
          if (!byPeriod.has(row.Vaatlusperiood)) {
            byPeriod.set(row.Vaatlusperiood, { x: row.Vaatlusperiood_label });
          }
          const label = row.Elukohariik === "EE" ? "Eesti elanikud" : "Väliskülastajad";
          if (row.value !== null) {
            byPeriod.get(row.Vaatlusperiood)[label] = row.value;
          }
        }
        const periodKeys = Array.from(byPeriod.keys()).sort();
        const historyChart = periodKeys.map((k) => byPeriod.get(k));

        // Reshape the same national monthly totals into a month x year grid
        // (total guests = domestic + foreign) for the heatmap below.
        const grid = {};
        const yearSet = new Set();
        for (const key of periodKeys) {
          const [year, monthStr] = key.split("M");
          const monthIdx = parseInt(monthStr, 10) - 1;
          yearSet.add(year);
          if (!grid[year]) grid[year] = new Array(12).fill(null);
          const entry = byPeriod.get(key);
          const domestic = entry["Eesti elanikud"];
          const foreign = entry["Väliskülastajad"];
          grid[year][monthIdx] =
            domestic === undefined && foreign === undefined ? null : (domestic ?? 0) + (foreign ?? 0);
        }
        const years = Array.from(yearSet).sort();

        const originData = await fetchTableData(MAJUTUS_PATH, "TU131.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
          { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
          {
            code: "Elukohariik",
            selection: { filter: "item", values: Object.keys(ORIGIN_COUNTRY_LABELS) },
          },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["12"] } },
        ]);
        const originRows = flattenToRows(originData);
        const originTotals = new Map();
        for (const row of originRows) {
          if (row.value === null) continue;
          originTotals.set(
            row.Elukohariik,
            (originTotals.get(row.Elukohariik) ?? 0) + row.value
          );
        }
        const origins = Array.from(originTotals.entries())
          .map(([code, value]) => ({ label: ORIGIN_COUNTRY_LABELS[code] ?? code, value }))
          .sort((a, b) => b.value - a.value);

        if (!cancelled) {
          setState({
            status: "ready",
            countyTotals,
            historyChart,
            years,
            grid,
            origins,
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

  if (state.status === "loading") return <div className="panel-status">Laen…</div>;
  if (state.status === "error")
    return <div className="panel-error">Andmete laadimine ebaõnnestus: {state.message}</div>;

  return (
    <div className="dashboard">
      <div className="tile-row-split">
        <div className="data-card">
          <h3>Ööbimised maakonna järgi (viimased 12 kuud kokku)</h3>
          <EstoniaMap valuesByMkood={state.countyTotals} unit="ööd" />
        </div>

        <div className="data-card">
          <h3>Enim külastajaid saatvad riigid (viimased 12 kuud)</h3>
          <RankedBarList items={state.origins} />
        </div>
      </div>

      <div className="data-card">
        <h3>Eesti elanikud vs. väliskülastajad (kogu ajalugu)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={state.historyChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fontSize: 9 }} interval="preserveStartEnd" minTickGap={40} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="Eesti elanikud"
              stroke="#5b6b7a"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="Väliskülastajad"
              stroke="#d98e2b"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="data-card">
        <h3>Hooajalisus: majutatute arv kuu ja aasta järgi</h3>
        <SeasonalityHeatmap years={state.years} grid={state.grid} />
      </div>
    </div>
  );
}
