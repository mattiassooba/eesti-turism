// Shared contract for the AI data explorer ("Küsi andmete kohta"): the
// browser (prototype/src/data/askPacket.js) builds a packet in this shape
// and the Cloudflare Worker (worker/src/validate.js) accepts only this
// shape. Plain constants so both sides can import it.

// Same order as REGIONS in prototype/src/lib/regions.js (a test enforces it).
export const REGION_IDS = [
  "ee",
  "harju",
  "hiiu",
  "ida-viru",
  "jogeva",
  "jarva",
  "laane",
  "laane-viru",
  "polva",
  "parnu",
  "rapla",
  "saare",
  "tartu",
  "valga",
  "viljandi",
  "voru",
  "tallinn",
  "parnu-linn",
  "tartu-linn",
];

// The only names a region may carry in a packet. The Worker rejects any
// other string, so region names can't smuggle free text to the model.
// Counties also get the everyday "Hiiumaa" form. A test checks these
// against prototype/src/lib/regions.js.
const COUNTY_SHORT = {
  harju: "Harju",
  hiiu: "Hiiu",
  "ida-viru": "Ida-Viru",
  jogeva: "Jõgeva",
  jarva: "Järva",
  laane: "Lääne",
  "laane-viru": "Lääne-Viru",
  polva: "Põlva",
  parnu: "Pärnu",
  rapla: "Rapla",
  saare: "Saare",
  tartu: "Tartu",
  valga: "Valga",
  viljandi: "Viljandi",
  voru: "Võru",
};

export const REGION_NAMES = {
  ee: { et: ["Eesti"], en: ["Estonia"] },
  ...Object.fromEntries(
    Object.entries(COUNTY_SHORT).map(([id, s]) => [id, { et: [`${s} maakond`, `${s}maa`, s], en: [`${s} County`, s] }])
  ),
  tallinn: { et: ["Tallinn"], en: ["Tallinn"] },
  "parnu-linn": { et: ["Pärnu linn"], en: ["Pärnu city"] },
  "tartu-linn": { et: ["Tartu linn"], en: ["Tartu city"] },
};

export const YEAR_COLUMNS = ["year", "guests", "nights", "domestic", "foreign", "foreignSharePct", "guestsYoyPct", "nightsYoyPct", "foreignYoyPct", "roomOccPct", "bedOccPct"];
export const LATEST_COLUMNS = ["guests", "guestsYoyPct", "nights", "nightsYoyPct", "domestic", "foreign", "foreignYoyPct"];
export const RANGE_COLUMNS = [
  "guestsFrom",
  "guestsTo",
  "guestsChangePct",
  "nightsFrom",
  "nightsTo",
  "nightsChangePct",
  "foreignFrom",
  "foreignTo",
  "foreignChangePct",
  "peakYear",
  "peakGuests",
  "lowYear",
  "lowGuests",
];
export const CAPACITY_COLUMNS = ["establishments", "rooms", "beds"];

export const MAX_BODY_BYTES = 65536;
export const MAX_QUESTION = 300;
export const MIN_QUESTION = 3;
