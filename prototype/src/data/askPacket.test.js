import { describe, expect, test } from "vitest";
import { detectYears, buildPacket } from "./askPacket.js";
import { REGIONS } from "../lib/regions.js";
import { REGION_IDS, RANGE_COLUMNS, YEAR_COLUMNS, MAX_BODY_BYTES } from "@prod/lib/askShape.js";
import { validateRequest } from "../../../worker/src/validate.js";

const HIIU = "EE00390000000000";
const HARJU = "EE00370000000000";

function monthPeriods(fromYear, toYear, toMonth) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === toYear && m > toMonth) break;
      out.push(`${y}M${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

// Spread an annual total over 12 integer months (January carries the rest).
function spread(total) {
  const k = Math.floor(total / 24);
  return [total - 11 * k, ...new Array(11).fill(k)];
}

// Builds objects shaped like useTourism().data / useCapacity().data.
function makeFixture({ fromYear, toYear, toMonth, annual }) {
  const periods = monthPeriods(fromYear, toYear, toMonth);
  const series = new Map();
  const put = (key, arr) => series.set(key, arr);
  for (const [code, byYear] of Object.entries(annual)) {
    const guests = periods.map((p) => {
      const year = +p.slice(0, 4);
      const month = +p.slice(5);
      const total = byYear(year);
      return total == null ? null : spread(total)[month - 1];
    });
    const dom = guests.map((g) => (g == null ? null : Math.round(g * 0.6)));
    const forg = guests.map((g, i) => (g == null ? null : g - dom[i]));
    put(`OCC_ARR|${code}|WORLD`, guests);
    put(`OCC_ARR|${code}|EE`, dom);
    put(`OCC_ARR|${code}|FOR`, forg);
    put(`OCC_NI|${code}|WORLD`, guests.map((g) => (g == null ? null : g * 2)));
    put(`OCC_NI|${code}|EE`, dom.map((g) => (g == null ? null : g * 2)));
    put(`OCC_NI|${code}|FOR`, forg.map((g) => (g == null ? null : g * 2)));
    put(`cap|OCC_OR_BEDR|${code}`, periods.map(() => 55.5));
    put(`cap|OCC_OR_BEDP|${code}`, periods.map(() => 40.25));
    put(`cap|CAP_ESTA|${code}`, periods.map(() => 120));
    put(`cap|CAP_BEDR|${code}`, periods.map(() => 3000));
    put(`cap|CAP_BEDP|${code}`, periods.map(() => 7000));
    put(`cap|OCC_NI_COST|${code}`, periods.map(() => 77.7));
  }
  const empty = () => new Array(periods.length).fill(null);
  const latestIdx = periods.length - 1;
  const tourism = {
    periods,
    get: (ind, region, res = "WORLD") => series.get(`${ind}|${region}|${res}`) ?? empty(),
    latestIdx,
    latest: periods[latestIdx],
  };
  const capacity = {
    periods,
    get: (ind, region) => series.get(`cap|${ind}|${region}`) ?? empty(),
    latestIdx,
    latest: periods[latestIdx],
  };
  return { tourism, capacity };
}

const HIIU_YEARS = { 2015: 1000, 2019: 1500, 2020: 700, 2024: 1380 };
const small = makeFixture({
  fromYear: 2013,
  toYear: 2026,
  toMonth: 8,
  annual: {
    EE: () => 2_400_000,
    [HIIU]: (y) => HIIU_YEARS[y] ?? 1100,
    [HARJU]: () => 1_200_000,
  },
});
// Harju: one missing month in 2018 suppresses that year's total.
small.tourism.get("OCC_ARR", HARJU)[small.tourism.periods.indexOf("2018M05")] = null;

const full = makeFixture({
  fromYear: 2005,
  toYear: 2026,
  toMonth: 8,
  annual: Object.fromEntries(REGIONS.map((r, i) => [r.code, (y) => 250_000 + i * 31_337 + (y - 2005) * 4_321])),
});

const row = (cols, values) => Object.fromEntries(cols.map((c, i) => [c, values[i]]));

describe("detectYears", () => {
  test("finds a range in either order and with dashes", () => {
    expect(detectYears("Milline on Hiiumaa turismitrend aastatel 2015-2024?")).toEqual({ from: 2015, to: 2024 });
    expect(detectYears("from 2024 back to 2015")).toEqual({ from: 2015, to: 2024 });
    expect(detectYears("2015–2019–2024")).toEqual({ from: 2015, to: 2024 });
  });

  test("returns null for zero or one distinct year", () => {
    expect(detectYears("Kuidas läks 2019?")).toBeNull();
    expect(detectYears("2019 ja 2019")).toBeNull();
    expect(detectYears("Võrdle Harjumaad ja Tartumaad")).toBeNull();
  });
});

describe("buildPacket", () => {
  test("REGION_IDS matches the prototype region list", () => {
    expect(REGION_IDS).toEqual(REGIONS.map((r) => r.id));
  });

  test("county names include the everyday …maa form", () => {
    const p = buildPacket({ ...small, locale: "et", question: "" });
    expect(p.regions.hiiu.names).toEqual(expect.arrayContaining(["Hiiu maakond", "Hiiumaa", "Hiiu County"]));
    expect(p.regions.hiiu.names[0]).toBe("Hiiu maakond");
    expect(buildPacket({ ...small, locale: "en", question: "" }).regions.hiiu.names[0]).toBe("Hiiu County");
  });

  test("partial current year is flagged and its YTD row is last", () => {
    const p = buildPacket({ ...small, locale: "et", question: "" });
    expect(p.lastFullYear).toBe(2025);
    expect(p.partialYear).toEqual({ year: 2026, months: 8 });
    expect(p.regions.ee.years.at(-1)[0]).toBe(2026);
  });

  test("range ending in the partial year is clipped to lastFullYear", () => {
    const p = buildPacket({ ...small, locale: "et", question: "2020-2026" });
    expect(p.range).toMatchObject({ from: 2020, to: 2025, requested: [2020, 2026], missing: [2026] });
  });

  test("range years outside the data are reported missing", () => {
    const p = buildPacket({ ...small, locale: "et", question: "1995-2030" });
    expect(p.range.from).toBe(2013);
    expect(p.range.to).toBe(2025);
    expect(p.range.missing).toEqual(expect.arrayContaining([1995, 2030]));
  });

  test("range row has exact change, peak and low", () => {
    const p = buildPacket({ ...small, locale: "et", question: "2015-2024" });
    expect(row(RANGE_COLUMNS, p.range.rows.hiiu)).toMatchObject({
      guestsFrom: 1000,
      guestsTo: 1380,
      guestsChangePct: 38,
      peakYear: 2019,
      peakGuests: 1500,
      lowYear: 2020,
      lowGuests: 700,
    });
  });

  test("no range when the question names fewer than two years", () => {
    expect(buildPacket({ ...small, locale: "et", question: "Kuidas läks 2019?" }).range).toBeNull();
  });

  test("year rows carry the foreign guests' change from the previous year", () => {
    const p = buildPacket({ ...small, locale: "et", question: "" });
    const y18 = row(YEAR_COLUMNS, p.regions.hiiu.years.find((r) => r[0] === 2018));
    const y19 = row(YEAR_COLUMNS, p.regions.hiiu.years.find((r) => r[0] === 2019));
    expect(y19.foreignYoyPct).toBe(Math.round(((y19.foreign - y18.foreign) / y18.foreign) * 1000) / 10);
    expect(y19.foreignYoyPct).toBeGreaterThan(30);
  });

  test("suppressed annual values stay null, not zero", () => {
    const p = buildPacket({ ...small, locale: "et", question: "" });
    const y2018 = row(YEAR_COLUMNS, p.regions.harju.years.find((r) => r[0] === 2018));
    expect(y2018.guests).toBeNull();
    expect(y2018.guestsYoyPct).toBeNull();
    const y2019 = row(YEAR_COLUMNS, p.regions.harju.years.find((r) => r[0] === 2019));
    expect(y2019.guestsYoyPct).toBeNull();
  });

  test("rankings cover counties only, for the last full year", () => {
    const p = buildPacket({ ...small, locale: "et", question: "" });
    expect(p.rankings.year).toBe(2025);
    expect(p.rankings.byGuests[0]).toEqual(["harju", 1_200_000]);
    expect(p.rankings.byGuests.map(([id]) => id)).not.toContain("ee");
  });

  test("built packets pass the Worker's validator", () => {
    for (const question of ["Milline on Hiiumaa trend 2015-2024?", "1995-2030 kokku", "Võrdle Harjumaad ja Tartumaad"]) {
      const packet = buildPacket({ ...full, locale: "et", question });
      expect(validateRequest({ question, locale: "et", selected: { region: "hiiu", compare: null }, packet })).toMatchObject({ ok: true });
    }
  });

  test("packet never contains average cost and stays under the size limit", () => {
    const p = buildPacket({ ...full, locale: "et", question: "2015-2024" });
    const json = JSON.stringify(p);
    expect(json).not.toMatch(/77\.7|COST|cost/);
    expect(new TextEncoder().encode(json).length).toBeLessThan(MAX_BODY_BYTES - 2048);
  });
});
