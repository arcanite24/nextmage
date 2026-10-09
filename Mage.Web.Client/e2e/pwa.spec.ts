import { expect, test } from '@playwright/test';

/**
 * The installable app: the web manifest, the service worker, and the shell opening offline. The service worker is
 * registered by production builds only, so this runs against `vite preview` (npm run test:e2e:ci).
 */
test.describe('app: installable, with an offline shell', () => {
  test.skip(process.env.MAGE_WEB_E2E_PREVIEW !== '1', 'the dev server registers no service worker');
  test.use({ serviceWorkers: 'allow' });

  test('the web manifest describes an installable app', async ({ page, request }) => {
    await page.goto('/login');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
    const manifest = await (await request.get(href!)).json();
    expect(manifest).toMatchObject({ start_url: '/', scope: '/', display: 'standalone' });
    expect(manifest.name).toBeTruthy();
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]));
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  });

  test('the shell opens offline and the sign-in screen says so', async ({ page, context }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Take a seat' })).toBeVisible();
    // installed and in control of the page (the first install claims open pages)
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 15_000 });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Take a seat' })).toBeVisible();
    await expect(page.getByText("You're offline", { exact: true })).toBeVisible({ timeout: 15_000 });
    // a deep link opens the shell too, and the router takes it to sign-in
    await page.goto('/decks');
    await page.waitForURL(/\/login$/);
    await expect(page.getByLabel('Player name')).toBeVisible();
    await context.setOffline(false);
  });
});
