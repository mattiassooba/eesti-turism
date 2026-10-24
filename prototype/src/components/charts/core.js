import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useIso(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.width - r.width) < 0.5 && Math.abs(s.height - r.height) < 0.5 ? s : { width: r.width, height: r.height }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

export function linear(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const f = (v) => r0 + (v - d0) * k;
  f.invert = (px) => d0 + (px - r0) / (k || 1);
  return f;
}

// Builds an SVG path through points, breaking at nulls so suppressed or
// missing periods show as gaps instead of being bridged.
export function linePath(points) {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (p == null || p[1] == null || Number.isNaN(p[1])) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    pen = true;
  }
  return d;
}

export function areaPath(points, baseY) {
  const segs = [];
  let cur = [];
  for (const p of points) {
    if (p == null || p[1] == null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) segs.push(cur);
  return segs
    .map((s) => `M${s[0][0].toFixed(1)} ${baseY}` + s.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("") + `L${s[s.length - 1][0].toFixed(1)} ${baseY}Z`)
    .join("");
}

// Spreads end labels vertically so they never overlap.
export function relaxLabels(items, minGap, top, bottom) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let iter = 0; iter < 30; iter++) {
    let moved = false;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].y - sorted[i - 1].y;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        sorted[i - 1].y -= push;
        sorted[i].y += push;
        moved = true;
      }
    }
    for (const s of sorted) s.y = Math.max(top, Math.min(bottom, s.y));
    if (!moved) break;
  }
  return sorted;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
