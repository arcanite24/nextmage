import { addDeckCardCopies } from './DeckCardListService.js';
import { wsService } from './WebSocketService.js';
import { Rarity } from '../types/index.js';
export const BASIC_LANDS = [
    { key: 'plains', cardName: 'Plains', label: 'Plains', symbol: 'W', pipClass: 'white' },
    { key: 'island', cardName: 'Island', label: 'Island', symbol: 'U', pipClass: 'blue' },
    { key: 'swamp', cardName: 'Swamp', label: 'Swamp', symbol: 'B', pipClass: 'black' },
    { key: 'mountain', cardName: 'Mountain', label: 'Mountain', symbol: 'R', pipClass: 'red' },
    { key: 'forest', cardName: 'Forest', label: 'Forest', symbol: 'G', pipClass: 'green' },
];
function normalizeText(value) {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function normalizeSetCode(value) {
    const normalized = (value ?? '').trim().toUpperCase();
    return /^[A-Z0-9]{2,8}$/.test(normalized) ? normalized : undefined;
}
function normalizeAmount(amount) {
    return Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
}
function countCards(cards) {
    return cards.reduce((sum, card) => sum + card.amount, 0);
}
function hasExactName(candidate, cardName, allowSnowBasics = false) {
    const expected = normalizeText(cardName);
    const snowExpected = `snow-covered ${expected}`;
    return normalizeText(candidate.name) === expected
        || normalizeText(candidate.displayName) === expected
        || (allowSnowBasics && (normalizeText(candidate.name) === snowExpected
            || normalizeText(candidate.displayName) === snowExpected));
}
function isFullArtPrinting(candidate) {
    const searchableText = [
        candidate.displayName,
        candidate.imageFileName,
        ...candidate.rules,
    ].map(normalizeText).join(' ');
    return /\bfull[-\s]?art\b/.test(searchableText);
}
function isSnowBasic(candidate) {
    return normalizeText(candidate.name).startsWith('snow-covered ')
        || candidate.superTypes.some(superType => normalizeText(superType) === 'snow');
}
function hasBasicLandName(candidate, landName) {
    const expected = normalizeText(landName);
    const actual = normalizeText(candidate.name);
    return actual === expected || actual === `snow-covered ${expected}`;
}
function emptyCounts() {
    return {
        plains: 0,
        island: 0,
        swamp: 0,
        mountain: 0,
        forest: 0,
    };
}
function getManaCosts(card) {
    if (!card)
        return [];
    return [
        ...(card.manaCostLeftStr ?? []),
        ...(card.manaCostRightStr ?? []),
    ];
}
function countManaSymbols(cards) {
    const symbols = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    for (const { deckCard, metadata } of cards) {
        for (const manaCost of getManaCosts(metadata)) {
            if (manaCost.includes('W'))
                symbols.W += deckCard.amount;
            if (manaCost.includes('U'))
                symbols.U += deckCard.amount;
            if (manaCost.includes('B'))
                symbols.B += deckCard.amount;
            if (manaCost.includes('R'))
                symbols.R += deckCard.amount;
            if (manaCost.includes('G'))
                symbols.G += deckCard.amount;
        }
    }
    return symbols;
}
function takeRoundedShare(landsNeeded, symbolCount, totalSymbols) {
    if (landsNeeded <= 0 || symbolCount <= 0 || totalSymbols <= 0)
        return 0;
    return Math.round(landsNeeded * (symbolCount / totalSymbols));
}
function addResolvedLand(deck, resolvedLand, zone) {
    return addDeckCardCopies(deck, resolvedLand.card, zone, resolvedLand.card.amount);
}
function getDeckSetCodes(deck) {
    const setCodes = new Set();
    for (const card of [...(deck?.cards ?? []), ...(deck?.sideboard ?? [])]) {
        const setCode = normalizeSetCode(card.setCode);
        if (setCode)
            setCodes.add(setCode);
    }
    return [...setCodes];
}
function normalizeBasicLandSetInfo(value) {
    const setCode = normalizeSetCode(value.setCode);
    if (!setCode || !value.hasBasicLands)
        return null;
    return {
        setCode,
        name: value.name?.trim() || setCode,
        blockName: value.blockName ?? null,
        releaseDate: Number.isFinite(value.releaseDate) ? value.releaseDate : 0,
        hasBasicLands: true,
        hasSnowBasics: Boolean(value.hasSnowBasics),
    };
}
function optionFromSearch(setCode, searchInfo, deckSetOrder) {
    const landNames = [...searchInfo.landNames].sort((left, right) => left.localeCompare(right));
    return {
        setCode,
        label: `${setCode} (${landNames.length}/5)`,
        landNames,
        hasFullArtPrintings: searchInfo.hasFullArtPrintings,
        hasSnowBasics: searchInfo.hasSnowBasics,
        isDeckSet: deckSetOrder.has(setCode),
    };
}
function sortBasicLandSetOptions(options, deckSetOrder) {
    return options.sort((left, right) => {
        const leftDeckIndex = deckSetOrder.get(left.setCode);
        const rightDeckIndex = deckSetOrder.get(right.setCode);
        if (leftDeckIndex !== undefined || rightDeckIndex !== undefined) {
            return (leftDeckIndex ?? Number.MAX_SAFE_INTEGER) - (rightDeckIndex ?? Number.MAX_SAFE_INTEGER);
        }
        const leftReleaseDate = left.releaseDate ?? Number.NEGATIVE_INFINITY;
        const rightReleaseDate = right.releaseDate ?? Number.NEGATIVE_INFINITY;
        if (leftReleaseDate !== rightReleaseDate) {
            return rightReleaseDate - leftReleaseDate;
        }
        return left.label.localeCompare(right.label) || left.setCode.localeCompare(right.setCode);
    });
}
export function createEmptyBasicLandCounts() {
    return emptyCounts();
}
export function defaultAddLandsDeckSize(deck, options = {}) {
    const mainCount = countCards(deck?.cards ?? []);
    const format = normalizeText(deck?.format);
    const formatTarget = options.limited ? 40 : format.includes('commander') ? 100 : format.includes('constructed') ? 60 : 40;
    return Math.max(formatTarget, mainCount);
}
export class DeckLandsService {
    searchCards;
    listBasicLandSets;
    cardCache = new Map();
    constructor(options = {}) {
        this.searchCards = options.searchCards ?? ((criteria) => wsService.searchCards(criteria));
        this.listBasicLandSets = options.listBasicLandSets ?? (() => wsService.getBasicLandSets());
    }
    async suggestBasicLands(deck, deckSize) {
        const counts = emptyCounts();
        const mainCards = deck?.cards ?? [];
        let landsNeeded = Math.max(0, normalizeAmount(deckSize) - countCards(mainCards));
        if (landsNeeded === 0)
            return counts;
        const resolvedCards = await Promise.all(mainCards.map(async (deckCard) => ({
            deckCard,
            metadata: await this.findExactCard(deckCard.cardName),
        })));
        const symbols = countManaSymbols(resolvedCards);
        let totalSymbols = symbols.W + symbols.U + symbols.B + symbols.R + symbols.G;
        if (totalSymbols === 0) {
            symbols.W = 1;
            symbols.U = 1;
            symbols.B = 1;
            symbols.R = 1;
            totalSymbols = 5;
        }
        counts.plains = takeRoundedShare(landsNeeded, symbols.W, totalSymbols);
        landsNeeded -= counts.plains;
        totalSymbols -= symbols.W;
        counts.island = takeRoundedShare(landsNeeded, symbols.U, totalSymbols);
        landsNeeded -= counts.island;
        totalSymbols -= symbols.U;
        counts.swamp = takeRoundedShare(landsNeeded, symbols.B, totalSymbols);
        landsNeeded -= counts.swamp;
        totalSymbols -= symbols.B;
        counts.mountain = takeRoundedShare(landsNeeded, symbols.R, totalSymbols);
        landsNeeded -= counts.mountain;
        counts.forest = Math.max(0, landsNeeded);
        return counts;
    }
    async listBasicLandSetOptions(deck = null, options = {}) {
        const allowSnowBasics = Boolean(options.allowSnowBasics);
        const deckSetCodes = getDeckSetCodes(deck);
        const deckSetOrder = new Map(deckSetCodes.map((setCode, index) => [setCode, index]));
        const [cardsByLand, repositorySets] = await Promise.all([
            Promise.all(BASIC_LANDS.map(async (land) => ({
                land,
                cards: await this.searchCards({
                    nameContains: land.cardName,
                    rarities: [Rarity.LAND],
                    types: ['LAND'],
                    count: 500,
                }),
            }))),
            this.listBasicLandSets().catch(() => []),
        ]);
        const bySetCode = new Map();
        for (const { land, cards } of cardsByLand) {
            for (const card of cards) {
                const setCode = normalizeSetCode(card.expansionSetCode);
                if (!setCode || !hasBasicLandName(card, land.cardName))
                    continue;
                if (!allowSnowBasics && isSnowBasic(card))
                    continue;
                const current = bySetCode.get(setCode) ?? {
                    landNames: new Set(),
                    hasFullArtPrintings: false,
                    hasSnowBasics: false,
                };
                current.landNames.add(land.cardName);
                current.hasFullArtPrintings ||= isFullArtPrinting(card);
                current.hasSnowBasics ||= isSnowBasic(card);
                bySetCode.set(setCode, current);
            }
        }
        const basicLandSets = repositorySets
            .map(normalizeBasicLandSetInfo)
            .filter((setInfo) => Boolean(setInfo))
            .filter(setInfo => allowSnowBasics || !setInfo.hasSnowBasics);
        if (basicLandSets.length > 0) {
            return sortBasicLandSetOptions(basicLandSets.map(setInfo => {
                const searchInfo = bySetCode.get(setInfo.setCode);
                const landNames = searchInfo ? [...searchInfo.landNames].sort((left, right) => left.localeCompare(right)) : [];
                return {
                    setCode: setInfo.setCode,
                    label: `${setInfo.name} (${setInfo.setCode})`,
                    landNames,
                    hasFullArtPrintings: searchInfo?.hasFullArtPrintings ?? false,
                    hasSnowBasics: setInfo.hasSnowBasics || searchInfo?.hasSnowBasics === true,
                    isDeckSet: deckSetOrder.has(setInfo.setCode),
                    releaseDate: setInfo.releaseDate,
                };
            }), deckSetOrder);
        }
        return sortBasicLandSetOptions([...bySetCode.entries()].map(([setCode, option]) => optionFromSearch(setCode, option, deckSetOrder)), deckSetOrder);
    }
    async addBasicLands(deck, counts, zone, options = {}) {
        const normalizedOptions = normalizeAddBasicLandsOptions(options);
        const resolvedLands = await Promise.all(BASIC_LANDS
            .map(land => ({ land, amount: normalizeAmount(counts[land.key]) }))
            .filter(({ amount }) => amount > 0)
            .map(({ land, amount }) => this.resolveBasicLand(land, amount, normalizedOptions)));
        let nextDeck = deck;
        for (const resolvedLand of resolvedLands) {
            nextDeck = addResolvedLand(nextDeck, resolvedLand, zone);
        }
        return {
            deck: nextDeck,
            addedCards: resolvedLands.map(resolvedLand => resolvedLand.card),
            unresolvedCardNames: resolvedLands
                .filter(resolvedLand => !resolvedLand.resolved)
                .map(resolvedLand => resolvedLand.card.cardName),
        };
    }
    async resolveBasicLand(land, amount, options) {
        const card = await this.findExactCard(land.cardName, options);
        if (!card) {
            return {
                card: { cardName: land.cardName, amount },
                resolved: false,
            };
        }
        return {
            card: {
                cardName: card.name,
                setCode: card.expansionSetCode,
                cardNumber: card.cardNumber,
                amount,
            },
            resolved: true,
        };
    }
    async findExactCard(cardName, options = {}) {
        const key = [
            normalizeText(cardName),
            normalizeSetCode(options.setCode) ?? '',
            options.fullArtOnly ? 'full-art' : 'any-art',
            options.allowSnowBasics ? 'snow' : 'basic',
        ].join('|');
        if (!this.cardCache.has(key)) {
            const setCode = normalizeSetCode(options.setCode);
            this.cardCache.set(key, this.searchCards({
                nameContains: cardName,
                rarities: [Rarity.LAND],
                types: ['LAND'],
                ...(setCode ? { setCodes: [setCode] } : {}),
                count: 100,
            }).then(cards => cards.find(candidate => (hasExactName(candidate, cardName, options.allowSnowBasics)
                && (!options.fullArtOnly || isFullArtPrinting(candidate)))) ?? null).catch(() => null));
        }
        return this.cardCache.get(key);
    }
}
export const deckLandsService = new DeckLandsService();
function normalizeAddBasicLandsOptions(options) {
    return {
        setCode: normalizeSetCode(options.setCode),
        fullArtOnly: Boolean(options.fullArtOnly),
        allowSnowBasics: Boolean(options.allowSnowBasics),
    };
}
