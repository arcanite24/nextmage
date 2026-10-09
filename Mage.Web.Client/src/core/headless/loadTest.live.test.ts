/**
 * Load test: N headless players each play a game against COMPUTER_MAD at the same time, in waves, while an admin
 * connection samples the server's CPU, load and memory (adminServerStats). Prints a summary to put in the ops README.
 *
 *   MAGE_LOAD_TEST=1 MAGE_SERVER_URL=wss://host/ws MAGE_ADMIN_PASSWORD=... \
 *     MAGE_LOAD_GAMES=8 MAGE_LOAD_WAVES=2 npx vitest run src/core/headless/loadTest --silent=false
 *
 * The bot answers prompts at once (50 ms apart), so a game here is busier than one with a person at the keyboard;
 * read the result as a lower bound on how many games a core holds.
 */
import { describe, expect, test } from 'vitest';
import { createApi } from '../../protocol/generated/api';
import type { ServerStats } from '../../protocol/generated/views';
import { RpcClient } from '../rpc/RpcClient';
import { playBotGame, type BotGameStats } from './botGame';

const SERVER_URL = process.env.MAGE_SERVER_URL ?? 'ws://127.0.0.1:17172';
const GAMES = Number(process.env.MAGE_LOAD_GAMES ?? 4);
const WAVES = Number(process.env.MAGE_LOAD_WAVES ?? 1);
const TIMEOUT = Number(process.env.MAGE_BOT_TIMEOUT_MS ?? 600_000);
const SAMPLE_MS = 2_000;

function summarize(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length);
  return { mean, p50: pick(0.5), p95: pick(0.95), max: sorted[sorted.length - 1] ?? 0 };
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

describe.skipIf(process.env.MAGE_LOAD_TEST !== '1')('load test', () => {
  test(`${GAMES} concurrent games against the AI`, async () => {
    const admin = new RpcClient({ heartbeatMs: 0 });
    const adminApi = createApi(admin);
    const samples: ServerStats[] = [];
    let timer: ReturnType<typeof setInterval> | null = null;
    if (process.env.MAGE_ADMIN_PASSWORD) {
      await admin.connect(SERVER_URL);
      expect(await adminApi.connectAdmin(process.env.MAGE_ADMIN_PASSWORD)).toBe(true);
      samples.push(await adminApi.adminServerStats());
      timer = setInterval(() => {
        adminApi.adminServerStats().then((stats) => samples.push(stats)).catch(() => undefined);
      }, SAMPLE_MS);
    }

    const results: (BotGameStats | Error)[] = [];
    const started = Date.now();
    const run = Date.now() % 10_000;
    for (let wave = 0; wave < WAVES; wave++) {
      const games = Array.from({ length: GAMES }, (_, index) =>
        playBotGame({ serverUrl: SERVER_URL, userName: `load${run}_${wave}${index}`.slice(0, 14), timeoutMs: TIMEOUT, maxTurns: 20 })
          .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error)))));
      results.push(...await Promise.all(games));
    }
    const wall = Date.now() - started;
    if (timer) clearInterval(timer);
    if (process.env.MAGE_ADMIN_PASSWORD) {
      samples.push(await adminApi.adminServerStats());
      admin.disconnect();
    }

    const finished = results.filter((result): result is BotGameStats => !(result instanceof Error) && result.gameOver);
    const failures = results.filter((result): result is Error => result instanceof Error);
    const busy = samples.filter((sample) => (sample.activeGames ?? 0) > 0);
    const cpu = summarize(busy.map((sample) => sample.processCpu ?? 0).filter((value) => value >= 0));
    const load = summarize(busy.map((sample) => sample.systemLoad ?? 0).filter((value) => value >= 0));
    const heap = summarize(samples.map((sample) => (sample.heapUsed ?? 0) / 1024 / 1024));
    const games = summarize(finished.map((game) => game.millis / 1000));
    const turns = summarize(finished.map((game) => game.maxTurn));
    const cores = samples[0]?.processors ?? 0;
    const peakGames = Math.max(0, ...samples.map((sample) => sample.activeGames ?? 0));
    const largest = samples[samples.length - 1]?.bridge?.heaviest?.[0];

    const lines = [
      `server ${SERVER_URL} · ${cores} cores · ${GAMES} concurrent games × ${WAVES} waves · wall ${Math.round(wall / 1000)} s`,
      `finished ${finished.length}/${results.length}${failures.length ? ` · failed: ${failures.map((error) => error.message).join('; ')}` : ''}`,
      `game length s: mean ${games.mean.toFixed(0)} · p50 ${games.p50.toFixed(0)} · p95 ${games.p95.toFixed(0)} · turns mean ${turns.mean.toFixed(1)}`,
      samples.length
        ? `server CPU (share of all cores) while games ran: mean ${pct(cpu.mean)} · p95 ${pct(cpu.p95)} · max ${pct(cpu.max)} · peak games ${peakGames}`
        : 'no server stats (set MAGE_ADMIN_PASSWORD)',
      samples.length ? `load average: mean ${load.mean.toFixed(2)} · max ${load.max.toFixed(2)} · heap MB: mean ${heap.mean.toFixed(0)} · max ${heap.max.toFixed(0)}` : '',
      samples.length && cpu.mean > 0
        ? `≈ ${((GAMES / (cpu.mean * cores)) || 0).toFixed(1)} games per busy core at this pace`
        : '',
      largest ? `heaviest callback: ${largest.method} · ${largest.count} sent · largest ${Math.round((largest.maxChars ?? 0) / 1024)} KB` : '',
    ].filter(Boolean);
    console.log(`[load]\n${lines.join('\n')}`);
    expect(finished.length).toBeGreaterThan(0);
  }, (TIMEOUT + 60_000) * WAVES);
});
