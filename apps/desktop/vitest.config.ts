import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const tauriConf = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./src-tauri/tauri.conf.json", import.meta.url)),
    "utf8",
  ),
);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(tauriConf.version),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    testTimeout: 15_000,
  },
});
