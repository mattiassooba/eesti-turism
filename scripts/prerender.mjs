import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { COUNTIES, CITIES } from "../src/data/counties.js";

// Turns the JS-only SPA build into 38 real static pages: for every
// /maakond/:slug and /en/county/:slug (region x language), a headless
// browser visits the already-built dist/ over a plain local static server,
// waits for the region's real narrative text to render, and saves that
// rendered HTML back into dist/<route>/index.html. Crawlers and anything
// else that doesn't execute JS then see real per-region content on first
// load, not an empty root div — routing alone (Phase 1) only gave each
// region a distinct URL, not distinct static content.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = path.join(ROOT, "dist");
const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}`;
const SITE_URL = "https://turismistatistika.ee";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".ico": "image/x-icon",
};

function contentType(filePath) {
  return MIME[path.extname(filePath)] ?? "application/octet-stream";
}

// Mirrors the production 404.html SPA fallback: any path that isn't an
// already-prerendered page or a real static asset gets the SPA shell, and
// react-router-dom takes it from there.
async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let filePath = path.join(DIST, urlPath);
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    if (!path.extname(filePath)) filePath = path.join(DIST, "index.html");
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function buildRoutes() {
  const routes = [
    { url: "/", outDir: "", priority: "1.0" },
    { url: "/en", outDir: "en", priority: "1.0" },
  ];
  for (const c of [...COUNTIES, ...CITIES]) {
    routes.push({ url: `/maakond/${c.slugEt}`, outDir: `maakond/${c.slugEt}`, priority: "0.8" });
    routes.push({ url: `/en/county/${c.slugEn}`, outDir: `en/county/${c.slugEn}`, priority: "0.8" });
  }
  return routes;
}

async function writeSitemap(routes) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map(
      (r) => `  <url>
    <loc>${SITE_URL}${r.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  await writeFile(path.join(DIST, "sitemap.xml"), xml);
}

async function main() {
  const server = createServer((req, res) => {
    serveStatic(req, res).catch(() => {
      res.writeHead(500);
      res.end("Server error");
    });
  });
  await new Promise((resolve) => server.listen(PORT, resolve));

  const browser = await chromium.launch();
  const routes = buildRoutes();

  try {
    for (const route of routes) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`${BASE_URL}${route.url}`, { waitUntil: "networkidle" });
      await page
        .waitForSelector(".narrative-card .narrative-text", { timeout: 10000 })
        .catch(() => {
          console.warn(`  (no narrative text found for ${route.url} — saving anyway)`);
        });
      const html = await page.content();
      await page.close();

      if (errors.length) {
        console.warn(`  console errors on ${route.url}:`, errors);
      }

      const outDir = path.join(DIST, route.outDir);
      await mkdir(outDir, { recursive: true });
      await writeFile(path.join(outDir, "index.html"), html);
      console.log(`Prerendered ${route.url} -> dist/${route.outDir ? route.outDir + "/" : ""}index.html`);
    }

    await writeSitemap(routes);
    console.log(`\nWrote dist/sitemap.xml with ${routes.length} URLs.`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
