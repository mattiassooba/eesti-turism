// Derives every geographic shape the prototype draws from the same
// authoritative source the production map already uses
// (public/data/maakond-topo.json — Maa-amet EHAK boundaries, 01.09.2018).
// Nothing here is hand-drawn: the hero artwork, the brand mark and the
// favicon are all projections + simplifications of that geometry.
//
// Projection: Lambert conformal conic with the L-EST97 standard parallels
// (58°00' and 59°20') and central meridian 24°E, so the shape reads the
// way Estonians see it on Maa-amet maps rather than a stretched Mercator.
//
// Run: node prototype/scripts/build-geo.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { feature, merge, mesh } from "topojson-client";
import { geoConicConformal, geoPath, geoArea, geoGraticule } from "d3-geo";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const topo = JSON.parse(await readFile(path.join(ROOT, "public/data/maakond-topo.json"), "utf8"));
const obj = topo.objects.maakond;
const counties = feature(topo, obj);
const nation = merge(topo, obj.geometries);
const inner = mesh(topo, obj, (a, b) => a !== b);

function projectionFor(width, height, target, padding = 0) {
  return geoConicConformal()
    .parallels([58, 59 + 20 / 60])
    .rotate([-24, 0])
    .fitExtent(
      [
        [padding, padding],
        [width - padding, height - padding],
      ],
      target
    );
}

// Douglas–Peucker on an already-projected ring.
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const sq = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > sq && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(points) {
  let s = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    s += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  }
  return Math.abs(s / 2);
}

const r = (n, d) => Number(n.toFixed(d));

function ringsToPath(rings, decimals) {
  return rings
    .map(
      (ring) =>
        "M" +
        ring
          .map(([x, y]) => `${r(x, decimals)} ${r(y, decimals)}`)
          .join("L") +
        "Z"
    )
    .join("");
}

// Projects a (Multi)Polygon geometry, simplifies every ring and drops
// rings (islets, lake holes) smaller than minArea in projected units².
function projectPolygons(geometry, projection, { tolerance, minArea }) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const out = [];
  for (const poly of polys) {
    poly.forEach((ring, ri) => {
      const projected = ring.map((c) => projection(c));
      const area = ringArea(projected);
      if (area < minArea) return;
      // Holes (ri > 0) are lakes inside the outline; only keep big ones.
      if (ri > 0 && area < minArea * 4) return;
      const simple = simplify(projected, tolerance);
      if (simple.length >= 4) out.push(simple);
    });
  }
  return out;
}

function projectLines(geometry, projection, tolerance) {
  return geometry.coordinates.map((line) => simplify(line.map((c) => projection(c)), tolerance));
}

function linesToPath(lines, decimals) {
  return lines
    .filter((l) => l.length > 1)
    .map((l) => "M" + l.map(([x, y]) => `${r(x, decimals)} ${r(y, decimals)}`).join("L"))
    .join("");
}

// ── Hero artwork (1000 × 640 canvas, generous detail) ──────────────────
const HERO_W = 1000;
const HERO_H = 640;
const heroProj = projectionFor(HERO_W, HERO_H, nation, 8);
const heroOutline = ringsToPath(projectPolygons(nation, heroProj, { tolerance: 0.45, minArea: 2.5 }), 1);
const heroBorders = linesToPath(projectLines(inner, heroProj, 0.6), 1);

// ── Brand mark (100 × 62 viewBox) and favicon (32 × 32) ────────────────
const MARK_W = 100;
const MARK_H = 62;
const markProj = projectionFor(MARK_W, MARK_H, nation, 1);
const markRings = projectPolygons(nation, markProj, { tolerance: 0.28, minArea: 2.2 });
const markOutline = ringsToPath(markRings, 2);

const FAV = 32;
const favProj = projectionFor(FAV, FAV * 0.62, nation, 0.5);
const favRings = projectPolygons(nation, favProj, { tolerance: 0.22, minArea: 0.9 });
const favOutline = ringsToPath(favRings, 2);

