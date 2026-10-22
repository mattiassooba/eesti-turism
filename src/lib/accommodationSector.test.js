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
  computeLatestKpis,
  buildRevenueInsight,
  buildGrowthInsight,
  buildBusinessInsight,
  buildWageInsight,
  buildCostInsight,
  buildSectionOverview,
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
  it("computes YoY %% directly from CUB_SERV, comparing each period against its t-4 quarter", () => {
    const rows = [
      tu410Row("CUB_SERV", "2025Q2", 100, "2025 II kvartal"),
      tu410Row("CUB_SERV", "2025Q3", 105, "2025 III kvartal"),
      tu410Row("CUB_SERV", "2025Q4", 110, "2025 IV kvartal"),
      tu410Row("CUB_SERV", "2026Q1", 115, "2026 I kvartal"),
      tu410Row("CUB_SERV", "2026Q2", 120, "2026 II kvartal"),
    ];
    // Only 2026Q2 has a t-4 comparison point (2025Q2) within this 5-period
    // fixture; (120-100)/100*100 = 20%.
    expect(computeRevenueGrowth(rows)).toEqual([{ period: "2026Q2", label: "2026 II kvartal", pct: 20 }]);
  });

  it("sorts input by period ascending before comparing, regardless of input order", () => {
    const rows = [
      tu410Row("CUB_SERV", "2026Q2", 120),
      tu410Row("CUB_SERV", "2025Q4", 110),
      tu410Row("CUB_SERV", "2025Q3", 105),
      tu410Row("CUB_SERV", "2025Q2", 100),
      tu410Row("CUB_SERV", "2026Q1", 115),
    ];
    const result = computeRevenueGrowth(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ period: "2026Q2", label: "2026Q2", pct: 20 });
  });

  it("returns an empty array when there are fewer than 5 periods (no t-4 comparison possible)", () => {
    const rows = [tu410Row("CUB_SERV", "2026Q1", 100), tu410Row("CUB_SERV", "2026Q2", 110)];
    expect(computeRevenueGrowth(rows)).toEqual([]);
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

describe("computeLatestKpis", () => {
  it("assembles all 4 KPIs from their own source's latest entry", () => {
    const latestRevenue = { period: "2026Q2", label: "2026Q2", valueMillionEur: 48.1 };
    const growthHighlights = { latest: { period: "2026Q2", label: "2026Q2", pct: 6.8 }, strongestIncrease: null, strongestDecline: null };
    const enterpriseCounts = [{ year: "2023", count: 900 }, { year: "2024", count: 937 }];
    const wageComparison = [{ period: "2026Q1", label: "2026Q1", accommodation: 1450, allActivities: 2100 }, { period: "2026Q2", label: "2026Q2", accommodation: 1500, allActivities: 2150 }];
    expect(computeLatestKpis({ latestRevenue, growthHighlights, enterpriseCounts, wageComparison })).toEqual({
      revenue: { value: 48.1, period: "2026Q2" },
      revenueYoy: { value: 6.8, period: "2026Q2" },
      businessCount: { value: 937, period: "2024" },
      avgWage: { value: 1500, period: "2026Q2" },
    });
  });

  it("returns null for a KPI whose own source is empty, without affecting the others", () => {
    const result = computeLatestKpis({ latestRevenue: null, growthHighlights: { latest: null, strongestIncrease: null, strongestDecline: null }, enterpriseCounts: [{ year: "2024", count: 937 }], wageComparison: [] });
    expect(result.revenue).toBeNull();
    expect(result.revenueYoy).toBeNull();
    expect(result.businessCount).toEqual({ value: 937, period: "2024" });
    expect(result.avgWage).toBeNull();
  });
});

describe("insight builders", () => {
  it("buildRevenueInsight phrases an increase in Estonian and English", () => {
    const latestRevenue = { period: "2026Q2", label: "2026 II kvartal", valueMillionEur: 48.1 };
    const growthHighlights = { latest: { period: "2026Q2", label: "2026 II kvartal", pct: 6.8 }, strongestIncrease: null, strongestDecline: null };
    const et = buildRevenueInsight(latestRevenue, growthHighlights, "et");
    expect(et).toContain("kasvades");
    expect(et).toContain("2026 II kvartal");
    expect(et).not.toContain("2026Q2");
    const en = buildRevenueInsight({ ...latestRevenue, label: "2026 Q2" }, growthHighlights, "en");
    expect(en).toContain("up");
    expect(en).toContain("2026 Q2");
    expect(en).not.toContain("2026Q2");
  });

  it("buildRevenueInsight returns null when either input is null", () => {
    expect(buildRevenueInsight(null, { latest: null }, "et")).toBeNull();
  });

  it("buildCostInsight names the actual largest category", () => {
    const cost = { personnel: 100, resale: 50, materials: 30, energy: 20, rent: 10, other: 50, total: 260 };
    const insight = buildCostInsight(cost, "en");
    expect(insight).toContain("personnel costs");
    expect(insight).toContain("38%"); // 100/260
  });

  it("buildCostInsight excludes 'other' from the largest-category comparison even when it's numerically the biggest of the 6", () => {
    // other (120) is the single biggest of the 6 fields, but it's a
    // computed remainder, not a real spending category — personnel (90) is
    // the largest of the 5 *named* categories and must be the one named.
    const cost = { personnel: 90, resale: 50, materials: 30, energy: 20, rent: 10, other: 120, total: 320 };
    const insight = buildCostInsight(cost, "en");
    expect(insight).toContain("personnel costs");
    expect(insight).not.toContain("other operating costs");
  });

  it("buildGrowthInsight returns null without a latest point, and phrases a fall in English", () => {
    expect(buildGrowthInsight({ latest: null }, "en")).toBeNull();
    expect(buildGrowthInsight({ latest: { period: "2026Q2", label: "2026 Q2", pct: -1.5 } }, "en")).toBe(
      "Accommodation-sector revenue fell 1.5% in 2026 Q2.",
    );
  });

  it("buildGrowthInsight uses the human label in Estonian, without the broken 'kvartalis' form", () => {
    const sentence = buildGrowthInsight({ latest: { period: "2026Q2", label: "2026 II kvartal", pct: 6.8 } }, "et");
    expect(sentence).toBe("Majutussektori käive kasvas 6,8% (2026 II kvartal).");
    expect(sentence).not.toContain("kvartalis");
  });

  it("buildBusinessInsight rounds the hotel share from the matching year", () => {
    const counts = [{ year: "2023", count: 900 }, { year: "2024", count: 937 }];
    const hotelsVsOther = [{ year: "2023", hotels: 300, other: 600 }, { year: "2024", hotels: 300, other: 637 }];
    expect(buildBusinessInsight(counts, hotelsVsOther, "en")).toBe(
      "Estonia had 937 accommodation businesses in 2024, 32% of them hotels.",
    );
    expect(buildBusinessInsight(counts, hotelsVsOther, "et")).toContain("2024. aastal");
  });

  it("buildBusinessInsight returns null when the count or the matching hotel split is missing", () => {
    expect(buildBusinessInsight([], [], "en")).toBeNull();
    expect(buildBusinessInsight([{ year: "2024", count: 937 }], [{ year: "2023", hotels: 1, other: 1 }], "en")).toBeNull();
  });

  it("buildWageInsight compares the latest accommodation wage against the all-activities average", () => {
    const wages = [{ period: "2026Q2", label: "2026 Q2", accommodation: 1500, allActivities: 2150 }];
    expect(buildWageInsight(wages, "en")).toBe(
      "Accommodation-sector average gross wage was €1,500 in 2026 Q2, versus Estonia's €2,150 average.",
    );
    const et = buildWageInsight([{ period: "2026Q2", label: "2026 II kvartal", accommodation: 1500, allActivities: 2150 }], "et");
    expect(et).toContain("(2026 II kvartal)");
    expect(et).not.toContain("2026Q2");
    expect(buildWageInsight([], "en")).toBeNull();
  });

  it("buildCostInsight returns null when there is no cost structure", () => {
    expect(buildCostInsight(null, "en")).toBeNull();
  });
});

describe("buildSectionOverview", () => {
  it("joins the 4 given insight sentences, in order, with a single space", () => {
    expect(
      buildSectionOverview({
        revenueInsight: "Revenue sentence.",
        growthInsight: "Growth sentence.",
        wageInsight: "Wage sentence.",
        costInsight: "Cost sentence.",
      }),
    ).toBe("Revenue sentence. Growth sentence. Wage sentence. Cost sentence.");
  });

  it("skips any insight that's null instead of leaving a gap", () => {
    expect(
      buildSectionOverview({
        revenueInsight: "Revenue sentence.",
        growthInsight: null,
        wageInsight: "Wage sentence.",
        costInsight: null,
      }),
    ).toBe("Revenue sentence. Wage sentence.");
  });

  it("returns null when none of the 4 insights are available", () => {
    expect(
      buildSectionOverview({ revenueInsight: null, growthInsight: null, wageInsight: null, costInsight: null }),
    ).toBeNull();
  });
});
