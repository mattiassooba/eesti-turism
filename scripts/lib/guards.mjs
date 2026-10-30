// Fail-loud checks for generate-narrative.mjs: a run stops with a clear
// message rather than publishing truncated or ungrounded text.

// A tool-use reply cut off at max_tokens (or refused) carries incomplete
// input; say so plainly instead of letting the QA gate fail on a symptom.
export function assertComplete(response, what) {
  if (response.stop_reason === "max_tokens" || response.stop_reason === "refusal") {
    throw new Error(`Claude's ${what} reply stopped early (stop_reason: ${response.stop_reason}); narrative.json was not updated.`);
  }
}

// Without TU410 figures the sector paragraph would have nothing to stand on.
export function requireSector(sector) {
  if (!sector) {
    throw new Error("TU410 returned no accommodation services turnover; refusing to ask Claude for an ungrounded sector paragraph.");
  }
  return sector;
}

// Claude's tool calls sometimes return a nested section as a JSON-encoded
// string instead of an object; parse those. A string that isn't JSON is
// reported with its section name and opening text, so a failed run says
// what actually came back.
export function normalizeSections(sections) {
  const normalized = {};
  for (const [key, value] of Object.entries(sections)) {
    if (typeof value !== "string") {
      normalized[key] = value;
      continue;
    }
    try {
      normalized[key] = JSON.parse(value);
    } catch {
      throw new Error(`sections.${key} came back as plain text instead of an object: ${JSON.stringify(value.slice(0, 400))}`);
    }
  }
  return normalized;
}

// Runs attempt(n) up to `tries` times, returning the first success. Claude's
// replies vary run to run (a banned phrase, a malformed section), so one
// fresh attempt usually clears a failed quality check.
export async function withRetries(attempt, { tries = 2, log = console.log } = {}) {
  let lastError;
  for (let n = 1; n <= tries; n++) {
    try {
      return await attempt(n);
    } catch (err) {
      lastError = err;
      if (n < tries) log(`Attempt ${n} failed (${err.message}); retrying.`);
    }
  }
  throw lastError;
}

// Strict tool mode can't enforce an exact array length; keep the first three
// key insights when Claude returns more. Fewer is left for the QA gate.
export function keepFirstInsights(sections) {
  if (Array.isArray(sections.keyInsights) && sections.keyInsights.length > 3) {
    return { ...sections, keyInsights: sections.keyInsights.slice(0, 3) };
  }
  return sections;
}
