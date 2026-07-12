import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LocaleContext.jsx";

// Enhancement content, not core data — unlike the rest of Dashboard's
// fetches, a missing or malformed narrative.json (e.g. before the first
// scheduled generation has ever run) should render nothing, not an error
// state.
export default function NarrativeBlock() {
  const { t, locale } = useTranslation();
  const [narrative, setNarrative] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/narrative.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.et && data?.en) setNarrative(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!narrative) return null;

  const text = narrative[locale] ?? narrative.et;
  const periodLabel = narrative.periodLabel?.[locale] ?? narrative.periodLabel?.et;

  return (
    <div className="narrative-card">
      <p className="narrative-text">{text}</p>
      <div className="narrative-caption">{t("narrative.caption", periodLabel)}</div>
    </div>
  );
}
