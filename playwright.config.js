import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5176'

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/api-*.spec.js',
  use: { baseURL, ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run dev -- --port 5176', env: { VITE_DATA_SOURCE: 'demo' }, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  reporter: 'list',
})
