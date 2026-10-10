import { describe, expect, test } from 'vitest';
import type { CareerCampaign, CareerNode, CareerPoolCard } from '../../protocol/generated/views';
import {
  graduated, graduationOf, requirementLines, schoolsOf, storiesOf,
  PATH_STEP, buildDeck, buildFrom, buildProblems, buildSize, changeBasic, changePick, chapterPath, countNames, crestArt, crestSpec, emptyBasics,
  focusChapter, focusNode, hashName, mergeByName, legCurve, nodeState, poolEntries, portraitArt, portraitSpec, puzzleZones, rewardLines, runOver, runReward,
  starCount, starSlots, suggestBasics, toggleChoice, twistLines, type LimitedBuild,
} from './careerModesModel';

const node = (id: string, requires: string[] = [], state = 'locked', extra: Partial<CareerNode> = {}): CareerNode => ({ id, name: id, type: 'duel', requires, state, ...extra });

describe('the academy', () => {
  const campaigns: CareerCampaign[] = [
    { id: 'five-paths', name: 'The Five Paths', done: 3, total: 30 },
    { id: 'modern', name: 'Modern', school: true, order: 6, missing: ['pioneer@2'], chapters: [{ nodes: [] }] },
    { id: 'pauper', name: 'Pauper', school: true, order: 1, done: 4, total: 4, chapters: [{ nodes: [{ id: 'a' }, { id: 'final', winsNeeded: 2 }] }] },
    { id: 'pioneer', name: 'Pioneer', school: true, order: 4, missing: ['pauper@2|five-paths@3', 'pauper'], chapters: [{ nodes: [] }] },
    { id: 'empty', name: 'Empty', school: true, order: 2, open: true },
  ];

  test('schools hang in their order, a school without acts not at all; the stories stay apart', () => {
    expect(schoolsOf(campaigns).map((campaign) => campaign.id)).toEqual(['pauper', 'pioneer', 'modern']);
    expect(storiesOf(campaigns.slice(0, 4)).map((campaign) => campaign.id)).toEqual(['five-paths']);
  });

  test('a closed school says what it needs, alternatives together', () => {
    expect(requirementLines(campaigns[3].missing, campaigns)).toEqual([
      [
        { key: 'career.academy.needsBosses', vars: { campaign: 'Pauper', count: 2 } },
        { key: 'career.academy.needsBosses', vars: { campaign: 'The Five Paths', count: 3 } },
      ],
      [{ key: 'career.academy.needsAll', vars: { campaign: 'Pauper' } }],
    ]);
  });

  test('graduation is every node done, and its reward is on the last node', () => {
    expect(graduated(campaigns[2])).toBe(true);
    expect(graduated(campaigns[0])).toBe(false);
    expect(graduated({ done: 0, total: 0 })).toBe(false);
    expect(graduationOf(campaigns[2])?.id).toBe('final');
  });
});

