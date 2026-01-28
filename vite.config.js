import { defineConfig } from "vite";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Plugin to emit app.js (non-module IIFE) as a static asset into dist
function copyAppJs() {
  return {
    name: "copy-app-js",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "app.js",
        source: readFileSync(resolve(__dirname, "app.js"), "utf-8"),
      });
    },
  };
}

export default defineConfig({
  plugins: [copyAppJs()],
  build: {
    rollupOptions: {
      input: "index.html",
    },
  },
});
