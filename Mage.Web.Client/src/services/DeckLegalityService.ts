import { Rarity, type CardSearchCriteria, type CommanderBracketView, type DeckCardInfo, type DeckCardLists, type DeckValidationErrorView, type DeckValidationResultView, type SearchCardView } from '../types/index.js';
import { wsService } from './WebSocketService.js';

export type DeckLegalityStatus = 'unknown' | 'legal' | 'partly-legal' | 'not-legal';

export type DeckLegalityErrorType = 'PRIMARY' | 'DECK_SIZE' | 'BANNED' | 'WRONG_SET' | 'OTHER';
export type DeckLegalityValidationSource = 'server' | 'browser' | 'none';

export interface DeckLegalityIssue {
  type: DeckLegalityErrorType;
  group: string;
  message: string;
  cardName: string | null;
}

export interface DeckLegalityFormat {
  deckType: string;
  shortName: string;
  minMain: number;
  maxSideboard: number;
  maxCopies: number;
  pauperRarity?: boolean;
  aliases?: string[];
}

export interface DeckLegalityFormatResult {
  format: DeckLegalityFormat;
  status: DeckLegalityStatus;
  validationSource: DeckLegalityValidationSource;
  issues: DeckLegalityIssue[];
  selectableCardNames: string[];
  edhPowerLevel?: number;
  edhPowerCards?: string[];
  edhPowerDetails?: string[];
  commanderBrackets?: CommanderBracketView[];
}

export interface DeckLegalityReport {
  results: DeckLegalityFormatResult[];
}

export interface DeckLegalityServiceOptions {
  searchCards?: (criteria: CardSearchCriteria) => Promise<SearchCardView[]>;
  validateDeck?: (deckType: string, deck: DeckCardLists) => Promise<DeckValidationResultView>;
  serverValidationTimeoutMs?: number;
}

export const DECK_LEGALITY_FORMATS: DeckLegalityFormat[] = [
  { deckType: 'Constructed - Standard', shortName: 'Standard', minMain: 60, maxSideboard: 15, maxCopies: 4 },
  { deckType: 'Constructed - Pioneer', shortName: 'Pioneer', minMain: 60, maxSideboard: 15, maxCopies: 4 },
  { deckType: 'Constructed - Modern', shortName: 'Modern', minMain: 60, maxSideboard: 15, maxCopies: 4 },
  { deckType: 'Constructed - Legacy', shortName: 'Legacy', minMain: 60, maxSideboard: 15, maxCopies: 4 },
  { deckType: 'Constructed - Vintage', shortName: 'Vintage', minMain: 60, maxSideboard: 15, maxCopies: 4 },
  { deckType: 'Constructed - Pauper', shortName: 'Pauper', minMain: 60, maxSideboard: 15, maxCopies: 4, pauperRarity: true },
  { deckType: 'Constructed - Historic', shortName: 'Historic', minMain: 60, maxSideboard: 15, maxCopies: 4 },
  { deckType: 'Commander', shortName: 'Commander', minMain: 100, maxSideboard: 0, maxCopies: 1, aliases: ['Constructed - Commander', 'Variant Magic - Commander'] },
  { deckType: 'Oathbreaker', shortName: 'Oathbreaker', minMain: 58, maxSideboard: 2, maxCopies: 1, aliases: ['Variant Magic - Oathbreaker'] },
  { deckType: 'Brawl', shortName: 'Brawl', minMain: 59, maxSideboard: 2, maxCopies: 1, aliases: ['Variant Magic - Brawl'] },
  { deckType: 'Constructed - Frontier', shortName: 'Frontier', minMain: 60, maxSideboard: 15, maxCopies: 4 },
  { deckType: 'Constructed - Historical Type 2', shortName: 'Historical', minMain: 60, maxSideboard: 15, maxCopies: 4 },
  { deckType: 'Penny Dreadful Commander', shortName: 'PD Commander', minMain: 100, maxSideboard: 0, maxCopies: 1, aliases: ['Variant Magic - Penny Dreadful Commander'] },
  { deckType: 'European Highlander', shortName: 'EuroLander', minMain: 100, maxSideboard: 0, maxCopies: 1 },
  { deckType: 'Canadian Highlander', shortName: 'CanLander', minMain: 100, maxSideboard: 0, maxCopies: 1 },
];

