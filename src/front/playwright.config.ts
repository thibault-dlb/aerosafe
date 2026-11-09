import { defineConfig, devices } from "@playwright/test";

const isCi = !!process.env.CI;

// Locally only Chromium runs, so no other browser has to be installed. The CI pipeline
// also runs Firefox and WebKit.
const projects = [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }];
if (isCi) {
  projects.push(
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:8888",
    trace: "on-first-retry",
  },
  projects,
});
