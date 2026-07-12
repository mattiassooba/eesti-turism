import { useTranslation } from "../i18n/LocaleContext.jsx";

// Fixed vertical nav for the scroll-through pages: shows which section is
// currently in view, jumps to any of them on click, and hints that there's
// more below until the last one is reached.
export default function SectionRail({ items, activeKey, onSelect }) {
  const { t } = useTranslation();
  const activeIndex = items.findIndex((item) => item.key === activeKey);
  const isLast = activeIndex === items.length - 1;

  return (
    <nav className="section-rail" aria-label={t("nav.railAria")}>
      <ul className="section-rail-list">
        {items.map((item, i) => {
          const state = i < activeIndex ? "passed" : i === activeIndex ? "active" : "upcoming";
          return (
            <li key={item.key}>
              <button
                className={"section-rail-item section-rail-" + state}
                onClick={() => onSelect(item.key)}
                aria-current={state === "active" ? "true" : undefined}
              >
                <span className="section-rail-dot" />
                <span className="section-rail-label">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className={"section-rail-hint" + (isLast ? " section-rail-hint-hidden" : "")} aria-hidden={isLast}>
        <span>{t("nav.scrollHint")}</span>
        <span className="section-rail-chevron">⌄</span>
      </div>
    </nav>
  );
}
