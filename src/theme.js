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

// Chart chrome (gridlines, axis lines/ticks) — tied to the card border and
// slate tokens instead of Recharts' library-default mid-grey, so charts
// read as this app's rather than a generic charting library's output.
export const CHART_GRID_COLOR = "#dbe0df";
export const CHART_AXIS_COLOR = "#8a96a0";
