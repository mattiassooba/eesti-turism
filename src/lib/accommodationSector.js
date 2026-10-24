// Pure computations over flattened Statistikaamet PxWeb EM001 rows.
// Each row: { Näitaja, Tegevusala, Vaatlusperiood, value, ... }.
// No React or DOM dependencies.

import { formatNumber } from "../i18n/format.js";

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

// Computed directly from CUB_SERV (actual nominal revenue, million €) rather
// than read from TU410's own CUB_SM indicator — CUB_SM is a volume-index
// change at constant prices (deflated), not nominal YoY revenue growth, and
// the two numbers materially diverge (e.g. 2026Q2 was ~22% by CUB_SM vs.
// ~12% actual nominal YoY growth). Each period is compared against the
// point 4 quarters earlier (t-4), so the first 4 periods of the sorted
// series have no comparison and are dropped.
export function computeRevenueGrowth(tu410Rows) {
  const points = tu410Rows
    .filter((r) => r.Näitaja === SERVICES_REVENUE)
    .map((r) => ({ period: r.Vaatlusperiood, label: r.Vaatlusperiood_label, value: r.value }))
    .sort(byPeriodAscending);

  const growth = [];
  for (let i = 4; i < points.length; i++) {
    const current = points[i];
    const prior = points[i - 4];
    if (!prior.value) continue; // avoid divide-by-zero on a missing/zero t-4 value
    const pct = ((current.value - prior.value) / prior.value) * 100;
    growth.push({ period: current.period, label: current.label, pct });
  }
  return growth;
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
    .map((r) => {
      const allActivities = allByPeriod.get(r.Vaatlusperiood);
      return {
        period: r.Vaatlusperiood,
        label: r.Vaatlusperiood_label,
        accommodation: r.value,
        allActivities,
        share: allActivities > 0 ? (r.value / allActivities) * 100 : null,
      };
    })
    .sort(byPeriodAscending);
}

// Shared by the cost-structure chart legend and the cost insight sentence.
export const COST_CATEGORY_LABELS = {
  personnel: { et: "personalikulud", en: "personnel costs" },
  resale: { et: "edasimüügiks ostetud kaubad", en: "goods purchased for resale" },
  materials: { et: "materjalid", en: "materials" },
  energy: { et: "energia", en: "energy" },
  rent: { et: "rent ja liisingud", en: "rent and leasing" },
  other: { et: "muud tegevuskulud", en: "other operating costs" },
};

const COST_CATEGORY_KEYS = Object.keys(COST_CATEGORY_LABELS);
// "other" is a computed remainder (total minus the 5 named categories —
// covers depreciation, taxes, travel costs, and other unrelated line
// items), not a real spending category, so it's never named as "the
// largest category" in the insight sentence even when it's numerically
// the biggest of the 6 values. It can still appear as a chart/table slice.
const NAMEABLE_COST_CATEGORY_KEYS = COST_CATEGORY_KEYS.filter((key) => key !== "other");

function lastOf(entries) {
  return entries?.length ? entries[entries.length - 1] : null;
}

