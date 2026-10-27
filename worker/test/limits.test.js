import { describe, expect, test } from "vitest";
import { tallinnDate, hashKey, checkLimits, countRequest, getCached, putCached } from "../src/limits.js";
import { fakeKv } from "./fakeKv.js";

const NOW = new Date("2026-10-27T10:15:00Z");
const opts = (ipHash, now = NOW) => ({ ipHash, now, dailyLimit: 50, visitorLimit: 5 });

describe("limits", () => {
  test("tallinnDate uses Europe/Tallinn", () => {
    expect(tallinnDate(new Date("2026-10-27T22:30:00Z"))).toBe("2026-10-28");
    expect(tallinnDate(new Date("2026-10-27T20:30:00Z"))).toBe("2026-10-27");
  });

  test("a fresh visitor is allowed", async () => {
    expect(await checkLimits(fakeKv(), opts("a"))).toEqual({ ok: true });
  });

  test("visitor limit trips at 5 within the hour", async () => {
    const kv = fakeKv();
    for (let i = 0; i < 4; i++) await countRequest(kv, { ipHash: "a", now: NOW });
    expect(await checkLimits(kv, opts("a"))).toEqual({ ok: true });
    await countRequest(kv, { ipHash: "a", now: NOW });
    expect(await checkLimits(kv, opts("a"))).toEqual({ ok: false, reason: "visitor" });
    expect(await checkLimits(kv, opts("b"))).toEqual({ ok: true });
  });

  test("daily limit trips at 50 across many visitors", async () => {
    const kv = fakeKv();
    for (let i = 0; i < 50; i++) await countRequest(kv, { ipHash: `v${i}`, now: NOW });
    expect(await checkLimits(kv, opts("new"))).toEqual({ ok: false, reason: "daily" });
  });

  test("daily is reported before visitor when both hit", async () => {
    const kv = fakeKv();
    for (let i = 0; i < 5; i++) await countRequest(kv, { ipHash: "a", now: NOW });
    for (let i = 0; i < 45; i++) await countRequest(kv, { ipHash: `v${i}`, now: NOW });
    expect(await checkLimits(kv, opts("a"))).toEqual({ ok: false, reason: "daily" });
  });

  test("a new hour resets the visitor counter, and a new day the daily one", async () => {
    const kv = fakeKv();
    for (let i = 0; i < 5; i++) await countRequest(kv, { ipHash: "a", now: NOW });
    expect(await checkLimits(kv, opts("a", new Date("2026-10-27T11:01:00Z")))).toEqual({ ok: true });
    for (let i = 0; i < 50; i++) await countRequest(kv, { ipHash: `v${i}`, now: NOW });
    expect(await checkLimits(kv, opts("z", new Date("2026-10-28T09:00:00Z")))).toEqual({ ok: true });
  });

  test("counters expire on their own", async () => {
    const kv = fakeKv();
    await countRequest(kv, { ipHash: "a", now: NOW });
    const ttls = [...kv.store.values()].map((e) => e.ttl).sort((a, b) => a - b);
    expect(ttls).toEqual([7200, 172800]);
  });

  test("cache round-trips JSON with a 7-day TTL", async () => {
    const kv = fakeKv();
    expect(await getCached(kv, "k")).toBeNull();
    await putCached(kv, "k", { answer: "Tere", evidence: ["1"] });
    expect(await getCached(kv, "k")).toEqual({ answer: "Tere", evidence: ["1"] });
    expect(kv.store.get("ans:k").ttl).toBe(604800);
  });

  test("hashKey is a stable hex digest that never contains the input", async () => {
    const h = await hashKey("203.0.113.7");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("203.0.113.7");
    expect(await hashKey("203.0.113.7")).toBe(h);
  });
});
