import { describe, expect, test } from "vitest";
import { ytdFigures, sectorFigures } from "./narrativeYtd.mjs";

// byPeriod rows shaped like generate-narrative.mjs builds them from TU131.
function months(fromYear, toYear, toMonth, row) {
  const map = new Map();
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === toYear && m > toMonth) break;
      map.set(`${y}M${String(m).padStart(2, "0")}`, row(y, m));
    }
  }
  return map;
}

const row = (y) => ({
  OCC_ARR_WORLD: y === 2026 ? 110 : 100,
  OCC_NI_WORLD: y === 2026 ? 220 : 200,
  OCC_ARR_EE: 60,
  OCC_ARR_FOR: y === 2026 ? 50 : 40,
});

describe("ytdFigures", () => {
  test("sums January through the latest month and compares with the same months a year earlier", () => {
    const byPeriod = months(2025, 2026, 8, row);
    const f = ytdFigures(byPeriod, [...byPeriod.keys()], "2026M08");
    expect(f).toEqual({
      months: 8,
      guests: 880,
      guestsYoyPct: 10,
      nights: 1760,
      nightsYoyPct: 10,
      domestic: 480,
      domesticYoyPct: 0,
      foreign: 400,
      foreignYoyPct: 25,
    });
  });

  test("returns null for a figure when a month is missing, instead of summing zeros", () => {
    const byPeriod = months(2025, 2026, 8, row);
    byPeriod.set("2026M03", { ...row(2026), OCC_ARR_FOR: null });
    const f = ytdFigures(byPeriod, [...byPeriod.keys()], "2026M08");
    expect(f.foreign).toBeNull();
    expect(f.foreignYoyPct).toBeNull();
    expect(f.guests).toBe(880);
  });

  test("handles January: the year to date is one month", () => {
    const byPeriod = months(2025, 2026, 1, row);
    const f = ytdFigures(byPeriod, [...byPeriod.keys()], "2026M01");
    expect(f.months).toBe(1);
    expect(f.guests).toBe(110);
    expect(f.guestsYoyPct).toBe(10);
  });
});

describe("sectorFigures", () => {
  test("gives the latest quarter's turnover and its change from the same quarter a year earlier", () => {
    const values = [40, 50, 70, 45, 44, 55, 77, 54]; // 2024Q1..2025Q4, M€
    const rows = values.map((value, i) => ({
      Näitaja: "CUB_SERV",
      Vaatlusperiood: `${2024 + Math.floor(i / 4)}Q${(i % 4) + 1}`,
      Vaatlusperiood_label: `${2024 + Math.floor(i / 4)} ${(i % 4) + 1}. kvartal`,
      value,
    }));
    const s = sectorFigures(rows);
    expect(s.latestQuarter).toBe("2025Q4");
    expect(s.turnoverMeur).toBe(54);
    expect(s.yoyPct).toBeCloseTo(20, 6);
    expect(s.lastFour.map((q) => q.period)).toEqual(["2025Q1", "2025Q2", "2025Q3", "2025Q4"]);
    expect(s.lastFour[0].pct).toBeCloseTo(10, 6);
  });

  test("returns null when there is no data", () => {
    expect(sectorFigures([])).toBeNull();
  });
});
