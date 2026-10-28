// Task 5.4: automated pre-publish QA checks, run once per generation
// before narrative.json is written. The goal is a hard gate: a run that
// fails an "error"-level check must NOT overwrite the last known-good
// narrative.json, the same way a failed test suite blocks a deploy.
// "Warning"-level checks are printed (so a human reviewing the GitHub
// Action log sees them) but don't block publishing.
//
// Each check returns null (passed) or { level: "error" | "warning", message }.

function err(message) {
  return { level: "error", message };
}
function warn(message) {
  return { level: "warning", message };
}

// Guards against the exact failure mode Task 2.2 tried to prevent at the
// prompt level: a banned cliché slipping through anyway. Checked here
// independently of the system prompt, since a prompt instruction is a
// request, not a guarantee — this is what actually verifies it didn't
// happen. (Found a real instance of this in production narrative.json
// before this check existed: "Harjumaa jääb Eesti turismisektori selgeks
// veduriks", a close paraphrase of the banned "kindel vedur".)
function checkBannedPhrases(output, bannedPhrases) {
  const issues = [];
  const normalize = (s) => s.toLowerCase();
  const bannedNormalized = bannedPhrases.map(normalize);

  function scan(obj, pathLabel) {
    if (obj == null) return;
    if (typeof obj === "string") {
      const lower = normalize(obj);
      for (let i = 0; i < bannedNormalized.length; i++) {
        if (lower.includes(bannedNormalized[i])) {
          issues.push(err(`Banned phrase "${bannedPhrases[i]}" found in ${pathLabel}.`));
        }
      }
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => scan(item, `${pathLabel}[${i}]`));
      return;
    }
    if (typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) scan(value, `${pathLabel}.${key}`);
    }
  }

  scan(output.sections, "sections");
  return issues;
}

// Every field the PDF and the dashboard actually read must exist, or
// they silently render blank/"n/a" sections with no warning anywhere —
// Task 5.3's "missing or incomplete data" case, caught here instead of
// discovered by a reader looking at a broken report.
function checkStructuralCompleteness(output, allRegionCodes) {
  const issues = [];
  const need = (cond, message) => {
    if (!cond) issues.push(err(message));
  };

  need(typeof output.period === "string" && /^\d{4}M\d{2}$/.test(output.period), "output.period is missing or not in YYYYMmm form.");
  need(output.periodLabel?.et && output.periodLabel?.en, "output.periodLabel is missing an et or en value.");

  const s = output.sections ?? {};
  for (const key of ["dashboard", "map", "purpose", "capacity", "expenses", "sector"]) {
    need(s[key]?.et && s[key]?.en, `sections.${key} is missing an et or en blurb.`);
  }
  need(s.headline?.et && s.headline?.en, "sections.headline is missing an et or en value.");
  need(Array.isArray(s.keyInsights) && s.keyInsights.length === 3, "sections.keyInsights must have exactly 3 items.");
  (s.keyInsights ?? []).forEach((insight, i) => {
    need(insight?.et && insight?.en, `sections.keyInsights[${i}] is missing an et or en value.`);
  });

  for (const code of allRegionCodes) {
    need(s.dashboardByRegion?.[code]?.et, `sections.dashboardByRegion is missing region ${code}.`);
  }

  need(output.facts?.national, "facts.national is missing.");
  need(output.featuredRegionCode, "featuredRegionCode is missing.");
  need(
    !output.featuredRegionCode || allRegionCodes.includes(output.featuredRegionCode),
    `featuredRegionCode "${output.featuredRegionCode}" is not a known region code.`
  );

  return issues;
}

// A region with no facts at all (as opposed to facts with a small/zero
// value) usually means that region's API fetch silently dropped a row —
// worth a human's attention, but not worth blocking the whole report over
// a single county, so this is a warning rather than an error.
function checkRegionalDataCompleteness(output, allRegionCodes) {
  const issues = [];
  const regions = output.facts?.regions ?? {};
  for (const code of allRegionCodes) {
    if (!regions[code] || regions[code].totalGuests == null) {
      issues.push(warn(`facts.regions is missing or incomplete for region ${code}.`));
    }
  }
  return issues;
}