const UNLIMITED_COPY_CARD_NAMES = new Set([
  'Plains',
  'Island',
  'Swamp',
  'Mountain',
  'Forest',
  'Wastes',
  'Snow-Covered Plains',
  'Snow-Covered Island',
  'Snow-Covered Swamp',
  'Snow-Covered Mountain',
  'Snow-Covered Forest',
  'Snow-Covered Wastes',
  'Relentless Rats',
  'Shadowborn Apostle',
  'Rat Colony',
  'Persistent Petitioners',
  "Dragon's Approach",
  'Slime Against Humanity',
  'Templar Knight',
  'Hare Apparent',
  'Tempest Hawk',
  'Cid, Timeless Artificer',
]);

const SPECIAL_MAX_COPY_COUNTS = new Map<string, number>([
  ['Once More with Feeling', 1],
  ['Seven Dwarves', 7],
  ['Nazgul', 9],
]);

const SERVER_DECK_TYPE_ALIASES = new Map<string, string>([
  ['Commander', 'Variant Magic - Commander'],
  ['Oathbreaker', 'Variant Magic - Oathbreaker'],
  ['Brawl', 'Variant Magic - Brawl'],
  ['Penny Dreadful Commander', 'Variant Magic - Penny Dreadful Commander'],
  ['European Highlander', 'Constructed - European Highlander'],
  ['Canadian Highlander', 'Constructed - Canadian Highlander'],
]);

export function serverDeckTypeForValidation(format: DeckLegalityFormat): string {
  return SERVER_DECK_TYPE_ALIASES.get(format.deckType) ?? format.deckType;
}

