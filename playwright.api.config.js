import { defineConfig, devices } from '@playwright/test'
import process from 'node:process'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/api-*.spec.js',
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:5175', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run dev -- --port 5175', env: { VITE_DATA_SOURCE: 'api' }, url: 'http://127.0.0.1:5175', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  reporter: 'list',
})
