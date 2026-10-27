# AI data explorer Worker ("Küsi andmete kohta")

This small Cloudflare Worker answers the questions visitors type into the
"✦ Küsi AI-lt" panel on turismistatistika.ee.

The browser computes all the numbers from Statistikaamet data and sends them
here together with the question. The Worker does five things in order:

1. checks the request
2. applies the limits
3. asks Claude Haiku to word an answer from those numbers only
4. checks the reply
5. sends it back

The Anthropic API key exists only here, as a Cloudflare secret.

Design: `docs/superpowers/specs/2026-10-27-ai-data-explorer-design.md`.

## One-time setup

Run these in a terminal, from the repository root.

1. **Create a free Cloudflare account** at https://dash.cloudflare.com/sign-up.
2. **Install and log in:**
   ```
   cd worker
   npm install
   npx wrangler login
   ```
3. **Create the storage for limits and cached answers:**
   ```
   npx wrangler kv namespace create ASK_KV
   ```
   Copy the `id` it prints into `wrangler.toml`, replacing
   `REPLACE_WITH_KV_NAMESPACE_ID`.
4. **Create a dedicated Anthropic API key** for this feature in the Anthropic
   Console. In the Console, also set a **monthly spend limit**; this is the
   hard backstop if anything else fails.
5. **Store the key in Cloudflare.** This command asks you to paste the key:
   ```
   npx wrangler secret put ANTHROPIC_API_KEY
   ```
6. **Deploy:**
   ```
   npx wrangler deploy
   ```
   Note the address it prints, e.g.
   `https://turismistatistika-ask.<your-name>.workers.dev`.
7. **Point the site at the Worker.** In GitHub, go to the repository's
   Settings → Secrets and variables → Actions → **Variables**. Add a
   variable named `ASK_AI_URL` set to that address.
8. **Rebuild the site:** go to Actions → "Deploy to GitHub Pages" → Run
   workflow.

The "Küsi AI-lt" button only appears once `ASK_AI_URL` is set. To take the
feature offline, delete the variable and run step 8 again.

## Limits and cost

| Setting (in `wrangler.toml`) | Value | Meaning |
|---|---|---|
| `DAILY_LIMIT` | 50 | Questions per day for the whole site (Estonian time) |
| `VISITOR_HOURLY_LIMIT` | 5 | Questions per visitor per hour |
| `MODEL` | `claude-haiku-5-5` | The Claude model that writes the answers |

Only questions that actually reach Claude count toward the limits. Repeated
questions about the same data are answered from a 7-day cache for free.

The limits are approximate under heavy bursts. At 50 a day the worst case is
roughly $3 a month on Haiku.

To change a setting, edit `wrangler.toml` and run `npx wrangler deploy`
again.

**Switching model:** set `MODEL` to e.g. `claude-sonnet-5-5`, then deploy.
Sonnet costs about 20× more per question.

## Local testing

1. Copy `.dev.vars.example` to `.dev.vars` and put the API key in it. This
   file is gitignored.
2. Run `npm run dev`. The Worker listens on http://localhost:8787 and uses a
   local, simulated KV.
3. In another terminal, from the repository root, start the site with
   `VITE_ASK_AI_URL=http://localhost:8787 npm run dev`.

The automated tests run with the rest of the repo's tests (`npm test` at the
root). They never call Anthropic.
