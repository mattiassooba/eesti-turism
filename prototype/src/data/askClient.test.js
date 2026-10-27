import { describe, expect, test } from "vitest";
import { askAi } from "./askClient.js";

const payload = { question: "Võrdle Harjumaad ja Tartumaad", locale: "et", selected: { region: "ee", compare: null }, packet: { v: 1 } };
const URL = "http://localhost:8787/";

const respond = (status, body) => async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const ask = (fetchImpl, extra) => askAi(payload, { url: URL, fetchImpl, ...extra });

describe("askAi", () => {
  test("200 → answer result", async () => {
    const body = { answer: "Harjumaa on suurim.", evidence: ["2025: 1 200 000"], note: null, unavailable: false, period: "2025", source: "Statistikaamet TU131, TU122", cached: false };
    expect(await ask(respond(200, body))).toEqual({
      status: "answer",
      answer: "Harjumaa on suurim.",
      evidence: ["2025: 1 200 000"],
      note: null,
      unavailable: false,
      period: "2025",
      source: "Statistikaamet TU131, TU122",
    });
  });

  test("429 daily → limit with reason daily", async () => {
    expect(await ask(respond(429, { error: "limit", reason: "daily" }))).toEqual({ status: "limit", reason: "daily" });
  });

  test("429 visitor → limit with reason visitor", async () => {
    expect(await ask(respond(429, { error: "limit", reason: "visitor" }))).toEqual({ status: "limit", reason: "visitor" });
  });

  test("400 / 500 / 502 → error", async () => {
    for (const status of [400, 500, 502]) expect(await ask(respond(status, { error: "x" }))).toEqual({ status: "error" });
  });

  test("network rejection → error", async () => {
    expect(await ask(async () => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ status: "error" });
  });

  test("200 with malformed or wrongly shaped JSON → error", async () => {
    expect(await ask(respond(200, "{oops"))).toEqual({ status: "error" });
    expect(await ask(respond(200, { hello: "world" }))).toEqual({ status: "error" });
  });

  test("a request that hangs past the timeout → error", async () => {
    const hang = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    expect(await ask(hang, { timeoutMs: 20 })).toEqual({ status: "error" });
  });

  test("POSTs JSON with question, locale, selected and packet to the given url", async () => {
    let seen;
    await ask(async (url, init) => {
      seen = { url, init };
      return new Response("{}", { status: 500 });
    });
    expect(seen.url).toBe(URL);
    expect(seen.init.method).toBe("POST");
    expect(seen.init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(seen.init.body)).toEqual(payload);
  });
});
