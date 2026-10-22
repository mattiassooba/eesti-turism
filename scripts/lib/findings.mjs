// Stage 1 of the two-stage reporting pipeline (Task 2.4): pure deterministic
// analysis over already-computed metrics, with no AI involved. Every number
// Claude sees in a "finding" below was calculated here, from real fetched
// data — Claude's job (stage 2, in generate-narrative.mjs) is to turn a
// short list of these into fluent prose, not to compute or invent anything.
//
// A "finding" is one verified, self-contained fact, already phrased in
// plain English (Claude translates/rewrites from here, the same way it
// already does for every other prompt block in this script):
//   { id, category, importance, magnitude, text }
// `magnitude` and `importance` only drive ranking (see rankFindings) — they
// are never shown to Claude.

const MIN_BASE_GUESTS = 5000; // ignore a region/market too small for a % swing to mean anything
const MIN_NOTABLE_PCT = 3; // below this, a YoY change isn't worth a dedicated finding
const MIN_NOTABLE_POINTS = 1.5; // same, for percentage-point metrics (occupancy)

function fmtPct(n) {
  if (n == null) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
function fmtPoints(n) {
  if (n == null) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)} points`;
}
function abbrev(n) {
  if (n == null) return "n/a";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)} thousand`;
  return String(Math.round(n));
}

// ---- Individual detectors ------------------------------------------------
// Each returns a finding or null (null when the data is missing, or the
// change is too small/the base too thin to be worth surfacing — the exact
// "safeguards so small denominators ... don't generate sensational
// headlines" Task 5.2 asks for).

function detectVisitorGrowth(dashboard) {
  const pct = dashboard.totalGuestsYoyPct;
  if (pct == null || Math.abs(pct) < MIN_NOTABLE_PCT) return null;
  return {
    id: "national_visitor_growth",
    category: "visitor_growth",
    importance: 3,
    magnitude: Math.abs(pct),
    text: `Nationally, accommodated guests ${pct >= 0 ? "grew" : "fell"} ${fmtPct(pct)} year-over-year in ${dashboard.periodLabel} (${abbrev(dashboard.totalGuests)} guests).`,
  };
}

function detectNightsGrowth(dashboard) {
  const pct = dashboard.totalNightsYoyPct;
  if (pct == null || Math.abs(pct) < MIN_NOTABLE_PCT) return null;
  return {
    id: "national_nights_growth",
    category: "nights_growth",
    importance: 2,
    magnitude: Math.abs(pct),
    text: `Nationally, nights spent ${pct >= 0 ? "grew" : "fell"} ${fmtPct(pct)} year-over-year in ${dashboard.periodLabel} (${abbrev(dashboard.totalNights)} nights).`,
  };
}

// The Task 2.1 worked example: visitor growth and night growth moving at
// different speeds implies average stay length changed — more interesting
// than restating either figure alone.
function detectStayLengthShift(dashboard) {
  const guestsPct = dashboard.totalGuestsYoyPct;
  const nightsPct = dashboard.totalNightsYoyPct;
  const stayPct = dashboard.avgNightsPerGuestYoyPct;
  if (guestsPct == null || nightsPct == null || stayPct == null) return null;
  const gap = Math.abs(nightsPct - guestsPct);
  if (gap < MIN_NOTABLE_PCT) return null;
  return {
    id: "national_stay_length_shift",
    category: "stay_length",
    importance: 3,
    magnitude: gap,
    text:
      `Nationally, guests ${fmtPct(guestsPct)} but nights ${fmtPct(nightsPct)} year-over-year — ` +
      `average nights per guest ${stayPct >= 0 ? "lengthened" : "shortened"} (${fmtPct(stayPct)}), ` +
      `now ${dashboard.avgNightsPerGuest.toFixed(2)} nights/guest.`,
  };
}

