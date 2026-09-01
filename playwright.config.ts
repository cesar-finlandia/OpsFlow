// Requirement IDs: FR-01…FR-20, NFR-01…NFR-12, MAN-01…MAN-05
// E2E configuration — see design_documents/e2e-testing/strategy.md §2.1.
import { defineConfig, devices } from "@playwright/test";

const LIVE_PORT = 5174; // vite dev — serves the app AND api/** via the dev plugin
const STATIC_PORT = 4174; // vite preview — the production bundle, no API

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // holds are client-owned singleton state; keep runs ordered
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "reports/e2e", open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      // The complete product: real routes, tool chain, confirmations, degradation.
      name: "live",
      testIgnore: /\.static\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${LIVE_PORT}` },
    },
    {
      // The shipped artifact, served with no API — also §5.2 rung 3.
      name: "static",
      testMatch: /\.static\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${STATIC_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${LIVE_PORT} --strictPort`,
      url: `http://localhost:${LIVE_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx vite build && npx vite preview --port ${STATIC_PORT} --strictPort`,
      url: `http://localhost:${STATIC_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
