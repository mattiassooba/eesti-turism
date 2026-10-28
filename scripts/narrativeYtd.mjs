// Pure helpers for generate-narrative.mjs (kept apart because that script
// runs as soon as it's imported): the year-to-date figures the texts lead
// with, and the accommodation sector's latest quarterly turnover.
import { computeRevenueGrowth } from "../src/lib/accommodationSector.js";

const FIELDS = {
  guests: "OCC_ARR_WORLD",
  nights: "OCC_NI_WORLD",
  domestic: "OCC_ARR_EE",
  foreign: "OCC_ARR_FOR",
};

const pct = (cur, prev) => (cur == null || prev == null || prev === 0 ? null : ((cur - prev) / prev) * 100);

// January through `latest` ("2026M08") vs the same months a year earlier.
// A figure is null when any month in either window is missing, rather than
// quietly summing a gap as zero.
export function ytdFigures(byPeriod, periods, latest) {
  const [year, month] = latest.split("M").map(Number);
  const window = (y) => Array.from({ length: month }, (_, i) => `${y}M${String(i + 1).padStart(2, "0")}`);
  const sum = (codes, field) => {
    let total = 0;
    for (const code of codes) {
      const v = periods.includes(code) ? byPeriod.get(code)?.[field] : null;
      if (v == null) return null;
      total += v;
    }
    return total;
  };
  const out = { months: month };
  for (const [name, field] of Object.entries(FIELDS)) {
    const cur = sum(window(year), field);
    const prev = sum(window(year - 1), field);
    out[name] = cur;
    out[`${name}YoyPct`] = pct(cur, prev);
  }
  return out;
}

// Latest quarter's accommodation services turnover (TU410 CUB_SERV, I55,
// million €) and its change from the same quarter a year earlier.
export function sectorFigures(tu410Rows) {
  const points = tu410Rows
    .filter((r) => r.Näitaja === "CUB_SERV" && r.value != null)
    .sort((a, b) => (a.Vaatlusperiood < b.Vaatlusperiood ? -1 : 1));
  const latest = points.at(-1);
  if (!latest) return null;
  const growth = computeRevenueGrowth(tu410Rows);
  const last = growth.at(-1);
  return {
    latestQuarter: latest.Vaatlusperiood,
    latestQuarterLabel: latest.Vaatlusperiood_label,
    turnoverMeur: latest.value,
    yoyPct: last?.period === latest.Vaatlusperiood ? last.pct : null,
    lastFour: growth.slice(-4).map(({ period, pct: p }) => ({ period, pct: p })),
  };
}
