/**
 * Card Resolver Service
 *
 * Resolves imported deck cards that only have names, stale set aliases, or
 * incomplete collector data by searching the server's card database. The
 * resolver returns a report so import flows can show unresolved cards instead
 * of silently saving partial decks.
 */

import { DeckCardInfo, DeckCardLists, SearchCardView, CardSearchCriteria } from '../types/index.js';
import { wsService } from './WebSocketService.js';

export interface ResolvedCard {
    name: string;
    setCode: string;
    cardNumber: string;
}

export type CardResolverZone = 'main' | 'side';

export interface CardResolutionZoneSummary {
    zone: CardResolverZone;
    amount: number;
}

export interface CardResolutionReportItem {
    key: string;
    cardName: string;
    setCode: string | null;
    cardNumber: string | null;
    amount: number;
    zones: CardResolutionZoneSummary[];
    candidates: ResolvedCard[];
}

export interface CardResolvedReportItem extends CardResolutionReportItem {
    resolved: ResolvedCard;
    source: 'server' | 'remembered';
}

export interface CardUnresolvedReportItem extends CardResolutionReportItem {
    reason: 'not-found' | 'ambiguous';
}

export interface DeckResolutionResult {
    deck: DeckCardLists;
    resolved: CardResolvedReportItem[];
    unresolved: CardUnresolvedReportItem[];
}

interface CardResolverStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem?(key: string): void;
}

export interface CardResolverOptions {
    searchCards?: (criteria: CardSearchCriteria) => Promise<SearchCardView[]>;
    storage?: CardResolverStorage | null;
}

interface CardResolutionGroup {
    key: string;
    cardName: string;
    setCode: string | null;
    cardNumber: string | null;
    amount: number;
    zones: CardResolutionZoneSummary[];
    complete: boolean;
}

interface ScoredCandidate {
    card: ResolvedCard;
    score: number;
}

interface ParsedImportRequest {
    cardName: string;
    setCode: string | null;
    cardNumber: string | null;
}

const CARD_RESOLVER_FIXES_KEY = 'mage.client.cardResolverFixes.v1';

const SET_ALIASES: Record<string, string> = {
    DAR: 'DOM',
};

const AUTO_RESOLVE_MIN_SCORE = 80;

function getBrowserStorage(): CardResolverStorage | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
}

function normalizeSetCode(setCode: string | null | undefined): string | null {
    const normalized = setCode?.trim().toUpperCase();
    if (!normalized) return null;
    return SET_ALIASES[normalized] ?? normalized;
}

function normalizeCollectorNumber(cardNumber: string | null | undefined): string | null {
    const normalized = cardNumber?.trim().toLowerCase();
    return normalized || null;
}

function normalizeCardName(cardName: string | null | undefined): string {
    return (cardName ?? '')
        .toLowerCase()
        .replace(/&amp;/g, '//')
        .replace(/\s*\/+\s*/g, ' // ')
        .replace(/\s+/g, ' ')
        .trim();
}

function frontFaceName(cardName: string): string {
    return normalizeCardName(cardName).split(' // ')[0].trim();
}

