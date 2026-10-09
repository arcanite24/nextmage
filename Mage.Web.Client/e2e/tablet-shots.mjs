// Captures the match on tablet sizes for review: node e2e/tablet-shots.mjs (dev server and game server running).
// Plays a game against the AI by touch (taps, no hover) and shoots every size at each moment: the opening hand, your
// main phase, combat and the opponent's turn. DESKTOP=1 shoots the desktop sizes with a mouse instead. PREFIX names
// the files, e.g. PREFIX=before- for a baseline. Shots land in .impeccable/review/tablet/ (git-ignored).
import { chromium } from '@playwright/test';

const base = process.env.BASE ?? 'http://localhost:5173';
const out = new URL('../.impeccable/review/tablet/', import.meta.url).pathname;
const prefix = process.env.PREFIX ?? '';
const desktop = process.env.DESKTOP === '1';
const sizes = desktop
  ? [[1440, 900], [1920, 1080]]
  : [[768, 1024], [820, 1180], [800, 1280], [1024, 768], [1180, 820], [1366, 1024]];
const wanted = (process.env.MOMENTS ?? 'mulligan,main,combat,theirs').split(',');

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({
  viewport: { width: sizes[0][0], height: sizes[0][1] },
  colorScheme: 'dark',
  ...(desktop ? {} : { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }),
});
const page = await context.newPage();
const press = (locator) => (desktop ? locator.click({ timeout: 3000 }) : locator.tap({ timeout: 3000 }));

const taken = new Set();
async function shootAll(moment) {
  if (taken.has(moment) || !wanted.includes(moment)) return;
  taken.add(moment);
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}${prefix}${moment}-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: sizes[0][0], height: sizes[0][1] });
  console.log('shot', moment);
}

await page.goto(`${base}/login`);
await page.getByLabel('Player name').fill(`tab${Date.now() % 100000}`);
await press(page.getByRole('button', { name: 'Sit down' }));
await page.waitForURL((url) => !url.pathname.startsWith('/login'));
await press(page.getByRole('button', { name: /^play$/i }));
await page.waitForURL(/\/game\//, { timeout: 60000 });
const starter = page.getByRole('dialog', { name: /who starts/i });
const hand = page.getByRole('dialog', { name: /opening hand/i });
await starter.or(hand).first().waitFor({ timeout: 60000 });
if (await starter.isVisible()) await press(starter.getByRole('button', { name: 'Play first' }));
await hand.waitFor({ timeout: 60000 });
await page.waitForTimeout(2500);
await shootAll('mulligan');
await press(hand.getByRole('button', { name: /^keep$/i }));

const cluster = page.getByRole('region', { name: 'Your decision' });
const deadline = Date.now() + Number(process.env.TIMEOUT ?? 240000);
const playsOnTurn = new Map();
while (Date.now() < deadline && wanted.some((moment) => !taken.has(moment))) {
  await page.waitForTimeout(700);
  if (await page.getByRole('dialog', { name: /defeat|victory|game over/i }).isVisible().catch(() => false)) break;
  const panel = page.getByRole('dialog').first();
  if (await panel.isVisible().catch(() => false)) {
    const choice = panel.getByRole('button').filter({ hasNotText: /^(See the board|Close|Cancel|Skip|Back to choice)$/ }).and(page.locator(':enabled'));
    if (await choice.count() > 0) await press(choice.last()).catch(() => undefined);
    continue;
  }
  const ladder = page.getByRole('navigation', { name: /^Turn \d+/ });
  const label = (await ladder.getAttribute('aria-label').catch(() => '')) ?? '';
  const turn = Number(/^Turn (\d+)/.exec(label)?.[1] ?? 0);
  const mine = /your turn/.test(label);
  const step = ((await ladder.locator('[aria-current="step"]').textContent().catch(() => '')) ?? '').trim();
  if (process.env.DEBUG) console.log(turn, mine, step, taken.size);
  if (!mine && turn > 1) await shootAll('theirs');
  const main = cluster.getByRole('button').filter({ hasNotText: /^$/ }).last();
  const waitingForMe = await main.isVisible().catch(() => false) && await main.isEnabled().catch(() => false);
  if ((step === 'Attack' || step === 'Block') && waitingForMe && !taken.has('combat')) {
    // declare an attacker (or a blocker) when the game asks, so the arrows show; the game waits while we shoot
    const creature = page.locator('[role="button"][data-object-id][aria-pressed="false"]').first();
    if (await creature.isVisible().catch(() => false)) {
      await press(creature).catch(() => undefined);
      await page.waitForTimeout(1200);
      await shootAll('combat');
    }
  }
  if (mine && step === 'Main' && (playsOnTurn.get(turn) ?? 0) < 3) {
    const playable = page.getByRole('list', { name: /^Your hand/ }).getByRole('listitem', { name: /, playable/ });
    if (await playable.count() > 0) {
      await press(playable.first()).catch(() => undefined);
      playsOnTurn.set(turn, (playsOnTurn.get(turn) ?? 0) + 1);
      await page.waitForTimeout(1500);
      if (turn >= 3) await shootAll('main');
      continue;
    }
  }
  if (waitingForMe) await press(main).catch(() => undefined);
}
console.log('taken', [...taken].join(', '));
await browser.close();
