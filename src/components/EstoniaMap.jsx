import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";
import { seasonalityColor } from "../colorScale";

const WIDTH = 520;
const HEIGHT = 340;

export default function EstoniaMap({ valuesByMkood, unit, selectedMkood, onSelectCounty }) {
  const [topology, setTopology] = useState(null);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/maakond-topo.json")
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((topo) => !cancelled && setTopology(topo))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const { features, path, max, min } = useMemo(() => {
    if (!topology) return { features: [], path: null, max: 0, min: 0 };
    const objectName = Object.keys(topology.objects)[0];
    const collection = feature(topology, topology.objects[objectName]);
    const projection = geoMercator().fitSize([WIDTH, HEIGHT], collection);
    const pathGen = geoPath(projection);
    const values = collection.features
      .map((f) => valuesByMkood[f.properties.MKOOD])
      .filter((v) => typeof v === "number");
    return {
      features: collection.features,
      path: pathGen,
      max: values.length ? Math.max(...values) : 1,
      min: values.length ? Math.min(...values) : 0,
    };
  }, [topology, valuesByMkood]);

  if (error) return <div className="panel-error">Kaardi laadimine ebaõnnestus: {error}</div>;
  if (!topology) return <div className="panel-status">Laen kaarti…</div>;

  const range = max - min || 1;

  function selectCounty(f) {
    onSelectCounty?.(f.properties.MKOOD, f.properties.MNIMI);
  }

  return (
    <div className="estonia-map">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Eesti maakondade kaart">
        {features.map((f) => {
          const value = valuesByMkood[f.properties.MKOOD];
          const hasValue = typeof value === "number";
          const t = hasValue ? (value - min) / range : 0;
          const isSelected = selectedMkood === f.properties.MKOOD;
          return (
            <path
              key={f.properties.MKOOD}
              d={path(f)}
              fill={hasValue ? seasonalityColor(t) : "#dbe0df"}
              stroke={isSelected ? "#101b26" : "#eef0ee"}
              strokeWidth={isSelected ? 2.5 : 1}
              onMouseEnter={() => setHovered(f.properties)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(f.properties)}
              onBlur={() => setHovered(null)}
              onClick={() => selectCounty(f)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectCounty(f);
                }
              }}
              tabIndex={onSelectCounty ? 0 : -1}
              role={onSelectCounty ? "button" : undefined}
              aria-label={onSelectCounty ? f.properties.MNIMI : undefined}
              aria-pressed={onSelectCounty ? isSelected : undefined}
              style={{ cursor: onSelectCounty ? "pointer" : "default" }}
            >
              <title>
                {f.properties.MNIMI}
                {hasValue ? `: ${value.toLocaleString("et-EE")}${unit ? ` ${unit}` : ""}` : ""}
              </title>
            </path>
          );
        })}
      </svg>
      <div className="estonia-map-caption">
        {hovered
          ? `${hovered.MNIMI}: ${
              typeof valuesByMkood[hovered.MKOOD] === "number"
                ? valuesByMkood[hovered.MKOOD].toLocaleString("et-EE") + (unit ? ` ${unit}` : "")
                : "andmed puuduvad"
            }`
          : "Liigu hiirega maakonna kohal, kliki valimiseks"}
      </div>
      <div className="estonia-map-source">Piirid: Maa-amet, seisuga 01.09.2018</div>
    </div>
  );
}
