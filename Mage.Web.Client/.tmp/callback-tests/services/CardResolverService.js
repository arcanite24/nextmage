/**
 * Card Resolver Service
 *
 * Resolves imported deck cards that only have names, stale set aliases, or
 * incomplete collector data by searching the server's card database. The
 * resolver returns a report so import flows can show unresolved cards instead
 * of silently saving partial decks.
 */
import { wsService } from './WebSocketService.js';
const CARD_RESOLVER_FIXES_KEY = 'mage.client.cardResolverFixes.v1';
const SET_ALIASES = {
    DAR: 'DOM',
};
const AUTO_RESOLVE_MIN_SCORE = 80;
function getBrowserStorage() {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    }
    catch {
        return null;
    }
}
function normalizeSetCode(setCode) {
    const normalized = setCode?.trim().toUpperCase();
    if (!normalized)
        return null;
    return SET_ALIASES[normalized] ?? normalized;
}
function normalizeCollectorNumber(cardNumber) {
    const normalized = cardNumber?.trim().toLowerCase();
    return normalized || null;
}
function normalizeCardName(cardName) {
    return (cardName ?? '')
        .toLowerCase()
        .replace(/&amp;/g, '//')
        .replace(/\s*\/+\s*/g, ' // ')
        .replace(/\s+/g, ' ')
        .trim();
}
function frontFaceName(cardName) {
    return normalizeCardName(cardName).split(' // ')[0].trim();
}
function parseEmbeddedImportMetadata(card) {
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
function compareText(a, b) {
    return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base', numeric: true });
}
function toResolvedCard(card) {
    return {
        name: card.name || card.displayName,
        setCode: card.expansionSetCode,
        cardNumber: card.cardNumber,
    };
}
function cloneDeck(deck) {
    return {
        ...deck,
        cards: deck.cards.map(card => ({ ...card })),
        sideboard: deck.sideboard.map(card => ({ ...card })),
    };
}
function mergeZones(existing, zone, amount) {
    const found = existing.find(item => item.zone === zone);
    if (found) {
        found.amount += amount;
        return existing;
    }
    existing.push({ zone, amount });
    return existing;
}
export class CardResolverService {
    searchCards;
    storage;
    cache = new Map();
    pendingLookups = new Map();
    constructor(options = {}) {
        this.searchCards = options.searchCards ?? ((criteria) => wsService.searchCards(criteria));
        this.storage = options.storage === undefined ? getBrowserStorage() : options.storage;
    }
    /**
     * Normalize a card name for consistent lookup.
     */
    normalizeImportName(name) {
        return normalizeCardName(name);
    }
    getImportKey(card) {
        return [
            normalizeCardName(card.cardName),
            normalizeSetCode(card.setCode) ?? '',
            normalizeCollectorNumber(card.cardNumber) ?? '',
        ].join('|');
    }
    /**
     * Resolve a single card by name for legacy callers.
     */
    async resolveCardByName(cardName) {
        const request = {
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
        }
        finally {
            this.pendingLookups.delete(key);
        }
    }
    /**
     * Return candidate replacement printings for an imported card.
     */
    async searchAlternates(card, limit = 12) {
        const results = new Map();
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
            }
            catch (error) {
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
    async resolveDeckWithReport(deck) {
        const groups = this.collectResolutionGroups(deck);
        if (groups.length === 0) {
            return { deck, resolved: [], unresolved: [] };
        }
        const resolvedCards = new Map();
        const resolved = [];
        const unresolved = [];
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
    async resolveDeck(deck) {
        return (await this.resolveDeckWithReport(deck)).deck;
    }
    applyResolutionFixes(deck, replacements) {
        const replacementMap = replacements instanceof Map ? replacements : new Map(Object.entries(replacements));
        const resolvedDeck = cloneDeck(deck);
        const updateCards = (cards) => cards.map(card => {
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
    rememberFix(original, replacement) {
        if (!this.storage)
            return;
        const fixes = this.loadRememberedFixes();
        fixes[this.getImportKey(original)] = replacement;
        try {
            this.storage.setItem(CARD_RESOLVER_FIXES_KEY, JSON.stringify(fixes));
        }
        catch (error) {
            console.warn('[CardResolver] Failed to remember card import fix', error);
        }
    }
    forgetFix(original) {
        if (!this.storage)
            return;
        const fixes = this.loadRememberedFixes();
        delete fixes[this.getImportKey(original)];
        try {
            this.storage.setItem(CARD_RESOLVER_FIXES_KEY, JSON.stringify(fixes));
        }
        catch (error) {
            console.warn('[CardResolver] Failed to remove card import fix', error);
        }
    }
    clearRememberedFixes() {
        try {
            this.storage?.removeItem?.(CARD_RESOLVER_FIXES_KEY);
        }
        catch (error) {
            console.warn('[CardResolver] Failed to clear remembered card fixes', error);
        }
    }
    /**
     * Clear the in-memory lookup cache.
     */
    clearCache() {
        this.cache.clear();
        this.pendingLookups.clear();
    }
    /**
     * Get cache statistics.
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
        };
    }
    async resolveCard(card) {
        const request = parseEmbeddedImportMetadata(card);
        const candidates = await this.searchAlternates(request, 8);
        return this.pickAutomaticResolution(candidates, request);
    }
    buildSearchCriteria(card) {
        const criteria = [];
        const normalizedName = normalizeCardName(card.cardName);
        const frontName = frontFaceName(card.cardName);
        const setCode = normalizeSetCode(card.setCode);
        const collector = normalizeCollectorNumber(card.cardNumber);
        const numericCollector = collector && /^\d+$/.test(collector) ? Number.parseInt(collector, 10) : null;
        const addCriteria = (next) => {
            const serialized = JSON.stringify(next);
            if (!criteria.some(existing => JSON.stringify(existing) === serialized)) {
                criteria.push(next);
            }
        };
        const addNameCriteria = (nameContains) => {
            const trimmed = nameContains.trim();
            if (!trimmed)
                return;
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
    scoreCandidates(cards, request) {
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
            }
            else if (requestFrontName && candidateFrontName === requestFrontName) {
                score += 55;
            }
            else if (candidateName.includes(requestName) || requestName.includes(candidateName)) {
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
    pickAutomaticResolution(candidates, request) {
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
            rarity: 'COMMON',
            isSplitCard: false,
            isDoubleFacedCard: false,
        })), request);
        const best = scored[0];
        if (!best || best.score < AUTO_RESOLVE_MIN_SCORE) {
            return null;
        }
        return best.card;
    }
    collectResolutionGroups(deck) {
        const groups = new Map();
        const collect = (cards, zone) => {
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
    matchesImportedCard(original, resolved) {
        return normalizeCardName(original.cardName) === normalizeCardName(resolved.name)
            && normalizeSetCode(original.setCode) === normalizeSetCode(resolved.setCode)
            && normalizeCollectorNumber(original.cardNumber) === normalizeCollectorNumber(resolved.cardNumber);
    }
    getRememberedFix(key) {
        return this.loadRememberedFixes()[key] ?? null;
    }
    loadRememberedFixes() {
        if (!this.storage)
            return {};
        try {
            const raw = this.storage.getItem(CARD_RESOLVER_FIXES_KEY);
            if (!raw)
                return {};
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object')
                return {};
            const fixes = {};
            for (const [key, value] of Object.entries(parsed)) {
                if (!value || typeof value !== 'object')
                    continue;
                if (!value.name || !value.setCode || !value.cardNumber)
                    continue;
                fixes[key] = {
                    name: String(value.name),
                    setCode: String(value.setCode),
                    cardNumber: String(value.cardNumber),
                };
            }
            return fixes;
        }
        catch {
            return {};
        }
    }
}
// Export singleton instance.
export const cardResolverService = new CardResolverService();
