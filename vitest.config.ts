import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/__tests__/**/*.ts"],
  },
  resolve: {
    alias: {
      "@/lib": path.resolve(__dirname, "lib"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
