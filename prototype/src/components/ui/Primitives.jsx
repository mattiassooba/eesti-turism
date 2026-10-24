import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../state/AppState.jsx";
import Icon from "./Icon.jsx";
import { fmtSignedPct } from "../../lib/format.js";
import { PATHS } from "../../data/client.js";

export function Section({ id, tone = "paper", className = "", children, labelledBy }) {
  return (
    <section
      id={id}
      className={`section section--${tone} ${className}`}
      data-theme={tone === "dark" || tone === "deep" ? "dark" : undefined}
      aria-labelledby={labelledBy}
    >
      <div className="container">{children}</div>
    </section>
  );
}

export function SectionHead({ kicker, title, lead, aside, id, as: H = "h2", size = "h2" }) {
  return (
    <header className="section-head">
      <div className="section-head-main">
        {kicker && (
          <p className="kicker">
            <span className="kicker-rule" aria-hidden="true" />
            {kicker}
          </p>
        )}
        <H id={id} className={`t-${size}`}>
          {title}
        </H>
        {lead && <p className="t-lead section-lead">{lead}</p>}
      </div>
      {aside && <div className="section-head-aside">{aside}</div>}
    </header>
  );
}

export function Delta({ value, digits = 1, suffix, invert = false, size = "m", unit = "pct", srPrefix }) {
  const { locale, t } = useApp();
  if (value == null || Number.isNaN(value)) return <span className="delta delta--none">—</span>;
  const good = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.05;
  const cls = flat ? "flat" : good ? "pos" : "neg";
  const text = unit === "pp" ? `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString(locale === "et" ? "et-EE" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })} pp` : fmtSignedPct(value, locale, digits);
  return (
    <span className={`delta delta--${cls} delta--${size}`}>
      <span className="delta-glyph" aria-hidden="true">
        {flat ? "→" : value > 0 ? "↑" : "↓"}
      </span>
      <span className="sr-only">{srPrefix ?? (value > 0 ? t("a11y.increase") : t("a11y.decrease"))} </span>
      <span className="num">{text}</span>
      {suffix && <span className="delta-suffix">{suffix}</span>}
    </span>
  );
}

export function Kpi({ label, value, delta, deltaLabel, meta, size = "l", note, invert, deltaUnit, accent }) {
  return (
    <div className={`kpi kpi--${size}` + (accent ? " kpi--accent" : "")}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value num">{value}</p>
      {(delta !== undefined || deltaLabel) && (
        <p className="kpi-foot">
          {delta !== undefined && <Delta value={delta} invert={invert} unit={deltaUnit} />}
          {deltaLabel && <span className="kpi-foot-label">{deltaLabel}</span>}
        </p>
      )}
      {note && <p className="kpi-note">{note}</p>}
      {meta && <p className="kpi-meta t-meta">{meta}</p>}
    </div>
  );
}

// States what geography and period a block of figures refers to. When the
// data is national-only, it says so even if a region is selected globally.
export function ScopeBadge({ region, period, nationalOnly, reason, compact }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (nationalOnly) {
    return (
      <span className={"scope scope--national" + (compact ? " scope--compact" : "")}>
        <span className="scope-dot" aria-hidden="true" />
        <span>{t("scope.nationalOnly")}</span>
        {period && <span className="scope-period">· {period}</span>}
        {reason && (
          <>
            <button type="button" className="scope-info" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
              <Icon name="info" size={15} />
              <span className="sr-only">{t("scope.why")}</span>
            </button>
            <span id={id} role="note" className={"scope-pop" + (open ? " is-open" : "")}>
              {reason}
            </span>
          </>
        )}
      </span>
    );
  }
  return (
    <span className={"scope" + (compact ? " scope--compact" : "")}>
      <span className="scope-dot scope-dot--region" aria-hidden="true" />
      <span>{region}</span>
      {period && <span className="scope-period">· {period}</span>}
    </span>
  );
}

