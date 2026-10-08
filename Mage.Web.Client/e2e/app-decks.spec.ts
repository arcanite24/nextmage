import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { playerName, requireServer, signIn } from './helpers/app';

/**
 * The deck builder and the deck shelf in the new app: build a deck from the collection, see it saved, export it as
 * a .dck file, then duplicate and rename it on the shelf. Needs the local server for card search
 * (MAGE_E2E_REQUIRE_SERVER=1).
 */

const deckOnShelf = (page: Page, name: string) => page.getByRole('listitem').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') });

test.describe('app: decks', () => {
  test.skip(!requireServer, 'needs the local server (MAGE_E2E_REQUIRE_SERVER=1)');

  test('build and save a deck, export it, duplicate and rename it', async ({ page }) => {
    test.setTimeout(180_000);
    const name = `Bolt ${Date.now() % 10000}`;
    await signIn(page, playerName('decks'), '/decks');
    await page.getByRole('button', { name: 'Build a deck' }).click();
    await page.waitForURL(/\/decks\/[0-9a-f-]{36}$/, { timeout: 20_000 });

    await page.getByLabel('Deck name').fill(name);
    await page.getByLabel('Search cards').fill('Lightning Bolt');
    const bolt = page.getByRole('button', { name: /^Lightning Bolt(, \d+ in deck)?\. Click to add/ }).first();
    await bolt.waitFor({ timeout: 30_000 });
    for (let copy = 0; copy < 4; copy++) await bolt.click();
    const mountain = page.locator('[aria-label="Basic lands"]').getByRole('button', { name: 'One more Mountain' });
    for (let copy = 0; copy < 16; copy++) await mountain.click();

    await expect(page.getByRole('tab', { name: 'Deck 20' })).toBeVisible();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });

    // export the saved list as an XMage .dck file
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('menuitem', { name: /\.dck file/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`${name}.dck`);
    const text = await readFile((await file.path())!, 'utf8');
    expect(text).toContain(`NAME:${name}`);
    expect(text).toMatch(/^4 \[[^\]]+\] Lightning Bolt$/m);
    expect(text).toMatch(/Mountain$/m);

    // the shelf keeps it across a reload
    await page.getByRole('button', { name: 'Decks', exact: true }).click();
    await page.waitForURL(/\/decks$/);
    await page.reload();
    await expect(deckOnShelf(page, name)).toBeVisible({ timeout: 20_000 });
    await deckOnShelf(page, name).first().click();
    await expect(page.getByRole('heading', { name, exact: true, level: 2 })).toBeVisible();

    // duplicate: a copy is saved and selected
    await page.getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.getByRole('heading', { name: `${name} (copy)`, level: 2 })).toBeVisible();
    await expect(deckOnShelf(page, `${name} (copy)`)).toBeVisible();

    // rename the copy
    await page.getByRole('button', { name: 'Rename' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rename deck' });
    await dialog.getByLabel('Deck name').fill(`${name} sideboard plan`);
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: `${name} sideboard plan`, level: 2 })).toBeVisible();
    await expect(deckOnShelf(page, `${name} (copy)`)).toHaveCount(0);
  });
});
