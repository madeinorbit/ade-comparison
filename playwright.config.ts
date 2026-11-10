import { defineConfig } from '@playwright/test'
const port = process.env.ADE_COMPARISON_TEST_PORT || 4329
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
  },
  webServer: { command: `npm run preview -- --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
})
