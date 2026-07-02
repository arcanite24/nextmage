import { Rarity } from '../types/index.js';
import { wsService } from './WebSocketService.js';
export const DECK_LEGALITY_FORMATS = [
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
const SPECIAL_MAX_COPY_COUNTS = new Map([
    ['Once More with Feeling', 1],
    ['Seven Dwarves', 7],
    ['Nazgul', 9],
]);
const SERVER_DECK_TYPE_ALIASES = new Map([
    ['Commander', 'Variant Magic - Commander'],
    ['Oathbreaker', 'Variant Magic - Oathbreaker'],
    ['Brawl', 'Variant Magic - Brawl'],
    ['Penny Dreadful Commander', 'Variant Magic - Penny Dreadful Commander'],
    ['European Highlander', 'Constructed - European Highlander'],
    ['Canadian Highlander', 'Constructed - Canadian Highlander'],
]);
export function serverDeckTypeForValidation(format) {
    return SERVER_DECK_TYPE_ALIASES.get(format.deckType) ?? format.deckType;
}
function normalizeCardName(cardName) {
    return (cardName ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function getMainCount(deck) {
    return deck.cards.reduce((sum, card) => sum + card.amount, 0);
}
function getSideboardCount(deck) {
    return deck.sideboard.reduce((sum, card) => sum + card.amount, 0);
}
function getCardIdentity(card) {
    return normalizeCardName(card.cardName);
}
function getMaxCopies(cardName, defaultAmount) {
    if (UNLIMITED_COPY_CARD_NAMES.has(cardName)) {
        return Number.MAX_SAFE_INTEGER;
    }
    return SPECIAL_MAX_COPY_COUNTS.get(cardName) ?? defaultAmount;
}
function hasExactName(candidate, cardName) {
    const expected = normalizeCardName(cardName);
    return normalizeCardName(candidate.name) === expected || normalizeCardName(candidate.displayName) === expected;
}
function hasExactPrinting(candidate, card) {
    if (!card.setCode || !card.cardNumber)
        return true;
    return candidate.expansionSetCode.toUpperCase() === card.setCode.toUpperCase()
        && candidate.cardNumber.toLowerCase() === card.cardNumber.toLowerCase();
}
function isCommonPrinting(candidate) {
    return candidate.rarity === Rarity.COMMON || String(candidate.rarity).toUpperCase() === 'COMMON';
}
function issueCardNames(issues) {
    return Array.from(new Set(issues.map(issue => issue.cardName).filter((name) => Boolean(name))));
}
const ISSUE_TYPE_SORT_ORDER = {
    PRIMARY: 10,
    DECK_SIZE: 20,
    BANNED: 30,
    WRONG_SET: 40,
    OTHER: 50,
};
function compareText(left, right) {
    if (left < right)
        return -1;
    if (left > right)
        return 1;
    return 0;
}
function sortIssuesLikeJavaValidator(issues) {
    return [...issues].sort((left, right) => {
        const typeOrder = ISSUE_TYPE_SORT_ORDER[left.type] - ISSUE_TYPE_SORT_ORDER[right.type];
        if (typeOrder !== 0)
            return typeOrder;
        const groupOrder = compareText(left.group, right.group);
        if (groupOrder !== 0)
            return groupOrder;
        return compareText(left.message, right.message);
    });
}
function statusFromIssues(issues) {
    if (issues.length === 0)
        return 'legal';
    if (issues.every(issue => issue.type === 'DECK_SIZE'))
        return 'partly-legal';
    return 'not-legal';
}
function statusFromServerValidation(result) {
    if (result.valid)
        return 'legal';
    if (result.partlyValid)
        return 'partly-legal';
    return statusFromIssues(result.errors.map(mapServerIssue));
}
function mapServerIssue(issue) {
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
    searchCards;
    validateDeckWithServer;
    serverValidationTimeoutMs;
    cardCache = new Map();
    constructor(options = {}) {
        this.searchCards = options.searchCards ?? ((criteria) => wsService.searchCards(criteria));
        this.validateDeckWithServer = options.validateDeck ?? ((deckType, deck) => wsService.validateDeck(deckType, deck));
        this.serverValidationTimeoutMs = options.serverValidationTimeoutMs ?? 5_000;
    }
    async validateDeck(deck, formats = DECK_LEGALITY_FORMATS) {
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
    async validateFormat(deck, format) {
        const serverResult = await this.tryValidateWithServer(deck, format);
        if (serverResult) {
            return serverResult;
        }
        try {
            const issues = [];
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
        }
        catch (error) {
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
    async tryValidateWithServer(deck, format) {
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
        }
        catch {
            return null;
        }
    }
    async validateDeckWithServerBudget(deckType, deck) {
        const validationPromise = this.validateDeckWithServer(deckType, deck);
        validationPromise.catch(() => undefined);
        if (this.serverValidationTimeoutMs <= 0) {
            return validationPromise;
        }
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Deck validation timed out')), this.serverValidationTimeoutMs);
        });
        try {
            return await Promise.race([validationPromise, timeoutPromise]);
        }
        finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    }
    validateDeckShape(deck, format, issues) {
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
        const counts = new Map();
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
    async validateCards(deck, format, issues) {
        const uniqueCards = new Map();
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
    async findExactCards(cardName, format) {
        const key = `${format ?? '*'}|${normalizeCardName(cardName)}`;
        if (!this.cardCache.has(key)) {
            this.cardCache.set(key, this.searchCards({
                nameContains: cardName,
                format,
                count: 100,
            }).then(cards => cards.filter(candidate => hasExactName(candidate, cardName))));
        }
        return this.cardCache.get(key);
    }
}
export const deckLegalityService = new DeckLegalityService();
