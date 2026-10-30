import { describe, expect, test } from "vitest";
import { assertComplete, requireSector } from "./guards.mjs";

describe("assertComplete", () => {
  test("passes a response that finished normally", () => {
    expect(() => assertComplete({ stop_reason: "tool_use" }, "narrative")).not.toThrow();
    expect(() => assertComplete({ stop_reason: "end_turn" }, "narrative")).not.toThrow();
  });

  test("throws a clear error when the output hit max_tokens", () => {
    expect(() => assertComplete({ stop_reason: "max_tokens" }, "narrative")).toThrow(/narrative.*max_tokens/);
  });

  test("throws when the model refused", () => {
    expect(() => assertComplete({ stop_reason: "refusal" }, "regions")).toThrow(/regions.*refusal/);
  });
});

describe("requireSector", () => {
  test("returns the figures when TU410 had data", () => {
    const s = { latestQuarter: "2026Q2", turnoverMeur: 83.5, yoyPct: 12.1, lastFour: [] };
    expect(requireSector(s)).toBe(s);
  });

  test("refuses to continue without TU410 data rather than ask for an ungrounded paragraph", () => {
    expect(() => requireSector(null)).toThrow(/TU410/);
  });
});
