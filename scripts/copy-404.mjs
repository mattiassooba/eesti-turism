import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// GitHub Pages has no server-side rewrites, so a direct visit to
// /maakond/harju-maakond 404s unless 404.html itself boots the SPA, which
// then reads the real path via react-router-dom. This is the standard
// GH Pages SPA-fallback trick.
const dist = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "dist");
copyFileSync(path.join(dist, "index.html"), path.join(dist, "404.html"));
console.log("Copied dist/index.html -> dist/404.html");
