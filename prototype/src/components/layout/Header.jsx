import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useApp } from "../../state/AppState.jsx";
import { Logo } from "../brand/Marks.jsx";
import RegionPicker from "./RegionPicker.jsx";
import LangSwitch from "./LangSwitch.jsx";
import Icon from "../ui/Icon.jsx";

// Six top-level destinations; the two with sub-pages open a small menu.
function useNav() {
  const { t } = useApp();
  return [
    { key: "home", label: t("nav.overview") },
    { key: "regions", label: t("nav.regions") },
    { key: "visitors", label: t("nav.visitors") },
    {
      key: "accommodationGroup",
      label: t("nav.accommodation"),
      children: [
        { key: "accommodation", label: t("nav.accommodationPerf"), desc: t("nav.accommodationPerfDesc") },
        { key: "sector", label: t("nav.sector"), desc: t("nav.sectorDesc") },
      ],
    },
    { key: "residents", label: t("nav.residents") },
    {
      key: "dataGroup",
      label: t("nav.data"),
      children: [
        { key: "data", label: t("nav.tables"), desc: t("nav.tablesDesc") },
        { key: "reports", label: t("nav.reports"), desc: t("nav.reportsDesc") },
      ],
    },
  ];
}

function NavMenu({ item, active }) {
  const { href } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <li className="nav-item" ref={ref} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className={"nav-link" + (active ? " is-active" : "")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
      >
        {item.label}
        <Icon name="chevronDown" size={14} className="nav-chev" />
      </button>
      <div className={"nav-menu" + (open ? " is-open" : "")}>
        <ul>
          {item.children.map((c) => (
            <li key={c.key}>
              <NavLink to={href(c.key)} className="nav-menu-link" onClick={() => setOpen(false)}>
                <span className="nav-menu-title">{c.label}</span>
                <span className="nav-menu-desc">{c.desc}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export default function Header({ transparent }) {
  const { t, href, routeKey, brand } = useApp();
  const nav = useNav();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const dark = (transparent && !scrolled) || menuOpen;
  const isActive = (item) => (item.children ? item.children.some((c) => c.key === routeKey) : item.key === routeKey);

  return (
    <header
      className={"site-header" + (transparent ? " is-overlay" : "") + (scrolled ? " is-scrolled" : "") + (menuOpen ? " is-menu-open" : "")}
      data-theme={dark ? "dark" : "light"}
    >
      <div className="site-header-inner">
        <Link to={href("home")} className="site-logo" aria-label={t("brand.homeLabel")}>
          <Logo concept={brand} tone={dark ? "dark" : "light"} />
        </Link>

        <nav className="primary-nav" aria-label={t("nav.label")}>
          <ul>
            {nav.map((item) =>
              item.children ? (
                <NavMenu key={item.key} item={item} active={isActive(item)} />
              ) : (
                <li key={item.key} className="nav-item">
                  <NavLink to={href(item.key)} end className={"nav-link" + (isActive(item) ? " is-active" : "")}>
                    {item.label}
                  </NavLink>
                </li>
              )
            )}
          </ul>
        </nav>

        <div className="header-tools">
          <RegionPicker />
          <LangSwitch className="header-lang" />
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={22} />
            <span className="sr-only">{t(menuOpen ? "nav.closeMenu" : "nav.openMenu")}</span>
          </button>
        </div>
      </div>

      <div id="mobile-menu" className={"mobile-menu" + (menuOpen ? " is-open" : "")} data-theme="dark" hidden={!menuOpen}>
        <nav aria-label={t("nav.label")}>
          <ul className="mobile-nav">
            {nav.flatMap((item) => (item.children ? item.children : [item])).map((item, i) => (
              <li key={item.key} style={{ "--i": i }}>
                <NavLink to={href(item.key)} end className={"mobile-nav-link" + (routeKey === item.key ? " is-active" : "")}>
                  <span>{item.label}</span>
                  <Icon name="arrowRight" size={20} />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mobile-menu-foot">
          <LangSwitch />
          <Link to={href("studio", { keepRegion: false })} className="mobile-studio-link">
            {t("proto.studio")} →
          </Link>
        </div>
      </div>
    </header>
  );
}
