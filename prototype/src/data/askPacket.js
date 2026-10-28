// Data packet for the AI data explorer. Everything the model may quote is
// computed here from data the page already loaded (TU131 via useTourism,
// TU122 via useCapacity); the model only words it. Shape and column order
// are the shared contract in @prod/lib/askShape.js, which the Worker
// validates. Average cost per night (OCC_NI_COST) is deliberately left out:
// its per-room vs per-person basis is unconfirmed.
import { annualTotals, annualMeans, summerShare, pctChange, monthYoy, ytd, at } from "./derive.js";
import { REGIONS } from "../lib/regions.js";
import { REGION_NAMES } from "@prod/lib/askShape.js";

const round1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const roundInt = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v));

// Two or more distinct four-digit years → their span; otherwise null.
export function detectYears(question) {
  const years = [...new Set([...String(question).matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => +m[0]))];
  if (years.length < 2) return null;
  return { from: Math.min(...years), to: Math.max(...years) };
}

// Every name a visitor might use, the visitor's language first. Taken from
// the shared allowlist, which the Worker enforces.
function namesFor(region, locale) {
  const { et, en } = REGION_NAMES[region.id];
  return [...new Set(locale === "en" ? [...en, ...et] : [...et, ...en])];
}

function byYear(entries) {
  return new Map(entries.map((e) => [e.year, e]));
}

function monthIndexes(periods, year) {
  return Array.from({ length: 12 }, (_, m) => periods.indexOf(`${year}M${String(m + 1).padStart(2, "0")}`));
}

// Month number (1–12) of the extreme value, or null if any month is
// unpublished: the missing one could be the true extreme.
function argExtreme(values, better) {
  if (values.some((v) => v == null)) return null;
  let best = null;
  values.forEach((v, i) => {
    if (v != null && (best == null || better(v, values[best]))) best = i;
  });
  return best == null ? null : best + 1;
}

function regionSeries(tourism, capacity, code) {
  const { periods } = tourism;
  const g = tourism.get("OCC_ARR", code);
  const n = tourism.get("OCC_NI", code);
  const gEE = tourism.get("OCC_ARR", code, "EE");
  const gFOR = tourism.get("OCC_ARR", code, "FOR");
  return {
    g,
    n,
    gEE,
    gFOR,
    G: byYear(annualTotals(g, periods)),
    N: byYear(annualTotals(n, periods)),
    D: byYear(annualTotals(gEE, periods)),
    F: byYear(annualTotals(gFOR, periods)),
    room: byYear(annualMeans(capacity.get("OCC_OR_BEDR", code), capacity.periods)),
    bed: byYear(annualMeans(capacity.get("OCC_OR_BEDP", code), capacity.periods)),
  };
}

// Only complete years plus the flagged current year: the data window
// usually starts mid-year, and that first stub must not pass as a full year.
function yearRows(s, tourism, partialYear, keep) {
  const val = (map, y) => map.get(y)?.value ?? null;
  // A partial year's change is year-to-date vs the same months a year earlier.
  const yoy = (map, arr, y) =>
    partialYear && y === partialYear.year ? ytd(arr, tourism.periods, tourism.latestIdx).change : pctChange(val(map, y), val(map, y - 1));
  return [...s.G.keys()]
    .filter((y) => keep.has(y))
    .sort((a, b) => a - b)
    .map((y) => [
      y,
      roundInt(val(s.G, y)),
      roundInt(val(s.N, y)),
      roundInt(val(s.D, y)),
      roundInt(val(s.F, y)),
      round1(val(s.F, y) != null && val(s.G, y) ? (val(s.F, y) / val(s.G, y)) * 100 : null),
      round1(yoy(s.G, s.g, y)),
      round1(yoy(s.N, s.n, y)),
      round1(yoy(s.F, s.gFOR, y)),
      round1(s.room.get(y)?.value),
      round1(s.bed.get(y)?.value),
    ]);
}

