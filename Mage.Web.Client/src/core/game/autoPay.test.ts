import { describe, expect, it } from 'vitest';
import { handNeeds, manaOf, nextSource, parseCost, type ManaCostParts, type ManaSource } from './autoPay';

const land = (id: string, produces: ManaSource['produces']): ManaSource => ({ id, produces, isLand: true });
const dork = (id: string, produces: ManaSource['produces']): ManaSource => ({ id, produces, isLand: false });

describe('parseCost', () => {
  it('reads generic and colored symbols', () => {
    expect(parseCost('Pay {2}{G}{G} Llanowar Elves')).toEqual({ generic: 2, colored: { G: 2 } });
  });
  it('refuses symbols that need a choice', () => {
    expect(parseCost('Pay {X}{R}')).toBeNull();
    expect(parseCost('Pay {G/W}')).toBeNull();
    expect(parseCost('Pay {B/P}')).toBeNull();
    expect(parseCost('Choose a card')).toBeNull();
  });
});

describe('manaOf', () => {
  it('reads basic land types and simple mana abilities', () => {
    expect(manaOf({ subTypes: ['FOREST'] })).toBe('G');
    expect(manaOf({ rules: ['{T}: Add {C}.'] })).toBe('C');
    expect(manaOf({ rules: ['{T}: Add {R}.'], cardTypes: ['CREATURE'] })).toBe('R');
  });
  it('marks sources with a choice of mana as ambiguous, and others as unreadable', () => {
    expect(manaOf({ rules: ['{T}: Add {W} or {U}.'] })).toBeNull();
    expect(manaOf({ rules: ['{T}: Add one mana of any color.'] })).toBeNull();
    expect(manaOf({ subTypes: ['PLAINS', 'ISLAND'] })).toBeNull();
    expect(manaOf({ rules: ['Flying'] })).toBeUndefined();
  });
});

describe('nextSource', () => {
  it('covers colored mana with matching sources first, then generic with lands', () => {
    const sources = [land('forest', 'G'), land('mountain', 'R'), dork('elf', 'G')];
    expect(nextSource({ generic: 1, colored: { G: 1 } }, sources)).toBe('forest');
  });
  it('pays generic with what colored symbols do not need', () => {
    // {1}{G} with a Forest and a Mountain: the Mountain pays the generic part, but colored comes first in the plan
    const plan = nextSource({ generic: 1, colored: { G: 1 } }, [land('mountain', 'R'), land('forest', 'G')]);
    expect(plan).toBe('forest');
    expect(nextSource({ generic: 1, colored: {} }, [land('mountain', 'R')])).toBe('mountain');
  });
  it('gives up when the cost cannot be covered without a choice', () => {
    expect(nextSource({ generic: 0, colored: { U: 1 } }, [land('forest', 'G')])).toBeNull();
    expect(nextSource({ generic: 1, colored: {} }, [land('dual', null)])).toBeNull();
    expect(nextSource({ generic: 2, colored: {} }, [land('a', 'G')])).toBeNull();
  });
});

describe('generic mana and the rest of the hand', () => {
  // Hill Giant {3}{R} with Forest x2, Island x3 and a Mountain untapped, Giant Growth {G} in hand
  const board = [land('forest1', 'G'), land('forest2', 'G'), land('island1', 'U'), land('island2', 'U'), land('island3', 'U'), land('mountain', 'R')];

  /** Taps sources one at a time, as the server asks for them, until the cost is paid; returns what's left untapped. */
  function pay(cost: ManaCostParts, sources: ManaSource[], hand: string[]): ManaSource[] {
    let untapped = [...sources];
    let owed: ManaCostParts = { generic: cost.generic, colored: { ...cost.colored } };
    const total = (parts: ManaCostParts) => parts.generic + Object.values(parts.colored).reduce((sum, value) => sum + (value ?? 0), 0);
    while (total(owed) > 0) {
      const id = nextSource(owed, untapped, handNeeds(hand, untapped.length - total(owed)));
      const source = untapped.find((candidate) => candidate.id === id);
      if (!source) throw new Error('no source');
      untapped = untapped.filter((candidate) => candidate !== source);
      const color = source.produces!;
      if (owed.colored[color]) owed = { ...owed, colored: { ...owed.colored, [color]: owed.colored[color]! - 1 } };
      else owed = { ...owed, generic: owed.generic - 1 };
    }
    return untapped;
  }

  it('keeps a Forest up for Giant Growth', () => {
    const left = pay({ generic: 3, colored: { R: 1 } }, board, ['{G}']);
    expect(left.map((source) => source.produces)).toContain('G');
    expect(left).toHaveLength(2);
  });

  it('spends the most plentiful color when the hand needs nothing, so both colors stay open', () => {
    const left = pay({ generic: 3, colored: { R: 1 } }, board, []);
    expect(left.map((source) => source.produces).sort()).toEqual(['G', 'U']);
  });

  it('ignores hand cards the leftover mana could not cast anyway', () => {
    expect(handNeeds(['{G}', '{2}{U}{U}', '{4}'], 2)).toEqual({ G: 1 });
  });

  it('still pays when the hand wants more than is left', () => {
    expect(pay({ generic: 2, colored: {} }, [land('forest', 'G'), land('island', 'U')], ['{G}', '{U}'])).toEqual([]);
  });
});
