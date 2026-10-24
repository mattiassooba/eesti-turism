import { useApp } from "../../state/AppState.jsx";
import { ArrowLink } from "../../components/ui/Primitives.jsx";

const BEFORE = import.meta.glob("../../assets/before/*.jpg", { eager: true, import: "default" });
const AFTER = import.meta.glob("../../assets/after/*.jpg", { eager: true, import: "default" });
const img = (set, kind, name) => set[`../../assets/${kind}/${name}.jpg`];

function Shot({ src, label, kind }) {
  const { t } = useApp();
  return (
    <figure className={`shot shot--${kind}`}>
      <figcaption>
        <span className={`shot-tag shot-tag--${kind}`}>{label}</span>
        <a href={src} target="_blank" rel="noreferrer" className="shot-open">
          {t("studio.walk.enlarge")}
        </a>
      </figcaption>
      <a href={src} target="_blank" rel="noreferrer" className="shot-img" tabIndex={-1} aria-hidden="true">
        <img src={src} alt="" loading="lazy" />
      </a>
    </figure>
  );
}

export default function Walkthrough() {
  const { t, href } = useApp();
  const points = t("studio.walk.points");
  return (
    <ol className="walk">
      {points.map((p, i) => {
        const before = p.shot && img(BEFORE, "before", p.shot);
        const after = p.shot && img(AFTER, "after", p.shot);
        return (
          <li key={p.title} className={"walk-point" + (before ? " has-shots" : "") + (p.mobile ? " is-mobile" : "")}>
            <div className="walk-copy">
              <span className="walk-num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="t-h3">{p.title}</h3>
              <p>{p.text}</p>
              <ArrowLink to={href(p.to, { hash: p.hash })}>{t("studio.walk.see")}</ArrowLink>
            </div>
            {before && after && (
              <div className="walk-shots">
                <Shot src={before} kind="before" label={t("studio.walk.before")} />
                <Shot src={after} kind="after" label={t("studio.walk.after")} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
