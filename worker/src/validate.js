// Strict request check for the AI data explorer. The browser sends a data
// packet it computed itself; anything that isn't exactly that shape (numbers,
// known region ids, short name strings) is rejected, so the only free text
// that reaches the model is the visitor's question.
import { REGION_IDS, REGION_NAMES, YEAR_COLUMNS, LATEST_COLUMNS, RANGE_COLUMNS, CAPACITY_COLUMNS, MAX_QUESTION, MIN_QUESTION } from "../../src/lib/askShape.js";

const IDS = new Set(REGION_IDS);

const isObj = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const exactKeys = (obj, keys) => isObj(obj) && Object.keys(obj).length === keys.length && keys.every((k) => k in obj);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isNumOrNull = (v) => v === null || isNum(v);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isYear = (v) => isInt(v, 1900, 2099);
const isYearOrNull = (v) => v === null || isYear(v);
const isMonthOrNull = (v) => v === null || isInt(v, 1, 12);
const isId = (v) => typeof v === "string" && IDS.has(v);
const isRow = (v, len) => Array.isArray(v) && v.length === len && v.every(isNumOrNull);
const isList = (v, max, check) => Array.isArray(v) && v.length <= max && v.every(check);
const idMap = (v, check) => isObj(v) && Object.entries(v).every(([k, x]) => IDS.has(k) && check(x, k));

const isYearRow = (r) => isRow(r, YEAR_COLUMNS.length) && isYear(r[0]);
const isRanking = (v) => isList(v, REGION_IDS.length, (e) => Array.isArray(e) && e.length === 2 && isId(e[0]) && isNum(e[1]));
const isName = (s) => typeof s === "string" && s.length > 0 && s.length <= 60;
const allowedNames = (id) => new Set([...REGION_NAMES[id].et, ...REGION_NAMES[id].en]);

function isRegion(r, id) {
  const allowed = allowedNames(id);
  return (
    exactKeys(r, ["names", "years", "latest", "months", "busiestMonth", "quietestMonth", "summerSharePct", "capacity"]) &&
    isList(r.names, 6, (n) => isName(n) && allowed.has(n)) &&
    r.names.length > 0 &&
    isList(r.years, 80, isYearRow) &&
    isRow(r.latest, LATEST_COLUMNS.length) &&
    isRow(r.months, 12) &&
    isMonthOrNull(r.busiestMonth) &&
    isMonthOrNull(r.quietestMonth) &&
    isNumOrNull(r.summerSharePct) &&
    isRow(r.capacity, CAPACITY_COLUMNS.length)
  );
}

function isRange(r) {
  if (r === null) return true;
  return (
    exactKeys(r, ["from", "to", "requested", "missing", "rows"]) &&
    isYearOrNull(r.from) &&
    isYearOrNull(r.to) &&
    Array.isArray(r.requested) &&
    r.requested.length === 2 &&
    r.requested.every(isYear) &&
    isList(r.missing, 2, isYear) &&
    idMap(r.rows, (row) => isRow(row, RANGE_COLUMNS.length))
  );
}

function isPacket(p) {
  return (
    exactKeys(p, ["v", "latest", "lastFullYear", "partialYear", "regions", "rankings", "range"]) &&
    p.v === 1 &&
    typeof p.latest === "string" &&
    /^\d{4}M\d{2}$/.test(p.latest) &&
    isYearOrNull(p.lastFullYear) &&
    (p.partialYear === null || (exactKeys(p.partialYear, ["year", "months"]) && isYear(p.partialYear.year) && isInt(p.partialYear.months, 1, 11))) &&
    idMap(p.regions, isRegion) &&
    Object.keys(p.regions).length > 0 &&
    exactKeys(p.rankings, ["year", "byGuests", "byGrowthPct", "bySummerSharePct"]) &&
    isYearOrNull(p.rankings.year) &&
    isRanking(p.rankings.byGuests) &&
    isRanking(p.rankings.byGrowthPct) &&
    isRanking(p.rankings.bySummerSharePct) &&
    isRange(p.range)
  );
}

export function validateRequest(body) {
  if (!exactKeys(body, ["question", "locale", "selected", "packet"])) return { ok: false, error: "shape" };
  if (typeof body.question !== "string") return { ok: false, error: "question" };
  const question = body.question.trim().replace(/\s+/g, " ");
  if (question.length < MIN_QUESTION || question.length > MAX_QUESTION) return { ok: false, error: "question" };
  if (body.locale !== "et" && body.locale !== "en") return { ok: false, error: "locale" };
  const s = body.selected;
  if (!exactKeys(s, ["region", "compare"]) || !isId(s.region) || !(s.compare === null || isId(s.compare))) {
    return { ok: false, error: "selected" };
  }
  if (!isPacket(body.packet)) return { ok: false, error: "packet" };
  return { ok: true, value: { question, locale: body.locale, selected: { region: s.region, compare: s.compare }, packet: body.packet } };
}
