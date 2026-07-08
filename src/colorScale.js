// Quiet-season-to-midsummer gradient, used by both the seasonality strip
// and the county choropleth map so "low value" and "high value" always
// mean the same colors across the app. QUIET is deliberately lighter than
// the hero card's own background (--sea-deep, #0f3a57) so low-value cells
// stay visible against it instead of blending in.
const QUIET = [77, 120, 148];
const MIDSUMMER = [217, 142, 43];

export function seasonalityColor(t) {
  const r = Math.round(QUIET[0] + (MIDSUMMER[0] - QUIET[0]) * t);
  const g = Math.round(QUIET[1] + (MIDSUMMER[1] - QUIET[1]) * t);
  const b = Math.round(QUIET[2] + (MIDSUMMER[2] - QUIET[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
