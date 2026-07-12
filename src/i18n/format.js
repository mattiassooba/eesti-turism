const NUMBER_LOCALE = { et: "et-EE", en: "en-US" };

export function formatNumber(n, locale, options) {
  if (typeof n !== "number") return "—";
  return n.toLocaleString(NUMBER_LOCALE[locale] ?? NUMBER_LOCALE.et, options);
}

// Estonian month names as PxWeb renders them in Vaatlusperiood_label
// (e.g. "2026 juuni"), used to detect a stale/untranslated label when the
// API's own English metadata is incomplete for a given table.
const ET_MONTH_NAMES = [
  "jaanuar", "veebruar", "märts", "aprill", "mai", "juuni",
  "juuli", "august", "september", "oktoober", "november", "detsember",
];

// Vaatlusperiood codes are "YYYYMkk" (monthly) or "YYYYQk" (quarterly) or
// a bare "YYYY" (annual). Falls back to Intl.DateTimeFormat when the API's
// own label is missing, or still Estonian despite an English locale being
// requested (incomplete PxWeb translation coverage for that table).
export function formatPeriodLabel(code, apiLabel, locale) {
  if (locale === "et" || !code) return apiLabel ?? code;

  const looksEstonian = apiLabel && ET_MONTH_NAMES.some((m) => apiLabel.toLowerCase().includes(m));
  if (apiLabel && !looksEstonian) return apiLabel;

  const monthMatch = /^(\d{4})M(\d{2})$/.exec(code);
  if (monthMatch) {
    const [, year, month] = monthMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  }

  const quarterMatch = /^(\d{4})Q(\d)$/.exec(code);
  if (quarterMatch) {
    const [, year, quarter] = quarterMatch;
    return `Q${quarter} ${year}`;
  }

  const yearMatch = /^(\d{4})$/.exec(code);
  if (yearMatch) return yearMatch[1];

  return apiLabel ?? code;
}
