import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * Runs against a production build with network maps disabled, so results don't
 * depend on a tile provider. Browser-emulated coordinates exercise the app's
 * flow only: they say nothing about real GPS accuracy, which needs real devices.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] },
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grep: /@responsive/ },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 240_000,
    env: { NEXT_PUBLIC_MAP_STYLE_URL: "none", NEXT_PUBLIC_SATELLITE_STYLE_URL: "" },
  },
});
