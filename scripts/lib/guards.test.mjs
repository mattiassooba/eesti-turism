import { describe, expect, test } from "vitest";
import { assertComplete, requireSector, normalizeSections, withRetries, keepFirstInsights } from "./guards.mjs";

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

describe("normalizeSections", () => {
  test("keeps objects and parses sections that came back as JSON strings", () => {
    const out = normalizeSections({ a: { et: "x", en: "y" }, b: '{"et":"p","en":"q"}' });
    expect(out).toEqual({ a: { et: "x", en: "y" }, b: { et: "p", en: "q" } });
  });

  test("names the section and shows what came back when a string isn't JSON", () => {
    expect(() => normalizeSections({ sector: "placeholder text from the model" })).toThrow(/sections\.sector.*placeholder text from the model/);
  });
});

describe("withRetries", () => {
  test("returns the first successful attempt without retrying", async () => {
    const calls = [];
    expect(await withRetries(async (n) => (calls.push(n), "ok"), { tries: 2, log: () => {} })).toBe("ok");
    expect(calls).toEqual([1]);
  });

  test("retries after a failure and returns the later success", async () => {
    const calls = [];
    const result = await withRetries(
      async (n) => {
        calls.push(n);
        if (n === 1) throw new Error("QA failed");
        return "second";
      },
      { tries: 2, log: () => {} }
    );
    expect(result).toBe("second");
    expect(calls).toEqual([1, 2]);
  });

  test("gives up after the last try and rethrows its error", async () => {
    await expect(
      withRetries(async (n) => {
        throw new Error(`fail ${n}`);
      }, { tries: 2, log: () => {} })
    ).rejects.toThrow("fail 2");
  });
});

describe("keepFirstInsights", () => {
  test("trims extra key insights to the first three", () => {
    const s = keepFirstInsights({ keyInsights: [1, 2, 3, 4].map((i) => ({ et: `e${i}`, en: `n${i}` })) });
    expect(s.keyInsights.map((k) => k.et)).toEqual(["e1", "e2", "e3"]);
  });

  test("leaves three or fewer untouched (QA judges a short list)", () => {
    const two = [{ et: "a", en: "b" }, { et: "c", en: "d" }];
    expect(keepFirstInsights({ keyInsights: two }).keyInsights).toEqual(two);
  });
});
