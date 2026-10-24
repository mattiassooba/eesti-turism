import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Isolated preview app. It never touches the production build: the root
// vite.config.js / index.html / dist/ are untouched, and this config only
// builds into prototype/dist. The production public/ folder is served
// read-only so the prototype reads the same narrative.json the scheduled
// pipeline writes, without copying or modifying it.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("."),
  base: "/",
  publicDir: here("../public"),
  plugins: [react()],
  resolve: {
    alias: {
      "@prod": here("../src"),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    fs: { allow: [here("..")] },
  },
  preview: { port: 5181 },
  build: {
    outDir: here("dist"),
    emptyOutDir: true,
  },
});