describe('campaign path', () => {
  test('a chain of nodes winds one step at a time, up and down', () => {
    const path = chapterPath([node('a', [], 'done'), node('b', ['a'], 'done'), node('c', ['b'], 'open'), node('d', ['c'])]);
    expect(path.stops.map((stop) => stop.node.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(path.stops.map((stop) => stop.x)).toEqual([0, 1, 2, 3].map((step) => PATH_STEP / 2 + step * PATH_STEP));
    expect(path.stops[0].y).toBeLessThan(path.stops[1].y);
    expect(path.stops[2].y).toBe(path.stops[0].y);
    expect(path.width).toBe(4 * PATH_STEP);
  });

  test('legs follow requirements, a choice requirement counts as its node, and take the state of where they lead', () => {
    const path = chapterPath([node('a', [], 'done'), node('pick', ['a'], 'done', { type: 'choice' }), node('b', ['pick:coins'], 'open'), node('c', ['b', 'elsewhere'])]);
    expect(path.legs.map((leg) => `${leg.from.node.id}>${leg.to.node.id}:${leg.state}`)).toEqual(['a>pick:done', 'pick>b:open', 'b>c:locked']);
    expect(legCurve(path.legs[0])).toMatch(/^M\d+(\.\d+)? \d+(\.\d+)? C/);
  });

  test('branches stack on the same step; a cycle in the content still lays out', () => {
    const branched = chapterPath([node('a'), node('b', ['a']), node('c', ['a']), node('d', ['b', 'c'])]);
    const b = branched.stops.find((stop) => stop.node.id === 'b')!;
    const c = branched.stops.find((stop) => stop.node.id === 'c')!;
    expect(b.x).toBe(c.x);
    expect(b.y).not.toBe(c.y);
    expect(branched.stops.find((stop) => stop.node.id === 'd')!.x).toBeGreaterThan(b.x);
    expect(chapterPath([node('x', ['y']), node('y', ['x'])]).stops).toHaveLength(2);
  });

  test('node state, the node and chapter to open on', () => {
    expect(nodeState({ state: 'done' })).toBe('done');
    expect(nodeState({ state: 'open' })).toBe('open');
    expect(nodeState({ state: undefined })).toBe('locked');
    expect(focusNode({ nodes: [node('a', [], 'done'), node('b', [], 'open')] })?.id).toBe('b');
    expect(focusNode({ nodes: [node('a', [], 'done'), node('b', [], 'done')] })?.id).toBe('b');
    expect(focusNode({ nodes: [node('a'), node('b')] })?.id).toBe('a');
    const chapters = [
      { id: 'one', done: true, nodes: [node('a', [], 'done')] },
      { id: 'two', done: false, nodes: [node('b')] },
      { id: 'three', done: false, nodes: [node('c', [], 'open')] },
    ];
    expect(focusChapter(chapters)?.id).toBe('three');
    expect(focusChapter(chapters.slice(0, 2))?.id).toBe('two');
  });
});

describe('rewards and twists', () => {
  test('a reward reads as lines, in a fixed order', () => {
    expect(rewardLines({ coins: 100, xp: 300, deckCards: true, unlockSet: 'M21' }).map((line) => line.key)).toEqual([
      'career.reward.coins', 'career.modeReward.xp', 'career.reward.deck', 'career.reward.set',
    ]);
    expect(rewardLines({ wildcard: 'uncommon' })).toEqual([{ key: 'career.reward.wildcard.uncommon' }]);
    expect(rewardLines({ wins: 6, coins: 160, packs: 1, wildcard: 'rare' }).map((line) => line.key)).toEqual([
      'career.reward.coins', 'career.modeReward.packs', 'career.reward.wildcard.rare',
    ]);
    expect(rewardLines(undefined)).toEqual([]);
  });

  test('a boss twist reads as what the opponent starts with', () => {
    expect(twistLines({ startingLife: 25, extraCards: 1, permanents: ['Giant Spider', 'Craw Wurm|tapped'], emblem: 'Glorious Anthem' })).toEqual([
      { key: 'career.twist.life', vars: { life: 25 } },
      { key: 'career.twist.cards', vars: { count: 1 } },
      { key: 'career.twist.permanent', vars: { name: 'Giant Spider' } },
      { key: 'career.twist.permanentTapped', vars: { name: 'Craw Wurm' } },
      { key: 'career.twist.emblem', vars: { name: 'Glorious Anthem' } },
    ]);
    expect(twistLines({ extraCards: 0 })).toEqual([]);
    expect(twistLines(undefined)).toEqual([]);
  });
});

describe('puzzles', () => {
  test('stars are 0 to 3, three slots lit up to them', () => {
    expect([undefined, -1, 0, 1, 2, 3, 7].map(starCount)).toEqual([0, 0, 0, 1, 2, 3, 3]);
    expect(starSlots(2)).toEqual([true, true, false]);
    expect(starSlots(0)).toEqual([false, false, false]);
  });

  test('a position counts the same card once per zone, tapped apart, and skips empty zones', () => {
    expect(countNames(['Grizzly Bears', 'Grizzly Bears', 'Forest|tapped', 'Forest'])).toEqual([
      { name: 'Grizzly Bears', count: 2, tapped: false },
      { name: 'Forest', count: 1, tapped: true },
      { name: 'Forest', count: 1, tapped: false },
    ]);
    const zones = puzzleZones({ life: 20, hand: ['Giant Growth'], battlefield: ['Grizzly Bears', 'Grizzly Bears', 'Forest'], graveyard: [], library: [] });
    expect(zones.map((zone) => zone.zone)).toEqual(['battlefield', 'hand']);
    expect(puzzleZones(undefined)).toEqual([]);
  });
});

describe('gauntlet', () => {
  const rewards = [{ wins: 0, coins: 10 }, { wins: 1, coins: 30 }, { wins: 4, coins: 100, packs: 1 }];

  test('a run pays the best reward its wins reach', () => {
    expect(runReward(rewards, 0)?.coins).toBe(10);
    expect(runReward(rewards, 3)?.coins).toBe(30);
    expect(runReward(rewards, 8)?.coins).toBe(100);
    expect(runReward([], 2)).toBeUndefined();
  });

  test('printings of the same card add up', () => {
    expect(mergeByName([{ name: 'Plains', amount: 6 }, { name: 'Shock', amount: 1 }, { name: 'Plains' }])).toEqual([{ name: 'Plains', amount: 7 }, { name: 'Shock', amount: 1 }]);
  });

  test('picking keeps at most the offer\'s count, the oldest choice giving way', () => {
    expect(toggleChoice([], 'a', 2)).toEqual(['a']);
    expect(toggleChoice(['a'], 'b', 2)).toEqual(['a', 'b']);
    expect(toggleChoice(['a', 'b'], 'c', 2)).toEqual(['b', 'c']);
    expect(toggleChoice(['a', 'b'], 'a', 2)).toEqual(['b']);
    expect(toggleChoice(['a'], 'b', 1)).toEqual(['b']);
  });
});

describe('limited deck from a pool', () => {
  const card = (name: string, extra: Partial<CareerPoolCard> = {}): CareerPoolCard => ({ name, setCode: 'M21', cardNumber: name.length.toString(), colors: '', manaValue: 2, ...extra });
  const pool = [
    card('Llanowar Elves', { creature: true, colors: 'G', manaValue: 1 }),
    card('Llanowar Elves', { creature: true, colors: 'G', manaValue: 1 }),
    card('Shock', { colors: 'R', manaValue: 1 }),
    card('Forest', { land: true }),
    card('Evolving Wilds', { land: true, manaValue: 0 }),
    card('Colossal Dreadmaw', { creature: true, colors: 'G', manaValue: 6 }),
  ];
  const entries = poolEntries(pool);

  test('the pool by name, basics left out, creatures first then by mana value', () => {
    expect(entries.map((entry) => `${entry.card.name}×${entry.count}`)).toEqual(['Llanowar Elves×2', 'Colossal Dreadmaw×1', 'Shock×1', 'Evolving Wilds×1']);
  });

  test('copies stay between none and what the pool holds', () => {
    let build: LimitedBuild = { picks: {}, basics: emptyBasics() };
    const elves = entries[0];
    build = changePick(build, elves, 1);
    build = changePick(build, elves, 1);
    expect(changePick(build, elves, 1)).toBe(build);
    expect(build.picks['llanowar elves']).toBe(2);
    expect(changePick(changePick(build, elves, -1), elves, -1).picks).toEqual({});
    expect(changeBasic(build, 'Forest', -1)).toBe(build);
    expect(changeBasic(build, 'Forest', 3).basics.Forest).toBe(3);
  });

  test('the server\'s rules: 40 cards, no more copies than the pool', () => {
    const short: LimitedBuild = { picks: { 'llanowar elves': 2 }, basics: { ...emptyBasics(), Forest: 17 } };
    expect(buildSize(short)).toBe(19);
    expect(buildProblems(short, entries)).toEqual([{ kind: 'short', count: 19, min: 40 }]);
    const ok: LimitedBuild = { picks: { 'llanowar elves': 2, shock: 1 }, basics: { ...emptyBasics(), Forest: 30, Mountain: 7 } };
    expect(buildProblems(ok, entries)).toEqual([]);
    const greedy: LimitedBuild = { picks: { shock: 3, 'black lotus': 1 }, basics: { ...emptyBasics(), Mountain: 40 } };
    expect(buildProblems(greedy, entries)).toEqual([
      { kind: 'notInPool', name: 'Shock', inDeck: 3, inPool: 1 },
      { kind: 'notInPool', name: 'black lotus', inDeck: 1, inPool: 0 },
    ]);
  });

  test('the deck sent keeps pool printings; basics go without one; a saved deck builds back', () => {
    const build: LimitedBuild = { picks: { 'llanowar elves': 2, shock: 1 }, basics: { ...emptyBasics(), Forest: 9, Mountain: 8 } };
    const deck = buildDeck(build, entries, 'M21 sealed');
    expect(deck.cards).toEqual([
      { cardName: 'Llanowar Elves', setCode: 'M21', cardNumber: '14', amount: 2 },
      { cardName: 'Shock', setCode: 'M21', cardNumber: '5', amount: 1 },
      { cardName: 'Mountain', amount: 8 },
      { cardName: 'Forest', amount: 9 },
    ]);
    expect(buildFrom(deck.cards)).toEqual(build);
  });

  test('suggested lands fill to 40, shared by the spells\' colours', () => {
    const build: LimitedBuild = { picks: { 'llanowar elves': 2, 'colossal dreadmaw': 1, shock: 1 }, basics: emptyBasics() };
    const basics = suggestBasics(build, entries);
    expect(Object.values(basics).reduce((sum, count) => sum + count, 0)).toBe(36);
    expect(basics.Forest).toBe(27);
    expect(basics.Mountain).toBe(9);
    expect(suggestBasics({ picks: {}, basics: emptyBasics() }, entries)).toEqual(emptyBasics());
  });

  test('a run ends at three wins or two losses', () => {
    expect(runOver(2, 1)).toBe(false);
    expect(runOver(3, 1)).toBe(true);
    expect(runOver(0, 2)).toBe(true);
  });
});

describe('procedural art', () => {
  test('the same name draws the same picture; colours come from the letters given', () => {
    expect(hashName('The Night Warden')).toBe(hashName('The Night Warden'));
    expect(hashName('a')).not.toBe(hashName('b'));
    expect(crestSpec('The White Path', 'W')).toEqual(crestSpec('The White Path', 'W'));
    expect(crestSpec('Gruul', 'RG').colors).toEqual(['R', 'G']);
    expect(crestSpec('Nobody').colors).toHaveLength(1);
    expect(['crown', 'horns']).toContain(portraitSpec('The Last Gate', undefined, true).headwear);
    expect(portraitSpec('Corporal Wren', 'W').glow).toBe(false);
    // the painted crests and portraits
    expect(crestArt('Pauper school', 'G', 'pauper')).toBe('pauper');
    expect(crestArt('Gruul', 'RG')).toBe('M');
    expect(crestArt('The White Path', 'W')).toBe('W');
    expect(portraitArt('The Last Gate', 'B', true)).toBe('B-boss');
    expect(portraitArt('Golem', 'C')).toBe('C');
    expect(['W', 'U', 'B', 'R', 'G']).toContain(portraitArt('Nobody'));
  });
});
