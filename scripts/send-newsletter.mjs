// Triggers the Mailchimp newsletter send from the narrative already
// written to public/data/narrative.json by generate-narrative.mjs. Run as
// a second step in the same workflow, after that script succeeds.
//
// Usage: node scripts/send-newsletter.mjs [--dry-run]
//
// Required env vars:
//   MAILCHIMP_API_KEY            — format "<key>-<dc>", e.g. "abc123-us21"
//   MAILCHIMP_LIST_ID            — the Audience ID
//   MAILCHIMP_CADENCE_CATEGORY_ID, MAILCHIMP_CADENCE_MONTHLY_ID, MAILCHIMP_CADENCE_QUARTERLY_ID
//   MAILCHIMP_LANGUAGE_CATEGORY_ID, MAILCHIMP_LANGUAGE_ET_ID, MAILCHIMP_LANGUAGE_EN_ID
// Optional:
//   MAILCHIMP_FROM_NAME (default "Eesti Turism"), MAILCHIMP_REPLY_TO

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NARRATIVE_PATH = path.join(__dirname, "..", "public", "data", "narrative.json");
const SITE_URL = "https://turismistatistika.ee/";

const SUBJECT = {
  et: (periodLabel) => `Eesti turismistatistika — ${periodLabel}`,
  en: (periodLabel) => `Estonian tourism statistics — ${periodLabel}`,
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

// isQuarterMonth is stateless calendar arithmetic (not a persisted
// counter) so it's immune to drift if a scheduled run is ever skipped or
// manually re-triggered — quarterly sends simply fire whenever the
// workflow happens to run during a quarter-start month.
export function isQuarterMonth(date) {
  return date.getUTCMonth() % 3 === 0;
}

function buildEmailHtml({ text, periodLabel, locale }) {
  const heading = locale === "en" ? "Estonian tourism statistics" : "Eesti turismistatistika";
  const unsubscribe = locale === "en" ? "Unsubscribe" : "Loobu tellimusest";
  const viewOnline = locale === "en" ? "View the full dashboard" : "Vaata täielikku armatuurlauda";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef0ee;font-family:Georgia,'Times New Roman',serif;color:#101b26;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0ee;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#0f3a57;color:#eef0ee;padding:24px 32px;">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7;">${heading}</div>
            <div style="font-size:20px;font-weight:600;margin-top:4px;">${periodLabel}</div>
          </td></tr>
          <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 20px;">${text}</p>
            <a href="${SITE_URL}" style="color:#2b6ca3;">${viewOnline} →</a>
          </td></tr>
          <tr><td style="padding:16px 32px;border-top:1px solid #dbe0df;font-size:11px;color:#5b6b7a;">
            *|IFNOT:ARCHIVE_PAGE|**|LIST:DESCRIPTION|*<br>
            <a href="*|UNSUB|*" style="color:#5b6b7a;">${unsubscribe}</a> ·
            *|UPDATE_PROFILE|**|END:IF|*
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function mailchimp(apiKey, dc, method, endpoint, body) {
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0${endpoint}`, {
    method,
    headers: {
      Authorization: `apikey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Mailchimp ${method} ${endpoint} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function sendCampaign({ apiKey, dc, listId, cadence, language, narrative, dryRun }) {
  const cadenceCategoryId = requireEnv("MAILCHIMP_CADENCE_CATEGORY_ID");
  const cadenceInterestId = requireEnv(
    cadence === "monthly" ? "MAILCHIMP_CADENCE_MONTHLY_ID" : "MAILCHIMP_CADENCE_QUARTERLY_ID"
  );
  const languageCategoryId = requireEnv("MAILCHIMP_LANGUAGE_CATEGORY_ID");
  const languageInterestId = requireEnv(language === "en" ? "MAILCHIMP_LANGUAGE_EN_ID" : "MAILCHIMP_LANGUAGE_ET_ID");

  const periodLabel = narrative.periodLabel?.[language] ?? narrative.periodLabel?.et ?? narrative.period;
  const text = narrative[language] ?? narrative.et;

  const campaign = await mailchimp(apiKey, dc, "POST", "/campaigns", {
    type: "regular",
    recipients: {
      list_id: listId,
      segment_opts: {
        match: "all",
        conditions: [
          {
            condition_type: "Interests",
            field: `interests-${cadenceCategoryId}`,
            op: "interestcontains",
            value: [cadenceInterestId],
          },
          {
            condition_type: "Interests",
            field: `interests-${languageCategoryId}`,
            op: "interestcontains",
            value: [languageInterestId],
          },
        ],
      },
    },
    settings: {
      subject_line: SUBJECT[language](periodLabel),
      title: `${cadence}-${language}-${narrative.period}`,
      from_name: process.env.MAILCHIMP_FROM_NAME || "Eesti Turism",
      reply_to: process.env.MAILCHIMP_REPLY_TO || "no-reply@turismistatistika.ee",
    },
  });

  console.log(`Created campaign ${campaign.id} (${cadence}/${language})`);

  await mailchimp(apiKey, dc, "PUT", `/campaigns/${campaign.id}/content`, {
    html: buildEmailHtml({ text, periodLabel, locale: language }),
  });

  if (dryRun) {
    console.log(`[dry-run] Skipping send for campaign ${campaign.id} — left as a draft for review.`);
    return;
  }

  await mailchimp(apiKey, dc, "POST", `/campaigns/${campaign.id}/actions/send`, {});
  console.log(`Sent campaign ${campaign.id}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const apiKey = requireEnv("MAILCHIMP_API_KEY");
  const dc = apiKey.split("-").pop();
  const listId = requireEnv("MAILCHIMP_LIST_ID");

  const narrative = JSON.parse(await readFile(NARRATIVE_PATH, "utf8"));

  const cadences = isQuarterMonth(new Date()) ? ["monthly", "quarterly"] : ["monthly"];
  const languages = ["et", "en"];

  console.log(`Sending for cadences: ${cadences.join(", ")}${dryRun ? " (dry run)" : ""}`);

  for (const cadence of cadences) {
    for (const language of languages) {
      await sendCampaign({ apiKey, dc, listId, cadence, language, narrative, dryRun });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