function parseEmbeddedImportMetadata(card: Pick<DeckCardInfo, 'cardName' | 'setCode' | 'cardNumber'>): ParsedImportRequest {
    let cardName = card.cardName.trim();
    let setCode = card.setCode;
    let cardNumber = card.cardNumber;

    const leadingXmage = cardName.match(/^\[([^:\]]+):([^\]]+)]\s+(.+)$/);
    if (leadingXmage) {
        setCode ??= leadingXmage[1];
        cardNumber ??= leadingXmage[2];
        cardName = leadingXmage[3].trim();
    }

    const trailingMtga = cardName.match(/^(.+?)\s+\(([a-zA-Z0-9]+)\)\s+([a-zA-Z0-9-]+)$/);
    if (trailingMtga) {
        cardName = trailingMtga[1].trim();
        setCode ??= trailingMtga[2];
        cardNumber ??= trailingMtga[3];
    }

    const inlineXmage = cardName.match(/\s*\[([^:\]]+):([^\]]+)]/);
    if (inlineXmage) {
        setCode ??= inlineXmage[1];
        cardNumber ??= inlineXmage[2];
        cardName = cardName.replace(inlineXmage[0], '').trim();
    }

    const bracketSet = cardName.match(/\s*\[([a-zA-Z0-9]+)]/);
    if (bracketSet) {
        setCode ??= bracketSet[1];
        cardName = cardName.replace(bracketSet[0], '').trim();
    }

    const angleCollector = cardName.match(/\s*<([^>]+)>/);
    if (angleCollector) {
        cardNumber ??= angleCollector[1];
        cardName = cardName.replace(angleCollector[0], '').trim();
    }

    cardName = cardName.replace(/\s*\([^)]+\)$/, '').trim() || card.cardName.trim();

    return {
        cardName,
        setCode: normalizeSetCode(setCode),
        cardNumber: normalizeCollectorNumber(cardNumber),
    };
}

function compareText(a: string | null | undefined, b: string | null | undefined): number {
    return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base', numeric: true });
}

function toResolvedCard(card: SearchCardView): ResolvedCard {
    return {
        name: card.name || card.displayName,
        setCode: card.expansionSetCode,
        cardNumber: card.cardNumber,
    };
}

function cloneDeck(deck: DeckCardLists): DeckCardLists {
    return {
        ...deck,
        cards: deck.cards.map(card => ({ ...card })),
        sideboard: deck.sideboard.map(card => ({ ...card })),
    };
}

function mergeZones(existing: CardResolutionZoneSummary[], zone: CardResolverZone, amount: number): CardResolutionZoneSummary[] {
    const found = existing.find(item => item.zone === zone);
    if (found) {
        found.amount += amount;
        return existing;
    }
    existing.push({ zone, amount });
    return existing;
}

export class CardResolverService {
    private readonly searchCards: (criteria: CardSearchCriteria) => Promise<SearchCardView[]>;
    private readonly storage: CardResolverStorage | null;
    private cache = new Map<string, ResolvedCard | null>();
    private pendingLookups = new Map<string, Promise<ResolvedCard | null>>();

    constructor(options: CardResolverOptions = {}) {
        this.searchCards = options.searchCards ?? ((criteria) => wsService.searchCards(criteria));
        this.storage = options.storage === undefined ? getBrowserStorage() : options.storage;
    }

    /**
     * Normalize a card name for consistent lookup.
     */
    public normalizeImportName(name: string): string {
        return normalizeCardName(name);
    }

    public getImportKey(card: Pick<DeckCardInfo, 'cardName' | 'setCode' | 'cardNumber'>): string {
        return [
            normalizeCardName(card.cardName),
            normalizeSetCode(card.setCode) ?? '',
            normalizeCollectorNumber(card.cardNumber) ?? '',
        ].join('|');
    }

    /**
     * Resolve a single card by name for legacy callers.
     */
    async resolveCardByName(cardName: string): Promise<ResolvedCard | null> {
        const request: DeckCardInfo = {
            amount: 1,
            cardName,
            setCode: null,
            cardNumber: null,
        };
        const key = this.getImportKey(request);

        if (this.cache.has(key)) {
            return this.cache.get(key) || null;
        }

        const pending = this.pendingLookups.get(key);
        if (pending) {
            return pending;
        }

        const lookupPromise = this.resolveCard(request);
        this.pendingLookups.set(key, lookupPromise);

        try {
            const result = await lookupPromise;
            this.cache.set(key, result);
            return result;
        } finally {
            this.pendingLookups.delete(key);
        }
    }

