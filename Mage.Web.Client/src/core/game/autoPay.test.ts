import { describe, expect, it } from 'vitest';
import { manaOf, nextSource, parseCost, type ManaSource } from './autoPay';

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
