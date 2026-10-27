// Request flow for the AI data explorer, free of Cloudflare globals so it can
// be tested under vitest: CORS → size → validation → cache → limits →
// model → answer check → cache. deps = { kv, callModel, now }.
import { MAX_BODY_BYTES } from "../../src/lib/askShape.js";
import { validateRequest } from "./validate.js";
import { checkLimits, countRequest, getCached, putCached, hashKey, tallinnDate } from "./limits.js";
import { SYSTEM_PROMPT, ANSWER_SCHEMA, buildUserMessage, validateAnswer } from "./prompt.js";

const SOURCE = "Statistikaamet TU131, TU122";
const LOCALHOST = /^http:\/\/localhost:\d+$/;

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin || !(allowed.includes(origin) || LOCALHOST.test(origin))) return { Vary: "Origin" };
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

function reply(status, body, cors) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
}

export async function handleRequest(request, env, deps) {
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" },
    });
  }
  if (request.method !== "POST") return reply(405, { error: "method" }, cors);

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return reply(400, { error: "invalid" }, cors);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(400, { error: "invalid" }, cors);
    }
    const checked = validateRequest(body);
    if (!checked.ok) return reply(400, { error: "invalid" }, cors);
    const { question, locale, selected, packet } = checked.value;

    // Model and instructions are part of the key, so changing either one
    // never serves answers written under the old setup.
    const cacheKey = await hashKey(JSON.stringify({ model: env.MODEL, prompt: SYSTEM_PROMPT, q: question.toLowerCase(), locale, selected, packet }));
    const cached = await getCached(deps.kv, cacheKey);
    if (cached) return reply(200, { ...cached, source: SOURCE, cached: true }, cors);

    const now = deps.now();
    // Salted with the date, so stored hashes can't be matched across days.
    const ipHash = await hashKey(`${request.headers.get("CF-Connecting-IP") ?? "unknown"}|${tallinnDate(now)}`);
    const limit = await checkLimits(deps.kv, {
      ipHash,
      now,
      dailyLimit: Number(env.DAILY_LIMIT) || 50,
      visitorLimit: Number(env.VISITOR_HOURLY_LIMIT) || 5,
    });
    if (!limit.ok) return reply(429, { error: "limit", reason: limit.reason }, cors);
    await countRequest(deps.kv, { ipHash, now });

    const result = await deps.callModel(env, { system: SYSTEM_PROMPT, user: buildUserMessage(checked.value), schema: ANSWER_SCHEMA });
    if (!result.ok || !validateAnswer(result.json)) return reply(502, { error: "upstream" }, cors);
    const answer = { ...result.json, evidence: result.json.evidence.slice(0, 4) };
    await putCached(deps.kv, cacheKey, answer);
    return reply(200, { ...answer, source: SOURCE, cached: false }, cors);
  } catch (err) {
    console.error("ask handler failed", err);
    return reply(500, { error: "server" }, cors);
  }
}
