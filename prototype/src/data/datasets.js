// Dataset loaders. Each returns period-aligned arrays keyed by indicator and
// region, plus the table ids it came from (for source attribution). The
// "latest" period is always read from the data itself — never hardcoded.
import { query, useData, PATHS } from "./client.js";
import { ALL_CODES } from "../lib/regions.js";
import { lastIndex } from "./derive.js";
import {
  computeRevenueSeries,
  computeEnterpriseCounts,
  computeHotelsVsOther,
  computeCostStructure,
  computeLatestRevenue,
  computeRevenueGrowth,
  computeGrowthHighlights,
  computeWageComparison,
} from "@prod/lib/accommodationSector.js";
import { loadNarrative } from "@prod/data/narrative.js";

function index(rows, keyFn) {
  const periods = [...new Set(rows.map((r) => r.Vaatlusperiood))].sort();
  const pos = new Map(periods.map((p, i) => [p, i]));
  const series = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!series.has(k)) series.set(k, new Array(periods.length).fill(null));
    series.get(k)[pos.get(r.Vaatlusperiood)] = r.value;
  }
  return { periods, series };
}

const empty = (n) => new Array(n).fill(null);

// ── TU131: accommodated guests & nights, by region and residence ───────
async function loadTourism() {
  const { rows } = await query(PATHS.majutus, "TU131.PX", {
    Näitaja: ["OCC_ARR", "OCC_NI"],
    Maakond: ALL_CODES,
    Elukohariik: ["WORLD", "EE", "FOR"],
    Vaatlusperiood: { top: 260 },
  });
  const { periods, series } = index(rows, (r) => `${r.Näitaja}|${r.Maakond}|${r.Elukohariik}`);
  const get = (ind, region, res = "WORLD") => series.get(`${ind}|${region}|${res}`) ?? empty(periods.length);
  const latestIdx = lastIndex(get("OCC_ARR", "EE"));
  return { periods, get, latestIdx, latest: periods[latestIdx], tables: ["TU131"] };
}
export const useTourism = () => useData("tourism", loadTourism);

// ── TU122: establishments, rooms, beds, occupancy, cost per guest night ─
async function loadCapacity() {
  const { rows } = await query(PATHS.majutus, "TU122.PX", {
    Näitaja: ["CAP_ESTA", "CAP_BEDR", "CAP_BEDP", "OCC_OR_BEDR", "OCC_OR_BEDP", "OCC_NI_COST"],
    Maakond: ALL_CODES,
    Vaatlusperiood: { top: 296 },
  });
  const { periods, series } = index(rows, (r) => `${r.Näitaja}|${r.Maakond}`);
  const get = (ind, region) => series.get(`${ind}|${region}`) ?? empty(periods.length);
  const latestIdx = lastIndex(get("OCC_OR_BEDR", "EE"));
  return { periods, get, latestIdx, latest: periods[latestIdx], tables: ["TU122"] };
}
export const useCapacity = () => useData("capacity", loadCapacity);

// ── TU131 by country of residence, for one region ──────────────────────
export const AGGREGATE_ORIGINS = new Set([
  "WORLD", "EE", "FOR", "EUR_OTH", "AFR", "AFR_OTH", "ASI", "ASI_OTH", "AME_C_S", "AME_C_S_OTH", "OCE", "OCE_OTH", "OTH57E",
]);
export const ORIGIN_CODES = [
  "FI", "LV", "DE", "SE", "LT", "NO", "PL", "UK", "US", "FR", "IT", "ES", "NL", "DK", "UA", "CH", "AT", "BE", "CZ",
  "JP", "CN", "KR", "RU", "HU", "IE", "PT", "RO", "SK", "SI", "HR", "BG", "EL", "IS", "LU", "MT", "CY", "AL", "TR",
  "CA", "AU", "BR", "ZA",
];

async function loadOrigins(region) {
  const { rows } = await query(PATHS.majutus, "TU131.PX", {
    Näitaja: ["OCC_ARR", "OCC_NI"],
    Maakond: [region],
    Elukohariik: ["FOR", ...ORIGIN_CODES],
    Vaatlusperiood: { top: 36 },
  });
  const { periods, series } = index(rows, (r) => `${r.Näitaja}|${r.Elukohariik}`);
  const get = (ind, country) => series.get(`${ind}|${country}`) ?? empty(periods.length);
  return { periods, get, latestIdx: lastIndex(get("OCC_ARR", "FOR")), labels: Object.fromEntries(rows.map((r) => [r.Elukohariik, r.Elukohariik_label])), tables: ["TU131"] };
}
export const useOrigins = (region) => useData(`origins:${region}`, () => loadOrigins(region));

