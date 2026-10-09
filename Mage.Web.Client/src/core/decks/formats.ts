/**
 * What the client needs to know about a deck format to build and play it: whether it has a command zone, whether it
 * is singleton, how big a deck is, and which game types it is played with. The server's deck validator stays the
 * judge of legality; these rules only shape the builder and the table setup.
 */

export type FormatFamily = 'constructed' | 'commander' | 'highlander' | 'limited' | 'variant';

export interface CommandZoneRules {
  /** what the zone is called in this format */
  label: string;
  /** what one card in it is called */
  cardLabel: string;
  /** cards the zone holds (a commander, two partners, an oathbreaker and its signature spell...) */
  min: number;
  max: number;
}

export interface FormatRules {
  deckType: string;
  /** short name for menus: "Commander", "Modern" */
  label: string;
  family: FormatFamily;
  /** the sideboard is the command zone (XMage keeps commanders in the sideboard) */
  commandZone: CommandZoneRules | null;
  /** one copy of each card, basic lands and "any number" cards aside */
  singleton: boolean;
  /** the exact deck size, command zone included, when the format has one */
  deckSize: number | null;
  /** the fewest main-deck cards worth playing (Constructed: 60) */
  minDeck: number;
  /** game types this format is played with, best first (names from the server's game type list) */
  gameTypes: string[];
}

const DUEL = 'Two Player Duel';
const FFA = 'Free For All';
const COMMANDER_GAMES = ['Commander Two Player Duel', 'Commander Free For All'];

const COMMANDER: CommandZoneRules = { label: 'Command zone', cardLabel: 'Commander', min: 1, max: 2 };

function commander(deckType: string, label: string, gameTypes = COMMANDER_GAMES, deckSize: number | null = 100): FormatRules {
  return { deckType, label, family: 'commander', commandZone: COMMANDER, singleton: true, deckSize, minDeck: (deckSize ?? 100) - 2, gameTypes };
}

const KNOWN: Record<string, FormatRules> = {
  'Variant Magic - Commander': commander('Variant Magic - Commander', 'Commander'),
  'Variant Magic - Duel Commander': commander('Variant Magic - Duel Commander', 'Duel Commander', ['Commander Two Player Duel']),
  'Variant Magic - MTGO 1v1 Commander': commander('Variant Magic - MTGO 1v1 Commander', 'MTGO 1v1 Commander', ['Commander Two Player Duel']),
  'Variant Magic - Centurion Commander': commander('Variant Magic - Centurion Commander', 'Centurion Commander'),
  'Variant Magic - Penny Dreadful Commander': commander('Variant Magic - Penny Dreadful Commander', 'Penny Dreadful Commander', ['Penny Dreadful Commander Free For All', ...COMMANDER_GAMES]),
  'Variant Magic - Freeform Commander': commander('Variant Magic - Freeform Commander', 'Freeform Commander', ['Freeform Commander Two Player Duel', 'Freeform Commander Free For All']),
  'Variant Magic - Freeform Unlimited Commander': {
    ...commander('Variant Magic - Freeform Unlimited Commander', 'Freeform Unlimited Commander', ['Freeform Unlimited Commander'], null),
    singleton: false,
    minDeck: 1,
  },
  'Variant Magic - Brawl': commander('Variant Magic - Brawl', 'Brawl', ['Brawl Two Player Duel', 'Brawl Free For All'], 60),
  'Variant Magic - Oathbreaker': {
    ...commander('Variant Magic - Oathbreaker', 'Oathbreaker', ['Oathbreaker Two Player Duel', 'Oathbreaker Free For All'], 60),
    commandZone: { label: 'Command zone', cardLabel: 'Oathbreaker or signature spell', min: 2, max: 4 },
    minDeck: 56,
  },
  'Variant Magic - Tiny Leaders': {
    ...commander('Variant Magic - Tiny Leaders', 'Tiny Leaders', ['Tiny Leaders Two Player Duel'], 50),
    commandZone: { label: 'Command zone', cardLabel: 'Commander', min: 1, max: 1 },
    minDeck: 49,
  },
  'Variant Magic - Momir Basic': {
    deckType: 'Variant Magic - Momir Basic', label: 'Momir Basic', family: 'variant', commandZone: null, singleton: false, deckSize: 60, minDeck: 60,
    gameTypes: ['Momir Basic Two Player Duel', 'Momir Basic Free For All'],
  },
  Limited: { deckType: 'Limited', label: 'Limited', family: 'limited', commandZone: null, singleton: false, deckSize: null, minDeck: 40, gameTypes: [DUEL, FFA] },
};

