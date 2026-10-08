import { expect, test } from '@playwright/test';
import { concede, currentTurn, gameOver, keepOpeningHand, playerName, playUntilTurn, requireServer, signIn, startAiGame } from './helpers/app';

/**
 * A whole game against the AI in the new app: sign in, Play with a starter deck, keep the opening hand, let a
 * few turns pass, concede, and land back on Play. Needs the local server (MAGE_E2E_REQUIRE_SERVER=1).
 */
test.describe('app: a game against the AI', () => {
  test.skip(!requireServer, 'needs the local server (MAGE_E2E_REQUIRE_SERVER=1)');

  test('play a starter deck for a few turns, concede and go back to Play', async ({ page }) => {
    test.setTimeout(300_000);
    await signIn(page, playerName('match'));
    await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible();

    await startAiGame(page);
    await keepOpeningHand(page);

    // the match stage: a hand, a phase ladder and a decision area
    await expect(page.getByRole('list', { name: /^Your hand, \d+ cards$/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Your decision' })).toBeVisible();

    await playUntilTurn(page, 4);
    expect(await currentTurn(page)).toBeGreaterThanOrEqual(4);

    await concede(page);
    await expect(gameOver(page).getByRole('heading', { name: 'Defeat' })).toBeVisible();
    await gameOver(page).getByRole('button', { name: 'Back to Play' }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^play$/i })).toBeEnabled();
  });
});
