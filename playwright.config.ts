import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:3006",
    headless: true,
  },
  webServer: {
    command: "npm run start -- -H 127.0.0.1",
    url: "http://127.0.0.1:3006/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
