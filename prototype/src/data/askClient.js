// Browser side of the AI data explorer: one POST to the Cloudflare Worker
// (worker/), mapped to a small set of outcomes the panel can render. The
// Worker URL is public build config; with it unset the feature stays hidden.
const ASK_URL = import.meta.env.VITE_ASK_AI_URL;

export const ASK_AI_ENABLED = Boolean(ASK_URL);

export async function askAi(payload, { url = ASK_URL, fetchImpl = fetch, timeoutMs = 25_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      return { status: "limit", reason: body.reason === "daily" ? "daily" : "visitor" };
    }
    if (!res.ok) return { status: "error" };
    const b = await res.json();
    if (typeof b?.answer !== "string" || !Array.isArray(b.evidence)) return { status: "error" };
    return {
      status: "answer",
      answer: b.answer,
      evidence: b.evidence,
      note: b.note ?? null,
      unavailable: Boolean(b.unavailable),
      period: b.period ?? "",
      source: b.source ?? "",
    };
  } catch {
    return { status: "error" };
  } finally {
    clearTimeout(timer);
  }
}
