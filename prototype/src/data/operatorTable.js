// Yearly table and chart data for the Operator page ("Majutusettevõtja
// vaade"), shared with the newsletter PDF so both show identical numbers.
import { ORIGIN_CODES } from "./datasets.js";
import { pctChange, sumRange, at } from "./derive.js";
import { monthName, parsePeriod, countryName } from "../lib/format.js";

export const MIN_TABLE_YEAR = 2020;

export function monthColLabel(period, locale) {
  const p = parsePeriod(period);
  if (!p) return period;
  const name = monthName(p.month - 1, locale).toUpperCase();
  return locale === "et" ? `${p.year} ${name}` : `${name} ${p.year}`;
}

export function yearIndexes(periods, year) {
  const out = [];
  periods.forEach((code, i) => {
    if (parsePeriod(code)?.year === year) out.push(i);
  });
  return out;
}

export function yearsIn(periods) {
  return [...new Set(periods.map((c) => parsePeriod(c)?.year).filter(Boolean))].sort((a, b) => a - b);
}

export function sumYear(arr, periods, year) {
  const ix = yearIndexes(periods, year);
  if (!ix.length) return null;
  return sumRange(arr, ix[0], ix[ix.length - 1]);
}

export function likeForLike(arr, periods, year) {
  const ix = yearIndexes(periods, year);
  if (!ix.length) return { value: null, change: null, partial: false, months: 0 };
  const months = ix.length;
  const value = sumRange(arr, ix[0], ix[ix.length - 1]);
  const prevIx = yearIndexes(periods, year - 1);
  const prev = prevIx.length >= months ? sumRange(arr, prevIx[0], prevIx[0] + months - 1) : null;
  return { value, change: pctChange(value, prev), partial: months < 12, months };
}

export function lastInYear(arr, periods, year) {
  let last = null;
  periods.forEach((code, i) => {
    if (parsePeriod(code)?.year === year && arr[i] != null) last = arr[i];
  });
  return last;
}

export function meanInYear(arr, periods, year) {
  let s = 0;
  let n = 0;
  periods.forEach((code, i) => {
    if (parsePeriod(code)?.year === year && arr[i] != null) {
      s += arr[i];
      n += 1;
    }
  });
  return n ? s / n : null;
}

export function ytdThrough(arr, periods, year, month) {
  const start = periods.indexOf(`${year}M01`);
  if (start < 0) return null;
  const end = periods.indexOf(`${year}M${String(month).padStart(2, "0")}`);
  if (end < 0) return null;
  return sumRange(arr, start, end);
}

