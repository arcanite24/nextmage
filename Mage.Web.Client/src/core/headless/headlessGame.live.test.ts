/**
 * Plays a whole game against the server's AI through the new client core, with a scripted bot answering prompts.
 * Needs a running local server:
 *   MAGE_LIVE_SERVER=1 npx vitest run src/core/headless
 */
import { describe, expect, test } from 'vitest';
import { playBotGame } from './botGame';

const SERVER_URL = process.env.MAGE_SERVER_URL ?? 'ws://127.0.0.1:17172';
const live = process.env.MAGE_LIVE_SERVER === '1';
const TIMEOUT = Number(process.env.MAGE_BOT_TIMEOUT_MS ?? 240_000);

describe.skipIf(!live)('headless game against the AI', () => {
  test('plays a full game through the client core', async () => {
    const stats = await playBotGame({ serverUrl: SERVER_URL, userName: `bot_${Date.now() % 100000}`, timeoutMs: TIMEOUT });
    expect(stats.gameOver).toBe(true);
    expect(stats.landsPlayed).toBeGreaterThan(0);
    expect(stats.commands).toBeGreaterThan(10);
    // the server's game events (B073): lands and spells move between zones, and someone takes damage
    expect(stats.events.ZONE ?? 0).toBeGreaterThan(0);
    expect(stats.events.DAMAGE ?? 0).toBeGreaterThan(0);
    console.log('[headless] finished:', JSON.stringify(stats));
  }, TIMEOUT + 60_000);
});
