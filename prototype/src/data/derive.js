// Pure statistical helpers over period-aligned arrays. Missing values are
// null — Statistikaamet suppresses small cells, and a suppressed cell must
// never be summed as a confirmed zero.
import { parsePeriod } from "../lib/format.js";

// A sum over a range with any suppressed month is unknown, not smaller.
export function sumRange(arr, from, to) {
  if (from < 0 || to >= arr.length || from > to) return null;
  let s = 0;
  for (let i = from; i <= to; i++) {
    if (arr[i] == null) return null;
    s += arr[i];
  }
  return s;
}

// Sum of the published months only, with the count of withheld ones, for
// display as a lower bound ("≥ x, n months withheld").
export function sumKnown(arr, from, to) {
  let s = 0;
  let n = 0;
  let missing = 0;
  for (let i = Math.max(0, from); i <= to && i < arr.length; i++) {
    if (arr[i] == null) missing += 1;
    else {
      s += arr[i];
      n += 1;
    }
  }
  return { value: n ? s : null, missing };
}

// Sums of several parallel series over the months where all of them are
// published, so shares between them stay like-for-like.
export function completeMonthSums(arrs, from, to) {
  const sums = arrs.map(() => 0);
  let months = 0;
  for (let i = Math.max(0, from); i <= to; i++) {
    if (arrs.some((a) => a[i] == null)) continue;
    arrs.forEach((a, k) => (sums[k] += a[i]));
    months += 1;
  }
  return { sums, months };
}

export function pctChange(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function at(arr, i) {
  return i >= 0 && i < arr.length ? arr[i] : null;
}

// Last index with a non-null value.
export function lastIndex(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i;
  return -1;
}

// Single month vs. same month a year earlier.
export function monthYoy(arr, i) {
  return pctChange(at(arr, i), at(arr, i - 12));
}

// Year-to-date through period index i, vs. the same months a year earlier.
export function ytd(arr, periods, i) {
  const p = parsePeriod(periods[i]);
  if (!p || p.kind !== "month") return { value: null, prev: null, change: null };
  const start = i - (p.month - 1);
  const value = sumRange(arr, start, i);
  const prev = sumRange(arr, start - 12, i - 12);
  return { value, prev, change: pctChange(value, prev) };
}

export function rolling12(arr, i) {
  const value = sumRange(arr, i - 11, i);
  const prev = sumRange(arr, i - 23, i - 12);
  return { value, prev, change: pctChange(value, prev) };
}

// Calendar-year totals; the last year is flagged partial if incomplete.
export function annualTotals(arr, periods) {
  const byYear = new Map();
  periods.forEach((code, i) => {
    const p = parsePeriod(code);
    if (!p) return;
    const e = byYear.get(p.year) ?? { year: p.year, value: 0, months: 0, any: false, gaps: 0 };
    if (arr[i] != null) {
      e.value += arr[i];
      e.any = true;
    } else {
      e.gaps += 1;
    }
    e.months += 1;
    byYear.set(p.year, e);
  });
  return [...byYear.values()]
    .filter((e) => e.any)
    .map((e) => ({ year: e.year, value: e.gaps ? null : e.value, suppressed: e.gaps > 0, partial: e.months < 12, months: e.months }));
}

// Calendar-year mean of a rate (occupancy, average cost).
export function annualMeans(arr, periods) {
  const byYear = new Map();
  periods.forEach((code, i) => {
    const p = parsePeriod(code);
    if (!p || arr[i] == null) return;
    const e = byYear.get(p.year) ?? { year: p.year, sum: 0, n: 0 };
    e.sum += arr[i];
    e.n += 1;
    byYear.set(p.year, e);
  });
  return [...byYear.values()].map((e) => ({ year: e.year, value: e.sum / e.n, partial: e.n < 12, months: e.n }));
}

// Year × month grid for the seasonality heatmap.
export function seasonGrid(arr, periods) {
  const rows = new Map();
  periods.forEach((code, i) => {
    const p = parsePeriod(code);
    if (!p || p.kind !== "month") return;
    if (!rows.has(p.year)) rows.set(p.year, new Array(12).fill(null));
    rows.get(p.year)[p.month - 1] = arr[i];
  });
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([year, values]) => ({ year, values }));
}

// Share of a complete year's total that falls in June–August.
export function summerShare(arr, periods, year) {
  let total = 0;
  let summer = 0;
  let months = 0;
  periods.forEach((code, i) => {
    const p = parsePeriod(code);
    if (!p || p.year !== year || arr[i] == null) return;
    total += arr[i];
    months += 1;
    if (p.month >= 6 && p.month <= 8) summer += arr[i];
  });
  return months === 12 && total ? (summer / total) * 100 : null;
}

export function niceTicks(min, max, count = 5) {
  if (min === max) {
    max = min + 1;
  }
  const span = max - min;
  const step0 = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}
