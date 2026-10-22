// src/lib/accommodationSector.test.js
import { describe, it, expect } from "vitest";
import {
  computeRevenueSeries,
  computeIndexedSeries,
  computeEnterpriseCounts,
  computeHotelsVsOther,
  computeCostStructure,
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
