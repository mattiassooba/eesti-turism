// Rate limits and answer cache, all in one Workers KV namespace. KV is
// eventually consistent, so the counts are approximate under bursts; the
// spend cap on the Anthropic key is the hard backstop. Visitor IPs are only
// ever stored as SHA-256 hashes.
const DAY_TTL = 172800;
const HOUR_TTL = 7200;
const CACHE_TTL = 604800;

function tallinnParts(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

export function tallinnDate(now) {
  const p = tallinnParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

function tallinnHour(now) {
  const p = tallinnParts(now);
  return `${p.year}-${p.month}-${p.day}T${p.hour}`;
}

export async function hashKey(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const dayKey = (now) => `day:${tallinnDate(now)}`;
const visitorKey = (ipHash, now) => `ip:${ipHash}:${tallinnHour(now)}`;

async function readCount(kv, key) {
  return Number((await kv.get(key, "text")) ?? 0) || 0;
}

export async function checkLimits(kv, { ipHash, now, dailyLimit, visitorLimit }) {
  if ((await readCount(kv, dayKey(now))) >= dailyLimit) return { ok: false, reason: "daily" };
  if ((await readCount(kv, visitorKey(ipHash, now))) >= visitorLimit) return { ok: false, reason: "visitor" };
  return { ok: true };
}

export async function countRequest(kv, { ipHash, now }) {
  const day = dayKey(now);
  const visitor = visitorKey(ipHash, now);
  await kv.put(day, String((await readCount(kv, day)) + 1), { expirationTtl: DAY_TTL });
  await kv.put(visitor, String((await readCount(kv, visitor)) + 1), { expirationTtl: HOUR_TTL });
}

export async function getCached(kv, key) {
  return (await kv.get(`ans:${key}`, "json")) ?? null;
}

export async function putCached(kv, key, value) {
  await kv.put(`ans:${key}`, JSON.stringify(value), { expirationTtl: CACHE_TTL });
}
