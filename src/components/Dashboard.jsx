import { memo, useState } from "react";
import { fetchTableData, isAbortError } from "../api/pxweb";
import { flattenToRows } from "../api/jsonStat";
import { useAbortableEffect } from "../hooks/useAbortableEffect";
import SeasonalityStrip from "./SeasonalityStrip";
import SplitBar from "./SplitBar";
import Sparkline from "./Sparkline";
import OperatorInsights from "./OperatorInsights";
import SectionFilters from "./SectionFilters";
import TableSource from "./TableSource";
import NarrativeBlock from "./NarrativeBlock";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { formatNumber } from "../i18n/format";
import { countyLabelByCode } from "../data/counties";
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
function Dashboard() {
  const { t, locale } = useTranslation();
  const RESIDENCY = {
    all: { code: "WORLD", guestsLabel: t("dashboard.guestsAll"), nightsLabel: t("dashboard.nightsAll") },
    domestic: {
      code: "EE",
      guestsLabel: t("dashboard.guestsDomestic"),
      nightsLabel: t("dashboard.nightsDomestic"),
    },
    foreign: {
      code: "FOR",
      guestsLabel: t("dashboard.guestsForeign"),
      nightsLabel: t("dashboard.nightsForeign"),
    },
  };
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [residency, setResidency] = useState("all");
  const [deltaMode, setDeltaMode] = useState("yoy");

  useAbortableEffect(
    async (signal, isActive) => {
      // Fixed window: covers the 12-month nights sparkline plus enough
      // headroom for the YoY delta (looks back 12 months from the latest).
      const fetchCount = 25;
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
            { signal, locale }
          ),
          fetchTableData(
            MAJUTUS_PATH,
            "TU131.PX",
            [
              { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
              { code: "Maakond", selection: { filter: "item", values: REAL_COUNTY_CODES } },
              { code: "Elukohariik", selection: { filter: "item", values: [residencyCode] } },
              { code: "Vaatlusperiood", selection: { filter: "top", values: [String(fetchCount)] } },
            ],
            { signal, locale }
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
        const avgNightsSeries = periods.map((p) => {
          const g = byPeriod.get(p)[`OCC_ARR_${residencyCode}`] ?? 0;
          const n = byPeriod.get(p)[`OCC_NI_${residencyCode}`] ?? 0;
          return g ? n / g : 0;
        });

        const months = periods.slice(-12).map((p) => ({
          label: byPeriod.get(p).label,
          value: byPeriod.get(p)[`OCC_ARR_${residencyCode}`] ?? 0,
        }));
        const sparkWindow = 12;
        const nightsSparkline = periods.slice(-sparkWindow).map((p) => ({
          value: byPeriod.get(p)[`OCC_NI_${residencyCode}`] ?? 0,
        }));

        const deltaOffset = deltaMode === "mom" ? 1 : 12;
        const deltaCompareLabel = deltaMode === "mom" ? t("common.vsLastMonth") : t("common.vsYearAgo");

        const countyRows = flattenToRows(county);
        const countyByPeriod = new Map();
        for (const row of countyRows) {
          if (!countyByPeriod.has(row.Vaatlusperiood)) countyByPeriod.set(row.Vaatlusperiood, new Map());
          countyByPeriod.get(row.Vaatlusperiood).set(row.Maakond, row.value);
        }
        let topCounty = null;
        for (const row of countyRows) {
          if (row.Vaatlusperiood !== periods[latestIdx] || row.value === null) continue;
          if (!topCounty || row.value > topCounty.value) {
            // Prefer the locally-maintained bilingual dictionary over the
            // API's own _label — we already fully control this table's
            // translation for both locales, so this sidesteps trusting
            // PxWeb's English coverage for a field we can guarantee.
            topCounty = { code: row.Maakond, label: countyLabelByCode(row.Maakond, locale), value: row.value };
          }
        }
        const topCountySeries = periods.map((p) => countyByPeriod.get(p)?.get(topCounty?.code) ?? 0);
        const topCountyDelta = topCounty
          ? periodDelta(topCountySeries, latestIdx, deltaOffset, deltaCompareLabel)
          : null;

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
              avgNightsDelta: periodDelta(avgNightsSeries, latestIdx, deltaOffset, deltaCompareLabel),
              months,
              nightsSparkline,
              sparkWindow,
              topCounty,
              topCountyDelta,
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
    [residency, deltaMode, locale]
  );

  if (!state.data && state.loading) {
    return <div className="panel-status">{t("dashboard.loading")}</div>;
  }
  if (!state.data && state.error) {
    return <div className="panel-error">{t("dashboard.loadError", state.error)}</div>;
  }

  const labels = RESIDENCY[residency] ?? RESIDENCY.all;
  const data = state.data;

  function deltaText(delta) {
    if (!delta) return null;
    return `${delta.pct >= 0 ? "▲" : "▼"} ${Math.abs(delta.pct).toFixed(1)}% vs ${delta.label}`;
  }

  return (
    <div className={"dashboard" + (state.loading ? " refetching" : "")}>
      <SectionFilters
        showResidency
        showDeltaMode
        residency={residency}
        onResidencyChange={setResidency}
        deltaMode={deltaMode}
        onDeltaModeChange={setDeltaMode}
      />

      <NarrativeBlock section="dashboard" />

      <div className="kpi-row">
        <div className="hero-card">
          <div className="hero-label">
            {labels.guestsLabel} · {data.latestLabel}
          </div>
          <div className="hero-number">{formatNumber(data.totalGuests, locale)}</div>
          {data.guestsDelta && (
            <div className={"hero-delta " + (data.guestsDelta.pct >= 0 ? "delta-up" : "delta-down")}>
              {deltaText(data.guestsDelta)}
            </div>
          )}
          <SeasonalityStrip months={data.months} locale={locale} />
          <div className="seasonality-legend">
            <span>{t("dashboard.quietSeason")}</span>
            <span className="seasonality-legend-gradient" />
            <span>{t("dashboard.peakSeason")}</span>
          </div>
          <TableSource path={MAJUTUS_PATH} ids={["TU131.PX"]} dark />
        </div>

        <div className="hero-card">
          <div className="hero-label">
            {labels.nightsLabel} · {data.latestLabel}
          </div>
          <div className="hero-number">{formatNumber(data.totalNights, locale)}</div>
          {data.nightsDelta && (
            <div className={"hero-delta " + (data.nightsDelta.pct >= 0 ? "delta-up" : "delta-down")}>
              {deltaText(data.nightsDelta)}
            </div>
          )}
          <Sparkline data={data.nightsSparkline} />
          <div className="hero-caption">{t("dashboard.lastMonths", data.sparkWindow)}</div>
          <TableSource path={MAJUTUS_PATH} ids={["TU131.PX"]} dark />
        </div>
      </div>

      {residency === "all" && (
        <div>
          <SplitBar
            segments={[
              { label: t("common.domestic"), value: data.domesticGuests, color: DOMESTIC_COLOR },
              { label: t("common.foreign"), value: data.foreignGuests, color: FOREIGN_COLOR },
            ]}
            locale={locale}
          />
          <TableSource path={MAJUTUS_PATH} ids={["TU131.PX"]} />
        </div>
      )}

      <div className="tile-row">
        <div className="stat-tile">
          <div className="tile-label">{t("dashboard.topCounty")}</div>
          <div className="tile-number tile-number-small">{data.topCounty?.label ?? "—"}</div>
          {data.topCountyDelta && (
            <div className={"tile-delta " + (data.topCountyDelta.pct >= 0 ? "delta-up-text" : "delta-down-text")}>
              {deltaText(data.topCountyDelta)}
            </div>
          )}
        </div>
        <div className="stat-tile">
          <div className="tile-label">{t("dashboard.avgNights")}</div>
          <div className="tile-number">{data.avgNightsPerGuest.toFixed(2)}</div>
          {data.avgNightsDelta && (
            <div className={"tile-delta " + (data.avgNightsDelta.pct >= 0 ? "delta-up-text" : "delta-down-text")}>
              {deltaText(data.avgNightsDelta)}
            </div>
          )}
        </div>
      </div>
      <TableSource path={MAJUTUS_PATH} ids={["TU131.PX"]} />

      <OperatorInsights />
    </div>
  );
}

export default memo(Dashboard);
