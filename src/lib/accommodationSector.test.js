// src/lib/accommodationSector.test.js
import { describe, it, expect } from "vitest";
import {
  computeRevenueSeries,
  computeIndexedSeries,
  computeEnterpriseCounts,
  computeHotelsVsOther,
  computeCostStructure,
  computeLatestRevenue,
  computeRevenueGrowth,
  computeGrowthHighlights,
  computeWageComparison,
} from "./accommodationSector.js";

const EMP_TOTAL = "Tööga hõivatud isikute arv";

function row(Näitaja, Tegevusala, Vaatlusperiood, value, label) {
  return { Näitaja, Tegevusala, [EMP_TOTAL]: "TOTAL", Vaatlusperiood, Vaatlusperiood_label: label ?? Vaatlusperiood, value };
}

describe("computeRevenueSeries", () => {
  it("filters to V12110 at I55 and sorts ascending by year", () => {
    const rows = [
      row("V12110", "I55", "2024", 450000),
      row("V12110", "I55", "2005", 120000),
      row("V12110", "I55", "2010", 200000),
      row("V11110", "I55", "2024", 900), // wrong Näitaja, must be excluded
      row("V12110", "I551", "2024", 300000), // wrong Tegevusala, must be excluded
    ];
    expect(computeRevenueSeries(rows)).toEqual([
      { year: "2005", value: 120000 },
      { year: "2010", value: 200000 },
      { year: "2024", value: 450000 },
    ]);
  });
});

describe("computeIndexedSeries", () => {
  it("indexes every point to the base year's value = 100", () => {
    const series = [{ year: "2010", value: 200 }, { year: "2011", value: 250 }, { year: "2012", value: 300 }];
    expect(computeIndexedSeries(series, "2011")).toEqual([
      { year: "2010", value: 200, index: 80 },
      { year: "2011", value: 250, index: 100 },
      { year: "2012", value: 300, index: 120 },
    ]);
  });

  it("returns null index for every point when the base year is absent", () => {
    const series = [{ year: "2010", value: 200 }];
    expect(computeIndexedSeries(series, "2011")).toEqual([{ year: "2010", value: 200, index: null }]);
  });
});

describe("computeEnterpriseCounts", () => {
  it("filters to V11110 at I55", () => {
    const rows = [row("V11110", "I55", "2024", 937), row("V12110", "I55", "2024", 450000)];
    expect(computeEnterpriseCounts(rows)).toEqual([{ year: "2024", count: 937 }]);
  });
});

describe("computeHotelsVsOther", () => {
  it("sums I552+I553+I559 into other, keeps I551 as hotels", () => {
    const rows = [
      row("V11110", "I551", "2024", 300),
      row("V11110", "I552", "2024", 200),
      row("V11110", "I553", "2024", 50),
      row("V11110", "I559", "2024", 387),
    ];
    expect(computeHotelsVsOther(rows)).toEqual([{ year: "2024", hotels: 300, other: 637 }]);
  });

  it("treats a missing sub-category as 0, not NaN", () => {
    const rows = [row("V11110", "I551", "2024", 300), row("V11110", "I552", "2024", 200)];
    // I553 and I559 absent entirely for 2024
    expect(computeHotelsVsOther(rows)).toEqual([{ year: "2024", hotels: 300, other: 200 }]);
  });
});

describe("computeCostStructure", () => {
  it("computes 'other' as the verified remainder against the real total", () => {
    const rows = [
      row("V13310", "I55", "2024", 100),
      row("CUB_C_100_110_120", "I55", "2024", 50),
      row("CUB_C_210", "I55", "2024", 30),
      row("CUB_C_400_410_420", "I55", "2024", 20),
      row("V13411", "I55", "2024", 10),
      row("CUB_C_705", "I55", "2024", 260),
    ];
    expect(computeCostStructure(rows, "2024")).toEqual({
      personnel: 100,
      resale: 50,
      materials: 30,
      energy: 20,
      rent: 10,
      other: 50, // 260 - (100+50+30+20+10)
      total: 260,
    });
  });

  it("returns null when the total (CUB_C_705) is missing for that year", () => {
    const rows = [row("V13310", "I55", "2024", 100)];
    expect(computeCostStructure(rows, "2024")).toBeNull();
  });
});

function tu410Row(Näitaja, period, value, label) {
  return { Näitaja, "Teenuse liik": "I55", Vaatlusperiood: period, Vaatlusperiood_label: label ?? period, value };
}
function pa113Row(Näitaja, Tegevusala, period, value, label) {
  return { Näitaja, Tegevusala, Vaatlusperiood: period, Vaatlusperiood_label: label ?? period, value };
}

