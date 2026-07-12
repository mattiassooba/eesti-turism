// Generates the AI-written "what happened this month" narrative shown at
// the top of the Ülevaade tab. Run standalone under Node (not the browser
// bundle) — imports the same fetch/flatten helpers the app itself uses,
// since both are pure fetch-based with no browser-only APIs.
//
// Usage: ANTHROPIC_API_KEY=... node scripts/generate-narrative.mjs
// Optional: ANTHROPIC_MODEL=claude-sonnet-5 (default), --force to skip the
// idempotency guard.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTableData } from "../src/api/pxweb.js";
import { flattenToRows } from "../src/api/jsonStat.js";
import { formatPeriodLabel } from "../src/i18n/format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "..", "public", "data", "narrative.json");

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];

// Same 15 non-overlapping maakonds Dashboard.jsx uses for its top-county
// tile — see that file for why ("EE" total + city sub-splits excluded).
const REAL_COUNTY_CODES = [
  "EE00370000000000",
  "EE00390000000000",
  "EE00450000000000",
  "EE00500000000000",
  "EE00520000000000",
  "EE00560000000000",
  "EE00600000000000",
  "EE00640000000000",
  "EE00680000000000",
  "EE00710000000000",
  "EE00740000000000",
  "EE00790000000000",
  "EE00810000000000",
  "EE00840000000000",
  "EE00870000000000",
];

function periodDelta(series, latestIndex, offset) {
  const compareIndex = latestIndex - offset;
  if (compareIndex < 0) return null;
  const latest = series[latestIndex];
  const compare = series[compareIndex];
  if (!compare) return null;
  return ((latest - compare) / compare) * 100;
}

async function computeMetrics() {
  // Fetched via /et/ specifically — Vaatlusperiood's "top" filter is only
  // reliably chronological under /et/ (see src/api/pxweb.js's comment on
  // the locale bug); the raw numbers themselves are locale-independent.
  const [national, county] = await Promise.all([
    fetchTableData(
      MAJUTUS_PATH,
      "TU131.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR", "OCC_NI"] } },
        { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
        { code: "Elukohariik", selection: { filter: "item", values: ["WORLD", "EE", "FOR"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["13"] } },
      ],
      { locale: "et" }
    ),
    fetchTableData(
      MAJUTUS_PATH,
      "TU131.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
        { code: "Maakond", selection: { filter: "item", values: REAL_COUNTY_CODES } },
        { code: "Elukohariik", selection: { filter: "item", values: ["WORLD"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["13"] } },
      ],
      { locale: "et" }
    ),
  ]);

  const rows = flattenToRows(national);
  const byPeriod = new Map();
  for (const row of rows) {
    if (!byPeriod.has(row.Vaatlusperiood)) {
      byPeriod.set(row.Vaatlusperiood, { label: row.Vaatlusperiood_label });
    }
    byPeriod.get(row.Vaatlusperiood)[`${row.Näitaja}_${row.Elukohariik}`] = row.value;
  }
  const periods = Array.from(byPeriod.keys()).sort();
  const latestIdx = periods.length - 1;
  const latest = byPeriod.get(periods[latestIdx]);

  const guestsSeries = periods.map((p) => byPeriod.get(p).OCC_ARR_WORLD ?? 0);
  const nightsSeries = periods.map((p) => byPeriod.get(p).OCC_NI_WORLD ?? 0);
  const avgNightsSeries = periods.map((p) => {
    const g = byPeriod.get(p).OCC_ARR_WORLD ?? 0;
    const n = byPeriod.get(p).OCC_NI_WORLD ?? 0;
    return g ? n / g : 0;
  });

  const totalGuests = latest.OCC_ARR_WORLD ?? 0;
  const totalNights = latest.OCC_NI_WORLD ?? 0;
  const domesticGuests = latest.OCC_ARR_EE ?? 0;
  const foreignGuests = latest.OCC_ARR_FOR ?? 0;
  const avgNightsPerGuest = totalGuests ? totalNights / totalGuests : 0;

  const countyRows = flattenToRows(county);
  const countyByPeriod = new Map();
  for (const row of countyRows) {
    if (!countyByPeriod.has(row.Vaatlusperiood)) countyByPeriod.set(row.Vaatlusperiood, new Map());
    countyByPeriod.get(row.Vaatlusperiood).set(row.Maakond, row.value);
  }
  let topCounty = null;
  for (const row of countyRows) {
    if (row.Vaatlusperiood !== periods[latestIdx] || row.value === null) continue;
    if (!topCounty || row.value > topCounty.value) {
      topCounty = { code: row.Maakond, label: row.Maakond_label, value: row.value };
    }
  }
  const topCountySeries = periods.map((p) => countyByPeriod.get(p)?.get(topCounty?.code) ?? 0);

  return {
    period: periods[latestIdx],
    periodLabel: latest.label,
    totalGuests,
    totalGuestsYoyPct: periodDelta(guestsSeries, latestIdx, 12),
    totalNights,
    totalNightsYoyPct: periodDelta(nightsSeries, latestIdx, 12),
    domesticGuests,
    foreignGuests,
    avgNightsPerGuest,
    avgNightsPerGuestYoyPct: periodDelta(avgNightsSeries, latestIdx, 12),
    topCounty: topCounty
      ? { label: topCounty.label, value: topCounty.value, yoyPct: periodDelta(topCountySeries, latestIdx, 12) }
      : null,
  };
}