// Full history of nights by origin country, for yearly top-5 rankings.
async function loadOriginHistory(region) {
  const { rows } = await query(PATHS.majutus, "TU131.PX", {
    Näitaja: ["OCC_NI"],
    Maakond: [region],
    Elukohariik: ORIGIN_CODES,
    Vaatlusperiood: { top: 256 },
  });
  const { periods, series } = index(rows, (r) => r.Elukohariik);
  const get = (country) => series.get(country) ?? empty(periods.length);
  return { periods, get, tables: ["TU131"] };
}
export const useOriginHistory = (region) => useData(`originHistory:${region}`, () => loadOriginHistory(region));

// ── TU133: nights by purpose of trip, for one region (2019→) ───────────
export const PURPOSES = ["HOL", "BSNS_CONF", "BSNS_O", "_O"];
async function loadPurpose(region) {
  const { rows } = await query(PATHS.majutus, "TU133.PX", {
    Näitaja: ["OCC_NI", "OCC_ARR"],
    Maakond: [region],
    "Reisi eesmärk": ["_T", ...PURPOSES],
    Vaatlusperiood: { top: 120 },
  });
  const { periods, series } = index(rows, (r) => `${r.Näitaja}|${r["Reisi eesmärk"]}`);
  const get = (ind, purpose) => series.get(`${ind}|${purpose}`) ?? empty(periods.length);
  return { periods, get, latestIdx: lastIndex(get("OCC_NI", "_T")), tables: ["TU133"] };
}
export const usePurpose = (region) => useData(`purpose:${region}`, () => loadPurpose(region));

// ── TU11: national capacity since 1992 (macro-regions only, no counties) ─
async function loadLongRun() {
  const { rows } = await query(PATHS.majutus, "TU11.PX", {
    Näitaja: ["CAP_ESTA", "CAP_BEDR", "CAP_BEDP"],
    Piirkond: ["EE"],
    Vaatlusperiood: { top: 40 },
  });
  const { periods, series } = index(rows, (r) => r.Näitaja);
  return { periods, get: (ind) => series.get(ind) ?? empty(periods.length), tables: ["TU11"] };
}
export const useLongRun = () => useData("longrun", loadLongRun);

// ── Residents' travel (national only, quarterly / annual) ──────────────
export const RES_PURPOSES = ["PERS_HOL", "PERS_VFR", "PROF", "PERS_OTH"];
export const DESTINATIONS = ["FI", "LV", "LT", "SE", "DE", "IT", "ES", "TR", "RU"];
export const ACCOM_TYPES = ["R_HOT", "R_CAMP", "R_OTH", "NR_OWN", "NR_RF", "NR_OTH"];
export const DURATIONS = ["N1-3", "N4-7", "N_GT7"];
export const EXP_CATEGORIES = ["EXP_TRA", "EXP_ACC", "EXP_REST", "EXP_OTH"];