export const TABLE_FOLDERS = {
  TU131: "majutus",
  TU122: "majutus",
  TU133: "majutus",
  TU11: "majutus",
  TU110: "majutus",
  TU51: "reisimine",
  TU54: "reisimine",
  TU56: "reisimine",
  TU63: "reisimine",
  TU551: "reisimine",
  TU552: "reisimine",
  TU661: "reisimine",
  TU410: "turismMajandus",
  EM001: "em001",
  PA113: "pa113",
};

export function officialTableUrl(id, locale = "et") {
  const folder = PATHS[TABLE_FOLDERS[id]] ?? PATHS.majutus;
  return `https://andmed.stat.ee/${locale}/stat/${folder.join("__")}/${id}`;
}

export function Source({ tables, note, children }) {
  const { t, locale } = useApp();
  return (
    <p className="source t-meta">
      <span>{t("source.prefix")}</span>{" "}
      {tables.map((id, i) => (
        <span key={id}>
          {i > 0 && ", "}
          <a href={officialTableUrl(id, locale)} target="_blank" rel="noreferrer">
            {id}
          </a>
        </span>
      ))}
      {note && <span className="source-note"> · {note}</span>}
      {children}
    </p>
  );
}

export function Segmented({ label, options, value, onChange, size = "m", hideLabel }) {
  const id = useId();
  return (
    <div className={`segmented-wrap segmented--${size}`}>
      {label && (
        <span id={id} className={"control-label" + (hideLabel ? " sr-only" : "")}>
          {label}
        </span>
      )}
      <div className="segmented" role="radiogroup" aria-labelledby={label ? id : undefined}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? "is-active" : ""}
            onClick={() => onChange(o.value)}
            disabled={o.disabled}
            title={o.title}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SelectControl({ label, value, onChange, options }) {
  const id = useId();
  return (
    <label className="select-control" htmlFor={id}>
      <span className="control-label">{label}</span>
      <span className="select-shell">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} />
      </span>
    </label>
  );
}

export function ArrowLink({ to, children, external, tone }) {
  const inner = (
    <>
      <span>{children}</span>
      <Icon name={external ? "arrowUpRight" : "arrowRight"} size={16} />
    </>
  );
  if (external)
    return (
      <a className={"arrow-link" + (tone ? ` arrow-link--${tone}` : "")} href={to} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  return (
    <Link className={"arrow-link" + (tone ? ` arrow-link--${tone}` : "")} to={to}>
      {inner}
    </Link>
  );
}

export function Button({ to, onClick, children, variant = "primary", icon, type = "button", ...rest }) {
  const cls = `btn btn--${variant}`;
  const content = (
    <>
      <span>{children}</span>
      {icon && <Icon name={icon} size={16} />}
    </>
  );
  if (to)
    return (
      <Link className={cls} to={to} {...rest}>
        {content}
      </Link>
    );
  return (
    <button type={type} className={cls} onClick={onClick} {...rest}>
      {content}
    </button>
  );
}

// Explains why a selected region doesn't apply to a national-only block.
export function NationalNotice({ regionLabel, text }) {
  const { t } = useApp();
  return (
    <div className="national-notice" role="note">
      <span className="national-notice-icon" aria-hidden="true">
        <Icon name="info" size={18} />
      </span>
      <p>
        <strong>{t("scope.nationalHeading", regionLabel)}</strong> {text}
      </p>
    </div>
  );
}

export function Insight({ kind = "computed", children, meta, to, toLabel }) {
  const { t } = useApp();
  return (
    <article className={`insight insight--${kind}`}>
      <p className="insight-kind">
        <Icon name={kind === "ai" ? "sparkle" : "chart"} size={14} />
        {kind === "ai" ? t("insight.ai") : t("insight.computed")}
      </p>
      <p className="insight-text">{children}</p>
      {meta && <p className="insight-meta t-meta">{meta}</p>}
      {to && (
        <ArrowLink to={to} tone="quiet">
          {toLabel}
        </ArrowLink>
      )}
    </article>
  );
}
