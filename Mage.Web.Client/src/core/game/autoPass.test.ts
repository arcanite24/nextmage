import { describe, expect, it } from 'vitest';
import type { GameView } from '../../protocol/generated/views';
import { autoAnswer, combatStopHere, meaningfulPlays } from './autoPass';
import { serverStops } from './stops';
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

describe('full control and combat stops', () => {
  const attacking: GameView = {
    myPlayerId: 'me', activePlayerId: 'them', step: 'DECLARE_ATTACKERS',
    combat: [{ attackers: { bear: { id: 'bear' } }, defenderId: 'me' }],
  };
  const stops = { yourTurn: { attackers: false, blockers: false }, opponentTurn: { attackers: true, blockers: false } };

  it('never answers for the player under full control', () => {
    expect(autoAnswer(view({}), priority, { ...on, fullControl: true })).toBeNull();
    const noAttackers = parsePrompt('GAME_SELECT', { message: 'Select attackers', options: { possibleAttackers: [] } });
    expect(autoAnswer(view({}), noAttackers, { ...on, fullControl: true })).toBeNull();
    expect(autoAnswer(view({}), noAttackers, on)).toBe('noAttacks');
  });

  it('stops in a combat step the player marked, once creatures attack', () => {
    expect(combatStopHere(attacking, stops)).toBe(true);
    expect(autoAnswer(attacking, priority, { ...on, combatStops: stops })).toBeNull();
    // without the stop, nothing to cast means pass
    expect(autoAnswer(attacking, priority, on)).toBe('pass');
    // the stop is per side and per step
    expect(combatStopHere({ ...attacking, activePlayerId: 'me' }, stops)).toBe(false);
    expect(combatStopHere({ ...attacking, step: 'DECLARE_BLOCKERS' }, stops)).toBe(false);
    // no attackers: nothing to stop for
    expect(combatStopHere({ ...attacking, combat: [] }, stops)).toBe(false);
  });

  it('asks the server for every stop under full control', () => {
    const own = {
      yourTurn: { upkeep: false, main1: true }, opponentTurn: { endOfTurn: true }, stopOnDeclareAttackers: false, stopOnStackNewObjects: false,
    };
    expect(serverStops(own, false)).toEqual({ ...own, yourTurn: { ...own.yourTurn, beforeCombat: true } });
    const full = serverStops(own, true);
    expect(full.yourTurn).toMatchObject({ upkeep: true, draw: true, main1: true, beforeCombat: true, endOfCombat: true, main2: true, endOfTurn: true });
    expect(full.opponentTurn).toEqual(full.yourTurn);
    expect(full).toMatchObject({ stopOnDeclareAttackers: true, stopOnStackNewObjects: true, stopOnDeclareBlockersWithZeroPermanents: true });
  });
});

describe('the beginning of your combat', () => {
  const crew = { vehicle: { other: [{ value: 'Crew 1' }] } } as never;
  const beginCombat: GameView = { myPlayerId: 'me', activePlayerId: 'me', step: 'BEGIN_COMBAT', turn: 5, canPlayObjects: { objects: crew } };
  const ownStop = { ...on, beginCombatStop: false };

  it('is passed when the player has no stop there, even with abilities to activate', () => {
    expect(autoAnswer(beginCombat, priority, ownStop)).toBe('pass');
    expect(autoAnswer(beginCombat, priority, { ...ownStop, autoPass: false })).toBe('pass');
    expect(autoAnswer(beginCombat, priority, { ...ownStop, beginCombatStop: true })).toBeNull();
  });
  it('stops after a trigger there resolved and left something to do (crew what Greasefang returned)', () => {
    expect(autoAnswer(beginCombat, priority, { ...ownStop, combatTriggered: true })).toBeNull();
    expect(autoAnswer({ ...beginCombat, canPlayObjects: { objects: {} } }, priority, { ...ownStop, combatTriggered: true })).toBe('pass');
  });
  it("leaves the trigger on the stack, the opponent's turn and full control alone", () => {
    expect(autoAnswer({ ...beginCombat, stack: { trigger: {} } } as GameView, priority, ownStop)).toBeNull();
    expect(autoAnswer({ ...beginCombat, activePlayerId: 'them', canPlayObjects: { objects: {} } }, priority, ownStop)).toBe('pass');
    expect(autoAnswer({ ...beginCombat, activePlayerId: 'them' }, priority, { ...ownStop, abilitiesOnTheirTurn: true })).toBeNull();
    expect(autoAnswer(beginCombat, priority, { ...ownStop, fullControl: true })).toBeNull();
  });
});
