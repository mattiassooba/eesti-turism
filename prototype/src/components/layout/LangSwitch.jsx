import { useApp } from "../../state/AppState.jsx";

export default function LangSwitch({ className }) {
  const { locale, switchLocale, t } = useApp();
  return (
    <div className={"lang-switch " + (className ?? "")} role="group" aria-label={t("nav.language")}>
      {[
        ["et", "ET", "Eesti keel"],
        ["en", "EN", "English"],
      ].map(([code, label, full]) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          aria-label={full}
          onClick={() => switchLocale(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
