import { describe, expect, test } from "vitest";
import { buildNewsletterPdfData, pdfInputs } from "./newsletterPdfData.js";
import { makeFixture } from "./testFixtures.js";
import { STRINGS } from "../i18n/strings.js";
import { REGIONS } from "../lib/regions.js";

const TARTU = REGIONS.find((r) => r.id === "tartu");

// Same lookup as AppState's t().
const makeT = (locale) => (key, vars) => {
  const get = (d) => key.split(".").reduce((n, k) => (n == null ? undefined : n[k]), d);
  const v = get(STRINGS[locale]) ?? get(STRINGS.et);
  if (v == null) throw new Error(`missing string ${key}`);
  return typeof v === "function" ? v(vars) : v;
};

const f = makeFixture({
  fromYear: 2017,
  toYear: 2026,
  toMonth: 8,
  annual: { EE: (y) => 3_000_000 + (y - 2017) * 100_000, [TARTU.code]: () => 240_000 },
});
const periods = f.tourism.periods;
const nights = { FI: 300, LV: 100, DE: 200, SE: 50 };
const origins = { periods, get: (code) => periods.map(() => nights[code] ?? null) };
const growthSeries = Array.from({ length: 40 }, (_, i) => ({ period: `${2016 + Math.floor(i / 4)}Q${(i % 4) + 1}`, pct: i % 3 ? 4.2 : -1.5 }));
const sector = { growthSeries };

const build = (locale = "et", extra = {}) =>
  buildNewsletterPdfData({ ...f, sector, origins, region: TARTU, locale, t: makeT(locale), ...extra });

// Every string that ends up printed in a table.
const allText = (d) =>
  [d.national, d.region]
    .flatMap((tbl) => [tbl.title, ...tbl.columns, ...tbl.rows.flatMap((r) => [r.label, ...r.cells.map((c) => (typeof c === "string" ? c : c.text))])])
    .join(" | ");

