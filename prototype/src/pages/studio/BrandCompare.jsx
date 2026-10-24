import { useApp } from "../../state/AppState.jsx";
import { Logo, SkylineMark, GeoMark, faviconDataUri } from "../../components/brand/Marks.jsx";
import Icon from "../../components/ui/Icon.jsx";

const MARKS = { a: SkylineMark, b: GeoMark };

function Tile({ label, dark, children, className = "" }) {
  return (
    <figure className={`brand-tile ${dark ? "brand-tile--dark" : ""} ${className}`} data-theme={dark ? "dark" : undefined}>
      <div className="brand-tile-stage">{children}</div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function HeaderMock({ concept, dark }) {
  const { t } = useApp();
  return (
    <div className={"brand-header-mock" + (dark ? " is-dark" : "")}>
      <Logo concept={concept} tone={dark ? "dark" : "light"} />
      <span className="brand-header-nav" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="brand-header-pill" aria-hidden="true">
        {t("region.label")}
      </span>
    </div>
  );
}

function MobileMock({ concept }) {
  return (
    <div className="brand-mobile-mock" aria-hidden="true">
      <div className="brand-mobile-bar">
        <Logo concept={concept} tone="light" />
        <Icon name="menu" size={20} />
      </div>
      <div className="brand-mobile-hero" data-theme="dark">
        <span className="brand-mobile-l1" />
        <span className="brand-mobile-l2" />
        <span className="brand-mobile-l3" />
      </div>
    </div>
  );
}

function FaviconRow({ concept }) {
  const { t } = useApp();
  const src = faviconDataUri(concept);
  return (
    <div className="brand-favicons">
      <div className="brand-favicon-sizes">
        {[16, 24, 32, 48, 64].map((s) => (
          <span key={s} className="brand-favicon-size">
            <img src={src} width={s} height={s} alt="" />
            <span className="t-meta">{s}</span>
          </span>
        ))}
      </div>
      <div className="brand-tabbar" aria-hidden="true">
        <span className="brand-tab is-active">
          <img src={src} width="16" height="16" alt="" />
          <span>{t("studio.brand.tabTitle")}</span>
          <Icon name="close" size={12} />
        </span>
        <span className="brand-tab">
          <span className="brand-tab-dot" />
          <span>andmed.stat.ee</span>
        </span>
      </div>
    </div>
  );
}

function SmallSizes({ concept }) {
  const { t } = useApp();
  const Mark = MARKS[concept];
  return (
    <div className="brand-small">
      <div className="brand-small-marks">
        {[40, 28, 20, 16, 12].map((h) => (
          <span key={h} className="brand-small-mark">
            <span className="brand-small-box" style={{ height: h }}>
              <Mark tone="light" />
            </span>
            <span className="t-meta">{h}px</span>
          </span>
        ))}
      </div>
      <div className="brand-small-lockups">
        <span className="brand-lockup-s">
          <Logo concept={concept} tone="light" />
        </span>
        <span className="brand-lockup-xs">
          <Logo concept={concept} tone="light" />
        </span>
        <span className="t-meta">{t("studio.brand.markOnly")}</span>
      </div>
    </div>
  );
}

function ConceptCard({ concept }) {
  const { t, brand, setBrand } = useApp();
  const active = brand === concept;
  const k = `studio.brand.${concept}`;
  return (
    <article className={"brand-card" + (active ? " is-active" : "")} aria-labelledby={`brand-${concept}`}>
      <header className="brand-card-head">
        <div>
          <p className="brand-card-letter">{concept.toUpperCase()}</p>
          <h3 id={`brand-${concept}`} className="t-h3">
            {t(`brand.${concept}.name`)}
          </h3>
        </div>
        {active ? (
          <span className="brand-in-use">
            <Icon name="check" size={16} />
            {t("studio.brand.inUse")}
          </span>
        ) : (
          <button type="button" className="btn btn--secondary" onClick={() => setBrand(concept)}>
            <span>{t("studio.brand.use")}</span>
          </button>
        )}
      </header>

      <dl className="brand-card-copy">
        <dt>{t("studio.brand.idea")}</dt>
        <dd>{t(`${k}.idea`)}</dd>
        <dt>{t("studio.brand.strengths")}</dt>
        <dd>{t(`${k}.strengths`)}</dd>
        <dt>{t("studio.brand.risks")}</dt>
        <dd>{t(`${k}.risks`)}</dd>
      </dl>

      <div className="brand-tiles">
        <Tile label={t("studio.brand.onLight")}>
          <span className="brand-lockup-l">
            <Logo concept={concept} tone="light" sub={t("brand.descriptor")} />
          </span>
        </Tile>
        <Tile label={t("studio.brand.onDark")} dark>
          <span className="brand-lockup-l">
            <Logo concept={concept} tone="dark" sub={t("brand.descriptor")} />
          </span>
        </Tile>
        <Tile label={t("studio.brand.header")} className="brand-tile--wide">
          <div className="brand-header-stack">
            <HeaderMock concept={concept} />
            <HeaderMock concept={concept} dark />
          </div>
        </Tile>
        <Tile label={t("studio.brand.mobile")}>
          <MobileMock concept={concept} />
        </Tile>
        <Tile label={t("studio.brand.favicon")}>
          <FaviconRow concept={concept} />
        </Tile>
        <Tile label={t("studio.brand.small")} className="brand-tile--wide">
          <SmallSizes concept={concept} />
        </Tile>
      </div>
    </article>
  );
}

export default function BrandCompare() {
  const { t } = useApp();
  return (
    <>
      <div className="brand-compare">
        <ConceptCard concept="a" />
        <ConceptCard concept="b" />
      </div>
      <p className="brand-note t-meta">{t("studio.brand.note")}</p>
    </>
  );
}
