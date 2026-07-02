import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.MAGE_WEB_E2E_PORT ?? 4175);
const baseURL = process.env.MAGE_WEB_E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: '.',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    },
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.MAGE_WEB_E2E_BASE_URL
    ? undefined
    : {
      command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: 'chromium-mobile',
      testMatch: /visual\/.*\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
