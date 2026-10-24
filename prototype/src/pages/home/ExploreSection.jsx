import { Link } from "react-router-dom";
import { useApp } from "../../state/AppState.jsx";
import { Section, SectionHead, Button } from "../../components/ui/Primitives.jsx";
import Icon from "../../components/ui/Icon.jsx";

const TILES = [
  { key: "regions", icon: "layers" },
  { key: "visitors", icon: "globe" },
  { key: "accommodation", icon: "chart" },
  { key: "sector", icon: "chart", national: true },
  { key: "residents", icon: "compare", national: true },
  { key: "data", icon: "table" },
];

export default function ExploreSection() {
  const { t, href } = useApp();
  return (
    <Section id="avasta" tone="white" labelledBy="explore-title">
      <SectionHead id="explore-title" kicker={t("explore.kicker")} title={t("explore.title")} lead={t("explore.lead")} />
      <ul className="explore-grid">
        {TILES.map((tile) => (
          <li key={tile.key}>
            <Link className="explore-tile" to={href(tile.key)}>
              <span className="explore-icon" aria-hidden="true">
                <Icon name={tile.icon} size={20} />
              </span>
              <span className="explore-name">{t(`explore.tiles.${tile.key}.name`)}</span>
              <span className="explore-desc">{t(`explore.tiles.${tile.key}.desc`)}</span>
              <span className="explore-meta">
                {tile.national ? t("scope.nationalOnly") : t("explore.regional")}
                <Icon name="arrowRight" size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="report-band" data-theme="dark">
        <div>
          <p className="report-band-kicker">{t("explore.reportKicker")}</p>
          <h3 className="report-band-title">{t("explore.reportTitle")}</h3>
          <p className="report-band-text">{t("explore.reportText")}</p>
        </div>
        <div className="report-band-actions">
          <Button to={href("reports")} variant="light" icon="file">
            {t("explore.reportPdf")}
          </Button>
          <Button to={href("reports", { hash: "uudiskiri" })} variant="ghost" icon="mail">
            {t("explore.reportNews")}
          </Button>
        </div>
      </div>
    </Section>
  );
}
