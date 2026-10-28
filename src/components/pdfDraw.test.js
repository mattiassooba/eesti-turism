import { describe, expect, test } from "vitest";
import { fitColumns, niceScale, pdfText, tableHeight } from "./pdfDraw.js";

describe("fitColumns", () => {
  test("keeps all columns and shares the spare width when they fit", () => {
    const r = fitColumns(100, [40, 40, 40], 400);
    expect(r.dropFirst).toBe(0);
    expect(r.widths).toHaveLength(3);
    expect(100 + r.widths.reduce((a, b) => a + b, 0)).toBeCloseTo(400, 6);
    expect(r.widths.every((w) => w >= 40)).toBe(true);
  });

  test("drops the earliest columns rather than squeezing below their minimum width", () => {
    const r = fitColumns(130, [45, 45, 45, 45, 45, 45, 50, 50, 50], 420);
    expect(r.dropFirst).toBe(3); // 130 + 4×45 + 150 = 460 > 420; dropping 3 leaves 415
    expect(r.widths).toHaveLength(6);
    expect(130 + r.widths.reduce((a, b) => a + b, 0)).toBeCloseTo(420, 6);
  });

  test("never drops the last column", () => {
    const r = fitColumns(300, [80, 80, 80], 360);
    expect(r.widths).toHaveLength(1);
    expect(r.dropFirst).toBe(2);
  });
});

describe("niceScale", () => {
  test("starts at zero for positive data and ends on a round number", () => {
    expect(niceScale(0, 3_693_465, 4)).toEqual({ min: 0, max: 4_000_000, step: 1_000_000 });
  });

  test("spans negative and positive values with zero on a tick", () => {
    const s = niceScale(-84, 231, 6);
    expect(s.min).toBeLessThanOrEqual(-84);
    expect(s.max).toBeGreaterThanOrEqual(231);
    expect((0 - s.min) % s.step).toBe(0);
  });

  test("handles an all-zero or empty range", () => {
    const s = niceScale(0, 0, 4);
    expect(s.max).toBeGreaterThan(s.min);
  });
});

describe("pdfText", () => {
  test("replaces characters the PDF's built-in font can't print", () => {
    expect(pdfText("−5,4%")).toBe("-5,4%");
    expect(pdfText("1 234")).toBe("1 234");
    expect(pdfText("ööpäev — 49,67 € ±0,0% × õ š ž")).toBe("ööpäev — 49,67 € ±0,0% × õ š ž");
  });

  test("turns null and undefined into an em dash", () => {
    expect(pdfText(null)).toBe("—");
    expect(pdfText(undefined)).toBe("—");
  });
});

describe("tableHeight", () => {
  test("grows for rows whose cells have two lines", () => {
    const one = tableHeight([{ label: "a", cells: ["1", "2"] }]);
    const two = tableHeight([{ label: "a", cells: ["Soome\n87,2 tuh.", "2"] }]);
    expect(two).toBeGreaterThan(one);
  });

  test("grows for two-line column headers", () => {
    const rows = [{ label: "a", cells: ["1"] }];
    expect(tableHeight(rows, ["2024\nAUGUST"])).toBeGreaterThan(tableHeight(rows, ["2024"]));
  });
});
