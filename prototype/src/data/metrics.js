// Region-level summaries shared by the homepage, the regional explorer and
// the analytical pages. Each figure carries its own period because TU131
// and TU122 are published separately and can differ.
import { at, monthYoy, pctChange, rolling12, ytd, lastIndex, sumRange, summerShare, annualTotals } from "./derive.js";
import { shiftPeriod } from "../lib/format.js";

export function tourismSummary(tourism, code, idx = tourism.latestIdx) {
  const g = tourism.get("OCC_ARR", code);
  const n = tourism.get("OCC_NI", code);
  const gEE = tourism.get("OCC_ARR", code, "EE");
  const gFOR = tourism.get("OCC_ARR", code, "FOR");
  const nEE = tourism.get("OCC_NI", code, "EE");
  const nFOR = tourism.get("OCC_NI", code, "FOR");
  const nat = tourism.get("OCC_ARR", "EE");
  const period = tourism.periods[idx];
  const guests = at(g, idx);
  const nights = at(n, idx);
  const r12 = rolling12(g, idx);
  const r12n = rolling12(n, idx);
  const r12dom = sumRange(gEE, idx - 11, idx);
  const r12for = sumRange(gFOR, idx - 11, idx);
  return {
    period,
    prevPeriod: shiftPeriod(period, -12),
    guests,
    guestsPrev: at(g, idx - 12),
    guestsYoy: monthYoy(g, idx),
    guestsMom: pctChange(guests, at(g, idx - 1)),
    nights,
    nightsYoy: monthYoy(n, idx),
    domestic: at(gEE, idx),
    foreign: at(gFOR, idx),
    domesticYoy: monthYoy(gEE, idx),
    foreignYoy: monthYoy(gFOR, idx),
    domesticNights: at(nEE, idx),
    foreignNights: at(nFOR, idx),
    foreignShare: guests ? (at(gFOR, idx) / guests) * 100 : null,
    foreignShareR12: r12dom != null && r12for != null ? (r12for / (r12dom + r12for)) * 100 : null,
    avgStay: guests ? nights / guests : null,
    avgStayPrev: at(g, idx - 12) ? at(n, idx - 12) / at(g, idx - 12) : null,
    ytd: ytd(g, tourism.periods, idx),
    ytdNights: ytd(n, tourism.periods, idx),
    r12,
    r12Nights: r12n,
    r12Domestic: r12dom,
    r12Foreign: r12for,
    shareOfNational: code !== "EE" && at(nat, idx) ? (guests / at(nat, idx)) * 100 : null,
    shareOfNationalR12: code !== "EE" ? (r12.value / rolling12(nat, idx).value) * 100 : null,
  };
}

export function capacitySummary(capacity, code, idx = capacity.latestIdx) {
  const get = (k) => capacity.get(k, code);
  const roomOcc = get("OCC_OR_BEDR");
  const bedOcc = get("OCC_OR_BEDP");
  const cost = get("OCC_NI_COST");
  const r12mean = (arr) => {
    let s = 0;
    let c = 0;
    for (let i = idx - 11; i <= idx; i++) {
      if (arr[i] != null) {
        s += arr[i];
        c++;
      }
    }
    return c ? s / c : null;
  };
  return {
    period: capacity.periods[idx],
    establishments: at(get("CAP_ESTA"), idx),
    establishmentsPrev: at(get("CAP_ESTA"), idx - 12),
    rooms: at(get("CAP_BEDR"), idx),
    roomsPrev: at(get("CAP_BEDR"), idx - 12),
    beds: at(get("CAP_BEDP"), idx),
    bedsPrev: at(get("CAP_BEDP"), idx - 12),
    roomOcc: at(roomOcc, idx),
    roomOccPrev: at(roomOcc, idx - 12),
    roomOccDiff: at(roomOcc, idx) != null && at(roomOcc, idx - 12) != null ? at(roomOcc, idx) - at(roomOcc, idx - 12) : null,
    bedOcc: at(bedOcc, idx),
    bedOccPrev: at(bedOcc, idx - 12),
    bedOccDiff: at(bedOcc, idx) != null && at(bedOcc, idx - 12) != null ? at(bedOcc, idx) - at(bedOcc, idx - 12) : null,
    cost: at(cost, idx),
    costPrev: at(cost, idx - 12),
    costYoy: monthYoy(cost, idx),
    roomOccR12: r12mean(roomOcc),
    bedOccR12: r12mean(bedOcc),
    costR12: r12mean(cost),
  };
}

// Latest complete calendar year for a monthly series.
export function lastCompleteYear(periods, arr) {
  const totals = annualTotals(arr, periods);
  const complete = totals.filter((t) => !t.partial);
  return complete.length ? complete[complete.length - 1].year : null;
}

export function seasonality(tourism, code) {
  const g = tourism.get("OCC_ARR", code);
  const year = lastCompleteYear(tourism.periods, g);
  return { year, summerShare: year ? summerShare(g, tourism.periods, year) : null };
}

export function latestIndexFor(arr) {
  return lastIndex(arr);
}