function detectDomesticVsForeign(dashboard) {
  const dom = dashboard.domesticGuestsYoyPct;
  const foreign = dashboard.foreignGuestsYoyPct;
  if (dom == null || foreign == null) return null;
  const gap = Math.abs(dom - foreign);
  if (gap < MIN_NOTABLE_PCT) return null;
  return {
    id: "national_domestic_vs_foreign",
    category: "domestic_vs_foreign",
    importance: 2,
    magnitude: gap,
    text: `Nationally, domestic guests ${fmtPct(dom)} year-over-year while foreign guests ${fmtPct(foreign)} — a ${gap.toFixed(1)}-point gap between the two.`,
  };
}

// The OTHER Task 2.1 worked example: growth and occupancy/price moving in
// opposite directions. Computed at both national and (if given) regional
// level, since this is exactly the Harju maakond pattern the spec quotes.
function detectGrowthVsOperatingDivergence(label, guestsPct, occupancyPtsYoy, pricePct, code = null) {
  if (guestsPct == null) return null;
  const parts = [];
  if (occupancyPtsYoy != null && Math.sign(occupancyPtsYoy) !== Math.sign(guestsPct) && Math.abs(occupancyPtsYoy) >= MIN_NOTABLE_POINTS) {
    parts.push(`occupancy moved the other way (${fmtPoints(occupancyPtsYoy)})`);
  }
  if (pricePct != null && Math.sign(pricePct) !== Math.sign(guestsPct) && Math.abs(pricePct) >= MIN_NOTABLE_PCT) {
    parts.push(`average cost per night moved the other way (${fmtPct(pricePct)})`);
  }
  if (!parts.length) return null;
  return {
    id: `divergence_${label}`,
    category: "growth_vs_operating",
    importance: 3,
    magnitude: Math.abs(guestsPct) + parts.length,
    code,
    text: `In ${label}, guests ${fmtPct(guestsPct)} year-over-year, but ${parts.join(" and ")} — growth in visitors did not translate into higher occupancy or price.`,
  };
}

function detectRegionalExtremes(dashboard, countyLabelByCode) {
  const findings = [];
  let strongest = null;
  let weakest = null;
  for (const [code, m] of Object.entries(dashboard.regions ?? {})) {
    if (!m || m.totalGuests < MIN_BASE_GUESTS || m.totalGuestsYoyPct == null) continue;
    if (!strongest || m.totalGuestsYoyPct > strongest.m.totalGuestsYoyPct) strongest = { code, m };
    if (!weakest || m.totalGuestsYoyPct < weakest.m.totalGuestsYoyPct) weakest = { code, m };
  }
  if (strongest && strongest.m.totalGuestsYoyPct >= MIN_NOTABLE_PCT) {
    findings.push({
      id: "region_strongest_growth",
      category: "regional",
      importance: 2,
      magnitude: Math.abs(strongest.m.totalGuestsYoyPct),
      code: strongest.code,
      text: `${countyLabelByCode(strongest.code)} had the strongest guest growth among counties this period: ${fmtPct(strongest.m.totalGuestsYoyPct)} year-over-year (${abbrev(strongest.m.totalGuests)} guests).`,
    });
  }
  if (weakest && weakest.m.totalGuestsYoyPct <= -MIN_NOTABLE_PCT && weakest.code !== strongest?.code) {
    findings.push({
      id: "region_weakest_growth",
      category: "regional",
      importance: 2,
      magnitude: Math.abs(weakest.m.totalGuestsYoyPct),
      code: weakest.code,
      text: `${countyLabelByCode(weakest.code)} had the steepest guest decline among counties this period: ${fmtPct(weakest.m.totalGuestsYoyPct)} year-over-year (${abbrev(weakest.m.totalGuests)} guests).`,
    });
  }
  return findings;
}

function detectOccupancyTrend(capacity) {
  if (capacity.occupancyPctYoy == null || Math.abs(capacity.occupancyPctYoy) < MIN_NOTABLE_POINTS) return null;
  return {
    id: "national_occupancy_trend",
    category: "occupancy",
    importance: 1.5,
    magnitude: Math.abs(capacity.occupancyPctYoy),
    text: `Nationally, bed occupancy was ${capacity.occupancyPct.toFixed(1)}% in ${capacity.occupancyPeriodLabel}, ${fmtPoints(capacity.occupancyPctYoy)} year-over-year.`,
  };
}