describe("computeLatestRevenue", () => {
  it("returns the single most recent CUB_SERV point", () => {
    const rows = [tu410Row("CUB_SERV", "2026Q1", 45.2), tu410Row("CUB_SERV", "2026Q2", 48.1), tu410Row("CUB_SM", "2026Q2", 6.8)];
    expect(computeLatestRevenue(rows)).toEqual({ period: "2026Q2", label: "2026Q2", valueMillionEur: 48.1 });
  });

  it("returns null when there are no CUB_SERV rows", () => {
    expect(computeLatestRevenue([tu410Row("CUB_SM", "2026Q2", 6.8)])).toBeNull();
  });
});

describe("computeRevenueGrowth", () => {
  it("filters to CUB_SM and sorts ascending by period", () => {
    const rows = [tu410Row("CUB_SM", "2026Q2", 6.8), tu410Row("CUB_SM", "2025Q4", -2.1), tu410Row("CUB_SERV", "2026Q2", 48.1)];
    expect(computeRevenueGrowth(rows)).toEqual([
      { period: "2025Q4", label: "2025Q4", pct: -2.1 },
      { period: "2026Q2", label: "2026Q2", pct: 6.8 },
    ]);
  });
});

describe("computeGrowthHighlights", () => {
  it("picks the latest point, the max positive, and the min negative in the window", () => {
    const series = [
      { period: "2025Q1", label: "2025Q1", pct: 2 },
      { period: "2025Q2", label: "2025Q2", pct: 9.4 },
      { period: "2025Q3", label: "2025Q3", pct: -3.2 },
      { period: "2025Q4", label: "2025Q4", pct: 1 },
    ];
    expect(computeGrowthHighlights(series)).toEqual({
      latest: { period: "2025Q4", label: "2025Q4", pct: 1 },
      strongestIncrease: { period: "2025Q2", label: "2025Q2", pct: 9.4 },
      strongestDecline: { period: "2025Q3", label: "2025Q3", pct: -3.2 },
    });
  });

  it("returns null for strongestDecline when every value in the window is positive", () => {
    const series = [{ period: "2025Q1", label: "2025Q1", pct: 2 }, { period: "2025Q2", label: "2025Q2", pct: 5 }];
    const result = computeGrowthHighlights(series);
    expect(result.strongestDecline).toBeNull();
    expect(result.strongestIncrease).toEqual({ period: "2025Q2", label: "2025Q2", pct: 5 });
  });

  it("returns null for a mover whose magnitude doesn't clear minSignificantPct, even though it's the window's extreme", () => {
    const series = [{ period: "2025Q1", label: "2025Q1", pct: 0.3 }, { period: "2025Q2", label: "2025Q2", pct: -0.1 }];
    const result = computeGrowthHighlights(series, { minSignificantPct: 2 });
    expect(result.strongestIncrease).toBeNull();
    expect(result.strongestDecline).toBeNull();
    expect(result.latest).toEqual({ period: "2025Q2", label: "2025Q2", pct: -0.1 }); // latest has no significance floor
  });

  it("only considers the last windowSize entries", () => {
    const series = Array.from({ length: 20 }, (_, i) => ({ period: `P${i}`, label: `P${i}`, pct: i === 0 ? 99 : 5 }));
    const result = computeGrowthHighlights(series, { windowSize: 16 });
    expect(result.strongestIncrease.period).not.toBe("P0"); // P0 fell outside the last-16 window
  });
});

describe("computeWageComparison", () => {
  it("inner-joins I55 and TOTAL rows on matching period", () => {
    const rows = [
      pa113Row("GR_W_AVG", "I55", "2026Q1", 1450),
      pa113Row("GR_W_AVG", "TOTAL", "2026Q1", 2100),
      pa113Row("GR_W_AVG", "I55", "2026Q2", 1500),
      pa113Row("GR_W_AVG", "TOTAL", "2026Q2", 2150),
      pa113Row("GR_W_AVG_SM", "I55", "2026Q2", 5.1), // wrong Näitaja, excluded
    ];
    expect(computeWageComparison(rows)).toEqual([
      { period: "2026Q1", label: "2026Q1", accommodation: 1450, allActivities: 2100 },
      { period: "2026Q2", label: "2026Q2", accommodation: 1500, allActivities: 2150 },
    ]);
  });

  it("drops a period present for only one side", () => {
    const rows = [
      pa113Row("GR_W_AVG", "I55", "2026Q1", 1450),
      pa113Row("GR_W_AVG", "TOTAL", "2026Q1", 2100),
      pa113Row("GR_W_AVG", "I55", "2026Q2", 1500), // TOTAL for 2026Q2 not yet published
    ];
    expect(computeWageComparison(rows)).toEqual([{ period: "2026Q1", label: "2026Q1", accommodation: 1450, allActivities: 2100 }]);
  });
});
