import { useMemo, useRef, useState } from "react";
import { COUNTY_PATHS, CITY_POINTS, HERO_VIEWBOX, HERO_OUTLINE, COUNTY_ANCHORS } from "../../geo/generated.js";
import { COUNTY_LIST, CITY_LIST, regionByMkood, regionName } from "../../lib/regions.js";
import { useApp } from "../../state/AppState.jsx";

// Interactive county choropleth. Counties and the three separately
// published cities are all focusable (Tab / Enter / Space); the ranked list
// shown next to the map offers the same selection as a non-spatial
// alternative. Boundaries: Maa-amet EHAK, 01.09.2018.
export default function EstoniaMap({
  values,
  color,
  format,
  selected,
  compare,
  onSelect,
  theme = "dark",
  metricLabel,
  showCities = true,
  ariaLabel,
  labels = true,
}) {
  const { locale, t } = useApp();
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const [w, h] = HERO_VIEWBOX;
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const counties = useMemo(
    () => COUNTY_LIST.map((r) => ({ region: r, d: COUNTY_PATHS[r.mkood], anchor: COUNTY_ANCHORS[r.mkood] })),
    []
  );

  function onPointerMove(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  const hovered = hover;
  const tipValue = hovered ? values[hovered.code] : null;

  const item = (r) => {
    const v = values[r.code];
    const isSel = selected === r.code;
    const isCmp = compare === r.code;
    return {
      fill: v == null ? "var(--map-empty)" : color(v),
      cls: (isSel ? " is-selected" : "") + (isCmp ? " is-compare" : "") + (hover?.code === r.code ? " is-hover" : ""),
      label: `${regionName(r, locale)}: ${v == null ? t("map.noData") : format(v)}`,
    };
  };

  return (
    <div className={`emap emap--${theme}`} ref={wrapRef} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`-10 -10 ${w + 20} ${h + 20}`} role="group" aria-label={ariaLabel}>
        <path d={HERO_OUTLINE} className="emap-shelf" fillRule="evenodd" />
        {counties.map(({ region, d }) => {
          const it = item(region);
          return (
            <path
              key={region.code}
              d={d}
              fill={it.fill}
              className={"emap-county" + it.cls}
              tabIndex={0}
              role="button"
              aria-pressed={selected === region.code}
              aria-label={it.label}
              onPointerEnter={() => setHover(region)}
              onFocus={() => setHover(region)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect?.(region)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(region);
                }
              }}
            />
          );
        })}
        {/* selected outline drawn last so it sits above neighbours */}
        {counties
          .filter(({ region }) => region.code === selected || region.code === compare)
          .map(({ region, d }) => (
            <path key={`o-${region.code}`} d={d} className={"emap-outline" + (region.code === compare ? " is-compare" : "")} />
          ))}
        {labels &&
          counties.map(({ region, anchor }) => (
            <text
              key={`l-${region.code}`}
              x={anchor[0] + (region.mkood === "0074" ? 30 : region.mkood === "0039" ? 10 : 0)}
              y={anchor[1] + (region.mkood === "0037" ? 14 : 0)}
              className={"emap-label" + (selected === region.code ? " is-selected" : "")}
              textAnchor="middle"
              aria-hidden="true"
            >
              {regionName(region, locale, { short: true })}
            </text>
          ))}
        {showCities &&
          CITY_LIST.map((r) => {
            const [cx, cy] = CITY_POINTS[r.code];
            const it = item(r);
            return (
              <g
                key={r.code}
                className={"emap-city" + it.cls}
                tabIndex={0}
                role="button"
                aria-pressed={selected === r.code}
                aria-label={it.label}
                onPointerEnter={() => setHover(r)}
                onFocus={() => setHover(r)}
                onBlur={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(r);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(r);
                  }
                }}
              >
                <circle cx={cx} cy={cy} r="20" className="emap-city-hit" />
                <circle cx={cx} cy={cy} r="10" fill={it.fill} className="emap-city-dot" />
              </g>
            );
          })}
      </svg>
      {hovered && (
        <div className="emap-tip" style={{ left: pointer.x, top: pointer.y }} aria-hidden="true">
          <p className="emap-tip-name">{regionName(hovered, locale)}</p>
          <p className="emap-tip-value num">{tipValue == null ? t("map.noData") : format(tipValue)}</p>
          {metricLabel && <p className="emap-tip-metric">{metricLabel}</p>}
        </div>
      )}
    </div>
  );
}

export function regionFromMkood(mkood) {
  return regionByMkood(mkood);
}