function detectPriceTrend(capacity) {
  if (capacity.avgNightCostYoyPct == null || Math.abs(capacity.avgNightCostYoyPct) < MIN_NOTABLE_PCT) return null;
  return {
    id: "national_price_trend",
    category: "price",
    importance: 1.5,
    magnitude: Math.abs(capacity.avgNightCostYoyPct),
    text: `Nationally, the average cost per night was €${capacity.avgNightCost.toFixed(0)}, ${fmtPct(capacity.avgNightCostYoyPct)} year-over-year.`,
  };
}

function detectSourceMarketMover(map) {
  const mover = map.topOriginMover;
  if (!mover || Math.abs(mover.pct) < MIN_NOTABLE_PCT) return null;
  return {
    id: "source_market_mover",
    category: "source_market",
    importance: 1.5,
    magnitude: Math.abs(mover.pct),
    text: `Among foreign source markets, ${mover.label} moved the most year-over-year: ${fmtPct(mover.pct)} (${abbrev(mover.prevValue)} to ${abbrev(mover.value)} guests, latest 12 months vs. the 12 before).`,
  };
}

/**
 * Runs every detector and returns the full, unranked list of findings that
 * cleared their own significance/size guard. `countyLabelByCode` maps a
 * county code to its display name (the caller already has this mapping).
 */
export function detectFindings({ dashboard, map, purpose, capacity, regionalOccPrice }, countyLabelByCode) {
  const findings = [];
  const push = (f) => {
    if (f) findings.push(f);
  };

  push(detectVisitorGrowth(dashboard));
  push(detectNightsGrowth(dashboard));
  push(detectStayLengthShift(dashboard));
  push(detectDomesticVsForeign(dashboard));
  push(detectOccupancyTrend(capacity));
  push(detectPriceTrend(capacity));
  push(
    detectGrowthVsOperatingDivergence(
      "Estonia overall",
      dashboard.totalGuestsYoyPct,
      capacity.occupancyPctYoy,
      capacity.avgNightCostYoyPct
    )
  );
  push(detectSourceMarketMover(map));
  for (const f of detectRegionalExtremes(dashboard, countyLabelByCode)) push(f);

  // Same growth-vs-operating-divergence check, per county, using the
  // regional occupancy/price fetch — this is what lets the Harju-style
  // example exist for whichever county it's actually true for this period,
  // not just the one or two regions already singled out elsewhere.
  for (const [code, m] of Object.entries(dashboard.regions ?? {})) {
    if (!m || m.totalGuests < MIN_BASE_GUESTS) continue;
    const occPrice = regionalOccPrice?.[code];
    if (!occPrice) continue;
    push(
      detectGrowthVsOperatingDivergence(
        countyLabelByCode(code),
        m.totalGuestsYoyPct,
        occPrice.occupancyPctYoy,
        occPrice.avgNightCostYoyPct,
        code
      )
    );
  }

  return findings;
}

/**
 * Picks out the per-region divergence findings detectFindings() already
 * computed and indexes them by region code, for the per-region blurb calls
 * — so a region's own "growth up, occupancy/price down" contrast (if any)
 * can be handed to Claude alongside that region's other numbers, the same
 * way the national version is. Returns a plain object, code -> finding.
 */
export function findingsByRegionCode(findings) {
  const byCode = {};
  for (const f of findings) {
    if (f.category === "growth_vs_operating" && f.code) byCode[f.code] = f;
  }
  return byCode;
}

/**
 * Selects the top findings by importance x magnitude, capped per category
 * so one topic (e.g. five different regions) can't crowd out everything
 * else — Task 5.2's "select a limited number of insights" plus variety.
 */
export function rankFindings(findings, { max = 7, maxPerCategory = 2 } = {}) {
  const sorted = [...findings].sort((a, b) => b.importance * b.magnitude - a.importance * a.magnitude);
  const perCategory = new Map();
  const selected = [];
  for (const f of sorted) {
    const count = perCategory.get(f.category) ?? 0;
    if (count >= maxPerCategory) continue;
    selected.push(f);
    perCategory.set(f.category, count + 1);
    if (selected.length >= max) break;
  }
  return selected;
}
