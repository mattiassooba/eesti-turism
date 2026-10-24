// Every page exists under an Estonian path (default) and an /en path.
// Switching language maps between the two and keeps the query string, so
// the selected region and comparison survive the switch.
export const ROUTES = {
  home: { et: "/", en: "/en" },
  regions: { et: "/piirkonnad", en: "/en/regions" },
  visitors: { et: "/kulastajad", en: "/en/visitors" },
  accommodation: { et: "/majutus", en: "/en/accommodation" },
  operator: { et: "/majutusettevotja", en: "/en/operator-view" },
  sector: { et: "/majutussektor", en: "/en/accommodation-sector" },
  residents: { et: "/elanike-reisid", en: "/en/residents-travel" },
  data: { et: "/andmed", en: "/en/data" },
  reports: { et: "/aruanded", en: "/en/reports" },
};

export function localeFromPath(pathname) {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "et";
}

export function countyFromPath(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const et = clean.match(/^\/maakond\/([a-z0-9-]+)$/);
  if (et) return { locale: "et", slug: et[1] };
  const en = clean.match(/^\/en\/county\/([a-z0-9-]+)$/);
  if (en) return { locale: "en", slug: en[1] };
  return null;
}

export function routeKeyFromPath(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (countyFromPath(clean)) return "regions";
  for (const [key, paths] of Object.entries(ROUTES)) {
    if (paths.et === clean || paths.en === clean) return key;
  }
  return null;
}

export function pathFor(key, locale) {
  return ROUTES[key]?.[locale] ?? ROUTES.home[locale];
}
