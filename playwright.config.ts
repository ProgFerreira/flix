import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e", fullyParallel: false, workers: 1, timeout: 60_000,
  use: { baseURL: "http://localhost:3003", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.platform === "win32" ? "msedge" : undefined } }],
  webServer: { command: "npm run dev", url: "http://localhost:3003/login", reuseExistingServer: true, timeout: 120_000 },
})
