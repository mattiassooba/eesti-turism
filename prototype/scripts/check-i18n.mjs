// Lists translation keys used in prototype/src that are missing from the
// Estonian or English dictionary. Template-literal keys are expanded only
// when their dynamic part is listed in DYNAMIC below.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(f) && !p.includes(`${"i18n"}`)) files.push(p);
  }
})(root);

const used = new Set();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*["']([A-Za-z0-9_.]+)["']/g)) used.add(m[1]);
}

const { STRINGS } = await import(new URL("../src/i18n/strings.js", import.meta.url));
const has = (dict, key) => key.split(".").reduce((n, k) => (n == null ? undefined : n[k]), dict) !== undefined;

let missing = 0;
for (const key of [...used].sort()) {
  const lacks = ["et", "en"].filter((l) => !has(STRINGS[l], key));
  if (lacks.length) {
    missing++;
    console.log(`missing [${lacks.join(",")}] ${key}`);
  }
}
console.log(`${used.size} keys used, ${missing} missing`);
process.exit(missing ? 1 : 0);
