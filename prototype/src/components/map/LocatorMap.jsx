import { memo } from "react";
import { COUNTY_PATHS, CITY_POINTS, HERO_VIEWBOX } from "../../geo/generated.js";
import { regionByCode } from "../../lib/regions.js";

// Tiny "where am I" map: all counties in a quiet tone, the selected county
// (or a city's parent county plus a dot) highlighted. Used in the region
// trigger, page headers and comparison chips.
function LocatorMap({ code, compareCode, className, title }) {
  const region = regionByCode(code);
  const compare = compareCode ? regionByCode(compareCode) : null;
  const activeMkood = region.kind === "county" ? region.mkood : region.kind === "city" ? regionByCode(region.parent).mkood : null;
  const compareMkood =
    compare?.kind === "county" ? compare.mkood : compare?.kind === "city" ? regionByCode(compare.parent).mkood : null;
  const [w, h] = HERO_VIEWBOX;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={"locator " + (className ?? "") + (region.kind === "country" ? " locator--all" : "")}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {Object.entries(COUNTY_PATHS).map(([mkood, d]) => (
        <path
          key={mkood}
          d={d}
          className={
            "locator-county" +
            (mkood === activeMkood ? " is-active" : "") +
            (mkood === compareMkood && mkood !== activeMkood ? " is-compare" : "")
          }
        />
      ))}
      {region.kind === "city" && <circle cx={CITY_POINTS[region.code][0]} cy={CITY_POINTS[region.code][1]} r="26" className="locator-city" />}
      {compare?.kind === "city" && <circle cx={CITY_POINTS[compare.code][0]} cy={CITY_POINTS[compare.code][1]} r="26" className="locator-city is-compare" />}
    </svg>
  );
}

export default memo(LocatorMap);