function formatPct1(n, locale) {
  return formatNumber(n, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function computeLatestKpis({ latestRevenue, growthHighlights, enterpriseCounts, wageComparison }) {
  const latestGrowth = growthHighlights?.latest ?? null;
  const latestCount = lastOf(enterpriseCounts);
  const latestWage = lastOf(wageComparison);
  return {
    revenue: latestRevenue ? { value: latestRevenue.valueMillionEur, period: latestRevenue.period } : null,
    revenueYoy: latestGrowth ? { value: latestGrowth.pct, period: latestGrowth.period } : null,
    businessCount: latestCount ? { value: latestCount.count, period: latestCount.year } : null,
    avgWage: latestWage ? { value: latestWage.accommodation, period: latestWage.period } : null,
  };
}

export function buildRevenueInsight(latestRevenue, growthHighlights, locale) {
  const latestGrowth = growthHighlights?.latest ?? null;
  if (!latestRevenue || !latestGrowth) return null;
  const value = formatPct1(latestRevenue.valueMillionEur, locale);
  const yoy = formatPct1(Math.abs(latestGrowth.pct), locale);
  const label = latestRevenue.label;
  if (locale === "en") {
    return `Accommodation-sector revenue was €${value} million in ${label}, ${latestGrowth.pct >= 0 ? "up" : "down"} ${yoy}% year-over-year.`;
  }
  return `Majutussektori käive oli ${value} miljonit eurot (${label}), ${latestGrowth.pct >= 0 ? "kasvades" : "vähenedes"} aastaga ${yoy}%.`;
}

export function buildGrowthInsight(growthHighlights, locale) {
  const latest = growthHighlights?.latest ?? null;
  if (!latest) return null;
  const pct = formatPct1(Math.abs(latest.pct), locale);
  if (locale === "en") {
    return `Accommodation-sector revenue ${latest.pct >= 0 ? "grew" : "fell"} ${pct}% in ${latest.label}.`;
  }
  return `Majutussektori käive ${latest.pct >= 0 ? "kasvas" : "vähenes"} ${pct}% (${latest.label}).`;
}

export function buildBusinessInsight(enterpriseCounts, hotelsVsOther, locale) {
  const latest = lastOf(enterpriseCounts);
  if (!latest) return null;
  const split = hotelsVsOther?.find((p) => p.year === latest.year);
  const total = split ? split.hotels + split.other : 0;
  if (!split || total === 0) return null;
  const count = formatNumber(latest.count, locale);
  const hotelsPct = formatNumber(Math.round((split.hotels / total) * 100), locale);
  if (locale === "en") {
    return `Estonia had ${count} accommodation businesses in ${latest.year}, ${hotelsPct}% of them hotels.`;
  }
  return `Eestis tegutses ${latest.year}. aastal ${count} majutusettevõtet, neist ${hotelsPct}% hotellid.`;
}

export function buildWageInsight(wageComparison, locale) {
  const latest = lastOf(wageComparison);
  if (!latest) return null;
  const accommodation = formatNumber(latest.accommodation, locale, { maximumFractionDigits: 0 });
  const allActivities = formatNumber(latest.allActivities, locale, { maximumFractionDigits: 0 });
  if (locale === "en") {
    return `Accommodation-sector average gross wage was €${accommodation} in ${latest.label}, versus Estonia's €${allActivities} average.`;
  }
  return `Majutussektori keskmine brutopalk oli ${accommodation} eurot (${latest.label}), Eesti keskmine oli ${allActivities} eurot.`;
}

export function buildCostInsight(costStructure, locale) {
  if (!costStructure || !costStructure.total) return null;
  const { total } = costStructure;
  const largestKey = NAMEABLE_COST_CATEGORY_KEYS.reduce((best, key) =>
    costStructure[key] > costStructure[best] ? key : best,
  );
  const label = COST_CATEGORY_LABELS[largestKey][locale === "en" ? "en" : "et"];
  const pct = formatNumber(Math.round((costStructure[largestKey] / total) * 100), locale);
  if (locale === "en") {
    return `The largest cost category was ${label} (${pct}% of total costs).`;
  }
  return `Suurim kulukategooria oli ${label} (${pct}% kogukuludest).`;
}

// A short section-level overview, written as continuous prose (not a join
// of the per-module insight sentences, which repeats itself when read back
// to back — e.g. the growth % would appear twice). Computed fresh from the
// same underlying data every module already uses, so it answers, in order:
// how revenue is developing, how many businesses operate, how fast the
// sector is growing (the same revenue-growth figure, stated once), how
// wages compare to the national average, and what the largest cost
// category is. Any clause whose own data isn't available is simply
// skipped, never leaving a gap or a placeholder.
export function buildSectionOverview(
  { latestRevenue, growthHighlights, enterpriseCounts, hotelsVsOther, wageComparison, costStructure },
  locale,
) {
  const latestGrowth = growthHighlights?.latest ?? null;
  const latestCount = lastOf(enterpriseCounts);
  const split = latestCount ? hotelsVsOther?.find((p) => p.year === latestCount.year) : null;
  const splitTotal = split ? split.hotels + split.other : 0;
  const latestWage = lastOf(wageComparison);

  const sentences = [];

  if (latestRevenue && latestGrowth) {
    const value = formatPct1(latestRevenue.valueMillionEur, locale);
    const yoy = formatPct1(Math.abs(latestGrowth.pct), locale);
    sentences.push(
      locale === "en"
        ? `Accommodation-sector revenue was €${value} million in ${latestRevenue.label}, ${latestGrowth.pct >= 0 ? "up" : "down"} ${yoy}% year-over-year.`
        : `Majutussektori käive oli ${value} miljonit eurot (${latestRevenue.label}), ${latestGrowth.pct >= 0 ? "kasvades" : "vähenedes"} aastaga ${yoy}%.`,
    );
  }

  if (latestCount && split && splitTotal > 0) {
    const count = formatNumber(latestCount.count, locale);
    const hotelsPct = formatNumber(Math.round((split.hotels / splitTotal) * 100), locale);
    sentences.push(
      locale === "en"
        ? `Estonia had ${count} accommodation businesses in ${latestCount.year}, ${hotelsPct}% of them hotels.`
        : `Eestis tegutses ${latestCount.year}. aastal ${count} majutusettevõtet, millest ${hotelsPct}% olid hotellid.`,
    );
  }

  if (latestWage) {
    const accommodation = formatNumber(latestWage.accommodation, locale, { maximumFractionDigits: 0 });
    const allActivities = formatNumber(latestWage.allActivities, locale, { maximumFractionDigits: 0 });
    sentences.push(
      locale === "en"
        ? `The sector's average gross wage was €${accommodation} in ${latestWage.label}, compared with Estonia's €${allActivities} average.`
        : `Keskmine brutopalk majutussektoris oli ${accommodation} eurot (${latestWage.label}), Eesti keskmine oli ${allActivities} eurot.`,
    );
  }

  if (costStructure && costStructure.total) {
    const largestKey = NAMEABLE_COST_CATEGORY_KEYS.reduce((best, key) =>
      costStructure[key] > costStructure[best] ? key : best,
    );
    const label = COST_CATEGORY_LABELS[largestKey][locale === "en" ? "en" : "et"];
    const pct = formatNumber(Math.round((costStructure[largestKey] / costStructure.total) * 100), locale);
    sentences.push(
      locale === "en"
        ? `The largest cost category was ${label}, accounting for ${pct}% of total costs.`
        : `Suurim kulukategooria oli ${label}, mis moodustas ${pct}% kogukuludest.`,
    );
  }

  if (!sentences.length) return null;
  return sentences.join(" ");
}
