import { Link } from "react-router-dom";
import { useApp } from "../../state/AppState.jsx";
import { Logo } from "../brand/Marks.jsx";
import { COUNTY_LIST, CITY_LIST, regionName, regionPath } from "../../lib/regions.js";
import { HERO_OUTLINE, HERO_VIEWBOX } from "../../geo/generated.js";

export default function Footer() {
  const { t, locale, href } = useApp();
  const license = `https://creativecommons.org/licenses/by-sa/4.0/deed.${locale === "en" ? "en" : "et"}`;
  const sections = [
    ["home", "nav.overview"],
    ["regions", "nav.regions"],
    ["visitors", "nav.visitors"],
    ["accommodation", "nav.accommodationPerf"],
    ["operator", "nav.operator"],
    ["sector", "nav.sector"],
    ["residents", "nav.residents"],
    ["data", "nav.tables"],
    ["reports", "nav.reports"],
  ];
  return (
    <footer className="site-footer" data-theme="dark">
      <svg className="footer-coast" viewBox={`0 0 ${HERO_VIEWBOX[0]} ${HERO_VIEWBOX[1]}`} aria-hidden="true">
        <path d={HERO_OUTLINE} />
      </svg>
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo concept="a" tone="dark" sub={t("brand.descriptor")} />
            <p className="footer-tagline">{t("footer.tagline")}</p>
          </div>
          <nav className="footer-col" aria-label={t("footer.statistics")}>
            <p className="footer-col-title">{t("footer.statistics")}</p>
            <ul>
              {sections.map(([key, label]) => (
                <li key={key}>
                  <Link to={href(key)}>{t(label)}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="footer-col footer-col--regions" aria-label={t("footer.regions")}>
            <p className="footer-col-title">{t("footer.regions")}</p>
            <ul>
              {[...COUNTY_LIST, ...CITY_LIST].map((r) => (
                <li key={r.code}>
                  <Link to={regionPath(r, locale)}>{regionName(r, locale, { short: r.kind === "county" })}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="footer-col">
            <p className="footer-col-title">{t("footer.source")}</p>
            <p className="footer-small">
              {t("footer.sourceLine")}{" "}
              <a href={`https://andmed.stat.ee/${locale}/stat`} target="_blank" rel="noreferrer">
                andmed.stat.ee
              </a>
              . {t("footer.licensed")}{" "}
              <a href={license} target="_blank" rel="noreferrer">
                CC BY-SA 4.0
              </a>
              .
            </p>
            <p className="footer-small">{t("footer.disclaimer")}</p>
            <p className="footer-small">{t("footer.scope")}</p>
            <p className="footer-small">{t("footer.boundaries")}</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Eesti Turism · turismistatistika.ee</span>
          <span>{t("footer.privacy")}</span>
        </div>
      </div>
    </footer>
  );
}
