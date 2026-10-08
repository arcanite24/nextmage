import { describe, expect, it } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { autoAnswer, meaningfulPlays } from './autoPass';
import { parsePrompt } from './prompt';

const record = [{}] as never;
const on = { autoPass: true, autoSkipCombat: true, abilitiesOnTheirTurn: false };
const priority = parsePrompt('GAME_SELECT', { message: 'Play instants and activated abilities' });

function view(objects: NonNullable<GameView['canPlayObjects']>['objects']): GameView {
  return { myPlayerId: 'me', canPlayObjects: { objects } };
}

describe('meaningfulPlays', () => {
  it('ignores sources that can only make mana', () => {
    expect(meaningfulPlays(view({ forest: { basicManaAbilities: record }, elf: { basicManaAbilities: record } }))).toEqual([]);
  });
  it('ignores mana abilities the server files under other (dual lands)', () => {
    expect(meaningfulPlays(view({ dual: { other: [{ value: '{T}: Add {G} or {W}.' }] } }))).toEqual([]);
    expect(meaningfulPlays(view({ map: { other: [{ value: '{T}, Sacrifice Renegade Map: Search your library for a basic...' }] } }))).toEqual(['map']);
  });
  it('counts spells, land plays and other abilities', () => {
    expect(meaningfulPlays(view({
      bolt: { basicCastAbilities: record },
      land: { basicPlayAbilities: record },
      looter: { other: record },
      forest: { basicManaAbilities: record },
    }))).toEqual(['bolt', 'land', 'looter']);
  });
});

describe('autoAnswer', () => {
  it('passes priority when only mana abilities are available', () => {
    expect(autoAnswer(view({ forest: { basicManaAbilities: record } }), priority, on)).toBe('pass');
  });
  it("on the opponent's turn, permanents' abilities only stop you when asked to", () => {
    const theirTurn: GameView = { ...view({ map: { other: [{ value: '{T}, Sacrifice: search...' }] } }), activePlayerId: 'them' };
    const myTurn: GameView = { ...theirTurn, activePlayerId: 'me' };
    expect(autoAnswer(theirTurn, priority, on)).toBe('pass');
    expect(autoAnswer(theirTurn, priority, { ...on, abilitiesOnTheirTurn: true })).toBeNull();
    expect(autoAnswer(myTurn, priority, on)).toBeNull();
  });
  it('stops when there is something to cast, or when the setting is off', () => {
    expect(autoAnswer(view({ bolt: { basicCastAbilities: record } }), priority, on)).toBeNull();
    expect(autoAnswer(view({}), priority, { ...on, autoPass: false })).toBeNull();
  });
  it('skips combat only when nothing can attack or block', () => {
    const noAttackers = parsePrompt('GAME_SELECT', { message: 'Select attackers', options: { possibleAttackers: [] } as never });
    const attackers = parsePrompt('GAME_SELECT', { message: 'Select attackers', options: { possibleAttackers: ['bear'] } as never });
    expect(autoAnswer(view({}), noAttackers, on)).toBe('noAttacks');
    expect(autoAnswer(view({}), attackers, on)).toBeNull();
  });
  it('waits for confirmation once every creature is declared (the server then lists none as possible)', () => {
    const noneLeft = parsePrompt('GAME_SELECT', { message: 'Select attackers', options: { possibleAttackers: [] } as never });
    const allDeclared: GameView = { ...view({}), combat: [{ defenderId: 'them', attackers: { bear: { controllerId: 'me' } } }] };
    expect(autoAnswer(allDeclared, noneLeft, on)).toBeNull();
    const noBlockersLeft = parsePrompt('GAME_SELECT', { message: 'Select blockers', options: { possibleBlockers: [] } as never });
    const blocking: GameView = { ...view({}), combat: [{ defenderId: 'me', attackers: { ogre: { controllerId: 'them' } }, blockers: { bear: { controllerId: 'me' } } }] };
    expect(autoAnswer(blocking, noBlockersLeft, on)).toBeNull();
  });
  it('lets the rest of combat go by when nobody attacks, unless something is on the stack', () => {
    const instant = view({ roar: { basicCastAbilities: record } });
    expect(autoAnswer({ ...instant, step: 'DECLARE_ATTACKERS', combat: [] }, priority, on)).toBe('pass');
    expect(autoAnswer({ ...instant, step: 'DECLARE_ATTACKERS', combat: [{ attackers: { bear: {} } }] } as GameView, priority, on)).toBeNull();
    expect(autoAnswer({ ...instant, step: 'END_COMBAT', stack: { bolt: {} } } as GameView, priority, on)).toBeNull();
    expect(autoAnswer({ ...instant, step: 'BEGIN_COMBAT' }, priority, on)).toBeNull();
    expect(autoAnswer({ ...instant, step: 'DECLARE_ATTACKERS' }, priority, { ...on, autoSkipCombat: false })).toBeNull();
  });
  it('never answers other decisions', () => {
    const target = parsePrompt('GAME_TARGET', { message: 'Choose a target', targets: ['x'], flag: true });
    expect(autoAnswer(view({}), target, on)).toBeNull();
  });
});
