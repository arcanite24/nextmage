/**
 * The commander starter decks must be legal Commander decks, or the AI can't take its seat in a commander game.
 * Needs a running local server:
 *   MAGE_LIVE_SERVER=1 npx vitest run src/core/headless/commanderStarters
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createApi } from '../../protocol/generated/api';
import { RpcClient } from '../rpc/RpcClient';
import { DeckSerializer } from '../decks/DeckSerializer';
import { isCommanderFormat } from '../decks/formats';
import { toWire } from '../../app/decks/deckModel';

const SERVER_URL = process.env.MAGE_SERVER_URL ?? 'ws://127.0.0.1:17172';
const live = process.env.MAGE_LIVE_SERVER === '1';
const STARTERS = join(__dirname, '../../../public/starter-decks');

interface StarterEntry {
  file: string;
  name: string;
  format?: string;
  cover?: { name: string; setCode: string; cardNumber: string };
}

describe.skipIf(!live)('commander starter decks', () => {
  test('are legal in their format and every card is known', async () => {
    const rpc = new RpcClient({ heartbeatMs: 0 });
    const api = createApi(rpc);
    await rpc.connect(SERVER_URL);
    expect(await api.connectUser(`check_${Date.now() % 100000}`, 'testpass')).toBe(true);

    const index = JSON.parse(readFileSync(join(STARTERS, 'index.json'), 'utf8')) as StarterEntry[];
    const commanders = index.filter((entry) => isCommanderFormat(entry.format));
    expect(commanders.length).toBeGreaterThan(0);
    const problems: string[] = [];
    for (const entry of commanders) {
      const deck = DeckSerializer.importDeck(readFileSync(join(STARTERS, entry.file), 'utf8'));
      const all = [...deck.cards, ...deck.sideboard];
      const found = await api.lookupCards(all.map((card) => ({ ...card, setCode: card.setCode ?? '', cardNumber: card.cardNumber ?? '' })));
      all.forEach((card, i) => {
        if (!found[i]) problems.push(`${entry.name}: unknown card ${card.cardName}`);
      });
      if (entry.cover) {
        const [cover] = await api.lookupCards([{ ...entry.cover, cardName: entry.cover.name, amount: 1 }]);
        if (cover?.name !== entry.cover.name || cover?.expansionSetCode !== entry.cover.setCode) {
          problems.push(`${entry.name}: cover ${entry.cover.setCode} #${entry.cover.cardNumber} is ${cover?.name ?? 'unknown'} (${cover?.expansionSetCode})`);
        }
      }
      const result = await api.deckValidate(entry.format!, toWire(deck));
      if (!result.valid) {
        for (const error of result.errors ?? []) problems.push(`${entry.name}: ${error.group} ${error.message}`);
      }
    }
    expect(problems).toEqual([]);
    rpc.disconnect();
  }, 60_000);
});