// A YoY swing beyond this magnitude is far more likely to be a
// period-matching bug (e.g. comparing against the wrong prior-year month)
// than a real tourism trend — flagged for a human to glance at, not
// auto-rejected, since a genuinely tiny base can legitimately swing this
// much.
const IMPLAUSIBLE_YOY_PCT = 500;
function checkNumericSanity(output) {
  const issues = [];
  const checkPct = (value, label) => {
    if (typeof value === "number" && Math.abs(value) > IMPLAUSIBLE_YOY_PCT) {
      issues.push(warn(`${label} is an implausible ${value.toFixed(0)}% YoY — check for a period-matching bug.`));
    }
  };
  const n = output.facts?.national ?? {};
  checkPct(n.totalGuestsYoyPct, "facts.national.totalGuestsYoyPct");
  checkPct(n.totalNightsYoyPct, "facts.national.totalNightsYoyPct");
  checkPct(n.avgNightCostYoyPct, "facts.national.avgNightCostYoyPct");
  for (const [code, r] of Object.entries(output.facts?.regions ?? {})) {
    checkPct(r.totalGuestsYoyPct, `facts.regions.${code}.totalGuestsYoyPct`);
    checkPct(r.avgNightCostYoyPct, `facts.regions.${code}.avgNightCostYoyPct`);
  }
  return issues;
}

// Task 5.1's "change detection": the period this run produced should
// never be older than the last published one — publishing an older period
// over a newer one almost always means the API returned a stale/partial
// response, not that time ran backwards.
function checkPeriodProgression(output, previous) {
  if (!previous?.period) return [];
  if (output.period < previous.period) {
    return [err(`New period ${output.period} is older than the previously published period ${previous.period}.`)];
  }
  return [];
}

/**
 * Runs every check and returns { errors, warnings, changeLog }. `errors`
 * must be empty before the caller writes narrative.json — a non-empty
 * `errors` means "do not publish this run; keep the last known-good file."
 * `changeLog` is a short human-readable diff against the previous run's
 * headline national numbers, printed for visibility in CI logs regardless
 * of pass/fail (Task 5.1).
 */
export function runPrePublishChecks(output, { previous, allRegionCodes, bannedPhrases }) {
  const all = [
    ...checkStructuralCompleteness(output, allRegionCodes),
    ...checkRegionalDataCompleteness(output, allRegionCodes),
    ...checkNumericSanity(output),
    ...checkBannedPhrases(output, bannedPhrases),
    ...checkPeriodProgression(output, previous),
  ];

  return {
    errors: all.filter((i) => i.level === "error").map((i) => i.message),
    warnings: all.filter((i) => i.level === "warning").map((i) => i.message),
    changeLog: buildChangeLog(output, previous),
  };
}

function fmtDelta(before, after) {
  if (before == null || after == null) return `${before ?? "n/a"} → ${after ?? "n/a"}`;
  const delta = after - before;
  const sign = delta >= 0 ? "+" : "";
  return `${before} → ${after} (${sign}${delta})`;
}

function buildChangeLog(output, previous) {
  if (!previous?.facts?.national) return ["(no previous narrative.json to diff against — first run)"];
  const before = previous.facts.national;
  const after = output.facts?.national ?? {};
  return [
    `period: ${previous.period} → ${output.period}`,
    `totalGuests: ${fmtDelta(before.totalGuests, after.totalGuests)}`,
    `totalNights: ${fmtDelta(before.totalNights, after.totalNights)}`,
    `occupancyPct: ${fmtDelta(before.occupancyPct, after.occupancyPct)}`,
    `avgNightCost: ${fmtDelta(before.avgNightCost, after.avgNightCost)}`,
    `featuredRegionCode: ${previous.featuredRegionCode ?? "n/a"} → ${output.featuredRegionCode ?? "n/a"}`,
  ];
}
