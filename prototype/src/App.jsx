import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { Route, Routes, useLocation, useParams } from "react-router-dom";
import { ROUTES, countyFromPath, localeFromPath } from "./lib/routes.js";
import { regionByLegacySlug, regionName, regionPath } from "./lib/regions.js";
import { useApp } from "./state/AppState.jsx";
import { useDocumentMeta } from "@prod/hooks/useDocumentMeta.js";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import FaviconSync from "./components/brand/FaviconSync.jsx";
import { PageSkeleton } from "./components/ui/States.jsx";
import Home from "./pages/Home.jsx";

const Regions = lazy(() => import("./pages/Regions.jsx"));
const Visitors = lazy(() => import("./pages/Visitors.jsx"));
const Accommodation = lazy(() => import("./pages/Accommodation.jsx"));
const Operator = lazy(() => import("./pages/Operator.jsx"));
const Sector = lazy(() => import("./pages/Sector.jsx"));
const Residents = lazy(() => import("./pages/Residents.jsx"));
const DataTables = lazy(() => import("./pages/DataTables.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

const PAGES = {
  home: Home,
  regions: Regions,
  visitors: Visitors,
  accommodation: Accommodation,
  operator: Operator,
  sector: Sector,
  residents: Residents,
  data: DataTables,
  reports: Reports,
};

function CountyPage() {
  const { slug } = useParams();
  const locale = localeFromPath(useLocation().pathname);
  const region = regionByLegacySlug(slug, locale);
  if (!region) return <NotFound />;
  return <Regions />;
}

const TITLE_KEYS = {
  regions: "nav.regions",
  visitors: "nav.visitors",
  accommodation: "nav.accommodationPerf",
  operator: "nav.operator",
  sector: "nav.sector",
  residents: "nav.residents",
  data: "nav.tables",
  reports: "nav.reports",
};
const REGIONAL_PAGES = new Set(["home", "regions", "visitors", "accommodation", "operator", "reports"]);

function DocumentMeta() {
  const { routeKey, region, locale, t } = useApp();
  const location = useLocation();
  const county = countyFromPath(location.pathname);

  const meta = useMemo(() => {
    const namedRegion = region.kind !== "country";
    const where = namedRegion && REGIONAL_PAGES.has(routeKey) ? regionName(region, locale) : null;

    if (county || (routeKey === "regions" && namedRegion)) {
      const path = namedRegion ? regionPath(region, locale) : location.pathname;
      return locale === "en"
        ? {
            title: `${regionName(region, locale)} tourism statistics — Eesti Turism`,
            description: `Tourism statistics for ${regionName(region, locale)}: visitor numbers, nights stayed, accommodation capacity, and a monthly AI-written summary, based on Statistikaamet data.`,
            path,
          }
        : {
            title: `${regionName(region, locale)} turismistatistika — Eesti Turism`,
            description: `${regionName(region, locale)} turismistatistika: külastajate arv, ööbimised, majutuskohtade mahutavus ning igakuine AI-kokkuvõte Statistikaameti andmete põhjal.`,
            path,
          };
    }

    if (routeKey === "home") {
      return locale === "en"
        ? {
            title: "Eesti Turism — Estonian tourism statistics",
            description:
              "Estonian tourism statistics overview based on Statistikaamet data: visitor numbers, nights stayed, county and seasonality comparisons, accommodation capacity, and a monthly AI summary.",
            path: "/en",
          }
        : {
            title: "Eesti Turism — turismistatistika ja majutusandmed",
            description:
              "Eesti turismistatistika ülevaade Statistikaameti andmete põhjal: külastajate arv, ööbimised, maakondade ja hooajalisuse võrdlus, majutuskohtade mahutavus ning igakuine AI-kokkuvõte.",
            path: "/",
          };
    }

    const page = TITLE_KEYS[routeKey] ? t(TITLE_KEYS[routeKey]) : routeKey ? "404" : "404";
    const title = [page, where, "Eesti Turism"].filter(Boolean).join(" · ");
    const description = TITLE_KEYS[routeKey] ? t(`meta.${routeKey}`) : t("meta.notFound");
    return { title, description, path: location.pathname };
  }, [routeKey, region, locale, t, location.pathname, county]);

  useDocumentMeta(meta);
  return null;
}

function ScrollManager() {
  const { pathname, hash } = useLocation();
  const prev = useRef(pathname);
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
        prev.current = pathname;
        return;
      }
    }
    if (prev.current !== pathname) window.scrollTo(0, 0);
    prev.current = pathname;
  }, [pathname, hash]);
  return null;
}

export default function App() {
  const { routeKey, t } = useApp();
  return (
    <>
      <FaviconSync />
      <DocumentMeta />
      <ScrollManager />
      <a className="skip-link" href="#main">
        {t("a11y.skip")}
      </a>
      <Header transparent={routeKey === "home"} />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {Object.entries(ROUTES).flatMap(([key, paths]) => {
              const Page = PAGES[key];
              return [
                <Route key={`${key}-et`} path={paths.et} element={<Page />} />,
                <Route key={`${key}-en`} path={paths.en} element={<Page />} />,
              ];
            })}
            <Route path="/maakond/:slug" element={<CountyPage />} />
            <Route path="/en/county/:slug" element={<CountyPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
