import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5174'

export default defineConfig({
  testDir: './tests',
  use: { baseURL, ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 60_000 },
  reporter: 'list',
})
