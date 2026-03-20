import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 8192,
  },
  server: {
    proxy: {
      "/_api": "http://127.0.0.1:9000",
    },
  },
});
