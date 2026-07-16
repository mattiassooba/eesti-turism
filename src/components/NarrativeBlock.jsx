import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LocaleContext.jsx";

// Module-level cache: every section's NarrativeBlock instance wants the
// same file, so fetch it once per page load and share the result instead
// of each of the 5 instances firing its own request.
let narrativePromise = null;
function loadNarrative() {
  if (!narrativePromise) {
    narrativePromise = fetch(`${import.meta.env.BASE_URL}data/narrative.json`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return narrativePromise;
}

// Enhancement content, not core data — unlike the rest of each page's own
// fetches, a missing or malformed narrative.json (e.g. before the first
// scheduled generation has ever run) should render nothing, not an error
// state.
export default function NarrativeBlock({ section }) {
  const { t, locale } = useTranslation();
  const [narrative, setNarrative] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadNarrative().then((data) => {
      if (!cancelled && data?.sections?.[section]?.et && data?.sections?.[section]?.en) {
        setNarrative(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [section]);

  if (!narrative) return null;

  const text = narrative.sections[section][locale] ?? narrative.sections[section].et;
  const periodLabel = narrative.periodLabel?.[locale] ?? narrative.periodLabel?.et;

  return (
    <div className="narrative-card">
      <p className="narrative-text">{text}</p>
      <div className="narrative-caption">{t("narrative.caption", periodLabel)}</div>
    </div>
  );
}
