import { describe, expect, test } from 'vitest';
import type { TournamentTypeView } from '../../protocol/generated/views';
import { CUBE_FROM_DECK, planEvent, tournamentTypeName, type EventChoice } from './eventPlan';

const TYPES: TournamentTypeView[] = [
  { name: 'Booster Draft Swiss', draft: true, limited: true, numBoosters: 3, minPlayers: 2, maxPlayers: 16 },
  { name: 'Booster Draft Swiss (Cube)', draft: true, limited: true, cubeBooster: true, numBoosters: 3 },
  { name: 'Booster Draft Elimination (Random)', draft: true, limited: true, random: true, numBoosters: 3 },
  { name: 'Booster Draft Swiss (Reshuffled)', draft: true, limited: true, reshuffled: true, numBoosters: 3 },
  { name: 'Booster Draft Swiss (Rich Man)', draft: true, limited: true, richMan: true, numBoosters: 1 },
  { name: 'Sealed Swiss', limited: true, numBoosters: 6 },
  { name: 'Jumpstart Swiss', limited: true, jumpstart: true, numBoosters: 0 },
  { name: 'Jumpstart Elimination (Custom)', limited: true, jumpstart: true, elimination: true, numBoosters: 0 },
  { name: 'Constructed Swiss', limited: false },
];

const BASE: EventChoice = {
  kind: 'draft', swiss: true, source: 'set', players: 8, setCode: 'DSK', pool: [], cubeName: '', constructionMinutes: 20, timing: 'REGULAR',
};

describe('tournamentTypeName', () => {
  test('matches the server config names', () => {
    expect(tournamentTypeName('draft', false, 'richManCube')).toBe('Booster Draft Elimination (Rich Man Cube)');
    expect(tournamentTypeName('sealed', true, 'cube')).toBe('Sealed Swiss (Cube)');
    expect(tournamentTypeName('jumpstart', true, 'custom')).toBe('Jumpstart Elimination (Custom)');
    expect(tournamentTypeName('constructed', true, 'set')).toBe('Constructed Swiss');
  });
});

describe('planEvent', () => {
  test('a set draft opens three packs of the set, with the draft timer', () => {
    const plan = planEvent(BASE, TYPES);
    expect(plan).toEqual({
      tournamentType: 'Booster Draft Swiss',
      limitedOptions: expect.objectContaining({ sets: ['DSK', 'DSK', 'DSK'], numberBoosters: 3, timing: 'REGULAR', constructionTime: 1200, isRandom: false }),
    });
  });

  test('a sealed event has no draft timer', () => {
    const plan = planEvent({ ...BASE, kind: 'sealed' }, TYPES);
    expect(typeof plan !== 'string' && plan.limitedOptions.timing).toBeFalsy();
    expect(typeof plan !== 'string' && plan.limitedOptions.sets).toHaveLength(6);
  });

  test('cubes name the cube, and an uploaded cube carries its list', () => {
    expect(planEvent({ ...BASE, source: 'cube' }, TYPES)).toBe('Pick a cube.');
    expect(planEvent({ ...BASE, source: 'cube', cubeName: `${CUBE_FROM_DECK} (your custom cube)` }, TYPES)).toMatch(/deck/);
    const list = { name: 'My cube', cards: [], sideboard: [] };
    const plan = planEvent({ ...BASE, source: 'cube', cubeName: CUBE_FROM_DECK, cubeFromDeck: list }, TYPES);
    expect(typeof plan !== 'string' && plan.limitedOptions).toEqual(expect.objectContaining({ draftCubeName: CUBE_FROM_DECK, cubeFromDeck: list, sets: [] }));
  });

  test('random drafts keep at most three packs per player plus three from the pool', () => {
    const pool = Array.from({ length: 40 }, (_, index) => `S${index}`);
    const plan = planEvent({ ...BASE, swiss: false, source: 'random', players: 4, pool, random: () => 0.5 }, TYPES);
    expect(typeof plan !== 'string' && plan.limitedOptions.sets).toHaveLength(15);
    expect(typeof plan !== 'string' && plan.limitedOptions.isRandom).toBe(true);
  });

  test('reshuffled drafts keep the whole pool; rich man keeps 36', () => {
    const pool = Array.from({ length: 40 }, (_, index) => `S${index}`);
    const reshuffled = planEvent({ ...BASE, source: 'reshuffled', pool }, TYPES);
    expect(typeof reshuffled !== 'string' && reshuffled.limitedOptions.sets).toEqual(pool);
    const richMan = planEvent({ ...BASE, source: 'richMan', pool }, TYPES);
    expect(typeof richMan !== 'string' && richMan.limitedOptions.sets).toHaveLength(36);
  });

  test('custom jumpstart needs the packs file', () => {
    expect(planEvent({ ...BASE, kind: 'jumpstart', source: 'custom' }, TYPES)).toMatch(/Upload/);
    const plan = planEvent({ ...BASE, kind: 'jumpstart', source: 'custom', jumpstartPacks: '# pack\n1 Island' }, TYPES);
    expect(typeof plan !== 'string' && plan.limitedOptions).toEqual(expect.objectContaining({ isJumpstart: true, jumpstartPacks: '# pack\n1 Island' }));
  });

  test("types the server doesn't run, and seat limits, are refused", () => {
    expect(planEvent({ ...BASE, kind: 'sealed', source: 'cube' }, TYPES)).toMatch(/doesn't run/);
    expect(planEvent({ ...BASE, players: 1 }, TYPES)).toMatch(/at least 2/);
  });
});
