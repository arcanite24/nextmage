// Captures the deck import surfaces for design review: node e2e/import-review-shots.mjs
// (dev server and game server running; NETWORK=1 also reads a real Archidekt deck)
import { chromium } from '@playwright/test';

const base = process.env.BASE ?? 'http://localhost:5173';
const out = new URL('../.impeccable/review/', import.meta.url).pathname;
const tablet = process.env.TABLET === '1';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: tablet ? { width: 1024, height: 768 } : { width: 1440, height: 900 }, colorScheme: 'dark' });
// deck reads are held for 3 s on the way to the server, so the loading state stays up long enough to capture
await page.routeWebSocket(/:17172|\/ws/, (ws) => {
  const server = ws.connectToServer();
  ws.onMessage((message) => (String(message).includes('deckImportFromUrl') ? setTimeout(() => server.send(message), 3000) : server.send(message)));
  server.onMessage((message) => ws.send(message));
});
const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const decoded = Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
    await Promise.race([decoded, new Promise((resolve) => setTimeout(resolve, 4000))]);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}${tablet ? 'mobile-' : ''}import-${name}.png` });
  console.log('shot', name);
};
const paste = (text) => page.evaluate((value) => {
  const data = new DataTransfer();
  data.setData('text/plain', value);
  document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
}, text);

await page.goto(`${base}/login`);
await page.getByLabel('Player name').fill(`imp${Date.now() % 10000}`);
await page.getByRole('button', { name: 'Sit down' }).click();
await page.waitForURL((url) => !url.pathname.startsWith('/login'));
await page.goto(`${base}/decks`);
await shot('01-empty-shelf');

await page.getByRole('button', { name: 'Import', exact: true }).click();
await shot('02-input');
await page.getByLabel('Deck link or list').fill('https://archidekt.com/decks/3872725/murktide');
await shot('03-input-recognized');

await page.getByLabel('Deck link or list').fill('https://moxfield.com/decks/E3zZUHuCBUiC2dExO6wn4A');
await page.getByRole('button', { name: 'Continue' }).click();
await shot('04-assisted');
// open the site (the new tab is closed again), then come back to Playmat
const [site] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: /open the deck on moxfield/i }).click()]);
await site.close();
await page.bringToFront();
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
await shot('05-assisted-waiting');
await paste("Commander\n1 Atraxa, Praetors' Voice (2X2) 190\n\nDeck\n1 Sol Ring (CMR) 472\n1 Arcane Signet (ELD) 331\n1 Lightnig Bolt\n1 Cultivate\n95 Forest\n\nMaybeboard\n1 Doubling Season");
await page.getByText('1 card needs a look').waitFor({ timeout: 20_000 });
await shot('06-preview-fix');
await page.getByRole('button', { name: 'Find it' }).click();
await page.getByRole('button', { name: /^Lightning Bolt/ }).first().waitFor({ timeout: 20_000 });
await shot('07-preview-alternates');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

if (process.env.NETWORK === '1') {
  // the read takes about a second: catch the printed ghost deck box while it waits (a deck the server hasn't cached)
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByLabel('Deck link or list').fill('https://archidekt.com/decks/3872725/murktide');
  await page.keyboard.press('Enter');
  await page.getByText(/reading the deck from archidekt/i).waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}${tablet ? 'mobile-' : ''}import-075-loading.png` });
  console.log('shot', '075-loading');
  await page.getByLabel('Deck name').waitFor({ timeout: 20_000 });
  await shot('08-preview-archidekt');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(300);
  await shot('09-saved');
}

await page.goto(`${base}/decks`);
// something importable dragged over the shelf
await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Your decks' }) }).first().evaluate((element) => {
  const data = new DataTransfer();
  data.setData('text/plain', '4 Lightning Bolt');
  element.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data, bubbles: true, cancelable: true }));
  element.dispatchEvent(new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }));
});
await shot('10-drop-target');

await browser.close();
