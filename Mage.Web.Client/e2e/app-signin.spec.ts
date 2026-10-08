import { expect, test } from '@playwright/test';

/**
 * The new app without a server: the sign-in screen, its checks, and what happens when the server can't be reached.
 * Runs in CI against `vite preview` (no game server needed).
 */
test.describe('app: sign-in without a server', () => {
  test('signed-out routes lead to the sign-in screen', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Take a seat' })).toBeVisible();
    await expect(page.getByLabel('Player name')).toBeFocused();
  });

  test('a player name must be 3 to 14 letters, digits or underscores', async ({ page }) => {
    await page.goto('/login');
    const sitDown = page.getByRole('button', { name: 'Sit down' });
    await expect(sitDown).toBeDisabled();
    await page.getByLabel('Player name').fill('no spaces');
    await expect(page.getByText('3 to 14 letters, digits or underscores.')).toBeVisible();
    await expect(sitDown).toBeDisabled();
    await page.getByLabel('Player name').fill('good_name');
    await expect(page.getByText('3 to 14 letters, digits or underscores.')).toBeHidden();
    await expect(sitDown).toBeEnabled();
  });

  test('an unreachable server is reported, and the player stays on sign-in', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Can't reach|Online|Checking/ }).click();
    await page.getByLabel('Server address').fill('ws://127.0.0.1:9');
    await expect(page.getByText("Can't reach", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Player name').fill('offline_e2e');
    await page.getByRole('button', { name: 'Sit down' }).click();
    await expect(page.getByRole('alert')).toContainText("Can't reach the server", { timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe('/login');
  });
});