function rangeRow(s, from, to) {
  const val = (map, y) => map.get(y)?.value ?? null;
  const pair = (map) => [roundInt(val(map, from)), roundInt(val(map, to)), round1(pctChange(val(map, to), val(map, from)))];
  let peak = null;
  let low = null;
  for (let y = from; y <= to; y++) {
    const v = val(s.G, y);
    if (v == null) continue;
    if (!peak || v > peak[1]) peak = [y, v];
    if (!low || v < low[1]) low = [y, v];
  }
  return [...pair(s.G), ...pair(s.N), ...pair(s.F), peak?.[0] ?? null, roundInt(peak?.[1]), low?.[0] ?? null, roundInt(low?.[1])];
}

export function buildPacket({ tourism, capacity, locale, question }) {
  const { periods, latestIdx } = tourism;
  const national = annualTotals(tourism.get("OCC_ARR", "EE"), periods);
  const fullYears = national.filter((e) => !e.partial).map((e) => e.year);
  const lastFullYear = fullYears.length ? fullYears[fullYears.length - 1] : null;
  const last = national[national.length - 1];
  const partialYear = last?.partial ? { year: last.year, months: last.months } : null;
  const keepYears = new Set(partialYear ? [...fullYears, partialYear.year] : fullYears);

  const series = new Map(REGIONS.map((r) => [r.id, regionSeries(tourism, capacity, r.code)]));
  const regions = {};
  for (const r of REGIONS) {
    const s = series.get(r.id);
    const months = lastFullYear ? monthIndexes(periods, lastFullYear).map((i) => roundInt(at(s.g, i))) : new Array(12).fill(null);
    const cap = (ind) => roundInt(at(capacity.get(ind, r.code), capacity.latestIdx));
    regions[r.id] = {
      names: namesFor(r, locale),
      years: yearRows(s, tourism, partialYear, keepYears),
      latest: [
        roundInt(at(s.g, latestIdx)),
        round1(monthYoy(s.g, latestIdx)),
        roundInt(at(s.n, latestIdx)),
        round1(monthYoy(s.n, latestIdx)),
        roundInt(at(s.gEE, latestIdx)),
        roundInt(at(s.gFOR, latestIdx)),
        round1(monthYoy(s.gFOR, latestIdx)),
      ],
      months,
      busiestMonth: argExtreme(months, (a, b) => a > b),
      quietestMonth: argExtreme(months, (a, b) => a < b),
      summerSharePct: lastFullYear ? round1(summerShare(s.g, periods, lastFullYear)) : null,
      capacity: [cap("CAP_ESTA"), cap("CAP_BEDR"), cap("CAP_BEDP")],
    };
  }

  const counties = REGIONS.filter((r) => r.kind === "county");
  const ranked = (fn) =>
    counties
      .map((r) => [r.id, fn(series.get(r.id))])
      .filter(([, v]) => v != null)
      .sort((a, b) => b[1] - a[1]);
  const valAt = (s, y) => s.G.get(y)?.value ?? null;
  const rankings = {
    year: lastFullYear,
    byGuests: ranked((s) => roundInt(valAt(s, lastFullYear))),
    byGrowthPct: ranked((s) => round1(pctChange(valAt(s, lastFullYear), valAt(s, lastFullYear - 1)))),
    bySummerSharePct: ranked((s) => round1(summerShare(s.g, periods, lastFullYear))),
  };

  let range = null;
  const asked = detectYears(question ?? "");
  if (asked) {
    const full = new Set(fullYears);
    const from = Math.max(asked.from, fullYears[0] ?? asked.from);
    const to = Math.min(asked.to, lastFullYear ?? asked.to);
    const usable = from <= to && full.has(from) && full.has(to);
    range = {
      from: usable ? from : null,
      to: usable ? to : null,
      requested: [asked.from, asked.to],
      missing: [asked.from, asked.to].filter((y) => !full.has(y)),
      rows: usable ? Object.fromEntries(REGIONS.map((r) => [r.id, rangeRow(series.get(r.id), from, to)])) : {},
    };
  }

  return { v: 1, latest: tourism.latest, lastFullYear, partialYear, regions, rankings, range };
}