// Per-county shapes in the same 1000 × 640 space — reused by the hero
// (selected-region highlight) and the interactive choropleth, so neither
// needs to download the 480 KB topojson at runtime.
const heroPathGen = geoPath(heroProj);
const countyPaths = Object.fromEntries(
  counties.features.map((f) => [
    f.properties.MKOOD,
    ringsToPath(projectPolygons(f.geometry, heroProj, { tolerance: 0.5, minArea: 3 }), 1),
  ])
);
const countyAnchors = Object.fromEntries(
  counties.features.map((f) => {
    const [x, y] = heroPathGen.centroid(f);
    return [f.properties.MKOOD, [r(x, 1), r(y, 1)]];
  })
);

// Cities Statistikaamet publishes separately (each inside its county).
// Coordinates are the cities' official centre points (WGS84).
const CITY_COORDS = {
  EE00370784000004: [24.7536, 59.437],
  EE00680624661905: [24.4971, 58.3859],
  EE00790793815105: [26.729, 58.378],
};
const cityPoints = Object.fromEntries(
  Object.entries(CITY_COORDS).map(([code, c]) => {
    const [x, y] = heroProj(c);
    return [code, [r(x, 1), r(y, 1)]];
  })
);

// Half-degree latitude / one-degree longitude graticule, extended past the
// canvas so it can bleed off the hero edges.
const wideProj = heroProj.clipExtent([
  [-400, -300],
  [HERO_W + 400, HERO_H + 300],
]);
const graticule = geoPath(wideProj)(geoGraticule().extent([[18, 56.5], [30, 60.5]]).step([1, 0.5])());
const graticuleLabels = [];
for (const lat of [58, 58.5, 59, 59.5]) {
  const [, y] = wideProj([21.2, lat]);
  graticuleLabels.push({ kind: "lat", value: lat, y: r(y, 1) });
}
for (const lon of [22, 23, 24, 25, 26, 27, 28]) {
  const [x] = wideProj([lon, 57.45]);
  graticuleLabels.push({ kind: "lon", value: lon, x: r(x, 1) });
}
const graticulePath = graticule.replace(/(\d+\.\d{2})\d+/g, "$1");

const totalArea = geoArea(nation);

const banner = `// GENERATED by prototype/scripts/build-geo.mjs from public/data/maakond-topo.json
// (Maa-amet EHAK county boundaries, validity 01.09.2018). Do not edit by hand.
// Projection: Lambert conformal conic, L-EST97 parallels 58°/59°20', meridian 24°E.
`;

const body = `${banner}
export const HERO_VIEWBOX = [${HERO_W}, ${HERO_H}];
export const HERO_OUTLINE = ${JSON.stringify(heroOutline)};
export const HERO_BORDERS = ${JSON.stringify(heroBorders)};
export const COUNTY_ANCHORS = ${JSON.stringify(countyAnchors)};
export const COUNTY_PATHS = ${JSON.stringify(countyPaths)};
export const CITY_POINTS = ${JSON.stringify(cityPoints)};
export const GRATICULE = ${JSON.stringify(graticulePath)};
export const GRATICULE_LABELS = ${JSON.stringify(graticuleLabels)};

export const MARK_VIEWBOX = [${MARK_W}, ${MARK_H}];
export const MARK_OUTLINE = ${JSON.stringify(markOutline)};

export const FAVICON_VIEWBOX = [${FAV}, ${r(FAV * 0.62, 2)}];
export const FAVICON_OUTLINE = ${JSON.stringify(favOutline)};

export const NATION_STERADIANS = ${totalArea};
`;

const outDir = path.join(ROOT, "prototype/src/geo");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "generated.js"), body);
console.log(
  `hero outline ${heroOutline.length} chars, borders ${heroBorders.length}, mark ${markOutline.length} (${markRings.length} rings), favicon ${favOutline.length} (${favRings.length} rings)`
);
