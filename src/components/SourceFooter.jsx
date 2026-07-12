import { useTranslation } from "../i18n/LocaleContext.jsx";

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
    </footer>
  );
}