function normalizeCardName(cardName: string | null | undefined): string {
  return (cardName ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getMainCount(deck: DeckCardLists): number {
  return deck.cards.reduce((sum, card) => sum + card.amount, 0);
}

function getSideboardCount(deck: DeckCardLists): number {
  return deck.sideboard.reduce((sum, card) => sum + card.amount, 0);
}

function getCardIdentity(card: DeckCardInfo): string {
  return normalizeCardName(card.cardName);
}

function getMaxCopies(cardName: string, defaultAmount: number): number {
  if (UNLIMITED_COPY_CARD_NAMES.has(cardName)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return SPECIAL_MAX_COPY_COUNTS.get(cardName) ?? defaultAmount;
}

function hasExactName(candidate: SearchCardView, cardName: string): boolean {
  const expected = normalizeCardName(cardName);
  return normalizeCardName(candidate.name) === expected || normalizeCardName(candidate.displayName) === expected;
}

function hasExactPrinting(candidate: SearchCardView, card: DeckCardInfo): boolean {
  if (!card.setCode || !card.cardNumber) return true;
  return candidate.expansionSetCode.toUpperCase() === card.setCode.toUpperCase()
    && candidate.cardNumber.toLowerCase() === card.cardNumber.toLowerCase();
}

function isCommonPrinting(candidate: SearchCardView): boolean {
  return candidate.rarity === Rarity.COMMON || String(candidate.rarity).toUpperCase() === 'COMMON';
}

function issueCardNames(issues: DeckLegalityIssue[]): string[] {
  return Array.from(new Set(issues.map(issue => issue.cardName).filter((name): name is string => Boolean(name))));
}

const ISSUE_TYPE_SORT_ORDER: Record<DeckLegalityErrorType, number> = {
  PRIMARY: 10,
  DECK_SIZE: 20,
  BANNED: 30,
  WRONG_SET: 40,
  OTHER: 50,
};

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortIssuesLikeJavaValidator(issues: DeckLegalityIssue[]): DeckLegalityIssue[] {
  return [...issues].sort((left, right) => {
    const typeOrder = ISSUE_TYPE_SORT_ORDER[left.type] - ISSUE_TYPE_SORT_ORDER[right.type];
    if (typeOrder !== 0) return typeOrder;

    const groupOrder = compareText(left.group, right.group);
    if (groupOrder !== 0) return groupOrder;

    return compareText(left.message, right.message);
  });
}

function statusFromIssues(issues: DeckLegalityIssue[]): DeckLegalityStatus {
  if (issues.length === 0) return 'legal';
  if (issues.every(issue => issue.type === 'DECK_SIZE')) return 'partly-legal';
  return 'not-legal';
}

function statusFromServerValidation(result: DeckValidationResultView): DeckLegalityStatus {
  if (result.valid) return 'legal';
  if (result.partlyValid) return 'partly-legal';
  return statusFromIssues(result.errors.map(mapServerIssue));
}

function mapServerIssue(issue: DeckValidationErrorView): DeckLegalityIssue {
  const type = issue.type === 'PRIMARY'
    || issue.type === 'DECK_SIZE'
    || issue.type === 'BANNED'
    || issue.type === 'WRONG_SET'
    || issue.type === 'OTHER'
    ? issue.type
    : 'OTHER';
  return {
    type,
    group: issue.group,
    message: issue.message,
    cardName: issue.cardName ?? null,
  };
}

export class DeckLegalityService {
  private readonly searchCards: (criteria: CardSearchCriteria) => Promise<SearchCardView[]>;
  private readonly validateDeckWithServer: (deckType: string, deck: DeckCardLists) => Promise<DeckValidationResultView>;
  private readonly serverValidationTimeoutMs: number;
  private readonly cardCache = new Map<string, Promise<SearchCardView[]>>();

  constructor(options: DeckLegalityServiceOptions = {}) {
    this.searchCards = options.searchCards ?? ((criteria) => wsService.searchCards(criteria));
    this.validateDeckWithServer = options.validateDeck ?? ((deckType, deck) => wsService.validateDeck(deckType, deck));
    this.serverValidationTimeoutMs = options.serverValidationTimeoutMs ?? 5_000;
  }

  public async validateDeck(
    deck: DeckCardLists | null,
    formats: DeckLegalityFormat[] = DECK_LEGALITY_FORMATS,
  ): Promise<DeckLegalityReport> {
    if (!deck) {
      return {
        results: formats.map(format => ({
          format,
          status: 'unknown',
          validationSource: 'none',
          issues: [{ type: 'OTHER', group: 'Deck', message: 'No deck loaded', cardName: null }],
          selectableCardNames: [],
        })),
      };
    }

    const results = await Promise.all(formats.map(format => this.validateFormat(deck, format)));
    return { results };
  }

  private async validateFormat(deck: DeckCardLists, format: DeckLegalityFormat): Promise<DeckLegalityFormatResult> {
    const serverResult = await this.tryValidateWithServer(deck, format);
    if (serverResult) {
      return serverResult;
    }

    try {
      const issues: DeckLegalityIssue[] = [];
      this.validateDeckShape(deck, format, issues);
      await this.validateCards(deck, format, issues);
      const sortedIssues = sortIssuesLikeJavaValidator(issues);

      return {
        format,
        status: statusFromIssues(sortedIssues),
        validationSource: 'browser',
        issues: sortedIssues,
        selectableCardNames: issueCardNames(sortedIssues),
      };
    } catch (error) {
      return {
        format,
        status: 'unknown',
        validationSource: 'browser',
        issues: [{
          type: 'OTHER',
          group: 'Validation',
          message: error instanceof Error ? error.message : 'Deck could not be validated',
          cardName: null,
        }],
        selectableCardNames: [],
      };
    }
  }

  private async tryValidateWithServer(deck: DeckCardLists, format: DeckLegalityFormat): Promise<DeckLegalityFormatResult | null> {
    try {
      const validation = await this.validateDeckWithServerBudget(serverDeckTypeForValidation(format), deck);
      const issues = sortIssuesLikeJavaValidator(validation.errors.map(mapServerIssue));
      const serverFormat = {
        ...format,
        shortName: validation.shortName || format.shortName,
      };
      return {
        format: serverFormat,
        status: statusFromServerValidation(validation),
        validationSource: 'server',
        issues,
        selectableCardNames: issueCardNames(issues),
        edhPowerLevel: validation.edhPowerLevel,
        edhPowerCards: validation.edhPowerCards ?? [],
        edhPowerDetails: validation.edhPowerDetails ?? [],
        commanderBrackets: validation.commanderBrackets ?? [],
      };
    } catch {
      return null;
    }
  }

  private async validateDeckWithServerBudget(deckType: string, deck: DeckCardLists): Promise<DeckValidationResultView> {
    const validationPromise = this.validateDeckWithServer(deckType, deck);
    validationPromise.catch(() => undefined);

    if (this.serverValidationTimeoutMs <= 0) {
      return validationPromise;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<DeckValidationResultView>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Deck validation timed out')), this.serverValidationTimeoutMs);
    });

    try {
      return await Promise.race([validationPromise, timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private validateDeckShape(deck: DeckCardLists, format: DeckLegalityFormat, issues: DeckLegalityIssue[]): void {
    const mainCount = getMainCount(deck);
    const sideboardCount = getSideboardCount(deck);

    if (mainCount < format.minMain) {
      issues.push({
        type: 'DECK_SIZE',
        group: 'Deck',
        message: `Must contain at least ${format.minMain} cards: has only ${mainCount} cards`,
        cardName: null,
      });
    }

    if (sideboardCount > format.maxSideboard) {
      issues.push({
        type: 'DECK_SIZE',
        group: 'Sideboard',
        message: `Must contain no more than ${format.maxSideboard} cards: has ${sideboardCount} cards`,
        cardName: null,
      });
    }

    const counts = new Map<string, { displayName: string; amount: number }>();
    for (const card of [...deck.cards, ...deck.sideboard]) {
      const identity = getCardIdentity(card);
      const current = counts.get(identity) ?? { displayName: card.cardName, amount: 0 };
      current.amount += card.amount;
      counts.set(identity, current);
    }

    for (const { displayName, amount } of counts.values()) {
      const maxCopies = getMaxCopies(displayName, format.maxCopies);
      if (amount > maxCopies) {
        issues.push({
          type: 'OTHER',
          group: displayName,
          message: `Too many: ${amount}`,
          cardName: displayName,
        });
      }
    }
  }

  private async validateCards(deck: DeckCardLists, format: DeckLegalityFormat, issues: DeckLegalityIssue[]): Promise<void> {
    const uniqueCards = new Map<string, DeckCardInfo>();
    for (const card of [...deck.cards, ...deck.sideboard]) {
      if (!uniqueCards.has(getCardIdentity(card))) {
        uniqueCards.set(getCardIdentity(card), card);
      }
    }

    for (const card of uniqueCards.values()) {
      const allPrintings = await this.findExactCards(card.cardName);
      if (allPrintings.length === 0) {
        issues.push({
          type: 'OTHER',
          group: card.cardName,
          message: 'Card not found',
          cardName: card.cardName,
        });
        continue;
      }

      if (card.setCode && card.cardNumber && !allPrintings.some(candidate => hasExactPrinting(candidate, card))) {
        issues.push({
          type: 'OTHER',
          group: card.cardName,
          message: `Printing not found: ${card.setCode}:${card.cardNumber}`,
          cardName: card.cardName,
        });
      }

      const formatPrintings = await this.findExactCards(card.cardName, serverDeckTypeForValidation(format));
      if (formatPrintings.length === 0) {
        issues.push({
          type: 'WRONG_SET',
          group: card.cardName,
          message: `Invalid set: ${card.setCode || 'unknown'}`,
          cardName: card.cardName,
        });
      }

      if (format.pauperRarity && !allPrintings.some(isCommonPrinting)) {
        issues.push({
          type: 'OTHER',
          group: card.cardName,
          message: 'Invalid rarity: no common printing found',
          cardName: card.cardName,
        });
      }
    }
  }

  private async findExactCards(cardName: string, format?: string): Promise<SearchCardView[]> {
    const key = `${format ?? '*'}|${normalizeCardName(cardName)}`;
    if (!this.cardCache.has(key)) {
      this.cardCache.set(key, this.searchCards({
        nameContains: cardName,
        format,
        count: 100,
      }).then(cards => cards.filter(candidate => hasExactName(candidate, cardName))));
    }
    return this.cardCache.get(key)!;
  }
}

export const deckLegalityService = new DeckLegalityService();
