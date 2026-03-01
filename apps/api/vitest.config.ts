import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@weather-trader/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@weather-trader/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
});
