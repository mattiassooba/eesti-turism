// Canonical Maakond dimension entries (TU131/TU122/etc.), consolidating
// what used to be separately-maintained REGION_LABELS/MKOOD_LABELS copies
// in Dashboard.jsx, Page2Map.jsx, Page4Residents.jsx, and
// OperatorInsights.jsx. `mkood` is the 4-digit map code used by the
// EstoniaMap topojson (Statistikaamet's own "EE" + mkood + 10 zeros <->
// the map's MKOOD is a fixed, mechanical transform — see
// Page2Map.jsx's toMkood/toStatCode). The 3 city entries are Statistikaamet
// sub-splits of their own maakond (e.g. Tallinn sits inside Harju) and are
// only relevant to OperatorInsights' region selector, not the map.
const COUNTIES_RAW = [
  { code: "EE00370000000000", mkood: "0037", et: "Harju maakond", en: "Harju county" },
  { code: "EE00390000000000", mkood: "0039", et: "Hiiu maakond", en: "Hiiu county" },
  { code: "EE00450000000000", mkood: "0045", et: "Ida-Viru maakond", en: "Ida-Viru county" },
  { code: "EE00500000000000", mkood: "0050", et: "Jõgeva maakond", en: "Jõgeva county" },
  { code: "EE00520000000000", mkood: "0052", et: "Järva maakond", en: "Järva county" },
  { code: "EE00560000000000", mkood: "0056", et: "Lääne maakond", en: "Lääne county" },
  { code: "EE00600000000000", mkood: "0060", et: "Lääne-Viru maakond", en: "Lääne-Viru county" },
  { code: "EE00640000000000", mkood: "0064", et: "Põlva maakond", en: "Põlva county" },
  { code: "EE00680000000000", mkood: "0068", et: "Pärnu maakond", en: "Pärnu county" },
  { code: "EE00710000000000", mkood: "0071", et: "Rapla maakond", en: "Rapla county" },
  { code: "EE00740000000000", mkood: "0074", et: "Saare maakond", en: "Saare county" },
  { code: "EE00790000000000", mkood: "0079", et: "Tartu maakond", en: "Tartu county" },
  { code: "EE00810000000000", mkood: "0081", et: "Valga maakond", en: "Valga county" },
  { code: "EE00840000000000", mkood: "0084", et: "Viljandi maakond", en: "Viljandi county" },
  { code: "EE00870000000000", mkood: "0087", et: "Võru maakond", en: "Võru county" },
];

// City sub-splits, appended after the 15 maakonds for OperatorInsights'
// region selector (which offers both granularities).
const CITIES_RAW = [
  { code: "EE00370784000004", et: "Tallinn", en: "Tallinn" },
  { code: "EE00680624661905", et: "Pärnu linn", en: "Pärnu (city)" },
  { code: "EE00790793815105", et: "Tartu linn", en: "Tartu (city)" },
];

// Ascii, hyphenated, per-locale — e.g. "Jõgeva maakond" -> "jogeva-maakond",
// "Pärnu (city)" -> "parnu-city". Used for the /maakond/:slug and
// /en/county/:slug routes; transliterated (not stripped) so diacritics
// still read as the right word.
const DIACRITICS = { õ: "o", ä: "a", ö: "o", ü: "u", š: "s", ž: "z" };
function slugify(label) {
  return label
    .toLowerCase()
    .replace(/[õäöüšž]/g, (ch) => DIACRITICS[ch])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function withSlugs(list) {
  return list.map((c) => ({ ...c, slugEt: slugify(c.et), slugEn: slugify(c.en) }));
}

export const COUNTIES = withSlugs(COUNTIES_RAW);
export const CITIES = withSlugs(CITIES_RAW);

const BY_CODE = new Map([...COUNTIES, ...CITIES].map((c) => [c.code, c]));
const BY_MKOOD = new Map(COUNTIES.map((c) => [c.mkood, c]));
const BY_SLUG = new Map();
for (const c of [...COUNTIES, ...CITIES]) {
  BY_SLUG.set(`et:${c.slugEt}`, c);
  BY_SLUG.set(`en:${c.slugEn}`, c);
}

export function countyLabelByCode(code, locale) {
  return BY_CODE.get(code)?.[locale] ?? code;
}

export function countyLabelByMkood(mkood, locale) {
  return BY_MKOOD.get(mkood)?.[locale] ?? mkood;
}

export function countyBySlug(slug, locale) {
  return BY_SLUG.get(`${locale}:${slug}`) ?? null;
}

export function slugForCode(code, locale) {
  const c = BY_CODE.get(code);
  return c ? (locale === "en" ? c.slugEn : c.slugEt) : null;
}