const HIGHLANDER_GAMES: Record<string, string[]> = {
  'Constructed - Canadian Highlander': ['Canadian Highlander Two Player Duel', DUEL, FFA],
};

/** Rules for a deck type as the server names it ("Constructed - Modern", "Variant Magic - Commander"). */
export function formatRules(deckType: string | null | undefined): FormatRules {
  const type = deckType || 'Constructed - Freeform';
  const known = KNOWN[type];
  if (known) return known;
  const label = type.replace(/^(Block )?Constructed( Custom)? - /, '').replace(/^Variant Magic - /, '');
  if (/Highlander/.test(type)) {
    return { deckType: type, label, family: 'highlander', commandZone: null, singleton: true, deckSize: 100, minDeck: 100, gameTypes: HIGHLANDER_GAMES[type] ?? [DUEL, FFA] };
  }
  const freeform = /Freeform/.test(type);
  return { deckType: type, label, family: 'constructed', commandZone: null, singleton: false, deckSize: null, minDeck: freeform ? 40 : 60, gameTypes: [DUEL, FFA] };
}

export function isCommanderFormat(deckType: string | null | undefined): boolean {
  return formatRules(deckType).commandZone !== null;
}

/** Formats a deck can be built for, grouped for a menu; Momir Basic needs no deck, Limited only comes from events. */
export function formatMenu(deckTypes: readonly string[]): { label: string; types: string[] }[] {
  const groups: { label: string; test(type: string): boolean }[] = [
    { label: 'Constructed', test: (type) => /^Constructed - /.test(type) && !/Highlander/.test(type) },
    { label: 'Commander', test: (type) => isCommanderFormat(type) },
    { label: 'Singleton', test: (type) => /Highlander/.test(type) },
    { label: 'Block', test: (type) => /^Block Constructed/.test(type) },
  ];
  return groups
    .map((group) => ({ label: group.label, types: deckTypes.filter(group.test) }))
    .filter((group) => group.types.length > 0);
}

/**
 * Game types to offer for a deck format, among those the server has: the format's own first, then the rest of the
 * server's list (a freeform table accepts any deck). Commander-only game types are kept for commander decks.
 */
export function gameTypesFor(deckType: string, available: readonly string[]): string[] {
  const rules = formatRules(deckType);
  const own = rules.gameTypes.filter((type) => available.includes(type));
  if (rules.commandZone) return own.length > 0 ? own : available.filter((type) => /Commander|Brawl|Oathbreaker|Leaders/.test(type));
  const plain = available.filter((type) => !/Commander|Brawl|Oathbreaker|Leaders|Momir|Highlander|Pillar/.test(type) || own.includes(type));
  return [...own, ...plain.filter((type) => !own.includes(type))];
}

const IDENTITY_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;

/** Color identity letters (WUBRG order) from the server's "{W}{U}" form; "{C}" or nothing is colorless. */
export function parseIdentity(identity: string | null | undefined): string[] {
  const letters = new Set((identity ?? '').toUpperCase().match(/[WUBRG]/g) ?? []);
  return IDENTITY_ORDER.filter((letter) => letters.has(letter));
}

/** The command zone's combined color identity: what the rest of the deck may use. */
export function commanderIdentity(commanders: readonly { originalColorIdentity?: string }[]): string[] {
  const letters = new Set(commanders.flatMap((card) => parseIdentity(card.originalColorIdentity)));
  return IDENTITY_ORDER.filter((letter) => letters.has(letter));
}

/** A card's color identity fits inside the commander's. */
export function withinIdentity(card: { originalColorIdentity?: string }, identity: readonly string[]): boolean {
  return parseIdentity(card.originalColorIdentity).every((letter) => identity.includes(letter));
}

/**
 * Whether a card can lead a deck from the command zone, judged from its type line and rules text: legendary creatures,
 * cards that say they can be your commander, Brawl's legendary planeswalkers, and Oathbreaker's planeswalkers and
 * signature spells. The server's validator has the final word.
 */
export function canCommand(card: { superTypes?: string[]; cardTypes?: string[]; rules?: string[] } | undefined, deckType: string): boolean {
  if (!card) return false;
  const types = card.cardTypes ?? [];
  const legendary = (card.superTypes ?? []).includes('LEGENDARY');
  const rules = (card.rules ?? []).join(' ');
  if (/can be your commander/i.test(rules)) return true;
  if (deckType === 'Variant Magic - Oathbreaker') return types.includes('PLANESWALKER') || types.includes('INSTANT') || types.includes('SORCERY');
  if (deckType === 'Variant Magic - Brawl' && legendary && types.includes('PLANESWALKER')) return true;
  return legendary && types.includes('CREATURE');
}
