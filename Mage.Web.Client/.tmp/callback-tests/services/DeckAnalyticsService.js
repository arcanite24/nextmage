import { DECK_LEGALITY_FORMATS } from './DeckLegalityService.js';
import { wsService } from './WebSocketService.js';
const CURVE_BUCKETS = [
    { key: '0', label: '0' },
    { key: '1', label: '1' },
    { key: '2', label: '2' },
    { key: '3', label: '3' },
    { key: '4', label: '4' },
    { key: '5', label: '5' },
    { key: '6', label: '6' },
    { key: '7+', label: '7+' },
];
const COLOR_BUCKETS = [
    { key: 'white', label: 'White' },
    { key: 'blue', label: 'Blue' },
    { key: 'black', label: 'Black' },
    { key: 'red', label: 'Red' },
    { key: 'green', label: 'Green' },
    { key: 'colorless', label: 'Colorless' },
];
const LAND_SOURCE_BUCKETS = [
    { key: 'plains', label: 'Plains' },
    { key: 'island', label: 'Island' },
    { key: 'swamp', label: 'Swamp' },
    { key: 'mountain', label: 'Mountain' },
    { key: 'forest', label: 'Forest' },
    { key: 'wastes', label: 'Wastes' },
];
const TYPE_BUCKETS = [
    { key: 'creature', label: 'Creatures', type: 'CREATURE' },
    { key: 'land', label: 'Lands', type: 'LAND' },
    { key: 'instant', label: 'Instants', type: 'INSTANT' },
    { key: 'sorcery', label: 'Sorceries', type: 'SORCERY' },
    { key: 'artifact', label: 'Artifacts', type: 'ARTIFACT' },
    { key: 'enchantment', label: 'Enchantments', type: 'ENCHANTMENT' },
    { key: 'planeswalker', label: 'Planeswalkers', type: 'PLANESWALKER' },
    { key: 'battle', label: 'Battles', type: 'BATTLE' },
    { key: 'other', label: 'Other' },
];
const UNLIMITED_SIDEBOARD_TARGET = Number.MAX_SAFE_INTEGER;
function normalizeCardName(cardName) {
    return (cardName ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function countCards(cards) {
    return cards.reduce((sum, card) => sum + card.amount, 0);
}
function countUniqueNames(cards) {
    return new Set(cards.map(card => normalizeCardName(card.cardName)).filter(Boolean)).size;
}
function hasExactName(candidate, cardName) {
    const expected = normalizeCardName(cardName);
    return normalizeCardName(candidate.name) === expected || normalizeCardName(candidate.displayName) === expected;
}
function hasExactPrinting(candidate, card) {
    if (!card.setCode || !card.cardNumber)
        return false;
    return candidate.expansionSetCode.toUpperCase() === card.setCode.toUpperCase()
        && candidate.cardNumber.toLowerCase() === card.cardNumber.toLowerCase();
}
function resolveFormat(deckType) {
    const normalized = normalizeCardName(deckType);
    const normalizedAliases = new Map([
        ['limited', 'limited'],
        ['sealed', 'limited'],
        ['draft', 'limited'],
        ['booster draft', 'limited'],
        ['limited building', 'limited'],
        ['constructed - commander', 'commander'],
        ['variant magic - commander', 'commander'],
        ['variant magic - oathbreaker', 'oathbreaker'],
        ['variant magic - brawl', 'brawl'],
        ['variant magic - duel penny dreadful commander', 'penny dreadful commander'],
    ]);
    const lookup = normalizedAliases.get(normalized) ?? normalized;
    const format = DECK_LEGALITY_FORMATS.find(candidate => (normalizeCardName(candidate.deckType) === lookup
        || normalizeCardName(candidate.shortName) === lookup
        || normalizeCardName(candidate.deckType.replace('Constructed - ', '')) === lookup));
    if (lookup === 'limited') {
        return {
            deckType: 'Limited',
            shortName: 'Limited',
            minMain: 40,
            maxSideboard: UNLIMITED_SIDEBOARD_TARGET,
            maxCopies: Number.MAX_SAFE_INTEGER,
        };
    }
    return format ?? {
        deckType: deckType || 'Constructed - Standard',
        shortName: deckType?.replace('Constructed - ', '') || 'Standard',
        minMain: 60,
        maxSideboard: 15,
        maxCopies: 4,
    };
}
function createBucketMap(buckets) {
    return new Map(buckets.map(bucket => [bucket.key, { ...bucket, count: 0, cardNames: [] }]));
}
function getCurveBucket(manaValue) {
    const normalizedValue = Math.max(0, Math.floor(Number.isFinite(manaValue) ? manaValue : 0));
    return normalizedValue >= 7 ? '7+' : String(normalizedValue);
}
function getExactManaValueKey(manaValue) {
    return String(Math.max(0, Math.floor(Number.isFinite(manaValue) ? manaValue : 0)));
}
function getManaDistributionBucket(distribution, manaValue) {
    const key = getExactManaValueKey(manaValue);
    const existingBucket = distribution.get(key);
    if (existingBucket)
        return existingBucket;
    const bucket = {
        key,
        label: key,
        pips: Array.from(createBucketMap(COLOR_BUCKETS).values()),
        total: 0,
        cardNames: [],
    };
    distribution.set(key, bucket);
    return bucket;
}
function addBucketCardName(bucket, cardName) {
    addCardName(bucket.cardNames, cardName);
}
function addCardName(cardNames, cardName) {
    const normalizedCardName = normalizeCardName(cardName);
    if (!normalizedCardName)
        return;
    if (cardNames.some(existingName => normalizeCardName(existingName) === normalizedCardName))
        return;
    cardNames.push(cardName);
}
function hasAnyColor(color) {
    return Boolean(color && (color.white || color.blue || color.black || color.red || color.green));
}
function addCardColors(colors, card, amount, deckCardName) {
    const color = card.color;
    if (!hasAnyColor(color)) {
        const colorlessBucket = colors.get('colorless');
        colorlessBucket.count += amount;
        addBucketCardName(colorlessBucket, deckCardName);
        return;
    }
    if (color.white) {
        const bucket = colors.get('white');
        bucket.count += amount;
        addBucketCardName(bucket, deckCardName);
    }
    if (color.blue) {
        const bucket = colors.get('blue');
        bucket.count += amount;
        addBucketCardName(bucket, deckCardName);
    }
    if (color.black) {
        const bucket = colors.get('black');
        bucket.count += amount;
        addBucketCardName(bucket, deckCardName);
    }
    if (color.red) {
        const bucket = colors.get('red');
        bucket.count += amount;
        addBucketCardName(bucket, deckCardName);
    }
    if (color.green) {
        const bucket = colors.get('green');
        bucket.count += amount;
        addBucketCardName(bucket, deckCardName);
    }
}
function getManaCostParts(card) {
    return [
        ...(card.manaCostLeftStr ?? []),
        ...(card.manaCostRightStr ?? []),
    ];
}
function addManaSymbol(buckets, symbol, amount, cardName) {
    const normalized = symbol.toUpperCase();
    if (normalized.includes('W'))
        addManaBucketCount(buckets.get('white'), amount, cardName);
    if (normalized.includes('U'))
        addManaBucketCount(buckets.get('blue'), amount, cardName);
    if (normalized.includes('B'))
        addManaBucketCount(buckets.get('black'), amount, cardName);
    if (normalized.includes('R'))
        addManaBucketCount(buckets.get('red'), amount, cardName);
    if (normalized.includes('G'))
        addManaBucketCount(buckets.get('green'), amount, cardName);
    if (normalized.includes('C'))
        addManaBucketCount(buckets.get('colorless'), amount, cardName);
    const numericCost = normalized.match(/^\{?(\d+)\}?$/);
    if (numericCost) {
        addManaBucketCount(buckets.get('colorless'), Number(numericCost[1]) * amount, cardName);
    }
}
function addManaBucketCount(bucket, amount, cardName) {
    bucket.count += amount;
    if (cardName)
        addBucketCardName(bucket, cardName);
}
function addManaPips(pips, card, amount, deckCardName) {
    for (const symbol of getManaCostParts(card)) {
        addManaSymbol(pips, symbol, amount, deckCardName);
    }
}
function addManaDistribution(distribution, card, amount, deckCardName) {
    const bucket = getManaDistributionBucket(distribution, card.manaValue);
    const pips = new Map(bucket.pips.map(pip => [pip.key, pip]));
    for (const symbol of getManaCostParts(card)) {
        addManaSymbol(pips, symbol, amount, deckCardName);
    }
    bucket.total = bucket.pips.reduce((sum, pip) => sum + pip.count, 0);
    addCardName(bucket.cardNames, deckCardName);
}
function addManaSources(sources, card, amount, deckCardName) {
    for (const rule of card.rules ?? []) {
        const addTextStart = rule.search(/\bAdd\b/i);
        if (addTextStart < 0)
            continue;
        const matches = rule.slice(addTextStart).match(/\{[WUBRGC]\}/gi) ?? [];
        for (const symbol of matches) {
            addManaSymbol(sources, symbol, amount, deckCardName);
        }
    }
}
function addLandSources(landSources, card, amount, deckCardName) {
    const landText = [
        card.name,
        card.displayName,
        ...(card.superTypes ?? []),
        ...(card.cardTypes ?? []),
        ...(card.subTypes ?? []),
        ...(card.rules ?? []),
    ].join(' ').toLowerCase();
    for (const bucket of LAND_SOURCE_BUCKETS) {
        if (!landText.includes(bucket.key))
            continue;
        const landSourceBucket = landSources.get(bucket.key);
        landSourceBucket.count += amount;
        addBucketCardName(landSourceBucket, deckCardName);
    }
}
function getMetadataStatus(totalCardsNeedingMetadata, resolvedCards) {
    if (totalCardsNeedingMetadata === 0)
        return 'empty';
    if (resolvedCards === totalCardsNeedingMetadata)
        return 'complete';
    if (resolvedCards > 0)
        return 'partial';
    return 'unavailable';
}
export class DeckAnalyticsService {
    searchCards;
    cardCache = new Map();
    constructor(options = {}) {
        this.searchCards = options.searchCards ?? ((criteria) => wsService.searchCards(criteria));
    }
    async analyzeDeck(deck) {
        const mainCards = deck?.cards ?? [];
        const sideboardCards = deck?.sideboard ?? [];
        const totals = {
            mainCount: countCards(mainCards),
            sideboardCount: countCards(sideboardCards),
            totalCount: countCards(mainCards) + countCards(sideboardCards),
            uniqueMainCount: countUniqueNames(mainCards),
            uniqueSideboardCount: countUniqueNames(sideboardCards),
            uniqueTotalCount: countUniqueNames([...mainCards, ...sideboardCards]),
        };
        const format = resolveFormat(deck?.format);
        const formatTarget = {
            deckType: format.deckType,
            shortName: format.shortName,
            minMain: format.minMain,
            maxSideboard: format.maxSideboard,
            remainingMain: Math.max(0, format.minMain - totals.mainCount),
            sideboardOver: Math.max(0, totals.sideboardCount - format.maxSideboard),
        };
        const [resolvedCards, resolvedSideboardCards] = await Promise.all([
            Promise.all(mainCards.map(card => this.resolveDeckCard(card))),
            Promise.all(sideboardCards.map(card => this.resolveDeckCard(card))),
        ]);
        const allResolvedCards = [...resolvedCards, ...resolvedSideboardCards];
        const metadataCards = allResolvedCards.filter(card => card.metadata);
        const unresolvedCardNames = Array.from(new Set(allResolvedCards
            .filter(card => !card.metadata)
            .map(card => card.deckCard.cardName)
            .filter(Boolean)));
        return {
            totals,
            formatTarget,
            ...this.buildMetadataAnalytics(resolvedCards),
            metadataStatus: getMetadataStatus(mainCards.length + sideboardCards.length, metadataCards.length),
            unresolvedCardNames,
        };
    }
    buildMetadataAnalytics(cards) {
        const colors = createBucketMap(COLOR_BUCKETS);
        const types = createBucketMap(TYPE_BUCKETS);
        const curve = createBucketMap(CURVE_BUCKETS);
        const manaPips = createBucketMap(COLOR_BUCKETS);
        const landSources = createBucketMap(LAND_SOURCE_BUCKETS);
        const manaSources = createBucketMap(COLOR_BUCKETS);
        const manaDistribution = new Map();
        let nonLandCount = 0;
        let manaValueTotal = 0;
        for (const { deckCard, metadata } of cards) {
            if (!metadata)
                continue;
            const amount = deckCard.amount;
            const cardTypes = new Set(metadata.cardTypes);
            const matchedTypes = TYPE_BUCKETS.filter(bucket => bucket.type && cardTypes.has(bucket.type));
            for (const bucket of matchedTypes) {
                const typeBucket = types.get(bucket.key);
                typeBucket.count += amount;
                addBucketCardName(typeBucket, deckCard.cardName);
            }
            if (matchedTypes.length === 0) {
                const otherBucket = types.get('other');
                otherBucket.count += amount;
                addBucketCardName(otherBucket, deckCard.cardName);
            }
            addCardColors(colors, metadata, amount, deckCard.cardName);
            addManaSources(manaSources, metadata, amount, deckCard.cardName);
            if (!cardTypes.has('LAND')) {
                const curveBucket = curve.get(getCurveBucket(metadata.manaValue));
                nonLandCount += amount;
                manaValueTotal += metadata.manaValue * amount;
                curveBucket.count += amount;
                addBucketCardName(curveBucket, deckCard.cardName);
                addManaPips(manaPips, metadata, amount, deckCard.cardName);
                addManaDistribution(manaDistribution, metadata, amount, deckCard.cardName);
            }
            else {
                addLandSources(landSources, metadata, amount, deckCard.cardName);
            }
        }
        return {
            colors: Array.from(colors.values()),
            typeCounts: Array.from(types.values()),
            manaCurve: Array.from(curve.values()),
            manaPips: Array.from(manaPips.values()),
            landSources: Array.from(landSources.values()),
            manaSources: Array.from(manaSources.values()),
            manaDistribution: Array.from(manaDistribution.values()).sort((left, right) => Number(left.key) - Number(right.key)),
            averageManaValue: nonLandCount > 0 ? Number((manaValueTotal / nonLandCount).toFixed(2)) : null,
            nonLandCount,
        };
    }
    async resolveDeckCard(card) {
        return {
            deckCard: card,
            metadata: await this.findExactCard(card),
        };
    }
    async findExactCard(card) {
        const key = `${normalizeCardName(card.cardName)}|${card.setCode ?? ''}|${card.cardNumber ?? ''}`;
        if (!this.cardCache.has(key)) {
            this.cardCache.set(key, this.searchCards({
                nameContains: card.cardName,
                count: 100,
            }).then(cards => {
                const exactCards = cards.filter(candidate => hasExactName(candidate, card.cardName));
                return exactCards.find(candidate => hasExactPrinting(candidate, card)) ?? exactCards[0] ?? null;
            }).catch(() => null));
        }
        return this.cardCache.get(key);
    }
}
export const deckAnalyticsService = new DeckAnalyticsService();
