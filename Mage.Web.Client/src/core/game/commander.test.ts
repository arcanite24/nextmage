import { describe, expect, it } from 'vitest';
import type { GameView, PlayerView } from '../../protocol/generated/views';
import { commanderDamageTo, commanderFacts, commandersByPlayer } from './commander';

const krenkoRules = [
  '{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.',
  '<b>Commander</b> 2 times played from the command zone.',
  "<b>Commander</b> did 7 combat damage to player <font color='#20B2AA'>Ana</font>.",
];

describe('commanderFacts', () => {
  it('reads casts, tax and damage from the info lines', () => {
    expect(commanderFacts({ rules: krenkoRules })).toEqual({ casts: 2, tax: 4, damage: [{ playerName: 'Ana', amount: 7 }] });
    expect(commanderFacts({ rules: ['<b>Commander</b>'] })).toEqual({ casts: 0, tax: 0, damage: [] });
    expect(commanderFacts({ rules: ['<b>Commander</b> 1 time played from the command zone.'] })?.tax).toBe(2);
    expect(commanderFacts({ rules: ['Flying'] })).toBeNull();
  });

  it('reads an Oathbreaker game, where the lines name the oathbreaker and the signature spell', () => {
    expect(commanderFacts({ rules: ['<b>Oathbreaker</b> 1 time played from the command zone.'] })?.tax).toBe(2);
    expect(commanderFacts({ rules: ['<b>Signature Spell</b> 3 times played from the command zone.'] })?.casts).toBe(3);
  });
});

describe('commandersByPlayer', () => {
  const me: PlayerView = {
    playerId: 'p1',
    name: 'Bo',
    commandList: [{ id: 'talrand', name: 'Talrand, Sky Summoner', mageObjectType: 'COMMANDER', rules: [] } as never],
  };
  const ana: PlayerView = {
    playerId: 'p2',
    name: 'Ana',
    battlefield: { k1: { id: 'k1', name: 'Krenko, Mob Boss', ownerId: 'p3', controllerId: 'p2', rules: krenkoRules } },
  };
  const cy: PlayerView = { playerId: 'p3', name: 'Cy', graveyard: {} };
  const view: GameView = { players: [me, ana, cy] };

  it('finds commanders in the command zone and on the battlefield, under their owner', () => {
    const commanders = commandersByPlayer(view);
    expect(commanders.get('p1')?.map((c) => [c.name, c.zone])).toEqual([['Talrand, Sky Summoner', 'command']]);
    // stolen by Ana, still Cy's commander
    expect(commanders.get('p3')?.map((c) => [c.name, c.zone, c.tax])).toEqual([['Krenko, Mob Boss', 'battlefield', 4]]);
    expect(commanders.has('p2')).toBe(false);
  });

  it('totals the damage each player took', () => {
    const commanders = commandersByPlayer(view);
    expect(commanderDamageTo(ana, commanders).map((hit) => [hit.commander.name, hit.amount])).toEqual([['Krenko, Mob Boss', 7]]);
    expect(commanderDamageTo(me, commanders)).toEqual([]);
  });
});
