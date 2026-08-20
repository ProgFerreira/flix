import { defineConfig } from "vitest/config"
import path from "path"
import { fileURLToPath } from "url"

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "."),
    },
  },
})
