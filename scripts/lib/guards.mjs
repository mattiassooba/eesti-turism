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
