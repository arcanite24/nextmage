/**
 * Plays a whole game against the server's AI through the new client core (RpcClient -> EventBus -> GameSession),
 * with a scripted bot answering prompts. Needs a running local server:
 *   MAGE_LIVE_SERVER=1 npx vitest run src/core/headless
 */
import { describe, expect, test } from 'vitest';
import { createApi } from '../../protocol/generated/api';
import type { DeckCardLists, TableClientMessage } from '../../protocol/generated/views';
import { RpcClient } from '../rpc/RpcClient';
import { EventBus } from '../rpc/EventBus';
import { GameSession } from '../game/gameSession';
import { chooseBotCommand } from './simpleBot';

const SERVER_URL = process.env.MAGE_SERVER_URL ?? 'ws://127.0.0.1:17172';
const live = process.env.MAGE_LIVE_SERVER === '1';

function deck(name: string, cards: [number, string][]): DeckCardLists {
  return {
    name,
    cards: cards.map(([amount, cardName]) => ({ amount, cardName, setCode: '', cardNumber: '' })),
    sideboard: [],
  };
}

const RED_AGGRO = deck('Headless Red', [
  [22, 'Mountain'],
  [4, 'Raging Goblin'],
  [4, 'Goblin Piker'],
  [4, 'Gray Ogre'],
  [4, 'Hill Giant'],
  [4, 'Lightning Bolt'],
  [4, 'Shock'],
  [4, 'Lava Axe'],
  [4, 'Goblin Bushwhacker'],
  [6, 'Mons\'s Goblin Raiders'],
]);

describe.skipIf(!live)('headless game against the AI', () => {
  test('plays a full game through the client core', async () => {
    const rpc = new RpcClient({ heartbeatMs: 0 });
    const bus = new EventBus(rpc);
    const api = createApi(rpc);
    await rpc.connect(SERVER_URL);

    const userName = `bot_${Date.now() % 100000}`;
    expect(await api.connectUser(userName, 'testpass')).toBe(true);
    const roomId = await api.serverGetMainRoomId();

    const gameStarted = new Promise<TableClientMessage>((resolve) => bus.on('START_GAME', (message) => resolve(message)));

    const table = await api.roomCreateTable(roomId, {
      name: 'Headless core test',
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Freeform',
      winsNeeded: 1,
      playerTypes: ['HUMAN', 'COMPUTER_MAD'],
    });
    expect(table.tableId).toBeTruthy();
    expect(await api.roomJoinTable(roomId, table.tableId!, userName, 'HUMAN', 1, RED_AGGRO)).toBe(true);
    expect(await api.roomJoinTable(roomId, table.tableId!, 'Headless AI', 'COMPUTER_MAD', 2, RED_AGGRO)).toBe(true);
    expect(await api.matchStart(roomId, table.tableId!)).toBe(true);

    const start = await gameStarted;
    expect(start.gameId).toBeTruthy();
    const session = new GameSession(api, bus, { gameId: start.gameId!, playerId: start.playerId ?? null, mode: 'play' });
    await api.gameJoin(start.gameId!);

    const stats = { commands: 0, landsPlayed: 0, spellsCast: 0, attacks: 0, maxTurn: 0 };
    const finished = new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`Game did not finish: ${JSON.stringify(stats)}`)), Number(process.env.MAGE_BOT_TIMEOUT_MS ?? 240_000));
      let busy = false;
      const unaffordable = new Set<string>();
      let lastCast: string | null = null;
      let skipTurn = -1;
      const step = () => {
        const state = session.getState();
        stats.maxTurn = Math.max(stats.maxTurn, state.view?.turn ?? 0);
        if (state.gameOver) {
          clearTimeout(deadline);
          resolve();
          return;
        }
        if (busy || state.awaitingServer) return;
        if (stats.maxTurn > 25 && state.interaction.mode === 'priority') {
          // keep the test bounded: the AI may stall a race; conceding still completes the game flow
          busy = true;
          void session.respond({ type: 'action', action: 'CONCEDE' }).finally(() => { busy = false; });
          return;
        }
        if ((state.view?.turn ?? 0) !== skipTurn) {
          unaffordable.clear();
          skipTurn = state.view?.turn ?? 0;
        }
        const command = chooseBotCommand(state.view, state.interaction, unaffordable);
        if (state.interaction.mode === 'payMana' && command?.type === 'boolean' && lastCast) unaffordable.add(lastCast);
        if (state.interaction.mode === 'priority' && command?.type === 'uuid' && command.id) lastCast = command.id;
        if (!command) return;
        if (state.interaction.mode === 'priority' && command.type === 'uuid') {
          const card = state.view?.myHand?.[command.id ?? ''];
          if (card?.cardTypes?.includes('LAND')) stats.landsPlayed++;
          else if (card) stats.spellsCast++;
        }
        if (state.interaction.mode === 'declareAttackers' && command.type === 'string') stats.attacks++;
        stats.commands++;
        if (process.env.MAGE_BOT_TRACE) console.log(`[bot] t${state.view?.turn} ${state.view?.step} ${state.interaction.mode} "${state.interaction.headline}" -> ${JSON.stringify(command)} clickable=${state.interaction.clickable.size}`);
        busy = true;
        void session.respond(command).catch(() => undefined).finally(() => {
          busy = false;
          queueMicrotask(step);
        });
      };
      session.store.subscribe(step);
      step();
    });

    await finished;
    const final = session.getState();
    expect(final.gameOver).toBeTruthy();
    expect(stats.landsPlayed).toBeGreaterThan(0);
    expect(stats.commands).toBeGreaterThan(10);
    console.log('[headless] finished:', final.gameOver, JSON.stringify(stats));

    session.dispose();
    await api.disconnectSession(false).catch(() => undefined);
    rpc.disconnect();
  }, Number(process.env.MAGE_BOT_TIMEOUT_MS ?? 240_000) + 60_000);
});
