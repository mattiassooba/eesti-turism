import { useState } from "react";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { COUNTIES } from "../data/counties";

// Mailchimp embedded-form mechanics — none of these are secrets (Mailchimp
// publishes them in every embed snippet it generates), but they ARE
// account-specific and don't exist until the Mailchimp Audience, its two
// Group categories (Cadence, Language), and the COUNTY merge field are
// created. PLACEHOLDER values below get swapped for the real ones from
// Audience → Signup forms → Embedded forms once that setup is done.
const MAILCHIMP_U = "PLACEHOLDER_U";
const MAILCHIMP_LIST_ID = "PLACEHOLDER_LIST_ID";
const MAILCHIMP_DC = "usPLACEHOLDER"; // the datacenter suffix on your API key, e.g. "us21"
const MAILCHIMP_ACTION = `https://${MAILCHIMP_DC}.list-manage.com/subscribe/post?u=${MAILCHIMP_U}&id=${MAILCHIMP_LIST_ID}`;

// Radio-button Group categories: Mailchimp names these `group[<categoryId>]`
// with each option's value being that option's own interest ID — both
// numbers are assigned by Mailchimp when the category/options are created.
const CADENCE_GROUP_NAME = "group[PLACEHOLDER_CADENCE_CATEGORY]";
const CADENCE_INTEREST_IDS = { monthly: "PLACEHOLDER", quarterly: "PLACEHOLDER" };
const LANGUAGE_GROUP_NAME = "group[PLACEHOLDER_LANGUAGE_CATEGORY]";
const LANGUAGE_INTEREST_IDS = { et: "PLACEHOLDER", en: "PLACEHOLDER" };

// Canonical (English) values for the COUNTY dropdown merge field — these
// must exactly match the option strings configured in Mailchimp, since a
// dropdown merge field only accepts one of its predefined values. Kept in
// English regardless of the visitor's UI locale so subscriber data stays
// consistent no matter which language they signed up in; only the
// *displayed* label is localized.
const ALL_ESTONIA_VALUE = "All Estonia";

// Memoized — see Dashboard.jsx for why (App.jsx's own re-renders, e.g.
// from scroll tracking, shouldn't cascade into this static form).
export default function NewsletterSignup() {
  const { t, locale } = useTranslation();
  const [cadence, setCadence] = useState("monthly");
  const [language, setLanguage] = useState(locale === "en" ? "en" : "et");

  return (
    <div className="newsletter-signup">
      <h3 className="newsletter-heading">{t("newsletter.heading")}</h3>
      <p className="newsletter-intro">{t("newsletter.intro")}</p>

      <form action={MAILCHIMP_ACTION} method="post" target="_blank" noValidate>
        <div className="newsletter-row">
          <input
            type="email"
            name="EMAIL"
            required
            placeholder={t("newsletter.emailPlaceholder")}
            className="newsletter-email"
          />
          <button type="submit" className="newsletter-submit">
            {t("newsletter.submit")}
          </button>
        </div>

        <div className="newsletter-options">
          <div className="operator-control">
            <span>{t("newsletter.cadence")}</span>
            <div className="pill-tabs">
              <input
                type="radio"
                id="newsletter-cadence-monthly"
                name={CADENCE_GROUP_NAME}
                value={CADENCE_INTEREST_IDS.monthly}
                checked={cadence === "monthly"}
                onChange={() => setCadence("monthly")}
                className="pill-radio"
              />
              <label htmlFor="newsletter-cadence-monthly" className="pill-tab">
                {t("newsletter.monthly")}
              </label>
              <input
                type="radio"
                id="newsletter-cadence-quarterly"
                name={CADENCE_GROUP_NAME}
                value={CADENCE_INTEREST_IDS.quarterly}
                checked={cadence === "quarterly"}
                onChange={() => setCadence("quarterly")}
                className="pill-radio"
              />
              <label htmlFor="newsletter-cadence-quarterly" className="pill-tab">
                {t("newsletter.quarterly")}
              </label>
            </div>
          </div>

          <div className="operator-control">
            <span>{t("newsletter.language")}</span>
            <div className="pill-tabs">
              <input
                type="radio"
                id="newsletter-language-et"
                name={LANGUAGE_GROUP_NAME}
                value={LANGUAGE_INTEREST_IDS.et}
                checked={language === "et"}
                onChange={() => setLanguage("et")}
                className="pill-radio"
              />
              <label htmlFor="newsletter-language-et" className="pill-tab">
                ET
              </label>
              <input
                type="radio"
                id="newsletter-language-en"
                name={LANGUAGE_GROUP_NAME}
                value={LANGUAGE_INTEREST_IDS.en}
                checked={language === "en"}
                onChange={() => setLanguage("en")}
                className="pill-radio"
              />
              <label htmlFor="newsletter-language-en" className="pill-tab">
                EN
              </label>
            </div>
          </div>

          <label className="operator-control">
            <span>{t("newsletter.county")}</span>
            <select name="COUNTY" defaultValue={ALL_ESTONIA_VALUE}>
              <option value={ALL_ESTONIA_VALUE}>{t("newsletter.allCounties")}</option>
              {COUNTIES.map((c) => (
                <option key={c.code} value={c.en}>
                  {c[locale]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Mailchimp's standard bot honeypot — real subscribers never see or
            fill this in; the field name itself is derived from u/id above. */}
        <div style={{ position: "absolute", left: "-5000px" }} aria-hidden="true">
          <input type="text" name={`b_${MAILCHIMP_U}_${MAILCHIMP_LIST_ID}`} tabIndex="-1" defaultValue="" />
        </div>

        <p className="newsletter-privacy">{t("newsletter.privacy")}</p>
      </form>
    </div>
  );
}
