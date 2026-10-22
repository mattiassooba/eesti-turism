// Shared color tokens for charts (SVG/canvas contexts, where CSS custom
// properties from App.css aren't reachable) — kept in sync with the
// --sea/--midsummer/--slate/--sea-deep/--ink values there by hand.

// Used everywhere a chart splits by visitor/trip residency, so the same
// real-world concept always reads the same color regardless of which
// page it's on: Eesti elanikud / Sisereisid always slate, Väliskülastajad
// / Välisreisid always midsummer gold.
export const DOMESTIC_COLOR = "#5b6b7a";
export const FOREIGN_COLOR = "#d98e2b";

// General-purpose series palette for charts with more than two, unrelated
// categories (e.g. trip purpose, accommodation type).
export const CHART_COLORS = ["#2b6ca3", "#d98e2b", "#5b6b7a", "#0f3a57", "#9c3b26", "#4d7894"];

// Matches --alert in tokens.css — used to flag specific bars (e.g. the
// 2020-2021 pandemic dip) without introducing a separate legend entry.
export const ALERT_COLOR = "#9c3b26";

// 2020-2021: the two years COVID-19 collapsed international travel. Any
// yearly bar chart spanning this range highlights those two bars in
// ALERT_COLOR instead of a separate background band — shared here so every
// chart that does this agrees on exactly which years.
export const PANDEMIC_YEARS = new Set(["2020", "2021"]);

// Paired 1:1 with CHART_COLORS by index — multi-series line/area charts
// apply both color AND dash pattern per series, so series stay
// distinguishable without relying on color alone (colorblind visitors,
// grayscale printing).
export const CHART_DASH_PATTERNS = ["0", "6 3", "2 2", "8 3 2 3", "1 3", "10 2"];

// Chart chrome (gridlines, axis lines/ticks) — tied to the card border and
// slate tokens instead of Recharts' library-default mid-grey, so charts
// read as this app's rather than a generic charting library's output.
export const CHART_GRID_COLOR = "#dbe0df";
export const CHART_AXIS_COLOR = "#8a96a0";
