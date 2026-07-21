import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import et from "./et";
import en from "./en";

const DICTS = { et, en };
const STORAGE_KEY = "eesti-turism-locale";

const LocaleContext = createContext(null);

function resolvePath(dict, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), dict);
}

export function LocaleProvider({ children }) {
  // Locale is derived from the URL, not stored state — /en and
  // /en/county/:slug are real, independently indexable English pages, so
  // the same path must always render the same language for every visitor
  // (including crawlers), never a stored preference or navigator.language.
  // See src/App.jsx for the language-switch buttons, which navigate to the
  // equivalent path instead of just flipping this.
  const { pathname } = useLocation();
  const locale = pathname === "/en" || pathname.startsWith("/en/") ? "en" : "et";

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  // Dictionary values are plain strings or (vars) => string for
  // interpolation (e.g. lastMonths: (n) => `Viimased ${n} kuud`) — no
  // templating library needed for this small a vocabulary.
  const t = useCallback(
    (path, vars) => {
      const value = resolvePath(DICTS[locale], path) ?? resolvePath(et, path) ?? path;
      return typeof value === "function" ? value(vars) : value;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useTranslation must be used within LocaleProvider");
  return ctx;
}

export { LocaleContext };
