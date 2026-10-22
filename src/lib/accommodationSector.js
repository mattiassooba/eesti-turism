// Pure computations over flattened Statistikaamet PxWeb EM001 rows.
// Each row: { Näitaja, Tegevusala, Vaatlusperiood, value, ... }.
// No React or DOM dependencies.

const REVENUE = "V12110";
const ENTERPRISES = "V11110";
const PERSONNEL = "V13310";
const RESALE = "CUB_C_100_110_120";
const MATERIALS = "CUB_C_210";
const ENERGY = "CUB_C_400_410_420";
const RENT = "V13411";
const COST_TOTAL = "CUB_C_705";

const ACCOMMODATION = "I55";
const HOTELS = "I551";
const OTHER_ACCOMMODATION = ["I552", "I553", "I559"];

function byYearAscending(a, b) {
  return a.year.localeCompare(b.year, undefined, { numeric: true });
}

function rowsFor(rows, naitaja, tegevusala) {
  return rows.filter((r) => r.Näitaja === naitaja && r.Tegevusala === tegevusala);
}

function valueOf(rows, naitaja) {
  const match = rows.find((r) => r.Näitaja === naitaja);
  return match ? match.value : 0;
}

export function computeRevenueSeries(em001Rows) {
  return rowsFor(em001Rows, REVENUE, ACCOMMODATION)
    .map((r) => ({ year: r.Vaatlusperiood, value: r.value }))
    .sort(byYearAscending);
}

export function computeIndexedSeries(series, baseYear) {
  const base = series.find((p) => p.year === baseYear);
  const hasBase = base !== undefined && base.value !== 0;
  return series.map((p) => ({
    year: p.year,
    value: p.value,
    index: hasBase ? (p.value * 100) / base.value : null,
  }));
}

export function computeEnterpriseCounts(em001Rows) {
  return rowsFor(em001Rows, ENTERPRISES, ACCOMMODATION)
    .map((r) => ({ year: r.Vaatlusperiood, count: r.value }))
    .sort(byYearAscending);
}

export function computeHotelsVsOther(em001Rows) {
  const byYear = new Map();
  for (const r of em001Rows) {
    if (r.Näitaja !== ENTERPRISES) continue;
    const isHotel = r.Tegevusala === HOTELS;
    const isOther = OTHER_ACCOMMODATION.includes(r.Tegevusala);
    if (!isHotel && !isOther) continue;
    const entry = byYear.get(r.Vaatlusperiood) ?? { hotels: 0, other: 0 };
    if (isHotel) entry.hotels += r.value;
    else entry.other += r.value;
    byYear.set(r.Vaatlusperiood, entry);
  }
  return [...byYear.entries()]
    .map(([year, { hotels, other }]) => ({ year, hotels, other }))
    .sort(byYearAscending);
}

export function computeCostStructure(em001Rows, year) {
  const yearRows = em001Rows.filter(
    (r) => r.Tegevusala === ACCOMMODATION && r.Vaatlusperiood === year,
  );
  const totalRow = yearRows.find((r) => r.Näitaja === COST_TOTAL);
  if (!totalRow) return null;

  const total = totalRow.value;
  const personnel = valueOf(yearRows, PERSONNEL);
  const resale = valueOf(yearRows, RESALE);
  const materials = valueOf(yearRows, MATERIALS);
  const energy = valueOf(yearRows, ENERGY);
  const rent = valueOf(yearRows, RENT);
  const other = total - (personnel + resale + materials + energy + rent);

  return { personnel, resale, materials, energy, rent, other, total };
}

// TU410 (quarterly services turnover and growth) and PA113 (quarterly wages).
const SERVICES_REVENUE = "CUB_SERV";
const SERVICES_GROWTH = "CUB_SM";
const WAGE_AVG = "GR_W_AVG";
const ALL_ACTIVITIES = "TOTAL";

function byPeriodAscending(a, b) {
  return a.period.localeCompare(b.period, undefined, { numeric: true });
}

function extremeBy(entries, pick) {
  return entries.reduce((best, p) => (best === null || pick(p, best) ? p : best), null);
}

export function computeLatestRevenue(tu410Rows) {
  const points = tu410Rows
    .filter((r) => r.Näitaja === SERVICES_REVENUE)
    .map((r) => ({ period: r.Vaatlusperiood, label: r.Vaatlusperiood_label, valueMillionEur: r.value }))
    .sort(byPeriodAscending);
  return points.length ? points[points.length - 1] : null;
}

export function computeRevenueGrowth(tu410Rows) {
  return tu410Rows
    .filter((r) => r.Näitaja === SERVICES_GROWTH)
    .map((r) => ({ period: r.Vaatlusperiood, label: r.Vaatlusperiood_label, pct: r.value }))
    .sort(byPeriodAscending);
}

export function computeGrowthHighlights(growthSeries, { windowSize = 16, minSignificantPct = 2 } = {}) {
  const window = growthSeries.slice(Math.max(0, growthSeries.length - windowSize));
  const latest = window.length ? window[window.length - 1] : null;
  const increases = window.filter((p) => p.pct >= minSignificantPct);
  const declines = window.filter((p) => p.pct <= -minSignificantPct);
  return {
    latest,
    strongestIncrease: extremeBy(increases, (p, best) => p.pct > best.pct),
    strongestDecline: extremeBy(declines, (p, best) => p.pct < best.pct),
  };
}

export function computeWageComparison(pa113Rows) {
  const allByPeriod = new Map();
  for (const r of pa113Rows) {
    if (r.Näitaja === WAGE_AVG && r.Tegevusala === ALL_ACTIVITIES) {
      allByPeriod.set(r.Vaatlusperiood, r.value);
    }
  }
  return pa113Rows
    .filter((r) => r.Näitaja === WAGE_AVG && r.Tegevusala === ACCOMMODATION && allByPeriod.has(r.Vaatlusperiood))
    .map((r) => ({
      period: r.Vaatlusperiood,
      label: r.Vaatlusperiood_label,
      accommodation: r.value,
      allActivities: allByPeriod.get(r.Vaatlusperiood),
    }))
    .sort(byPeriodAscending);
}
