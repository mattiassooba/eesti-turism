import { describe, expect, test } from "vitest";
import { buildColumns, chartYears, shareChartSeries, occupancyChartSeries, originsByColumn } from "./operatorTable.js";
import { makeFixture } from "./testFixtures.js";

const TARTU = "EE00790000000000";
const f = makeFixture({
  fromYear: 2017,
  toYear: 2026,
  toMonth: 8,
  annual: { EE: (y) => 3_000_000 + (y - 2017) * 100_000, [TARTU]: () => 240_000 },
});
const cols = (code = "EE") => buildColumns({ ...f, code, res: "WORLD", latest: f.tourism.latest, locale: "et" });

describe("operatorTable", () => {
  test("columns are full years from 2020 to last year plus the latest month in each of the last three years", () => {
    expect(cols().map((c) => c.key)).toEqual(["2020", "2021", "2022", "2023", "2024", "2025", "2024M08", "2025M08", "2026M08"]);
  });

  test("cumulative figures exist only on month columns and equal the Jan–month sum", () => {
    const c = cols();
    expect(c.filter((x) => x.kind === "year").every((x) => x.cumulative === null)).toBe(true);
    const jan = f.tourism.periods.indexOf("2026M01");
    const aug = f.tourism.periods.indexOf("2026M08");
    const expected = f.tourism.get("OCC_ARR", "EE").slice(jan, aug + 1).reduce((a, b) => a + b, 0);
    expect(c.at(-1).cumulative).toBe(expected);
  });

  test("revpar is occupancy % × average price", () => {
    for (const c of cols(TARTU)) expect(c.revpar).toBeCloseTo((55.5 / 100) * 77.7, 6);
  });

  test("chartYears returns the last n years present in the data", () => {
    expect(chartYears(f.tourism, 10)).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });

  test("shareChartSeries flags the partial current year and gives the county's % of Estonia", () => {
    const s = shareChartSeries({ tourism: f.tourism, code: TARTU, years: chartYears(f.tourism, 10) });
    expect(s.partial.at(-1)).toBe(true);
    expect(s.partial.slice(0, -1).every((p) => p === false)).toBe(true);
    expect(s.sharePct[0]).toBeCloseTo((240_000 / 3_000_000) * 100, 6);
    expect(s.national[0]).toBe(3_000_000);
  });

  test("occupancyChartSeries yields null, not 0, where price is missing", () => {
    const g = makeFixture({ fromYear: 2023, toYear: 2025, toMonth: 12, annual: { [TARTU]: () => 1000 } });
    const cost = g.capacity.get("OCC_NI_COST", TARTU);
    g.capacity.periods.forEach((p, i) => p.startsWith("2024") && (cost[i] = null));
    const s = occupancyChartSeries({ capacity: g.capacity, code: TARTU, years: [2023, 2024, 2025] });
    expect(s.arr[1]).toBeNull();
    expect(s.revpar[1]).toBeNull();
    expect(s.occ[1]).toBeCloseTo(55.5, 6);
  });

  test("originsByColumn ranks countries per column, highest first, up to the limit", () => {
    const periods = f.tourism.periods;
    const nights = { FI: 300, LV: 100, DE: 200 };
    const origins = { periods, get: (code) => periods.map(() => nights[code] ?? null) };
    const map = originsByColumn(origins, cols(TARTU), "et", 2);
    const top = map.get("2025");
    expect(top.map((o) => o.code)).toEqual(["FI", "DE"]);
    expect(top[0].value).toBe(300 * 12);
    expect(map.get("2026M08")[0].value).toBe(300);
  });
});
