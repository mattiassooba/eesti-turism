import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
