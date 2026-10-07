import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility of the new app's screens against a running local server: axe finds no serious or critical
 * violations on sign-in, Play, Decks, the deck builder, Events, hosting, the match stage and the result screen.
 * Run with MAGE_E2E_REQUIRE_SERVER=1 and the server on its default port.
 */

const requireServer = process.env.MAGE_E2E_REQUIRE_SERVER === '1';

async function serious(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(' | ')})`);
}

test.describe('app accessibility', () => {
  test.skip(!requireServer, 'needs the local server (MAGE_E2E_REQUIRE_SERVER=1)');

  test('screens have no serious violations', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/login');
    expect(await serious(page)).toEqual([]);

    await page.getByLabel('Player name').fill(`axe${Date.now() % 100000}`);
    await page.getByRole('button', { name: /sign in|play/i }).first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    expect(await serious(page), 'Play').toEqual([]);

    await page.goto('/decks');
    await page.waitForLoadState('networkidle');
    expect(await serious(page), 'Decks').toEqual([]);

    await page.goto('/decks/new');
    await page.waitForURL(/\/decks\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await page.getByRole('button', { name: /click to add/i }).first().waitFor({ timeout: 20_000 });
    expect(await serious(page), 'Deck builder').toEqual([]);

    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    expect(await serious(page), 'Events').toEqual([]);

    await page.getByRole('button', { name: 'Host an event' }).click();
    await page.getByRole('dialog').waitFor();
    expect(await serious(page, '[role="dialog"]'), 'Host dialog').toEqual([]);
    await page.keyboard.press('Escape');

    // a game against the AI: the match stage and the opening-hand overlay
    await page.goto('/');
    // the deck builder step left an empty deck selected: play a starter deck
    await page.getByText(/^Ajani, Valiant Protector$/i).first().click();
    await page.getByRole('button', { name: /^play$/i }).click();
    await page.waitForURL(/\/game\//, { timeout: 60_000 });
    // winning the roll asks who starts before the opening hand
    const starter = page.getByRole('dialog', { name: /who starts/i });
    const hand = page.getByRole('dialog', { name: /opening hand/i });
    await starter.or(hand).first().waitFor({ timeout: 60_000 });
    if (await starter.isVisible()) {
      expect(await serious(page), 'Starting player').toEqual([]);
      await starter.getByRole('button', { name: 'Play first' }).click();
    }
    await hand.waitFor({ timeout: 60_000 });
    expect(await serious(page), 'Match stage').toEqual([]);
    await page.getByRole('dialog', { name: /opening hand/i }).getByRole('button', { name: /^keep$/i }).click();
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('menuitem', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('dialog', { name: /defeat|victory|game over/i }).waitFor({ timeout: 30_000 });
    expect(await serious(page), 'Game over').toEqual([]);
  });
});
