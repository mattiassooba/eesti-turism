// Captures matched before/after screenshots for the Design Studio walkthrough.
// "Before" is the live production site, viewed read-only; "after" is the
// prototype dev server. Usage (from prototype/, with `npm run proto` running):
//   node scripts/capture-compare.mjs [before|after|both]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets");
const which = process.argv[2] ?? "both";
const LIVE = "https://turismistatistika.ee";
const PROTO = process.env.PROTO_URL ?? "http://localhost:5180";

// The live site scrolls inside an inner container, not the document.
async function scrollLive(page, y) {
  await page.evaluate((yy) => {
    const els = [...document.querySelectorAll("*")].filter((el) => {
      const s = getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 50;
    });
    const target = els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? document.scrollingElement;
    target.scrollTop = yy;
    window.scrollTo(0, yy);
  }, y);
  await page.waitForTimeout(900);
}

async function clickLive(page, text) {
  await page.getByRole("button", { name: text }).or(page.getByRole("link", { name: text })).or(page.getByRole("tab", { name: text })).first().click();
  await page.waitForTimeout(3500);
}

const BEFORE = [
  { name: "home", width: 1440, run: async () => {} },
  { name: "home-region", width: 1440, run: async (p) => scrollLive(p, 1500) },
  { name: "home-map", width: 1440, run: async (p) => scrollLive(p, 3600) },
  { name: "residents", width: 1440, run: async (p) => clickLive(p, "Residentide reisid") },
  { name: "tables", width: 1440, run: async (p) => clickLive(p, "Kõik tabelid") },
  { name: "mobile", width: 390, run: async () => {} },
  { name: "mobile-2", width: 390, run: async (p) => scrollLive(p, 900) },
];

const AFTER = [
  { name: "home", width: 1440, path: "/" },
  { name: "home-region", width: 1440, path: "/piirkonnad?r=harju" },
  { name: "home-map", width: 1440, path: "/", hash: "piirkonnad" },
  { name: "residents", width: 1440, path: "/elanike-reisid" },
  { name: "tables", width: 1440, path: "/andmed" },
  { name: "mobile", width: 390, path: "/" },
  { name: "mobile-2", width: 390, path: "/", scroll: 900 },
];

const browser = await chromium.launch();

if (which !== "after") {
  const out = join(root, "before");
  mkdirSync(out, { recursive: true });
  for (const shot of BEFORE) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.width < 600 ? 844 : 900 } });
    await page.goto(LIVE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await shot.run(page);
    await page.screenshot({ path: join(out, `${shot.name}.jpg`), type: "jpeg", quality: 78 });
    console.log("before", shot.name);
    await page.close();
  }
}

if (which !== "before") {
  const out = join(root, "after");
  mkdirSync(out, { recursive: true });
  for (const shot of AFTER) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.width < 600 ? 844 : 900 } });
    await page.addInitScript(() => localStorage.setItem("proto-brand-concept", "a"));
    await page.goto(PROTO + shot.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    if (shot.hash) {
      await page.evaluate((h) => document.getElementById(h)?.scrollIntoView({ block: "start" }), shot.hash);
      await page.waitForTimeout(1200);
    }
    if (shot.scroll) {
      await page.evaluate((y) => window.scrollTo(0, y), shot.scroll);
      await page.waitForTimeout(1200);
    }
    await page.screenshot({ path: join(out, `${shot.name}.jpg`), type: "jpeg", quality: 78 });
    console.log("after", shot.name);
    await page.close();
  }
}

await browser.close();