async function loadResidents() {
  const R = PATHS.reisimine;
  const [trips, dest, duration, domSpend, outSpend, accom, expType] = await Promise.all([
    query(R, "TU51.PX", { Näitaja: ["TR_DOM", "TR_OUT"], "Reisi eesmärk": ["TOTAL", ...RES_PURPOSES], Vaatlusperiood: { top: 90 } }),
    query(R, "TU63.PX", { Näitaja: ["TR_OUT"], Sihtriik: ["TOTAL", ...DESTINATIONS], Vaatlusperiood: { top: 12 } }),
    query(R, "TU54.PX", { Näitaja: ["TR_DOM", "TR_OUT"], "Reisi kestus": DURATIONS, Vaatlusperiood: { top: 8 } }),
    query(R, "TU56.PX", { Näitaja: ["EXP_DOM"], "Reisi eesmärk": ["TOTAL", ...RES_PURPOSES], Vaatlusperiood: { top: 90 } }),
    query(R, "TU661.PX", { Näitaja: ["EXP_OUT", ...EXP_CATEGORIES], "Reisi eesmärk": ["TOTAL"], Vaatlusperiood: { top: 60 } }),
    query(R, "TU551.PX", { Näitaja: ["N_DOM", "N_OUT"], "Majutuse liik": ["TOTAL", ...ACCOM_TYPES], Vaatlusperiood: { top: 4 } }),
    query(R, "TU552.px", {
      Näitaja: ["EXP", ...EXP_CATEGORIES],
      "Kulu tüüp": ["SUM_EXP", "AVG_EXP_TRP", "AVG_EXP_NGT"],
      "Reisi tüüp": ["DOM", "OUT"],
      Vaatlusperiood: { top: 10 },
    }),
  ]);
  const t = index(trips.rows, (r) => `${r.Näitaja}|${r["Reisi eesmärk"]}`);
  const d = index(dest.rows, (r) => r.Sihtriik);
  const du = index(duration.rows, (r) => `${r.Näitaja}|${r["Reisi kestus"]}`);
  const ds = index(domSpend.rows, (r) => r["Reisi eesmärk"]);
  const os = index(outSpend.rows, (r) => r.Näitaja);
  const ac = index(accom.rows, (r) => `${r.Näitaja}|${r["Majutuse liik"]}`);
  const et = index(expType.rows, (r) => `${r.Näitaja}|${r["Kulu tüüp"]}|${r["Reisi tüüp"]}`);
  const g = (ix) => (k) => ix.series.get(k) ?? empty(ix.periods.length);
  return {
    trips: { periods: t.periods, get: g(t) },
    destinations: { periods: d.periods, get: g(d) },
    duration: { periods: du.periods, get: g(du) },
    domSpend: { periods: ds.periods, get: g(ds) },
    outSpend: { periods: os.periods, get: g(os) },
    accommodation: { periods: ac.periods, get: g(ac) },
    expType: { periods: et.periods, get: g(et) },
    tables: ["TU51", "TU63", "TU54", "TU56", "TU661", "TU551", "TU552"],
  };
}
export const useResidents = () => useData("residents", loadResidents);

// ── Accommodation-sector economics (national only), via production lib ─
async function loadSector() {
  const [em, tu, pa] = await Promise.all([
    query(PATHS.em001, "EM001.PX", {
      Näitaja: ["V12110", "V11110", "CUB_C_705", "V13310", "CUB_C_100_110_120", "CUB_C_210", "CUB_C_400_410_420", "V13411"],
      Tegevusala: ["I55", "I551", "I552", "I553", "I559"],
      "Tööga hõivatud isikute arv": ["TOTAL"],
      Vaatlusperiood: { top: 24 },
    }),
    query(PATHS.turismMajandus, "TU410.PX", { Näitaja: ["CUB_SERV"], "Teenuse liik": ["I55"], Vaatlusperiood: { top: 40 } }),
    query(PATHS.pa113, "PA113.px", { Näitaja: ["GR_W_AVG"], Tegevusala: ["I55", "TOTAL"], Vaatlusperiood: { top: 24 } }),
  ]);
  const revenueSeries = computeRevenueSeries(em.rows);
  const growthSeries = computeRevenueGrowth(tu.rows);
  const latestYear = revenueSeries.at(-1)?.year ?? null;
  const quarterly = tu.rows
    .filter((r) => r.value != null)
    .map((r) => ({ period: r.Vaatlusperiood, value: r.value }))
    .sort((a, b) => a.period.localeCompare(b.period));
  return {
    revenueSeries,
    enterpriseCounts: computeEnterpriseCounts(em.rows),
    hotelsVsOther: computeHotelsVsOther(em.rows),
    latestRevenue: computeLatestRevenue(tu.rows),
    growthSeries,
    growthHighlights: computeGrowthHighlights(growthSeries),
    wageComparison: computeWageComparison(pa.rows),
    costLatest: latestYear ? computeCostStructure(em.rows, latestYear) : null,
    costByYear: revenueSeries.map((p) => ({ year: p.year, cost: computeCostStructure(em.rows, p.year) })).filter((x) => x.cost),
    latestYear,
    quarterly,
    tables: ["EM001", "TU410", "PA113"],
  };
}
export const useSector = () => useData("sector", loadSector);

// ── AI narrative written by the scheduled pipeline (read-only) ─────────
export const useNarrative = () => useData("narrative", () => loadNarrative());
