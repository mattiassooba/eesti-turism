// Quiet-season-to-midsummer gradient, used by both the seasonality strip
// and the county choropleth map so "low value" and "high value" always
// mean the same colors across the app. Muted rather than saturated so the
// strip and map read as calm data, not an alert.
const QUIET = [140, 165, 182];
const MIDSUMMER = [224, 168, 96];

export function seasonalityColor(t) {
  const r = Math.round(QUIET[0] + (MIDSUMMER[0] - QUIET[0]) * t);
  const g = Math.round(QUIET[1] + (MIDSUMMER[1] - QUIET[1]) * t);
  const b = Math.round(QUIET[2] + (MIDSUMMER[2] - QUIET[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
