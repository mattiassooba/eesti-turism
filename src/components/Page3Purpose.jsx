import { useEffect, useState } from "react";
import { fetchTableData } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];
const REISIMINE_PATH = ["majandus", "turism-ja-majutus", "eesti-elanike-reisimine"];

const COLORS = ["#2b6ca3", "#d98e2b", "#5b6b7a", "#0f3a57", "#9c3b26"];
const PURPOSE_CODES = ["HOL", "BSNS", "BSNS_CONF", "BSNS_O", "_O"];
const DURATION_ORDER = ["1 kuni 3 ööd", "4 kuni 7 ööd", "Üle 7 öö"];
const NAITAJA_SHORT = { TR_DOM: "Sisereisid", TR_OUT: "Välisreisid" };

export default function Page3Purpose() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const purposeData = await fetchTableData(MAJUTUS_PATH, "TU133.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_NI"] } },
          { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
          { code: "Reisi eesmärk", selection: { filter: "item", values: PURPOSE_CODES } },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["24"] } },
        ]);
        const purposeRows = flattenToRows(purposeData);
        const byMonth = new Map();
        for (const row of purposeRows) {
          const key = row.Vaatlusperiood;
          if (!byMonth.has(key)) byMonth.set(key, { x: row.Vaatlusperiood_label });
          byMonth.get(key)[row["Reisi eesmärk_label"]] = row.value;
        }
        const monthKeys = Array.from(byMonth.keys()).sort();
        const purposeChart = monthKeys.map((m) => byMonth.get(m));
        const purposeNames = Array.from(
          new Set(purposeRows.map((r) => r["Reisi eesmärk_label"]))
        );

        const durationData = await fetchTableData(REISIMINE_PATH, "TU54.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["TR_DOM", "TR_OUT"] } },
          {
            code: "Reisi kestus",
            selection: { filter: "item", values: ["N1-3", "N4-7", "N_GT7"] },
          },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
        ]);
        const durationRows = flattenToRows(durationData);
        const byDuration = new Map();
        for (const row of durationRows) {
          const key = row["Reisi kestus_label"];
          if (!byDuration.has(key)) byDuration.set(key, { x: key });
          byDuration.get(key)[NAITAJA_SHORT[row.Näitaja] ?? row.Näitaja] = row.value;
        }
        const durationChart = DURATION_ORDER.map((d) => byDuration.get(d)).filter(Boolean);
        const durationLatestLabel = durationRows[0]?.Vaatlusperiood_label ?? "";

        if (!cancelled) {
          setState({
            status: "ready",
            purposeChart,
            purposeNames,
            durationChart,
            durationLatestLabel,
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
      <div className="data-card">
        <h3>Ööbimised reisi eesmärgi järgi (viimased 24 kuud)</h3>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={state.purposeChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {state.purposeNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stackId="1"
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.75}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="data-card">
        <h3>Reisi kestus, sise- vs. välisreisid ({state.durationLatestLabel})</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={state.durationChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Sisereisid" fill={COLORS[0]} isAnimationActive={false} />
            <Bar dataKey="Välisreisid" fill={COLORS[1]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
