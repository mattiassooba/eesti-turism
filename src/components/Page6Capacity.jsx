import { useEffect, useState } from "react";
import { fetchTableData } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];

const REGION_LABELS = {
  EE001: "Põhja-Eesti",
  EE009: "Kesk-Eesti",
  EE00A: "Kirde-Eesti",
  EE004: "Lääne-Eesti",
  EE008: "Lõuna-Eesti",
};

export default function Page6Capacity() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const regionData = await fetchTableData(MAJUTUS_PATH, "TU11.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["CAP_BEDP"] } },
          {
            code: "Piirkond",
            selection: { filter: "item", values: Object.keys(REGION_LABELS) },
          },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
        ]);
        const regionRows = flattenToRows(regionData);
        const regionChart = regionRows
          .map((r) => ({ x: REGION_LABELS[r.Piirkond] ?? r.Piirkond, Voodikohad: r.value }))
          .sort((a, b) => b.Voodikohad - a.Voodikohad);
        const regionLatestLabel = regionRows[0]?.Vaatlusperiood_label ?? "";

        const trendData = await fetchTableData(MAJUTUS_PATH, "TU11.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["CAP_BEDP"] } },
          { code: "Piirkond", selection: { filter: "item", values: ["EE"] } },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["34"] } },
        ]);
        const trendRows = flattenToRows(trendData);
        const trendChart = trendRows
          .map((r) => ({ x: r.Vaatlusperiood_label, Voodikohad: r.value }))
          .sort((a, b) => a.x.localeCompare(b.x));

        const occupancyData = await fetchTableData(MAJUTUS_PATH, "TU110.PX", [
          { code: "Näitaja", selection: { filter: "item", values: ["OCC_OR_BEDP"] } },
          { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
          { code: "Vaatlusperiood", selection: { filter: "top", values: ["22"] } },
        ]);
        const occupancyRows = flattenToRows(occupancyData);
        const occupancyChart = occupancyRows
          .map((r) => ({ x: r.Vaatlusperiood_label, "Täituvus, %": r.value }))
          .sort((a, b) => a.x.localeCompare(b.x));

        if (!cancelled) {
          setState({
            status: "ready",
            regionChart,
            regionLatestLabel,
            trendChart,
            occupancyChart,
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
        <h3>Voodikohad piirkonna järgi ({state.regionLatestLabel})</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={state.regionChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="Voodikohad" fill="#2b6ca3" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="tile-row-split">
        <div className="data-card">
          <h3>Voodikohtade arv, Eesti kokku (alates 1992)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={state.trendChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="Voodikohad"
                stroke="#0f3a57"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="data-card">
          <h3>Voodikohtade täituvus, Eesti kokku (alates 2004)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={state.occupancyChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="Täituvus, %"
                stroke="#d98e2b"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
