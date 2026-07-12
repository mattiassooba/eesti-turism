import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import et from "./et";
import en from "./en";

const DICTS = { et, en };
const STORAGE_KEY = "eesti-turism-locale";

const LocaleContext = createContext(null);

function resolvePath(dict, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), dict);
}

function initialLocale() {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored === "et" || stored === "en") return stored;
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en")
    ? "en"
    : "et";
}

export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState(initialLocale);

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

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useTranslation must be used within LocaleProvider");
  return ctx;
}

export { LocaleContext };
