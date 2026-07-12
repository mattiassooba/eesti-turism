import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages project site serves from /eesti-turism/, not the domain
  // root — asset URLs need this prefix or they 404 after deploy.
  base: "/eesti-turism/",
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
