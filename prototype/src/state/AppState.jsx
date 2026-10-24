import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { localeFromPath, routeKeyFromPath, pathFor } from "../lib/routes.js";
import { regionById, ESTONIA } from "../lib/regions.js";
import { STRINGS } from "../i18n/strings.js";

const Ctx = createContext(null);
const BRAND_KEY = "proto-brand-concept";

function lookup(dict, key) {
  return key.split(".").reduce((node, k) => (node == null ? undefined : node[k]), dict);
}

// One provider for the three pieces of global UI state:
//   locale  — from the path (/en prefix), same rule as production
//   region  — ?r=<id>, compare region ?vs=<id>; URL is the source of truth
//             so selections are shareable and survive language switches
//   brand   — which of the two logo concepts the prototype header shows
export function AppStateProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const locale = localeFromPath(location.pathname);
  const routeKey = routeKeyFromPath(location.pathname);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const region = regionById(params.get("r")) ?? ESTONIA;
  const compareParam = params.get("vs");
  const compare = compareParam ? regionById(compareParam) : null;

  const [brand, setBrandState] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("brand");
    if (fromUrl === "a" || fromUrl === "b") return fromUrl;
    return localStorage.getItem(BRAND_KEY) ?? "a";
  });
  const setBrand = useCallback((b) => {
    setBrandState(b);
    localStorage.setItem(BRAND_KEY, b);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("eesti-turism-locale", locale);
  }, [locale]);

  const t = useCallback(
    (key, vars) => {
      const v = lookup(STRINGS[locale], key) ?? lookup(STRINGS.et, key);
      if (v == null) {
        if (import.meta.env.DEV) console.warn(`[i18n] missing ${locale}:${key}`);
        return key;
      }
      return typeof v === "function" ? v(vars) : v;
    },
    [locale]
  );

  const updateParams = useCallback(
    (patch, { replace = false } = {}) => {
      const next = new URLSearchParams(location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "" || (k === "r" && v === "ee")) next.delete(k);
        else next.set(k, v);
      }
      if (next.get("vs") && next.get("vs") === (next.get("r") ?? "ee")) next.delete("vs");
      const s = next.toString();
      navigate({ pathname: location.pathname, search: s ? `?${s}` : "", hash: location.hash }, { replace });
    },
    [location.pathname, location.search, location.hash, navigate]
  );

  const setRegion = useCallback((id) => updateParams({ r: id }), [updateParams]);
  const setCompare = useCallback((id) => updateParams({ vs: id }), [updateParams]);

  // Links between pages carry the region selection along.
  const href = useCallback(
    (key, { hash, keepRegion = true } = {}) => {
      const keep = new URLSearchParams();
      if (keepRegion) {
        if (params.get("r")) keep.set("r", params.get("r"));
        if (params.get("vs")) keep.set("vs", params.get("vs"));
      }
      const s = keep.toString();
      return `${pathFor(key, locale)}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
    },
    [locale, params]
  );

  const switchLocale = useCallback(
    (next) => {
      if (next === locale) return;
      const key = routeKey ?? "home";
      navigate(`${pathFor(key, next)}${location.search}${location.hash}`);
    },
    [locale, routeKey, location.search, location.hash, navigate]
  );

  const value = useMemo(
    () => ({ locale, t, routeKey, region, compare, setRegion, setCompare, updateParams, params, href, switchLocale, brand, setBrand }),
    [locale, t, routeKey, region, compare, setRegion, setCompare, updateParams, params, href, switchLocale, brand, setBrand]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}
