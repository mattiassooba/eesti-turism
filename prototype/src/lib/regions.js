// Region model for the prototype, built on the production county
// dictionary (src/data/counties.js) so codes and labels stay identical.
import { COUNTIES, CITIES } from "@prod/data/counties.js";

// Short, language-neutral ids used in the ?r= / ?vs= query parameters.
const SHORT = {
  EE00370000000000: "harju",
  EE00390000000000: "hiiu",
  EE00450000000000: "ida-viru",
  EE00500000000000: "jogeva",
  EE00520000000000: "jarva",
  EE00560000000000: "laane",
  EE00600000000000: "laane-viru",
  EE00640000000000: "polva",
  EE00680000000000: "parnu",
  EE00710000000000: "rapla",
  EE00740000000000: "saare",
  EE00790000000000: "tartu",
  EE00810000000000: "valga",
  EE00840000000000: "viljandi",
  EE00870000000000: "voru",
  EE00370784000004: "tallinn",
  EE00680624661905: "parnu-linn",
  EE00790793815105: "tartu-linn",
};

const PARENT = {
  EE00370784000004: "EE00370000000000",
  EE00680624661905: "EE00680000000000",
  EE00790793815105: "EE00790000000000",
};

// Short display names: "Harju" rather than "Harju maakond" where space is
// tight (map labels, ranking rows); full names everywhere else.
function shortName(label, locale) {
  return label.replace(locale === "et" ? / maakond$/ : / county$/, "");
}

export const ESTONIA = {
  code: "EE",
  id: "ee",
  kind: "country",
  et: "Eesti",
  en: "Estonia",
  shortEt: "Eesti",
  shortEn: "Estonia",
};

export const REGIONS = [
  ESTONIA,
  ...COUNTIES.map((c) => ({
    code: c.code,
    id: SHORT[c.code],
    kind: "county",
    mkood: c.mkood,
    et: c.et,
    en: c.en.replace(" county", " County"),
    shortEt: shortName(c.et, "et"),
    shortEn: shortName(c.en, "en"),
    legacySlugEt: c.slugEt,
    legacySlugEn: c.slugEn,
  })),
  ...CITIES.map((c) => ({
    code: c.code,
    id: SHORT[c.code],
    kind: "city",
    parent: PARENT[c.code],
    et: c.et,
    en: c.en === "Pärnu (city)" ? "Pärnu city" : c.en === "Tartu (city)" ? "Tartu city" : c.en,
    shortEt: c.et,
    shortEn: c.en === "Pärnu (city)" ? "Pärnu city" : c.en === "Tartu (city)" ? "Tartu city" : c.en,
    legacySlugEt: c.slugEt,
    legacySlugEn: c.slugEn,
  })),
];

export const COUNTY_LIST = REGIONS.filter((r) => r.kind === "county");
export const CITY_LIST = REGIONS.filter((r) => r.kind === "city");
export const ALL_CODES = REGIONS.map((r) => r.code);
export const SUBNATIONAL_CODES = REGIONS.filter((r) => r.kind !== "country").map((r) => r.code);

const BY_CODE = new Map(REGIONS.map((r) => [r.code, r]));
const BY_ID = new Map(REGIONS.map((r) => [r.id, r]));
const BY_MKOOD = new Map(COUNTY_LIST.map((r) => [r.mkood, r]));

export const regionByCode = (code) => BY_CODE.get(code) ?? ESTONIA;
export const regionById = (id) => (id ? BY_ID.get(id) : null) ?? null;
export const regionByMkood = (mkood) => BY_MKOOD.get(mkood) ?? null;

export function regionByLegacySlug(slug, locale) {
  return REGIONS.find((r) => (locale === "en" ? r.legacySlugEn : r.legacySlugEt) === slug) ?? null;
}

export function regionPath(region, locale) {
  if (!region || region.kind === "country") return locale === "en" ? "/en/regions" : "/piirkonnad";
  return locale === "en" ? `/en/county/${region.legacySlugEn}` : `/maakond/${region.legacySlugEt}`;
}

export function regionName(region, locale, { short = false } = {}) {
  if (!region) return "";
  if (short) return locale === "en" ? region.shortEn : region.shortEt;
  return locale === "en" ? region.en : region.et;
}

// Which geography each published dataset actually supports. Used to decide
// whether a global region selection applies, and to explain when it doesn't.
export const AVAILABILITY = {
  tourism: { levels: ["country", "county", "city"], tables: ["TU131"] },
  capacity: { levels: ["country", "county", "city"], tables: ["TU122"] },
  purpose: { levels: ["country", "county", "city"], tables: ["TU133"] },
  capacityLongRun: { levels: ["country"], tables: ["TU11"] },
  residents: { levels: ["country"], tables: ["TU51", "TU54", "TU56", "TU63", "TU551", "TU552", "TU661"] },
  sector: { levels: ["country"], tables: ["EM001", "TU410", "PA113"] },
};

export function supports(dataset, region) {
  return AVAILABILITY[dataset].levels.includes(region.kind);
}
