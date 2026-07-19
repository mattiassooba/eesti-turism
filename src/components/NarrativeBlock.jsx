import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { loadNarrative } from "../data/narrative";

// Enhancement content, not core data — unlike the rest of each page's own
// fetches, a missing or malformed narrative.json (e.g. before the first
// scheduled generation has ever run) should render nothing, not an error
// state.
export default function NarrativeBlock({ section, regionCode }) {
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

  // The dashboard section has a per-region variant, keyed by the region
  // picker's code, that replaces the national blurb once generated — falls
  // back to the national blurb for any code not (yet) covered there.
  const regionBlurb = regionCode ? narrative.sections[`${section}ByRegion`]?.[regionCode] : null;
  const blurb = regionBlurb ?? narrative.sections[section];
  const text = blurb[locale] ?? blurb.et;
  const periodLabel = narrative.periodLabel?.[locale] ?? narrative.periodLabel?.et;

  return (
    <div className="narrative-card">
      <p className="narrative-text">{text}</p>
      <div className="narrative-caption">{t("narrative.caption", periodLabel)}</div>
    </div>
  );
}
