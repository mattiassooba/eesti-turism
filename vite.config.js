import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Served from the custom domain's root (turismistatistika.ee), not a
  // GitHub Pages project subpath — see public/CNAME.
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@prod": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ["recharts"],
          geo: ["d3-geo", "topojson-client"],
          table: ["@tanstack/react-table"],
        },
      },
    },
  },
});
