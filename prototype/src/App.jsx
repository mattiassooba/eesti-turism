import { lazy, Suspense, useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { ROUTES } from "./lib/routes.js";
import { regionByLegacySlug, regionName } from "./lib/regions.js";
import { useApp } from "./state/AppState.jsx";
import PrototypeRibbon from "./components/layout/PrototypeRibbon.jsx";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import FaviconSync from "./components/brand/FaviconSync.jsx";
import { PageSkeleton } from "./components/ui/States.jsx";
import Home from "./pages/Home.jsx";

const Regions = lazy(() => import("./pages/Regions.jsx"));
const Visitors = lazy(() => import("./pages/Visitors.jsx"));
const Accommodation = lazy(() => import("./pages/Accommodation.jsx"));
const Sector = lazy(() => import("./pages/Sector.jsx"));
const Residents = lazy(() => import("./pages/Residents.jsx"));
const DataTables = lazy(() => import("./pages/DataTables.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Studio = lazy(() => import("./pages/Studio.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

const PAGES = {
  home: Home,
  regions: Regions,
  visitors: Visitors,
  accommodation: Accommodation,
  sector: Sector,
  residents: Residents,
  data: DataTables,
  reports: Reports,
  studio: Studio,
};

// Production's per-region URLs (/maakond/:slug, /en/county/:slug) resolve to
// the new regional explorer with that region preselected — the redirect
// strategy proposed for a future migration, demonstrated here.
function LegacyRegion({ locale }) {
  const { slug } = useParams();
  const region = regionByLegacySlug(slug, locale);
  const base = ROUTES.regions[locale];
  return <Navigate replace to={region ? `${base}?r=${region.id}` : base} />;
}

const TITLE_KEYS = {
  regions: "nav.regions",
  visitors: "nav.visitors",
  accommodation: "nav.accommodationPerf",
  sector: "nav.sector",
  residents: "nav.residents",
  data: "nav.tables",
  reports: "nav.reports",
  studio: "proto.studio",
};
const REGIONAL_PAGES = new Set(["home", "regions", "visitors", "accommodation", "reports"]);

function DocumentTitle() {
  const { routeKey, region, locale, t } = useApp();
  useEffect(() => {
    const suffix = locale === "et" ? "Eesti Turism (prototüüp)" : "Eesti Turism (prototype)";
    const page = TITLE_KEYS[routeKey] ? t(TITLE_KEYS[routeKey]) : routeKey === "home" ? null : "404";
    const where = region.kind !== "country" && REGIONAL_PAGES.has(routeKey) ? regionName(region, locale) : null;
    document.title = [page, where, suffix].filter(Boolean).join(" · ");
  }, [routeKey, region, locale, t]);
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
      <DocumentTitle />
      <ScrollManager />
      <a className="skip-link" href="#main">
        {t("a11y.skip")}
      </a>
      <PrototypeRibbon />
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
            <Route path="/maakond/:slug" element={<LegacyRegion locale="et" />} />
            <Route path="/en/county/:slug" element={<LegacyRegion locale="en" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
