import { memo } from "react";
import {
  HERO_OUTLINE,
  HERO_BORDERS,
  HERO_VIEWBOX,
  COUNTY_PATHS,
  CITY_POINTS,
  GRATICULE,
  GRATICULE_LABELS,
} from "../../geo/generated.js";
import { regionByCode } from "../../lib/regions.js";

// Atmospheric cartography for the dark hero. Every line is real geometry:
// the coastline and county borders are Maa-amet boundaries; the "depth
// rings" are that same coastline stroked at increasing widths, so the sea
// appears to shelve away from the actual shore. Decorative in role (the
// interactive map further down is the informational one), accurate in form.
function HeroArt({ selectedCode }) {
  const [w, h] = HERO_VIEWBOX;
  const region = selectedCode ? regionByCode(selectedCode) : null;
  const mkood = region?.kind === "county" ? region.mkood : region?.kind === "city" ? regionByCode(region.parent).mkood : null;
  const city = region?.kind === "city" ? CITY_POINTS[region.code] : null;
  return (
    <svg className="hero-art" viewBox={`-60 -40 ${w + 120} ${h + 80}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="hero-glow" cx="58%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#3b80ab" stopOpacity="0.26" />
          <stop offset="55%" stopColor="#1c3550" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#0b1a29" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#15304a" />
          <stop offset="100%" stopColor="#0f2438" />
        </linearGradient>
      </defs>
      <rect x="-400" y="-300" width={w + 800} height={h + 600} fill="url(#hero-glow)" />
      <path d={GRATICULE} className="hero-graticule" />
      {GRATICULE_LABELS.filter((l) => l.kind === "lat").map((l) => (
        <text key={`lat${l.value}`} x={-50} y={l.y - 6} className="hero-grat-label">
          {`${Math.floor(l.value)}°${l.value % 1 ? "30′" : "00′"} N`}
        </text>
      ))}
      {GRATICULE_LABELS.filter((l) => l.kind === "lon").map((l) => (
        <text key={`lon${l.value}`} x={l.x + 6} y={h + 30} className="hero-grat-label">
          {`${l.value}°E`}
        </text>
      ))}
      <g className="hero-depth">
        <path d={HERO_OUTLINE} strokeWidth="72" style={{ opacity: 0.05 }} />
        <path d={HERO_OUTLINE} strokeWidth="46" style={{ opacity: 0.07 }} />
        <path d={HERO_OUTLINE} strokeWidth="26" style={{ opacity: 0.1 }} />
        <path d={HERO_OUTLINE} strokeWidth="11" style={{ opacity: 0.16 }} />
      </g>
      <path d={HERO_OUTLINE} className="hero-land" fill="url(#hero-land)" fillRule="evenodd" />
      <path d={HERO_BORDERS} className="hero-borders" />
      {mkood && <path d={COUNTY_PATHS[mkood]} className="hero-selected" />}
      <path d={HERO_OUTLINE} className="hero-coast" fillRule="evenodd" pathLength="1" />
      {city && (
        <g className="hero-city">
          <circle cx={city[0]} cy={city[1]} r="18" className="hero-city-ring" />
          <circle cx={city[0]} cy={city[1]} r="5.5" className="hero-city-dot" />
        </g>
      )}
      <text x={w + 50} y={-18} textAnchor="end" className="hero-grat-label hero-credit">
        Maa-amet EHAK 2018 · L-EST97 LCC
      </text>
    </svg>
  );
}

export default memo(HeroArt);
