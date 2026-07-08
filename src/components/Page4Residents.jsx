import { useState } from "react";
import { fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import RankedBarList from "./RankedBarList";
import ChartTooltip from "./ChartTooltip";
import { DOMESTIC_COLOR, FOREIGN_COLOR, CHART_GRID_COLOR, CHART_AXIS_COLOR } from "../theme";

const REISIMINE_PATH = ["majandus", "turism-ja-majutus", "eesti-elanike-reisimine"];

const NAITAJA_SHORT = { TR_DOM: "Sisereisid", TR_OUT: "Välisreisid" };

const COUNTRY_LABELS = {
  LT: "Leedu",
  LV: "Läti",
  SE: "Rootsi",
  FI: "Soome",
  RU: "Venemaa",
  DE: "Saksamaa",
  IT: "Itaalia",
  TR: "Türgi",
  ES: "Hispaania",
};

const ACCOMMODATION_LABELS = {
  R_HOT: "Hotellid",
  R_CAMP: "Laagriplatsid, haagissuvilad",
  R_OTH: "Muu tasuline majutus",
  NR_OWN: "Endale kuuluv eluruum",
  NR_RF: "Tuttavate/sugulaste juures",
  NR_OTH: "Muu tasuta majutus",
};

export default function Page4Residents({ timeRangeMonths }) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  // This page's tables are quarterly, but the global time-range control is
  // defined in months (it applies to monthly pages too) — convert here.
  const quarters = timeRangeMonths ? Math.max(Math.ceil(Number(timeRangeMonths) / 3), 4) : 999;
  const originQuarters = timeRangeMonths ? Math.max(Math.ceil(Number(timeRangeMonths) / 3), 1) : 999;

  useAbortableEffect(
    async (signal, isActive) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // All five queries are independent (different tables, no data
        // dependency between them) — fire them concurrently instead of
        // paying for five sequential round-trips.
        const [tripsData, countryData, domesticSpend, foreignSpend, accommodationData] =
          await Promise.all([
            fetchTableData(
              REISIMINE_PATH,
              "TU51.PX",
              [
                { code: "Näitaja", selection: { filter: "item", values: ["TR_DOM", "TR_OUT"] } },
                { code: "Reisi eesmärk", selection: { filter: "item", values: ["TOTAL"] } },
                { code: "Vaatlusperiood", selection: { filter: "top", values: [String(quarters)] } },
              ],
              { signal }
            ),
            fetchTableData(
              REISIMINE_PATH,
              "TU63.PX",
              [
                {
                  code: "Sihtriik",
                  selection: { filter: "item", values: Object.keys(COUNTRY_LABELS) },
                },
                {
                  code: "Vaatlusperiood",
                  selection: { filter: "top", values: [String(originQuarters)] },
                },
              ],
              { signal }
            ),
            fetchTableData(
              REISIMINE_PATH,
              "TU56.PX",
              [
                { code: "Reisi eesmärk", selection: { filter: "item", values: ["TOTAL"] } },
                { code: "Vaatlusperiood", selection: { filter: "top", values: [String(quarters)] } },
              ],
              { signal }
            ),
            fetchTableData(
              REISIMINE_PATH,
              "TU661.PX",
              [
                { code: "Näitaja", selection: { filter: "item", values: ["EXP_OUT"] } },
                { code: "Reisi eesmärk", selection: { filter: "item", values: ["TOTAL"] } },
                { code: "Vaatlusperiood", selection: { filter: "top", values: [String(quarters)] } },
              ],
              { signal }
            ),
            fetchTableData(
              REISIMINE_PATH,
              "TU551.PX",
              [
                { code: "Näitaja", selection: { filter: "item", values: ["N_DOM", "N_OUT"] } },
                {
                  code: "Majutuse liik",
                  selection: { filter: "item", values: Object.keys(ACCOMMODATION_LABELS) },
                },
                { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
              ],
              { signal }
            ),
          ]);

        const tripsRows = flattenToRows(tripsData);
        const byQuarter = new Map();
        for (const row of tripsRows) {
          if (!byQuarter.has(row.Vaatlusperiood)) {
            byQuarter.set(row.Vaatlusperiood, { x: row.Vaatlusperiood_label });
          }
          byQuarter.get(row.Vaatlusperiood)[NAITAJA_SHORT[row.Näitaja] ?? row.Näitaja] =
            row.value;
        }
        const quarterKeys = Array.from(byQuarter.keys()).sort();
        const tripsChart = quarterKeys.map((k) => byQuarter.get(k));

        const countryRows = flattenToRows(countryData);
        // Statistikaamet suppresses cells with too few observations (returned
        // as null, not 0) — summing null as 0 would misreport "data withheld"
        // as "confirmed zero visitors." Skip nulls, and drop a country
        // entirely if it has no reported quarters at all.
        const countryTotals = new Map();
        for (const row of countryRows) {
          if (row.value === null) continue;
          countryTotals.set(row.Sihtriik, (countryTotals.get(row.Sihtriik) ?? 0) + row.value);
        }
        const countries = Array.from(countryTotals.entries())
          .map(([code, value]) => ({ label: COUNTRY_LABELS[code] ?? code, value }))
          .sort((a, b) => b.value - a.value);

        const domesticRows = flattenToRows(domesticSpend);
        const foreignRows = flattenToRows(foreignSpend);
        const bySpendQuarter = new Map();
        for (const row of domesticRows) {
          if (!bySpendQuarter.has(row.Vaatlusperiood)) {
            bySpendQuarter.set(row.Vaatlusperiood, { x: row.Vaatlusperiood_label });
          }
          bySpendQuarter.get(row.Vaatlusperiood)["Sisereis"] = row.value;
        }
        for (const row of foreignRows) {
          if (!bySpendQuarter.has(row.Vaatlusperiood)) {
            bySpendQuarter.set(row.Vaatlusperiood, { x: row.Vaatlusperiood_label });
          }
          bySpendQuarter.get(row.Vaatlusperiood)["Välisreis"] = row.value;
        }
        const spendKeys = Array.from(bySpendQuarter.keys()).sort();
        const spendChart = spendKeys.map((k) => bySpendQuarter.get(k));

        const accommodationRows = flattenToRows(accommodationData);
        // Same null-suppression handling as the country ranking above.
        const accommodationTotals = new Map();
        for (const row of accommodationRows) {
          if (row.value === null) continue;
          const key = row["Majutuse liik"];
          accommodationTotals.set(key, (accommodationTotals.get(key) ?? 0) + row.value);
        }
        const accommodation = Array.from(accommodationTotals.entries())
          .map(([code, value]) => ({ label: ACCOMMODATION_LABELS[code] ?? code, value }))
          .sort((a, b) => b.value - a.value);

        if (isActive()) {
          setState({
            data: { tripsChart, countries, spendChart, accommodation },
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (isAbortError(err)) return;
        if (isActive()) setState((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    },
    [timeRangeMonths]
  );

  if (!state.data && state.loading) return <div className="panel-status">Laen…</div>;
  if (!state.data && state.error)
    return <div className="panel-error">Andmete laadimine ebaõnnestus: {state.error}</div>;

  const { data } = state;

  const topCountry = data.countries[0] ?? null;

  return (
    <div className={"dashboard" + (state.loading ? " refetching" : "")}>
      {topCountry && (
        <div className="hero-card">
          <div className="hero-label">Populaarseim sihtriik</div>
          <div className="hero-number hero-number-text">{topCountry.label}</div>
          <div className="hero-caption">
            {topCountry.value.toLocaleString("et-EE")} tuh reisi
          </div>
        </div>
      )}

      <div className="data-card">
        <h3>Sise- ja välisreisid kvartalite kaupa (tuhat reisi, viimased {quarters === 999 ? data.tripsChart.length : quarters} kvartalit)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.tripsChart}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
            />
            <Tooltip content={<ChartTooltip unit="tuh" />} />
            <Legend />
            <Bar dataKey="Sisereisid" fill={DOMESTIC_COLOR} isAnimationActive={false} />
            <Bar dataKey="Välisreisid" fill={FOREIGN_COLOR} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="tile-row-split">
        <div className="data-card">
          <h3>Enim külastatud sihtriigid (viimased {originQuarters === 999 ? "kõik" : originQuarters} kvartalit, tuhat reisi)</h3>
          <RankedBarList items={data.countries} unit="tuh reisi" />
        </div>

        <div className="data-card">
          <h3>Majutuse liik reisidel (viimane kvartal, tuhat ööbimist)</h3>
          <RankedBarList items={data.accommodation} unit="tuh ööbimist" />
        </div>
      </div>

      <div className="data-card">
        <h3>Reisikulutused, sise- vs. välisreis (eurot, viimased {quarters === 999 ? data.spendChart.length : quarters} kvartalit)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.spendChart}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tickLine={{ stroke: CHART_GRID_COLOR }}
            />
            <Tooltip content={<ChartTooltip unit="€" />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="Sisereis"
              stroke={DOMESTIC_COLOR}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="Välisreis"
              stroke={FOREIGN_COLOR}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