    /**
     * Return candidate replacement printings for an imported card.
     */
    async searchAlternates(card: Pick<DeckCardInfo, 'cardName' | 'setCode' | 'cardNumber'>, limit = 12): Promise<ResolvedCard[]> {
        const results = new Map<string, SearchCardView>();
        const request = parseEmbeddedImportMetadata(card);
        const criteriaList = this.buildSearchCriteria(request);

        for (const criteria of criteriaList) {
            try {
                const cards = await this.searchCards(criteria);
                for (const searchCard of cards) {
                    const key = `${searchCard.expansionSetCode}|${searchCard.cardNumber}|${searchCard.name}`;
                    if (!results.has(key)) {
                        results.set(key, searchCard);
                    }
                }
            } catch (error) {
                console.error(`[CardResolver] Error searching alternates for "${card.cardName}":`, error);
            }
        }

        return this.scoreCandidates(Array.from(results.values()), request)
            .slice(0, limit)
            .map(candidate => candidate.card);
    }

    /**
     * Resolve all imported cards and return both the normalized deck and a
     * report of automatic fixes and unresolved cards.
     */
    async resolveDeckWithReport(deck: DeckCardLists): Promise<DeckResolutionResult> {
        const groups = this.collectResolutionGroups(deck);

        if (groups.length === 0) {
            return { deck, resolved: [], unresolved: [] };
        }

        const resolvedCards = new Map<string, ResolvedCard>();
        const resolved: CardResolvedReportItem[] = [];
        const unresolved: CardUnresolvedReportItem[] = [];

        for (const group of groups) {
            const remembered = this.getRememberedFix(group.key);
            const candidates = remembered ? [remembered] : await this.searchAlternates(group, 16);
            const automatic = remembered ?? this.pickAutomaticResolution(candidates, group);

            if (automatic) {
                if (group.complete && this.matchesImportedCard(group, automatic)) {
                    continue;
                }

                resolvedCards.set(group.key, automatic);
                resolved.push({
                    ...group,
                    candidates,
                    resolved: automatic,
                    source: remembered ? 'remembered' : 'server',
                });
                continue;
            }

            if (group.complete) {
                continue;
            }

            unresolved.push({
                ...group,
                candidates,
                reason: candidates.length > 0 ? 'ambiguous' : 'not-found',
            });
        }

        return {
            deck: this.applyResolutionFixes(deck, resolvedCards),
            resolved,
            unresolved,
        };
    }

    /**
     * Resolve all unresolved cards in a deck for legacy callers.
     */
    async resolveDeck(deck: DeckCardLists): Promise<DeckCardLists> {
        return (await this.resolveDeckWithReport(deck)).deck;
    }

    applyResolutionFixes(deck: DeckCardLists, replacements: Map<string, ResolvedCard> | Record<string, ResolvedCard>): DeckCardLists {
        const replacementMap = replacements instanceof Map ? replacements : new Map(Object.entries(replacements));
        const resolvedDeck = cloneDeck(deck);

        const updateCards = (cards: DeckCardInfo[]): DeckCardInfo[] => cards.map(card => {
            const replacement = replacementMap.get(this.getImportKey(card));
            if (!replacement) {
                return card;
            }

            return {
                ...card,
                cardName: replacement.name,
                setCode: replacement.setCode,
                cardNumber: replacement.cardNumber,
            };
        });

        resolvedDeck.cards = updateCards(resolvedDeck.cards);
        resolvedDeck.sideboard = updateCards(resolvedDeck.sideboard);
        return resolvedDeck;
    }

    rememberFix(original: Pick<DeckCardInfo, 'cardName' | 'setCode' | 'cardNumber'>, replacement: ResolvedCard): void {
        if (!this.storage) return;

        const fixes = this.loadRememberedFixes();
        fixes[this.getImportKey(original)] = replacement;

        try {
            this.storage.setItem(CARD_RESOLVER_FIXES_KEY, JSON.stringify(fixes));
        } catch (error) {
            console.warn('[CardResolver] Failed to remember card import fix', error);
        }
    }

    forgetFix(original: Pick<DeckCardInfo, 'cardName' | 'setCode' | 'cardNumber'>): void {
        if (!this.storage) return;

        const fixes = this.loadRememberedFixes();
        delete fixes[this.getImportKey(original)];

        try {
            this.storage.setItem(CARD_RESOLVER_FIXES_KEY, JSON.stringify(fixes));
        } catch (error) {
            console.warn('[CardResolver] Failed to remove card import fix', error);
        }
    }

