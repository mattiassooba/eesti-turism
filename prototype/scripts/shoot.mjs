// Review helper: full-page screenshots of the running prototype at several
// viewport widths. Usage:
//   node prototype/scripts/shoot.mjs <path> [widths=1440] [outDir] [--clip=y,h]
// Writes <outDir>/<slug>-<width>.png and prints console errors.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const [, , path = "/", widthArg = "1440", outArg] = process.argv;
const clipArg = process.argv.find((a) => a.startsWith("--clip="));
const widths = widthArg.split(",").map(Number);
const out = outArg && !outArg.startsWith("--") ? outArg : join(tmpdir(), "proto-shots");
mkdirSync(out, { recursive: true });
const base = process.env.PROTO_URL ?? "http://localhost:5180";
const slug = path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";

const browser = await chromium.launch();
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 860 : 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Scroll through once so lazy sections and ResizeObservers settle.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
  const file = join(out, `${slug}-${width}.png`);
  if (process.argv.includes("--split")) {
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const vh = page.viewportSize().height;
    for (let y = 0, k = 0; y < total; y += vh - 60, k++) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(350);
      await page.screenshot({ path: file.replace(".png", `-${String(k).padStart(2, "0")}.png`) });
    }
  } else if (clipArg) {
    const [y, h] = clipArg.slice(7).split(",").map(Number);
    await page.screenshot({ path: file, clip: { x: 0, y, width, height: h }, fullPage: true });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(`${file}  scrollWidth=${sw}${sw > width ? "  OVERFLOW" : ""}`);
  for (const e of errors) console.log("  console:", e.slice(0, 300));
  await page.close();
}
await browser.close();
