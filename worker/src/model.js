// The only file that talks to Anthropic. Structured output keeps the reply
// to ANSWER_SCHEMA; low effort because the work is wording, not reasoning.
import Anthropic from "@anthropic-ai/sdk";

export async function callModel(env, { system, user, schema }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 20_000 });
  try {
    const response = await client.messages.create({
      model: env.MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low", format: { type: "json_schema", schema } },
    });
    if (response.stop_reason === "refusal") return { ok: false, kind: "refusal" };
    if (response.stop_reason !== "end_turn") return { ok: false, kind: "error" };
    const text = response.content.find((b) => b.type === "text")?.text;
    return { ok: true, json: JSON.parse(text) };
  } catch (err) {
    if (err instanceof Anthropic.APIError || err instanceof SyntaxError) {
      console.error("model call failed", err.status ?? "", err.message);
      return { ok: false, kind: "error" };
    }
    throw err;
  }
}
