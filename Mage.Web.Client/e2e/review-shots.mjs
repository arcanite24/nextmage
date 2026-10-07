// Captures the new app's screens for design review: node e2e/review-shots.mjs (dev server and game server running)
import { chromium } from '@playwright/test';

const base = process.env.BASE ?? 'http://localhost:5173';
const out = new URL('../.impeccable/review/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const shot = async (name) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};

await page.goto(`${base}/login`);
await shot('01-login');
await page.getByLabel('Player name').fill(`rev${Date.now() % 10000}`);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL((url) => !url.pathname.startsWith('/login'));
await shot('02-play');
await page.goto(`${base}/decks`);
await shot('03-decks');
await page.getByText(/^Ajani, Valiant Protector$/).first().click();
await page.getByRole('button', { name: /copy and edit/i }).click();
await page.waitForURL(/\/decks\/[0-9a-f-]{36}/);
await page.waitForTimeout(3000);
await shot('04-deck-builder');
await page.goto(`${base}/events`);
await shot('05-events');
await page.getByRole('button', { name: 'Host an event' }).click();
await shot('06-host-event');
await page.keyboard.press('Escape');
await page.goto(`${base}/`);
await page.getByRole('button', { name: /^play$/i }).click();
await page.waitForURL(/\/game\//, { timeout: 60000 });
const starter = page.getByRole('dialog', { name: /who starts/i });
const hand = page.getByRole('dialog', { name: /opening hand/i });
await starter.or(hand).first().waitFor({ timeout: 60000 });
if (await starter.isVisible()) {
  await shot('07-who-starts');
  await starter.getByRole('button', { name: 'Play first' }).click();
}
await hand.waitFor({ timeout: 60000 });
await page.waitForTimeout(2500);
await shot('08-opening-hand');
await hand.getByRole('button', { name: /^keep$/i }).click();
// play a few turns by passing so the board fills
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(1500);
  await page.keyboard.press('F5').catch(() => undefined);
}
await page.waitForTimeout(3000);
await shot('09-match');
await browser.close();
