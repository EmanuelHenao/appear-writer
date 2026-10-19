import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // En las pruebas no hay separación cliente/servidor.
      "server-only": path.resolve(__dirname, "test/empty.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
