import { defineConfig, devices } from '@playwright/test';

const externalGym = process.env.GYM_BASE_URL;

export default defineConfig({
  testDir: './tests',
  tsconfig: './tsconfig.json',
  outputDir: './artifacts/test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 4 } : {}),
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: externalGym ?? 'http://127.0.0.1:4173',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  ...(externalGym
    ? {}
    : { webServer: {
        command: 'node gym/server.mjs',
        url: 'http://127.0.0.1:4173/healthz',
        reuseExistingServer: !process.env.CI,
        timeout: 10_000
      } }),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
