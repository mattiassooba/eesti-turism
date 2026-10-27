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

export const YEAR_COLUMNS = ["year", "guests", "nights", "domestic", "foreign", "guestsYoyPct", "nightsYoyPct", "foreignYoyPct", "roomOccPct", "bedOccPct"];
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
