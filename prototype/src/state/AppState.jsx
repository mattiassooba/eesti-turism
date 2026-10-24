import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { countyFromPath, localeFromPath, routeKeyFromPath, pathFor } from "../lib/routes.js";
import { regionById, regionByLegacySlug, regionPath, ESTONIA } from "../lib/regions.js";
import { STRINGS } from "../i18n/strings.js";

const Ctx = createContext(null);

function lookup(dict, key) {
  return key.split(".").reduce((node, k) => (node == null ? undefined : node[k]), dict);
}

export function AppStateProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const locale = localeFromPath(location.pathname);
  const routeKey = routeKeyFromPath(location.pathname);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const county = countyFromPath(location.pathname);

  const region = county
    ? (regionByLegacySlug(county.slug, county.locale) ?? ESTONIA)
    : (regionById(params.get("r")) ?? ESTONIA);
  const compareParam = params.get("vs");
  const compare = compareParam ? regionById(compareParam) : null;

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

  const setRegion = useCallback(
    (id) => {
      const next = regionById(id) ?? ESTONIA;
      if (routeKey === "regions") {
        navigate(regionPath(next, locale));
        return;
      }
      updateParams({ r: next.id });
    },
    [routeKey, locale, navigate, updateParams]
  );
  const setCompare = useCallback((id) => updateParams({ vs: id }), [updateParams]);

  const href = useCallback(
    (key, { hash, keepRegion = true } = {}) => {
      const selected = region.kind !== "country" ? region : regionById(params.get("r"));
      if (key === "regions" && keepRegion && selected && selected.kind !== "country") {
        return `${regionPath(selected, locale)}${hash ? `#${hash}` : ""}`;
      }
      const keep = new URLSearchParams();
      if (keepRegion) {
        const rid = params.get("r") ?? (region.kind !== "country" ? region.id : null);
        if (rid) keep.set("r", rid);
        if (params.get("vs")) keep.set("vs", params.get("vs"));
      }
      const s = keep.toString();
      return `${pathFor(key, locale)}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
    },
    [locale, params, region]
  );

  const switchLocale = useCallback(
    (next) => {
      if (next === locale) return;
      if (county && region.kind !== "country") {
        navigate(regionPath(region, next));
        return;
      }
      const key = routeKey ?? "home";
      navigate(`${pathFor(key, next)}${location.search}${location.hash}`);
    },
    [locale, routeKey, county, region, location.search, location.hash, navigate]
  );

  const value = useMemo(
    () => ({
      locale,
      t,
      routeKey,
      region,
      compare,
      setRegion,
      setCompare,
      updateParams,
      params,
      href,
      switchLocale,
      brand: "a",
    }),
    [locale, t, routeKey, region, compare, setRegion, setCompare, updateParams, params, href, switchLocale]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}
