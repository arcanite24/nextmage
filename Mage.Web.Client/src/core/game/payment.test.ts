import { describe, expect, test } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { deriveInteraction } from './interaction';
import { parsePayment, poolId, poolTypes } from './payment';
import { parsePrompt } from './prompt';

const PAY = "Pay {2}{G}<div style='font-size:11pt'><font color='#6fbb7c' object_id='elves-1'>Llanowar Elves</font> [e1f]</div>";

describe('paying a cost', () => {
  test('reads what is still owed and what it pays for', () => {
    expect(parsePayment({ message: PAY })).toEqual({ cost: '{2}{G}', sourceId: 'elves-1', sourceName: 'Llanowar Elves' });
    expect(parsePayment({ message: 'Pay {X}' })).toEqual({ cost: '{X}', sourceId: null, sourceName: '' });
  });

  test('lists the kinds of floating mana', () => {
    expect(poolTypes({ manaPool: { green: 2, red: 0, colorless: 1 } })).toEqual(['GREEN', 'COLORLESS']);
    expect(poolTypes(null)).toEqual([]);
  });

  test('floating mana in your pool is clickable while paying and sends its mana type', () => {
    const view: GameView = {
      myPlayerId: 'me',
      players: [{ playerId: 'me', manaPool: { green: 1 } }, { playerId: 'them', manaPool: { red: 3 } }],
      canPlayObjects: { objects: { 'forest-1': {} } },
    };
    const interaction = deriveInteraction(view, parsePrompt('GAME_PLAY_MANA', { message: PAY }));
    expect(interaction.clickable.get(poolId('GREEN'))).toEqual({ type: 'manaType', manaType: 'GREEN' });
    expect(interaction.clickable.has(poolId('RED'))).toBe(false);
    expect(interaction.clickable.has('forest-1')).toBe(true);
  });
});
