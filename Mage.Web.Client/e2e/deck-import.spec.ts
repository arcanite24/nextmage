import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * Deck import against a running local server: a pasted list with a typo is fixed and played; a deck from
 * a site that blocks other apps comes over by copy and paste; the "Send to Playmat" bookmarklet hands a
 * deck over through the URL fragment, across sign-in.
 * Run with MAGE_E2E_REQUIRE_SERVER=1. The @network test reads a real Archidekt deck and also needs
 * MAGE_E2E_NETWORK=1.
 */

const requireServer = process.env.MAGE_E2E_REQUIRE_SERVER === '1';
const network = process.env.MAGE_E2E_NETWORK === '1';

async function signIn(page: Page, path = '/decks') {
  await page.goto(path);
  await page.getByLabel('Player name').fill(`imp${Date.now() % 100000}`);
  await page.getByRole('button', { name: 'Sit down' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

/** A paste the way the browser delivers it, with the list on the clipboard. */
async function paste(page: Page, text: string, target = 'body') {
  await page.locator(target).first().evaluate((element, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
}

const sheet = (page: Page) => page.getByRole('dialog', { name: /import a deck/i });

test.describe('deck import', () => {
  test.skip(!requireServer, 'needs the local server (MAGE_E2E_REQUIRE_SERVER=1)');

  test('a pasted list: fix a typo, save and play', async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    // ⌘V anywhere on the shelf opens the sheet with the list
    await paste(page, '20 Lightnig Bolt\n40 Mountain\n\nSideboard\n3 Smash to Smithereens');
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByText('1 card needs a look')).toBeVisible({ timeout: 20_000 });

    // focus lands on the card to fix
    await expect(page.getByRole('button', { name: 'Find it' })).toBeFocused();
    await page.getByRole('button', { name: 'Find it' }).click();
    await page.getByRole('button', { name: /^Lightning Bolt/ }).first().click();
    await expect(page.getByText('Every card matched.')).toBeVisible();

    await page.getByLabel('Deck name').fill('Typo Burn');
    await page.getByRole('button', { name: 'Save and play' }).click();
    await page.waitForURL(/\/game\//, { timeout: 60_000 });
    const starter = page.getByRole('dialog', { name: /who starts/i });
    const hand = page.getByRole('dialog', { name: /opening hand/i });
    await starter.or(hand).first().waitFor({ timeout: 60_000 });
    if (await starter.isVisible()) await starter.getByRole('button', { name: 'Play first' }).click();
    await hand.waitFor({ timeout: 60_000 });
    await hand.getByRole('button', { name: /^keep$/i }).click();
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('menuitem', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede' }).click();
  });

  test('a site that blocks other apps: copy and paste, then update by pasting', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await page.getByLabel('Deck link or list').fill('https://moxfield.com/decks/E3zZUHuCBUiC2dExO6wn4A');
    await expect(page.getByText('Moxfield deck')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: /bring it over from moxfield/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open the deck on moxfield/i })).toHaveAttribute('href', 'https://moxfield.com/decks/E3zZUHuCBUiC2dExO6wn4A');
    // back from the site, the paste target waits for the list
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await paste(page, 'https://moxfield.com/decks/E3zZUHuCBUiC2dExO6wn4A');
    await expect(page.getByText(/that’s the link again/i)).toBeVisible();
    await paste(page, 'Deck\n4 Lightning Bolt (M11) 149\n56 Mountain\n\nSideboard\n2 Pyroblast');
    await expect(page.getByLabel('Deck name')).toHaveValue('Moxfield deck', { timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Moxfield' })).toHaveAttribute('href', 'https://moxfield.com/decks/E3zZUHuCBUiC2dExO6wn4A');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText('Deck imported')).toBeVisible();
    await expect(page.getByText(/from moxfield/i)).toBeVisible();
    // Moxfield decks update by pasting a fresh list
    await page.getByRole('button', { name: 'Paste a new list' }).click();
    await expect(page.getByRole('dialog', { name: /replace moxfield deck/i })).toBeVisible();
  });

  test('Send to Playmat: the bookmarklet carries a deck across sign-in', async ({ page, baseURL }) => {
    const source = readFileSync(new URL('../src/app/decks/import/bookmarklet.source.js', import.meta.url), 'utf8')
      .replaceAll('__PLAYMAT_ORIGIN__', new URL(baseURL!).origin);
    // a stand-in for a TappedOut deck page and its text export
    await page.route('https://tappedout.net/**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('fmt') === 'txt') {
        return route.fulfill({ contentType: 'text/plain', body: '4x Lightning Bolt\n56x Mountain\n\nSideboard:\n2x Pyroblast\n' });
      }
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Bolt Tribal</title><h1>Bolt Tribal</h1>' });
    });
    await page.goto('https://tappedout.net/mtg-decks/bolt-tribal/');
    await page.evaluate(() => {
      (window as unknown as { opened: string[] }).opened = [];
      window.open = (url) => {
        (window as unknown as { opened: string[] }).opened.push(String(url));
        return null;
      };
    });
    await page.evaluate(source);
    await expect.poll(() => page.evaluate(() => (window as unknown as { opened: string[] }).opened[0] ?? '')).toContain('/import#deck=');
    const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened[0]);

    // not signed in yet: sign-in keeps the deck in the fragment
    await page.goto(opened);
    await page.getByLabel('Player name').fill(`bm${Date.now() % 100000}`);
    await page.getByRole('button', { name: 'Sit down' }).click();
    await expect(page.getByLabel('Deck name')).toHaveValue('Bolt Tribal', { timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'TappedOut' })).toBeVisible();
    // the fragment is gone from the address once read
    expect(new URL(page.url()).hash).toBe('');
  });

  test('a deck link from a site the server reads @network', async ({ page }) => {
    test.skip(!network, 'reads a real deck from Archidekt (MAGE_E2E_NETWORK=1)');
    await signIn(page);
    await paste(page, 'https://archidekt.com/decks/3872725/murktide');
    await expect(page.getByLabel('Deck name')).toHaveValue('Murktide', { timeout: 20_000 });
    await expect(page.getByText('Every card matched.')).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Update from Archidekt' }).click();
    await expect(page.getByText(/nothing changed on archidekt/i)).toBeVisible({ timeout: 20_000 });
  });
});
