import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Served from the custom domain's root (turismistatistika.ee), not a
  // GitHub Pages project subpath — see public/CNAME.
  base: "/",
  plugins: [react()],
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