export function rankOrigins(origins, periodCodes, locale, limit = 5) {
  if (!origins) return [];
  const idx = new Map(origins.periods.map((p, i) => [p, i]));
  return ORIGIN_CODES.map((code) => {
    const arr = origins.get(code);
    let value = 0;
    let any = false;
    for (const p of periodCodes) {
      const i = idx.get(p);
      if (i == null || arr[i] == null) continue;
      value += arr[i];
      any = true;
    }
    return { code, label: countryName(code, locale), value: any ? value : null };
  })
    .filter((x) => x.value != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function buildColumns({ tourism, capacity, code, res, latest, locale }) {
  const guests = tourism.get("OCC_ARR", code, res);
  const domestic = tourism.get("OCC_ARR", code, "EE");
  const world = tourism.get("OCC_ARR", code, "WORLD");
  const national = tourism.get("OCC_ARR", "EE", res);
  const esta = capacity.get("CAP_ESTA", code);
  const rooms = capacity.get("CAP_BEDR", code);
  const occ = capacity.get("OCC_OR_BEDR", code);
  const cost = capacity.get("OCC_NI_COST", code);
  const latestP = parsePeriod(latest);
  const cutoff = latestP.year - 1;
  const annualYears = yearsIn(tourism.periods).filter((y) => y >= MIN_TABLE_YEAR && y <= cutoff);
  const monthCodes = [2, 1, 0].map((back) => `${latestP.year - back}M${String(latestP.month).padStart(2, "0")}`);

  function annualCol(year) {
    const acc = likeForLike(guests, tourism.periods, year);
    const nat = sumYear(national, tourism.periods, year);
    const dom = sumYear(domestic, tourism.periods, year);
    const tot = sumYear(world, tourism.periods, year);
    const arr = meanInYear(cost, capacity.periods, year);
    const prevArr = meanInYear(cost, capacity.periods, year - 1);
    const occVal = meanInYear(occ, capacity.periods, year);
    return {
      key: String(year),
      label: String(year),
      partial: false,
      kind: "year",
      year,
      accommodated: acc.value,
      accommodatedYoy: acc.change,
      cumulative: null,
      cumulativeYoy: null,
      share: acc.value != null && nat ? (acc.value / nat) * 100 : null,
      domesticShare: dom != null && tot ? (dom / tot) * 100 : null,
      esta: lastInYear(esta, capacity.periods, year),
      rooms: lastInYear(rooms, capacity.periods, year),
      occ: occVal,
      arr,
      arrYoy: pctChange(arr, prevArr),
      revpar: occVal != null && arr != null ? (occVal / 100) * arr : null,
    };
  }

  function monthCol(period) {
    const p = parsePeriod(period);
    const i = tourism.periods.indexOf(period);
    const ci = capacity.periods.indexOf(period);
    const prev = `${p.year - 1}M${String(p.month).padStart(2, "0")}`;
    const pi = tourism.periods.indexOf(prev);
    const cpi = capacity.periods.indexOf(prev);
    const cur = at(guests, i);
    const nat = at(national, i);
    const dom = at(domestic, i);
    const tot = at(world, i);
    const arr = at(cost, ci);
    const occVal = at(occ, ci);
    const ytdCur = ytdThrough(guests, tourism.periods, p.year, p.month);
    const ytdPrev = ytdThrough(guests, tourism.periods, p.year - 1, p.month);
    return {
      key: period,
      label: monthColLabel(period, locale),
      partial: false,
      kind: "month",
      year: p.year,
      accommodated: cur,
      accommodatedYoy: pctChange(cur, at(guests, pi)),
      cumulative: ytdCur,
      cumulativeYoy: pctChange(ytdCur, ytdPrev),
      share: cur != null && nat ? (cur / nat) * 100 : null,
      domesticShare: dom != null && tot ? (dom / tot) * 100 : null,
      esta: at(esta, ci),
      rooms: at(rooms, ci),
      occ: occVal,
      arr,
      arrYoy: pctChange(arr, at(cost, cpi)),
      revpar: occVal != null && arr != null ? (occVal / 100) * arr : null,
    };
  }

  return [...annualYears.map(annualCol), ...monthCodes.map(monthCol)];
}

export function chartYears(tourism, yearsToShow) {
  const years = yearsIn(tourism.periods);
  return years.slice(-Math.min(yearsToShow, years.length));
}

// Estonia's guests per year (bars) and the region's share of them (line),
// as on the page's first regional chart. Partial year = year-to-date.
export function shareChartSeries({ tourism, code, years, res = "WORLD" }) {
  const lfl = (c) => years.map((y) => likeForLike(tourism.get("OCC_ARR", c, res), tourism.periods, y));
  const ee = lfl("EE");
  const region = lfl(code);
  return {
    years,
    partial: ee.map((x) => x.partial),
    national: ee.map((x) => x.value),
    sharePct: years.map((_, i) => (region[i].value != null && ee[i].value ? (region[i].value / ee[i].value) * 100 : null)),
  };
}

// Room occupancy (bars), average price and RevPAR (lines) per year.
export function occupancyChartSeries({ capacity, code, years }) {
  const occ = years.map((y) => meanInYear(capacity.get("OCC_OR_BEDR", code), capacity.periods, y));
  const arr = years.map((y) => meanInYear(capacity.get("OCC_NI_COST", code), capacity.periods, y));
  return {
    years,
    partial: years.map((y) => yearIndexes(capacity.periods, y).length < 12),
    occ,
    arr,
    revpar: years.map((_, i) => (occ[i] != null && arr[i] != null ? (occ[i] / 100) * arr[i] : null)),
  };
}

// Top origin countries (by nights) for each table column.
export function originsByColumn(origins, columns, locale, limit = 5) {
  const map = new Map();
  if (!origins) return map;
  for (const c of columns) {
    const codes = c.kind === "year" ? origins.periods.filter((p) => p.startsWith(`${c.year}M`)) : [c.key];
    map.set(c.key, rankOrigins(origins, codes, locale, limit));
  }
  return map;
}
