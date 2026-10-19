import { defineConfig, devices } from "@playwright/test";
import { VERIFY_ENV, VERIFY_PORT } from "./helpers.ts";

// E2E against `vite preview` of the production build (run `npm run build` first), served under the
// same base path the build used (VITE_BASE_PATH; "/" locally, "/<repo>/" in CI). Chromium only.
const port = 4173;
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.ts",
  testMatch: "*.spec.ts",
  outputDir: "../test-results",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://localhost:${port}${base}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `npx vite preview --port ${port} --strictPort`,
      cwd: "..",
      url: `http://localhost:${port}${base}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Same app built with the Lemon Squeezy verifier on, so the privacy spec can exercise the one
      // permitted external request (mocked with page.route; nothing leaves the machine).
      command: `npx vite build --outDir dist-verify --emptyOutDir && npx vite preview --outDir dist-verify --port ${VERIFY_PORT} --strictPort`,
      cwd: "..",
      env: VERIFY_ENV,
      url: `http://localhost:${VERIFY_PORT}${base}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
