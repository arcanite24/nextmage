import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Helpers for the new app's end-to-end specs (e2e/app-*.spec.ts). They drive the real UI by role and label,
 * the way a player would. Live specs need a local server: MAGE_E2E_REQUIRE_SERVER=1 (see e2e/README.md).
 */

export const requireServer = process.env.MAGE_E2E_REQUIRE_SERVER === '1';

let counter = 0;
/** A fresh player name (3 to 14 letters, digits or underscores). */
export function playerName(prefix: string): string {
  counter += 1;
  const suffix = `${Date.now() % 100000}${counter}`;
  return `${prefix.slice(0, 14 - suffix.length)}${suffix}`;
}

/** Signs in with just a name (the local server runs without passwords) and waits to leave the login screen. */
export async function signIn(page: Page, name: string, path = '/'): Promise<void> {
  await page.goto(path);
  await page.getByLabel('Player name').fill(name);
  await page.getByRole('button', { name: 'Sit down' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

export const decisionCluster = (page: Page) => page.getByRole('region', { name: 'Your decision' });
const openingHand = (page: Page) => page.getByRole('dialog', { name: /opening hand/i });
const whoStarts = (page: Page) => page.getByRole('dialog', { name: /who starts/i });
export const gameOver = (page: Page) => page.getByRole('dialog', { name: /defeat|victory|game over/i });

/** On Play: pick a deck by name (a starter by default) and start a game against the AI. */
export async function startAiGame(page: Page, deckName: RegExp | string = /^Ajani, Valiant Protector$/i): Promise<void> {
  await page.getByRole('list').filter({ has: page.getByText(deckName) }).getByText(deckName).first().click();
  await page.getByRole('button', { name: /^play$/i }).click();
  await page.waitForURL(/\/game\//, { timeout: 60_000 });
}

/** Answers "who starts" (play first) and keeps the opening hand. */
export async function keepOpeningHand(page: Page): Promise<void> {
  await whoStarts(page).or(openingHand(page)).first().waitFor({ timeout: 60_000 });
  if (await whoStarts(page).isVisible()) await whoStarts(page).getByRole('button', { name: 'Play first' }).click();
  await openingHand(page).waitFor({ timeout: 60_000 });
  await openingHand(page).getByRole('button', { name: /^keep$/i }).click();
  await expect(openingHand(page)).toBeHidden({ timeout: 30_000 });
}

/** The turn number printed on the phase ladder ("Turn 3, your turn"), 0 before the first turn. */
export async function currentTurn(page: Page): Promise<number> {
  const ladder = page.getByRole('navigation', { name: /^Turn \d+/ });
  if (!(await ladder.isVisible().catch(() => false))) return 0;
  const label = (await ladder.getAttribute('aria-label')) ?? '';
  return Number(/^Turn (\d+)/.exec(label)?.[1] ?? 0);
}

async function clickIfVisible(locator: Locator): Promise<boolean> {
  if (!(await locator.isVisible().catch(() => false))) return false;
  if (!(await locator.isEnabled().catch(() => false))) return false;
  await locator.click({ timeout: 2_000 }).catch(() => undefined);
  return true;
}

/**
 * Plays passively until the game reaches `turn`: passes priority ahead to the next turn, answers whatever the
 * game asks with its default (no attackers, no blockers, the first choice), and keeps going.
 */
export async function playUntilTurn(page: Page, turn: number, timeoutMs = 150_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while ((await currentTurn(page)) < turn) {
    if (Date.now() > deadline) throw new Error(`The game did not reach turn ${turn} (now ${await currentTurn(page)}).`);
    if (await gameOver(page).isVisible().catch(() => false)) throw new Error('The game ended before the turn was reached.');

    // a panel or picker that needs an answer (modes, choices, numbers, cards)
    const panel = page.getByRole('dialog').filter({ hasNot: page.getByRole('heading', { name: /victory|defeat|game over/i }) }).first();
    if (await panel.isVisible().catch(() => false)) {
      const choice = panel.getByRole('button').filter({ hasNotText: /^(See the board|Close|Cancel|Skip|Back to choice)$/ });
      const enabled = choice.and(page.locator(':enabled'));
      if (await enabled.count() > 0) {
        await enabled.last().click({ timeout: 2_000 }).catch(() => undefined);
        await page.waitForTimeout(300);
        continue;
      }
    }

    // pass ahead to the next turn when the game offers it; otherwise press the decision button
    const ahead = decisionCluster(page).getByRole('button', { name: 'Pass ahead' });
    if (await clickIfVisible(ahead)) {
      const next = page.getByRole('menuitem', { name: 'Pass to next turn' });
      if (await next.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await next.click({ timeout: 2_000 }).catch(() => undefined);
      } else {
        await page.keyboard.press('Escape');
      }
    } else {
      const main = decisionCluster(page).getByRole('button').filter({ hasNotText: /^$/ }).last();
      // nothing to press: the game wants a card from hand (a discard), so give it the first one it accepts
      if (!(await clickIfVisible(main))) {
        await clickIfVisible(page.getByRole('list', { name: /^Your hand/ }).getByRole('listitem', { name: /, playable/ }).first());
      }
    }
    await page.waitForTimeout(400);
  }
}

/** Concedes through the game menu and waits for the result screen. */
export async function concede(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Game menu' }).click();
  await page.getByRole('menuitem', { name: 'Concede' }).click();
  await page.getByRole('dialog', { name: /concede this game/i }).getByRole('button', { name: 'Concede' }).click();
  await gameOver(page).waitFor({ timeout: 30_000 });
}
