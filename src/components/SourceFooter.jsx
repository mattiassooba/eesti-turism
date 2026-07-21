import { Link } from "react-router-dom";
import { useTranslation } from "../i18n/LocaleContext.jsx";
import { COUNTIES, CITIES } from "../data/counties";

export default function SourceFooter() {
  const { t, locale } = useTranslation();
  const licenseUrl =
    locale === "en"
      ? "https://creativecommons.org/licenses/by-sa/4.0/deed.en"
      : "https://creativecommons.org/licenses/by-sa/4.0/deed.et";

  return (
    <footer className="source-footer">
      <span>
        {t("footer.source")}{" "}
        <a href={`https://andmed.stat.ee/${locale}/stat`} target="_blank" rel="noreferrer">
          {t("footer.sourceLink")}
        </a>
      </span>
      <span>
        {t("footer.licensedUnder")}{" "}
        <a href={licenseUrl} target="_blank" rel="noreferrer">
          {t("footer.license")}
        </a>
        {" "}· {t("footer.disclaimer")} · {t("app.localeNote")}
      </span>
      <nav className="footer-counties" aria-label={t("footer.allCounties")}>
        <span className="footer-counties-label">{t("footer.allCounties")}</span>
        {[...COUNTIES, ...CITIES].map((county, i, all) => (
          <span key={county.code}>
            <Link to={locale === "en" ? `/en/county/${county.slugEn}` : `/maakond/${county.slugEt}`}>
              {locale === "en" ? county.en : county.et}
            </Link>
            {i < all.length - 1 && ", "}
          </span>
        ))}
      </nav>
    </footer>
  );
}
