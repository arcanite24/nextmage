import { expect, test, type Locator, type Page } from '@playwright/test';
import { keepOpeningHand, playerName, requireServer, signIn, startAiGame } from './helpers/app';

/**
 * The match on a tablet held upright, played by touch: the tall layout, a long press that opens a card's detail
 * instead of playing it, a tap that plays, and the stops menu behind the turn ladder. Needs the local server
 * (MAGE_E2E_REQUIRE_SERVER=1).
 */
test.describe('app: the match on a tablet, by touch', () => {
  test.skip(!requireServer, 'needs the local server (MAGE_E2E_REQUIRE_SERVER=1)');
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });

  /** Holds a finger on the element for a while, through the DevTools protocol (Playwright only taps). */
  async function longPress(page: Page, target: Locator, ms = 700) {
    const box = await target.boundingBox();
    if (!box) throw new Error('nothing to press');
    const point = { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 24) };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }

  test('long press reads a card, tap plays it, the ladder opens the stops', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, playerName('tablet'));
    await startAiGame(page);
    await keepOpeningHand(page);

    await expect(page.locator('[data-layout="tall"]')).toBeVisible();
    const hand = page.getByRole('list', { name: /^Your hand, \d+ cards$/ });
    const playable = hand.getByRole('listitem', { name: /, playable$/ });
    await expect(playable.first()).toBeVisible({ timeout: 60_000 });
    const count = await hand.getByRole('listitem').count();
    const name = ((await playable.first().getAttribute('aria-label')) ?? '').replace(/, playable$/, '');

    // held: the detail view opens and the card stays in hand
    await longPress(page, playable.first());
    const detail = page.getByRole('dialog', { name });
    await expect(detail).toBeVisible();
    await detail.getByRole('button', { name: 'Close' }).tap();
    await expect(detail).toBeHidden();
    await expect(hand.getByRole('listitem')).toHaveCount(count);

    // tapped: played (a land, or a spell that goes to the stack)
    await playable.first().tap();
    await expect(hand.getByRole('listitem')).toHaveCount(count - 1, { timeout: 20_000 });

    // the whole ladder is one target on touch; the stops open as full-size rows
    await page.getByRole('button', { name: /^Stops on your turn$/ }).tap();
    await expect(page.getByRole('menuitemcheckbox', { name: /^Upkeep/ })).toBeVisible();
    const box = await page.getByRole('menuitemcheckbox').first().boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
