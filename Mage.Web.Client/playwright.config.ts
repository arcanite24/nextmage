import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.MAGE_WEB_E2E_PORT ?? 4175);
const baseURL = process.env.MAGE_WEB_E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
// Set PLAYWRIGHT_CHANNEL=chrome to use the installed Google Chrome instead of Playwright's bundled browser.
const channel = process.env.PLAYWRIGHT_CHANNEL || undefined;
// MAGE_WEB_E2E_PREVIEW=1 serves the production build (`npm run build` first) with `vite preview`, as CI does
const preview = process.env.MAGE_WEB_E2E_PREVIEW === '1';

export default defineConfig({
  testDir: '.',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  // CI runs on shared runners: one retry absorbs a slow first paint, a real failure still fails twice
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    // the production build registers a service worker; only e2e/pwa.spec.ts lets it run, so page.route sees every request
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.MAGE_WEB_E2E_BASE_URL
    ? undefined
    : {
      command: preview
        ? `npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`
        : `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel,
        viewport: { width: 1440, height: 960 },
      },
    },
  ],
});