    clearRememberedFixes(): void {
        try {
            this.storage?.removeItem?.(CARD_RESOLVER_FIXES_KEY);
        } catch (error) {
            console.warn('[CardResolver] Failed to clear remembered card fixes', error);
        }
    }

    /**
     * Clear the in-memory lookup cache.
     */
    clearCache(): void {
        this.cache.clear();
        this.pendingLookups.clear();
    }

    /**
     * Get cache statistics.
     */
    getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
        };
    }

    private async resolveCard(card: DeckCardInfo): Promise<ResolvedCard | null> {
        const request = parseEmbeddedImportMetadata(card);
        const candidates = await this.searchAlternates(request, 8);
        return this.pickAutomaticResolution(candidates, request);
    }

    private buildSearchCriteria(card: Pick<DeckCardInfo, 'cardName' | 'setCode' | 'cardNumber'>): CardSearchCriteria[] {
        const criteria: CardSearchCriteria[] = [];
        const normalizedName = normalizeCardName(card.cardName);
        const frontName = frontFaceName(card.cardName);
        const setCode = normalizeSetCode(card.setCode);
        const collector = normalizeCollectorNumber(card.cardNumber);
        const numericCollector = collector && /^\d+$/.test(collector) ? Number.parseInt(collector, 10) : null;

        const addCriteria = (next: CardSearchCriteria) => {
            const serialized = JSON.stringify(next);
            if (!criteria.some(existing => JSON.stringify(existing) === serialized)) {
                criteria.push(next);
            }
        };

        const addNameCriteria = (nameContains: string) => {
            const trimmed = nameContains.trim();
            if (!trimmed) return;

            if (setCode) {
                addCriteria({
                    nameContains: trimmed,
                    setCodes: [setCode],
                    count: 50,
                    sortBy: 'cardNumber',
                    ...(numericCollector !== null ? { minCardNumber: numericCollector, maxCardNumber: numericCollector } : {}),
                });

                if (numericCollector !== null) {
                    addCriteria({
                        nameContains: trimmed,
                        setCodes: [setCode],
                        count: 50,
                        sortBy: 'cardNumber',
                    });
                }
            }

            addCriteria({
                nameContains: trimmed,
                count: 50,
                sortBy: 'name',
            });
        };

        addNameCriteria(card.cardName);
        if (frontName && frontName !== normalizedName) {
            addNameCriteria(frontName);
        }

        if (setCode && collector) {
            addCriteria({
                setCodes: [setCode],
                count: numericCollector !== null ? 50 : 500,
                sortBy: 'cardNumber',
                ...(numericCollector !== null ? { minCardNumber: numericCollector, maxCardNumber: numericCollector } : {}),
            });
        }

        return criteria;
    }

    private scoreCandidates(cards: SearchCardView[], request: Pick<DeckCardInfo, 'cardName' | 'setCode' | 'cardNumber'>): ScoredCandidate[] {
        const requestName = normalizeCardName(request.cardName);
        const requestFrontName = frontFaceName(request.cardName);
        const requestSet = normalizeSetCode(request.setCode);
        const requestNumber = normalizeCollectorNumber(request.cardNumber);

        return cards
            .map(card => {
                const candidateName = normalizeCardName(card.name);
                const candidateDisplayName = normalizeCardName(card.displayName);
                const candidateFrontName = frontFaceName(card.name || card.displayName);
                const candidateSet = normalizeSetCode(card.expansionSetCode);
                const candidateNumber = normalizeCollectorNumber(card.cardNumber);

                let score = 0;
                if (candidateName === requestName || candidateDisplayName === requestName) {
                    score += 80;
                } else if (requestFrontName && candidateFrontName === requestFrontName) {
                    score += 55;
                } else if (candidateName.includes(requestName) || requestName.includes(candidateName)) {
                    score += 20;
                }

                if (requestSet && candidateSet === requestSet) {
                    score += 40;
                }

                if (requestNumber && candidateNumber === requestNumber) {
                    score += 50;
                }

                return { card: toResolvedCard(card), score };
            })
            .filter(candidate => candidate.score > 0)
            .sort((a, b) => b.score - a.score || compareText(a.card.name, b.card.name) || compareText(a.card.setCode, b.card.setCode) || compareText(a.card.cardNumber, b.card.cardNumber));
    }

    private pickAutomaticResolution(candidates: ResolvedCard[], request: Pick<DeckCardInfo, 'cardName' | 'setCode' | 'cardNumber'>): ResolvedCard | null {
        const scored = this.scoreCandidates(candidates.map(candidate => ({
            id: `${candidate.setCode}-${candidate.cardNumber}`,
            name: candidate.name,
            displayName: candidate.name,
            rules: [],
            power: '',
            toughness: '',
            loyalty: '',
            defense: '',
            cardTypes: [],
            subTypes: [],
            superTypes: [],
            expansionSetCode: candidate.setCode,
            cardNumber: candidate.cardNumber,
            imageFileName: '',
            imageNumber: 0,
            color: { white: false, blue: false, black: false, red: false, green: false },
            frameColor: { white: false, blue: false, black: false, red: false, green: false },
            manaValue: 0,
            rarity: 'COMMON' as SearchCardView['rarity'],
            isSplitCard: false,
            isDoubleFacedCard: false,
        })), request);

        const best = scored[0];
        if (!best || best.score < AUTO_RESOLVE_MIN_SCORE) {
            return null;
        }

        return best.card;
    }

    private collectResolutionGroups(deck: DeckCardLists): CardResolutionGroup[] {
        const groups = new Map<string, CardResolutionGroup>();

        const collect = (cards: DeckCardInfo[], zone: CardResolverZone) => {
            for (const card of cards) {
                const key = this.getImportKey(card);
                const request = parseEmbeddedImportMetadata(card);
                const existing = groups.get(key);

                if (existing) {
                    existing.amount += card.amount;
                    mergeZones(existing.zones, zone, card.amount);
                    continue;
                }

                groups.set(key, {
                    key,
                    cardName: request.cardName,
                    setCode: request.setCode,
                    cardNumber: request.cardNumber,
                    amount: card.amount,
                    zones: [{ zone, amount: card.amount }],
                    complete: Boolean(request.setCode && request.cardNumber),
                });
            }
        };

        collect(deck.cards, 'main');
        collect(deck.sideboard, 'side');

        return Array.from(groups.values());
    }

    private matchesImportedCard(
        original: Pick<DeckCardInfo, 'cardName' | 'setCode' | 'cardNumber'>,
        resolved: ResolvedCard,
    ): boolean {
        return normalizeCardName(original.cardName) === normalizeCardName(resolved.name)
            && normalizeSetCode(original.setCode) === normalizeSetCode(resolved.setCode)
            && normalizeCollectorNumber(original.cardNumber) === normalizeCollectorNumber(resolved.cardNumber);
    }

    private getRememberedFix(key: string): ResolvedCard | null {
        return this.loadRememberedFixes()[key] ?? null;
    }

    private loadRememberedFixes(): Record<string, ResolvedCard> {
        if (!this.storage) return {};

        try {
            const raw = this.storage.getItem(CARD_RESOLVER_FIXES_KEY);
            if (!raw) return {};

            const parsed = JSON.parse(raw) as Record<string, ResolvedCard>;
            if (!parsed || typeof parsed !== 'object') return {};

            const fixes: Record<string, ResolvedCard> = {};
            for (const [key, value] of Object.entries(parsed)) {
                if (!value || typeof value !== 'object') continue;
                if (!value.name || !value.setCode || !value.cardNumber) continue;
                fixes[key] = {
                    name: String(value.name),
                    setCode: String(value.setCode),
                    cardNumber: String(value.cardNumber),
                };
            }
            return fixes;
        } catch {
            return {};
        }
    }
}

// Export singleton instance.
export const cardResolverService = new CardResolverService();
