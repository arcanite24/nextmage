import { describe, expect, it } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { askedAttacker, defenderChoice, inRange, seatDistance } from './multiplayer';
import type { Prompt } from './prompt';

const players = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ playerId: id, name: id.toUpperCase(), life: 40 }));

describe('range of influence', () => {
  it('measures seats around the table', () => {
    expect(seatDistance(players, 'a', 'b')).toBe(1);
    expect(seatDistance(players, 'a', 'e')).toBe(1);
    expect(seatDistance(players, 'a', 'c')).toBe(2);
  });

  it('keeps players within the table range', () => {
    expect(inRange({ players, rangeOfInfluence: 'ALL' }, 'a', 'c')).toBe(true);
    expect(inRange({ players, rangeOfInfluence: 'ONE' }, 'a', 'c')).toBe(false);
    expect(inRange({ players, rangeOfInfluence: 'ONE' }, 'a', 'e')).toBe(true);
    expect(inRange({ players, rangeOfInfluence: 'TWO' }, 'a', 'c')).toBe(true);
  });

  it('closes the range around players who left', () => {
    const left = players.map((player) => (player.playerId === 'b' ? { ...player, hasLeft: true } : player));
    expect(inRange({ players: left, rangeOfInfluence: 'ONE' }, 'a', 'c')).toBe(true);
  });
});

describe('defenderChoice', () => {
  const view: GameView = {
    step: 'DECLARE_ATTACKERS',
    players: [
      ...players.slice(0, 2),
      { ...players[2], battlefield: { pw: { id: 'pw', name: 'Jace Beleren', cardTypes: ['PLANESWALKER'], loyalty: '3' } } },
    ],
  };
  const prompt = (targets: string[], text = 'Select player, planeswalker, or battle to attack') =>
    ({ kind: 'target', text, targets, cards: null, required: true, chosen: [], doneLabel: null }) as unknown as Prompt;

  it('names the players and planeswalkers that can be attacked', () => {
    expect(defenderChoice(prompt(['b', 'c', 'pw']), view)).toEqual([
      { id: 'b', kind: 'player', name: 'B', value: '40', controllerName: null },
      { id: 'c', kind: 'player', name: 'C', value: '40', controllerName: null },
      { id: 'pw', kind: 'planeswalker', name: 'Jace Beleren', value: '3', controllerName: 'C' },
    ]);
  });

  it('ignores other questions', () => {
    expect(defenderChoice(prompt(['b', 'c'], 'Select target player'), view)).toBeNull();
    expect(defenderChoice(prompt(['b', 'c']), { ...view, step: 'PRECOMBAT_MAIN' })).toBeNull();
  });
});

describe('askedAttacker', () => {
  const goblin = { id: 'g', name: 'Battle Cry Goblin', cardTypes: ['CREATURE'] as const, tapped: true };
  const token = { id: 't', name: 'Goblin Token', cardTypes: ['CREATURE'] as const, tapped: true };
  const land = { id: 'l', name: 'Mountain', cardTypes: ['LAND'] as const, tapped: true };
  const view = (attacking: string[]) => ({
    players: [{ playerId: 'me', battlefield: { g: goblin, t: token, l: land } }],
    combat: [{ attackers: Object.fromEntries(attacking.map((id) => [id, {}])) }],
  }) as unknown as GameView;

  it('names the creature just clicked while it is being declared', () => {
    expect(askedAttacker(view([]), 'me', 'g')?.name).toBe('Battle Cry Goblin');
  });

  it('names the creature entering attacking once the clicked one is already in combat', () => {
    expect(askedAttacker(view(['g']), 'me', 'g')?.name).toBe('Goblin Token');
  });

  it('says nothing when it cannot tell', () => {
    expect(askedAttacker(view([]), 'me', null)).toBeNull();
    expect(askedAttacker(null, 'me', 'g')).toBeNull();
  });
});
