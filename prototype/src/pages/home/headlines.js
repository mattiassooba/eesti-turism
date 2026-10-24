// Deterministic editorial headlines computed from the data (not AI). Each
// states one fact with its comparison; no causes are inferred.
import { fmtInt, fmtDec, monthName, parsePeriod } from "../../lib/format.js";

// Estonian locative ("in X"): Eesti → Eestis, Harju maakond → Harju
// maakonnas, Tallinn → Tallinnas, Pärnu linn → Pärnu linnas.
export function etLocative(name) {
  if (name === "Eesti") return "Eestis";
  if (name.endsWith(" maakond")) return name.replace(/ maakond$/, " maakonnas");
  if (name.endsWith(" linn")) return name.replace(/ linn$/, " linnas");
  return `${name}as`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function monthOf(code, locale) {
  const p = parsePeriod(code);
  return p?.kind === "month" ? monthName(p.month - 1, locale) : code;
}

export function trendHeadline(s, locale, name) {
  const m = monthOf(s.period, locale);
  const v = fmtInt(s.guests, locale);
  const pct = s.guestsYoy == null ? null : fmtDec(Math.abs(s.guestsYoy), locale, 1);
  if (locale === "et") {
    const where = etLocative(name);
    if (pct == null) return `${cap(m)}: ${where} majutati ${v} külastajat.`;
    const dir = Math.abs(s.guestsYoy) < 0.05 ? "sama palju kui" : s.guestsYoy > 0 ? `${pct}% rohkem kui` : `${pct}% vähem kui`;
    return `${cap(m)}: ${where} majutati ${v} külastajat, ${dir} aasta varem.`;
  }
  if (pct == null) return `${m}: ${v} accommodated guests in ${name}.`;
  const dir = Math.abs(s.guestsYoy) < 0.05 ? "unchanged" : s.guestsYoy > 0 ? `up ${pct}%` : `down ${pct}%`;
  return `${m}: ${v} accommodated guests in ${name}, ${dir} year on year.`;
}

export function occupancyHeadline(c, locale, name) {
  const m = monthOf(c.period, locale);
  const v = fmtDec(c.roomOcc, locale, 1);
  const diff = c.roomOccDiff;
  const pp = diff == null ? null : fmtDec(Math.abs(diff), locale, 1);
  if (locale === "et") {
    const where = etLocative(name);
    const tail = pp == null ? "" : Math.abs(diff) < 0.05 ? ", sama mis aasta varem" : `, ${pp} protsendipunkti ${diff > 0 ? "kõrgem" : "madalam"} kui aasta varem`;
    return `${cap(m)}: tubade täituvus ${where} oli ${v}%${tail}.`;
  }
  const tail = pp == null ? "" : Math.abs(diff) < 0.05 ? ", unchanged on a year earlier" : `, ${pp} points ${diff > 0 ? "higher" : "lower"} than a year earlier`;
  return `${m}: room occupancy in ${name} was ${v}%${tail}.`;
}