function fmtPct(n) {
  if (n == null) return "no comparable data a year ago";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function buildPrompt(m) {
  return `Here are this month's Estonian tourism accommodation statistics (source: Statistikaamet, table TU131):

- Period: ${m.periodLabel}
- Total guests accommodated: ${m.totalGuests.toLocaleString("en-US")} (YoY: ${fmtPct(m.totalGuestsYoyPct)})
- Total nights spent: ${m.totalNights.toLocaleString("en-US")} (YoY: ${fmtPct(m.totalNightsYoyPct)})
- Domestic (Estonian resident) guests: ${m.domesticGuests.toLocaleString("en-US")}
- Foreign visitor guests: ${m.foreignGuests.toLocaleString("en-US")}
- Average nights per guest: ${m.avgNightsPerGuest.toFixed(2)} (YoY: ${fmtPct(m.avgNightsPerGuestYoyPct)})
${m.topCounty ? `- Most-visited county: ${m.topCounty.label}, ${m.topCounty.value.toLocaleString("en-US")} guests (YoY: ${fmtPct(m.topCounty.yoyPct)})` : ""}

Write a short newsletter-style summary of this month's Estonian tourism accommodation activity, in both Estonian and English, using the emit_narrative tool.`;
}

async function callClaude(metrics) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1536,
    system:
      "You write a short monthly newsletter blurb for a personal Estonian tourism statistics dashboard " +
      "('Eesti Turism'). Ground every sentence strictly in the numbers given — never invent, round loosely, " +
      "or speculate about causes not implied by the data. Write 150-250 words of plain, newsletter-style " +
      "prose (no headings, no bullet points, no markdown). Produce both an Estonian and an English version, " +
      "each independently well-written (not a literal translation of each other, though they must report " +
      "the same facts). Estonian should read naturally to a native speaker.",
    messages: [{ role: "user", content: buildPrompt(metrics) }],
    tools: [
      {
        name: "emit_narrative",
        description: "Emit the finished newsletter narrative in both languages.",
        input_schema: {
          type: "object",
          properties: {
            et: { type: "string", description: "150-250 word Estonian newsletter narrative." },
            en: { type: "string", description: "150-250 word English newsletter narrative." },
          },
          required: ["et", "en"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "emit_narrative" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a tool_use block");
  return toolUse.input;
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const force = process.argv.includes("--force");

  console.log("Fetching latest metrics from Statistikaamet…");
  const metrics = await computeMetrics();
  console.log(`Latest period: ${metrics.period} (${metrics.periodLabel})`);

  const existing = await readExisting();
  if (!force && existing?.period === metrics.period) {
    console.log(`narrative.json is already up to date for ${metrics.period} — skipping (no API call made).`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  console.log("Calling Claude to generate the narrative…");
  const { et, en } = await callClaude(metrics);

  const output = {
    generatedAt: new Date().toISOString(),
    period: metrics.period,
    periodLabel: {
      et: metrics.periodLabel,
      en: formatPeriodLabel(metrics.period, null, "en"),
    },
    et,
    en,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
