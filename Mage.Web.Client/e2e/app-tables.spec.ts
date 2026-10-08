import { expect, test, type Page } from '@playwright/test';
import { concede, gameOver, keepOpeningHand, playerName, requireServer, signIn } from './helpers/app';

/**
 * Hosting and joining a table between two players, each in their own browser: the host opens a table, the guest
 * joins it from Tables, the host starts it and both land in the game. Needs the local server
 * (MAGE_E2E_REQUIRE_SERVER=1).
 */

const tableRow = (page: Page, tableName: string) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: tableName }) });

test.describe('app: tables', () => {
  test.skip(!requireServer, 'needs the local server (MAGE_E2E_REQUIRE_SERVER=1)');

  test('host a table, a friend joins, the host starts it', async ({ browser }) => {
    test.setTimeout(240_000);
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const tableName = `Duel ${Date.now() % 100000}`;

    try {
      await signIn(host, playerName('host'), '/tables');
      await host.getByRole('button', { name: 'Host a table' }).click();
      const dialog = host.getByRole('dialog', { name: 'Host a table' });
      await dialog.getByLabel('Table name').fill(tableName);
      await dialog.getByLabel('Games to win').selectOption('1');
      await dialog.getByRole('button', { name: 'Host', exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: 20_000 });
      const mine = tableRow(host, tableName);
      await expect(mine).toBeVisible({ timeout: 20_000 });
      await expect(mine.getByRole('button', { name: 'Start' })).toBeDisabled();

      await signIn(guest, playerName('guest'), '/tables');
      const open = tableRow(guest, tableName);
      await expect(open).toBeVisible({ timeout: 20_000 });
      await open.getByRole('button', { name: 'Join' }).click();

      // both seats taken: the host starts the match
      await expect(mine.getByRole('button', { name: 'Start' })).toBeEnabled({ timeout: 20_000 });
      await mine.getByRole('button', { name: 'Start' }).click();
      await Promise.all([
        host.waitForURL(/\/game\//, { timeout: 60_000 }),
        guest.waitForURL(/\/game\//, { timeout: 60_000 }),
      ]);

      // whoever won the roll chooses; both keep their hands
      await Promise.all([keepOpeningHand(host), keepOpeningHand(guest)]);
      await expect(host.getByRole('list', { name: /^Your hand, \d+ cards$/ })).toBeVisible({ timeout: 30_000 });
      await expect(guest.getByRole('list', { name: /^Your hand, \d+ cards$/ })).toBeVisible({ timeout: 30_000 });

      // the player whose turn it is holds priority, so their concession ends the game at once
      // (the other player's would wait for the active player to act)
      const hostsTurn = /your turn/.test((await host.getByRole('navigation', { name: /^Turn \d+/ }).getAttribute('aria-label')) ?? '');
      const [loser, winner] = hostsTurn ? [host, guest] : [guest, host];
      await concede(loser);
      await expect(gameOver(loser).getByRole('heading', { name: 'Defeat' })).toBeVisible();
      await gameOver(winner).waitFor({ timeout: 30_000 });
      await expect(gameOver(winner).getByRole('heading', { name: 'Victory' })).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