describe("buildNewsletterPdfData", () => {
  test("national table rows match the Operator page rows, in order", () => {
    const d = build();
    expect(d.national.rows.map((r) => r.label)).toEqual([
      "Majutatud Eestis",
      "Muutus (aasta varasemaga)",
      "Kumulatiivne (jaan.–aug)",
      "Muutus (aasta varasemaga)",
      "Kodumaiste külastajate osakaal",
      "Majutusettevõtteid",
      "Tubasid",
      "Täituvus",
      "Keskmine ööpäevamaksumus",
      "Muutus (aasta varasemaga)",
      "RevPAR (täituvus × ööpäevamaksumus)",
    ]);
    // Month headers on two lines keep those columns narrow in the PDF.
    expect(d.national.columns).toEqual(["2020", "2021", "2022", "2023", "2024", "2025", "2024\nAUGUST", "2025\nAUGUST", "2026\nAUGUST"]);
    expect(d.national.rows.every((r) => r.cells.length === d.national.columns.length)).toBe(true);
  });

  test("region table adds the share row and exactly 3 origin rows", () => {
    const d = build();
    const labels = d.region.rows.map((r) => r.label);
    expect(labels[0]).toBe("Majutatud: Tartu maakond");
    expect(labels).toContain("Tartu maakond osakaal Eestist");
    expect(labels.filter((l) => l.startsWith("Top "))).toEqual(["Top 1 päritoluriik", "Top 2 päritoluriik", "Top 3 päritoluriik"]);
    const top1 = d.region.rows.find((r) => r.label === "Top 1 päritoluriik").cells[0];
    // Country and nights on separate lines, so the column stays narrow in the PDF.
    expect(top1).toMatch(/^Soome\n[\d\s,]+( tuh\.)?$/);
  });

  test("missing values render as an em dash, never NaN, null or undefined", () => {
    const g = makeFixture({ fromYear: 2019, toYear: 2026, toMonth: 8, annual: { EE: () => 1_000_000, [TARTU.code]: (y) => (y === 2021 ? null : 5000) } });
    const d = buildNewsletterPdfData({ ...g, sector, origins: null, region: TARTU, locale: "et", t: makeT("et") });
    const text = allText(d);
    expect(text).not.toMatch(/NaN|null|undefined/);
    const acc = d.region.rows[0];
    expect(acc.cells[d.region.columns.indexOf("2021")]).toBe("—");
  });

  test("delta cells carry a sign for colouring", () => {
    const d = build();
    const change = d.national.rows[1].cells;
    expect(change.every((c) => typeof c === "object" && "text" in c && "sign" in c)).toBe(true);
    expect(change.at(-1).sign).toBe(1);
    expect(change.at(-1).text).toMatch(/^\+/);
  });

  test("en locale gives English month headers and number formats", () => {
    const d = build("en");
    expect(d.national.columns.at(-1)).toBe("AUGUST\n2026");
    expect(d.national.rows[0].cells[0]).toBe("3.3M");
    expect(d.national.rows[0].label).toBe("Accommodated in Estonia");
  });

  test("county charts cover the last 10 years with the partial year flagged", () => {
    const d = build();
    expect(d.region.shareChart.categories).toHaveLength(10);
    expect(d.region.shareChart.partial.at(-1)).toBe(true);
    expect(d.region.shareChart.categories.at(-1)).toBe("2026*");
    expect(d.region.occChart.lines.map((l) => l.label)).toEqual(["RevPAR", "Keskmine ööpäevamaksumus"]);
  });

  test("axis labels keep a decimal when the axis steps by less than 1", () => {
    const { shareChart } = build().region;
    expect(shareChart.rightFormat(0.5, 0.5)).toBe("0,5%");
    expect(shareChart.rightFormat(1, 0.5)).toBe("1,0%");
    expect(shareChart.rightFormat(20, 10)).toBe("20%");
  });

  test("growth chart is the last 36 quarters with a year label on each Q1", () => {
    const d = build();
    expect(d.growth.values).toHaveLength(36);
    expect(d.growth.labels.filter(Boolean)).toEqual(["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"]);
  });
});

describe("pdfInputs", () => {
  const ok = (data) => ({ data, error: null, loading: false });
  const loading = (data = null) => ({ data, error: null, loading: true });
  const failed = { data: null, error: "boom", loading: false };
  const all = { tourism: ok(f.tourism), capacity: ok(f.capacity), sector: ok(sector), origins: ok(origins) };

  test("waits (undefined) while anything is still loading, even with stale data from a previous county", () => {
    expect(pdfInputs({ ...all, origins: loading(origins) })).toBeUndefined();
    expect(pdfInputs({ ...all, tourism: loading() })).toBeUndefined();
  });

  test("a failed sector or origins download only drops that part", () => {
    expect(pdfInputs({ ...all, sector: failed })).toMatchObject({ sector: null, origins });
    expect(pdfInputs({ ...all, origins: failed })).toMatchObject({ origins: null, sector });
  });

  test("without tourism or capacity data the PDF is built without tables (null), not blocked", () => {
    expect(pdfInputs({ ...all, tourism: failed })).toBeNull();
    expect(pdfInputs({ ...all, capacity: failed })).toBeNull();
  });
});

describe("table period follows the narrative", () => {
  test("columns end at the given latest month, not the newest month in the data", () => {
    const d = build("et", { latest: "2026M07" });
    expect(d.national.columns.slice(-3)).toEqual(["2024\nJUULI", "2025\nJUULI", "2026\nJUULI"]);
    expect(d.national.rows[2].label).toBe("Kumulatiivne (jaan.–juuli)");
  });

  test("an unknown latest month falls back to the newest month in the data", () => {
    expect(build("et", { latest: "2031M01" }).national.columns.at(-1)).toBe("2026\nAUGUST");
  });
});
