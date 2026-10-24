import { Link } from "react-router-dom";
import { useApp } from "../state/AppState.jsx";
import PageHeader from "../components/layout/PageHeader.jsx";
import { Section, Button } from "../components/ui/Primitives.jsx";
import Icon from "../components/ui/Icon.jsx";

const LINKS = ["regions", "visitors", "accommodation", "sector", "residents", "data"];

export default function NotFound() {
  const { t, href } = useApp();
  return (
    <>
      <PageHeader kicker={t("notFound.kicker")} title={t("notFound.title")} lead={t("notFound.lead")}>
        <div className="hero-actions notfound-actions">
          <Button to={href("home")} variant="light" icon="arrowRight">
            {t("notFound.home")}
          </Button>
        </div>
      </PageHeader>
      <Section tone="paper" labelledBy="nf-links">
        <h2 id="nf-links" className="t-h3">
          {t("notFound.linksTitle")}
        </h2>
        <ul className="notfound-links">
          {LINKS.map((k) => (
            <li key={k}>
              <Link to={href(k)}>
                <span>
                  <span className="notfound-name">{t(`explore.tiles.${k}.name`)}</span>
                  <span className="notfound-desc">{t(`explore.tiles.${k}.desc`)}</span>
                </span>
                <Icon name="arrowRight" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
