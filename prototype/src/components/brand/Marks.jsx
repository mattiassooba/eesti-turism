import { useId } from "react";
import { MARK_OUTLINE, MARK_VIEWBOX, FAVICON_OUTLINE, FAVICON_VIEWBOX } from "../../geo/generated.js";

// ── Concept A — "Vanalinn": Tallinn Old Town seen from the bay ─────────
// Left to right: Paks Margareeta, St Olaf's (Oleviste), the Town Hall spire
// (Vana Toomas), St Nicholas' (Niguliste), the Dome Church (Toomkirik) and
// Tall Hermann (Pikk Hermann) with its flag. Drawn on a 120 × 52 grid with
// the same 1-unit rhythm throughout so it holds together at 20 px.
const SKYLINE =
  "M0 44V36H6V30H16V36H22V31H26V18H26.8L29 1L31.2 18H32V31H38L40 27L42 31H44L46 27.5L48 31V28H54V16L55.25 7L56.5 16V28H60V31L62 27L64 31V30H68V19L70.5 7L73 19V30H78L82 27H86V16L86.6 13H87.4L88 9L88.6 13H89.4L90 16V22H100V12H101V10.5H102V12H104V10.5H105V12H106V22H110L116 30L120 36V44Z";

export function SkylineMark({ tone = "dark", title, className }) {
  const ink = tone === "dark" ? "var(--on-dark)" : "var(--navy-800)";
  const accent = tone === "dark" ? "var(--sea)" : "var(--baltic)";
  return (
    <svg viewBox="0 0 120 52" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d={SKYLINE} fill={ink} />
      <rect x="102.7" y="2.6" width="0.7" height="8.2" fill={ink} />
      <rect x="103.4" y="2.6" width="5" height="2.8" fill={accent} />
      <rect x="3" y="47" width="114" height="1.4" rx="0.7" fill={accent} />
      <rect x="20" y="50.4" width="80" height="1.2" rx="0.6" fill={accent} opacity="0.55" />
    </svg>
  );
}

const SKYLINE_FAVICON =
  "M4 24V19.5H8V13H9.2L11 3.5L12.8 13H14V17.5H15.6V11.5L16.6 7L17.6 11.5V17.5H20.5V12H21.5V11H22.5V12H24.5V11H25.5V12H27V24Z";

// ── Concept B — "Rannajoon": Estonia drawn as rows of data ─────────────
// The country's real outline (Maa-amet geometry, simplified) sliced into
// horizontal bars, one of which is lifted out in the accent colour: the
// country read as a chart.
const ROWS = 9;
export function GeoMark({ tone = "dark", title, className, highlightRow = 4 }) {
  const id = useId().replace(/:/g, "");
  const [w, h] = MARK_VIEWBOX;
  const ink = tone === "dark" ? "var(--on-dark)" : "var(--navy-800)";
  const accent = tone === "dark" ? "var(--sea)" : "var(--baltic)";
  const pitch = h / ROWS;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`geo-${id}`}>
          <path d={MARK_OUTLINE} clipRule="evenodd" fillRule="evenodd" />
        </clipPath>
      </defs>
      <g clipPath={`url(#geo-${id})`}>
        {Array.from({ length: ROWS }, (_, i) => (
          <rect key={i} x="0" y={i * pitch + 0.35} width={w} height={pitch - 1.5} fill={i === highlightRow ? accent : ink} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ tone = "dark", sub }) {
  return (
    <span className={`wordmark wordmark--${tone}`}>
      <span className="wordmark-name">Eesti Turism</span>
      {sub && <span className="wordmark-sub">{sub}</span>}
    </span>
  );
}

export function Logo({ concept = "a", tone = "dark", sub, title }) {
  const Mark = concept === "b" ? GeoMark : SkylineMark;
  return (
    <span className={`logo logo--${concept}`}>
      <Mark tone={tone} className="logo-mark" title={title} />
      <Wordmark tone={tone} sub={sub} />
    </span>
  );
}

// Standalone SVG strings for favicons (also shown in the Design Studio).
export function faviconSvg(concept) {
  if (concept === "b") {
    const [w, h] = FAVICON_VIEWBOX;
    const oy = (32 - h) / 2;
    const rows = 5;
    const pitch = h / rows;
    const bars = Array.from(
      { length: rows },
      (_, i) => `<rect x="0" y="${(i * pitch + 0.3).toFixed(2)}" width="32" height="${(pitch - 1.05).toFixed(2)}" fill="${i === 2 ? "#9ac6dc" : "#eef4f8"}"/>`
    ).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#14283d"/><clipPath id="c"><path transform="translate(0 ${oy.toFixed(2)})" d="${FAVICON_OUTLINE}"/></clipPath><g clip-path="url(#c)" transform="translate(0 ${oy.toFixed(2)})">${bars}</g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#14283d"/><path d="${SKYLINE_FAVICON}" fill="#eef4f8"/><rect x="23.7" y="5.2" width="0.6" height="6" fill="#eef4f8"/><rect x="24.3" y="5.2" width="3.4" height="2.1" fill="#9ac6dc"/><rect x="3.5" y="26" width="25" height="1.4" rx="0.7" fill="#9ac6dc"/></svg>`;
}

export function faviconDataUri(concept) {
  return `data:image/svg+xml,${encodeURIComponent(faviconSvg(concept))}`;
}
