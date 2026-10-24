import { Link } from "react-router-dom";
import { useApp } from "../../state/AppState.jsx";

// Prototype-only chrome: always states that this is not the live site, and
// gives reviewers the brand A/B switch and a route into the Design Studio.
export default function PrototypeRibbon() {
  const { t, brand, setBrand, href } = useApp();
  return (
    <div className="proto-ribbon" data-theme="dark" role="region" aria-label={t("proto.ribbonLabel")}>
      <div className="proto-ribbon-inner">
        <p className="proto-ribbon-note">
          <span className="proto-dot" aria-hidden="true" />
          <strong>{t("proto.badge")}</strong>
          <span className="proto-ribbon-hide-s">{t("proto.notLive")}</span>
        </p>
        <div className="proto-ribbon-tools">
          <div className="proto-brand-switch" role="group" aria-label={t("proto.brandSwitch")}>
            <span className="proto-ribbon-hide-s">{t("proto.logo")}</span>
            {["a", "b"].map((c) => (
              <button key={c} type="button" aria-pressed={brand === c} onClick={() => setBrand(c)}>
                {c.toUpperCase()}
                <span className="proto-ribbon-hide-m"> · {t(`brand.${c}.name`)}</span>
              </button>
            ))}
          </div>
          <Link className="proto-studio-link" to={href("studio", { keepRegion: false })}>
            {t("proto.studio")}
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
