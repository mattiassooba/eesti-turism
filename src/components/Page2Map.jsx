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
import ChartTooltip from "./ChartTooltip";

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

// Statistikaamet's Maakond code ("EE" + MKOOD + 10 zeros) <-> the map
// GeoJSON's MKOOD (e.g. "EE00370000000000" <-> "0037").
function toMkood(statCode) {
  return statCode.slice(2, 6);
}
function toStatCode(mkood) {
  return `EE${mkood}0000000000`;
}

const RESIDENCY_CODE = { all: "WORLD", domestic: "EE", foreign: "FOR" };

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

export default function Page2Map({ residency, timeRangeMonths }) {
  const [base, setBase] = useState({ data: null, loading: true, error: null });
  const [origins, setOrigins] = useState({ data: null, loading: true, error: null });
  const [selectedCounty, setSelectedCounty] = useState(null); // { mkood, label } | null

  const windowSize = timeRangeMonths ? Number(timeRangeMonths) : 999;

  useEffect(() => {
    let cancelled = false;
    const residencyCode = RESIDENCY_CODE[residency] ?? "WORLD";
    setBase((prev) => ({ ...prev, loading: true, error: null }));

    async function load() {
      try {
        const countyData = await fetchTableData(MAJUTUS_PATH, "TU131.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_NI"] } },
          { code: "Maakond", selection: { filter: "item", values: REAL_COUNTY_CODES } },
          { code: "Elukohariik", selection: { filter: "item", values: [residencyCode] } },
          {
            code: "Vaatlusperiood",
            selection: { filter: "top", values: [String(Math.min(windowSize, 24))] },
          },
        ]);
        const countyRows = flattenToRows(countyData);
        const countyTotals = {};
        for (const row of countyRows) {
          if (row.value === null) continue;
          const mkood = toMkood(row.Maakond);
          countyTotals[mkood] = (countyTotals[mkood] ?? 0) + row.value;
        }

        // Fetched at full history regardless of the time-range filter: the
        // heatmap below only makes sense across many years (that's how the
        // COVID-era anomaly becomes visible), so it's exempt from the
        // control the same way Page6's long-run charts are. The line chart
        // below it, which DOES respect the time range, just slices the
        // tail of this same fetch instead of a second API call.
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
        const allPeriodKeys = Array.from(byPeriod.keys()).sort();
        const periodKeys = allPeriodKeys.slice(-windowSize);
        const historyChart = periodKeys.map((k) => byPeriod.get(k));

        // Reshape the same national monthly totals into a month x year grid
        // (total guests = domestic + foreign) for the heatmap below. Uses
        // the full fetch (allPeriodKeys), not the time-range-limited slice.
        const grid = {};
        const yearSet = new Set();
        for (const key of allPeriodKeys) {
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

        if (!cancelled) {
          setBase({ data: { countyTotals, historyChart, years, grid }, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) setBase((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [residency, timeRangeMonths]);

  useEffect(() => {
    let cancelled = false;
    const maakond = selectedCounty ? toStatCode(selectedCounty.mkood) : "EE";
    const originWindow = Math.min(windowSize, 12);
    setOrigins((prev) => ({ ...prev, loading: true, error: null }));

    async function load() {
      try {
        const originData = await fetchTableData(MAJUTUS_PATH, "TU131.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
          { code: "Maakond", selection: { filter: "item", values: [maakond] } },
          {
            code: "Elukohariik",
            selection: { filter: "item", values: Object.keys(ORIGIN_COUNTRY_LABELS) },
          },
          { code: "Vaatlusperiood", selection: { filter: "top", values: [String(originWindow)] } },
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
        const list = Array.from(originTotals.entries())
          .map(([code, value]) => ({ label: ORIGIN_COUNTRY_LABELS[code] ?? code, value }))
          .sort((a, b) => b.value - a.value);

        if (!cancelled) setOrigins({ data: list, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setOrigins((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [timeRangeMonths, selectedCounty]);

  if (!base.data && base.loading) return <div className="panel-status">Laen…</div>;
  if (!base.data && base.error)
    return <div className="panel-error">Andmete laadimine ebaõnnestus: {base.error}</div>;

  return (
    <div className={"dashboard" + (base.loading ? " refetching" : "")}>
      <div className="tile-row-split">
        <div className="data-card">
          <h3>Ööbimised maakonna järgi (viimased {Math.min(windowSize, 24)} kuud kokku)</h3>
          <EstoniaMap
            valuesByMkood={base.data.countyTotals}
            unit="ööd"
            selectedMkood={selectedCounty?.mkood}
            onSelectCounty={(mkood, label) =>
              setSelectedCounty((prev) => (prev?.mkood === mkood ? null : { mkood, label }))
            }
          />
        </div>

        <div className="data-card">
          <h3>Enim külastajaid saatvad riigid (viimased {Math.min(windowSize, 12)} kuud)</h3>
          {selectedCounty && (
            <button className="selection-chip" onClick={() => setSelectedCounty(null)}>
              {selectedCounty.label}
              <span className="selection-chip-x">×</span>
            </button>
          )}
          {!origins.data && origins.loading && <div className="panel-status">Laen…</div>}
          {!origins.data && origins.error && (
            <div className="panel-error">Andmete laadimine ebaõnnestus: {origins.error}</div>
          )}
          {origins.data && (
            <div className={origins.loading ? "refetching" : ""}>
              {origins.data.length ? (
                <RankedBarList items={origins.data} unit="külastajat" />
              ) : (
                <div className="panel-status">Selle maakonna kohta andmed puuduvad.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="data-card">
        <h3>
          Eesti elanikud vs. väliskülastajad (viimased {base.data.historyChart.length} kuud)
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={base.data.historyChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fontSize: 9 }} interval="preserveStartEnd" minTickGap={40} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} />
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
        <SeasonalityHeatmap years={base.data.years} grid={base.data.grid} />
      </div>
    </div>
  );
}
