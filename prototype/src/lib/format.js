// Locale-aware number, currency, percentage and period formatting.
// Period codes follow PxWeb: "2026M08" (month), "2026Q2" (quarter), "2026".

const NUM = { et: "et-EE", en: "en-GB" };

export function fmtInt(n, locale) {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString(NUM[locale], { maximumFractionDigits: 0 });
}

export function fmtDec(n, locale, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(NUM[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// 481 600 -> "481,6 tuh" / "481.6k"; 7 512 300 -> "7,5 mln" / "7.5M".
export function fmtCompact(n, locale, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${fmtDec(n / 1e6, locale, digits)}${locale === "et" ? " mln" : "M"}`;
  if (abs >= 1e4) return `${fmtDec(n / 1e3, locale, abs >= 1e5 ? 0 : digits)}${locale === "et" ? " tuh" : "k"}`;
  return fmtInt(n, locale);
}

// Short axis-tick form.
export function fmtAxis(n, locale) {
  if (n == null) return "";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString(NUM[locale], { maximumFractionDigits: 1 })}${locale === "et" ? " mln" : "M"}`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString(NUM[locale], { maximumFractionDigits: 0 })}${locale === "et" ? " tuh" : "k"}`;
  return n.toLocaleString(NUM[locale], { maximumFractionDigits: 1 });
}

export function fmtEur(n, locale, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  const v = fmtDec(n, locale, digits);
  return locale === "et" ? `${v} €` : `€${v}`;
}

export function fmtEurCompact(n, locale) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) {
    const v = fmtDec(n / 1e6, locale, 1);
    return locale === "et" ? `${v} mln €` : `€${v}M`;
  }
  return fmtEur(n, locale, 0);
}

export function fmtPct(n, locale, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${fmtDec(n, locale, digits)}%`;
}

// TU122 publishes occupancy in whole per cent and price in whole euros;
// derived means keep their decimals.
export const fmtOcc = (n, locale) => fmtPct(n, locale, Number.isInteger(n) ? 0 : 1);
export const fmtCost = (n, locale) => fmtEur(n, locale, Number.isInteger(n) ? 0 : 2);

export function fmtSignedPct(n, locale, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${fmtPct(Math.abs(n), locale, digits)}`;
}

export function fmtPp(n, locale, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${fmtDec(Math.abs(n), locale, digits)} ${locale === "et" ? "pp" : "pp"}`;
}

const MONTHS = {
  et: ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const MONTHS_SHORT = {
  et: ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

export function monthName(index, locale, short = false) {
  return (short ? MONTHS_SHORT : MONTHS)[locale][index];
}

export function parsePeriod(code) {
  let m = /^(\d{4})M(\d{2})$/.exec(code);
  if (m) return { kind: "month", year: +m[1], month: +m[2] };
  m = /^(\d{4})Q(\d)$/.exec(code);
  if (m) return { kind: "quarter", year: +m[1], quarter: +m[2] };
  m = /^(\d{4})$/.exec(code);
  if (m) return { kind: "year", year: +m[1] };
  return null;
}

const ROMAN = ["I", "II", "III", "IV"];

// "august 2026" / "August 2026"; "II kv 2026" / "Q2 2026"; "2025".
export function fmtPeriod(code, locale, { short = false } = {}) {
  const p = parsePeriod(code);
  if (!p) return code ?? "—";
  if (p.kind === "month") {
    const name = monthName(p.month - 1, locale, short);
    return `${name} ${p.year}`;
  }
  if (p.kind === "quarter") return locale === "et" ? `${ROMAN[p.quarter - 1]} kv ${p.year}` : `Q${p.quarter} ${p.year}`;
  return String(p.year);
}

// Axis tick for monthly series: "jaan 25" style, or just the year in January.
export function fmtMonthTick(code, locale) {
  const p = parsePeriod(code);
  if (!p) return code;
  if (p.kind === "month") return p.month === 1 ? String(p.year) : monthName(p.month - 1, locale, true);
  if (p.kind === "quarter") return p.quarter === 1 ? String(p.year) : locale === "et" ? `${ROMAN[p.quarter - 1]} kv` : `Q${p.quarter}`;
  return String(p.year);
}

// "jaanuar–august 2026" / "January–August 2026".
export function fmtYtdRange(code, locale) {
  const p = parsePeriod(code);
  if (!p || p.kind !== "month") return code;
  if (p.month === 1) return fmtPeriod(code, locale);
  return `${monthName(0, locale, locale === "et")}–${monthName(p.month - 1, locale, locale === "et")} ${p.year}`;
}

export function shiftPeriod(code, months) {
  const p = parsePeriod(code);
  if (!p || p.kind !== "month") return null;
  const idx = p.year * 12 + (p.month - 1) + months;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}M${String(m).padStart(2, "0")}`;
}

export function shiftQuarter(code, quarters) {
  const p = parsePeriod(code);
  if (!p || p.kind !== "quarter") return null;
  const idx = p.year * 4 + (p.quarter - 1) + quarters;
  return `${Math.floor(idx / 4)}Q${(idx % 4) + 1}`;
}

const REGION_CODE_FIX = { UK: "GB", EL: "GR" };
const displayNames = {};
export function countryName(code, locale, fallback) {
  try {
    displayNames[locale] ??= new Intl.DisplayNames([locale === "et" ? "et" : "en"], { type: "region" });
    const iso = REGION_CODE_FIX[code] ?? code;
    if (/^[A-Z]{2}$/.test(iso)) {
      const name = displayNames[locale].of(iso);
      if (name && name !== iso) return name;
    }
  } catch {
    /* Intl.DisplayNames unavailable: fall back to the API label */
  }
  return fallback ?? code;
}
