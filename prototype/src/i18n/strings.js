import * as core from "./core.js";
import * as pages from "./pages.js";
import * as studio from "./studio.js";

function merge(...parts) {
  const out = {};
  for (const part of parts) {
    for (const [k, v] of Object.entries(part)) {
      out[k] = v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" ? merge(out[k], v) : v;
    }
  }
  return out;
}

export const STRINGS = {
  et: merge(core.et, pages.et, studio.et),
  en: merge(core.en, pages.en, studio.en),
};
