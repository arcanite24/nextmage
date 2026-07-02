import { DEFAULT_DECK_GENERATOR_SETTINGS, } from './AppConfigService.js';
import { BASIC_LANDS } from './DeckLandsService.js';
import { wsService } from './WebSocketService.js';
const DEFAULT_CREATURE_PERCENTAGE = 38;
const DEFAULT_NON_CREATURE_PERCENTAGE = 21;
const DEFAULT_LAND_PERCENTAGE = 41;
const MAX_GENERATOR_TRIES = 8196;
const COLOR_DEFINITIONS = [
    { key: 'white', symbol: 'W', basicLand: 'Plains' },
    { key: 'blue', symbol: 'U', basicLand: 'Island' },
    { key: 'black', symbol: 'B', basicLand: 'Swamp' },
    { key: 'red', symbol: 'R', basicLand: 'Mountain' },
    { key: 'green', symbol: 'G', basicLand: 'Forest' },
];
const CMC_PROFILES = {
    Low: {
        100: [{ min: 0, max: 2, percentage: 0.55 }, { min: 3, max: 4, percentage: 0.30 }, { min: 5, max: 6, percentage: 0.15 }],
        60: [{ min: 0, max: 2, percentage: 0.60 }, { min: 3, max: 4, percentage: 0.30 }, { min: 5, max: 6, percentage: 0.10 }],
        40: [{ min: 0, max: 2, percentage: 0.65 }, { min: 3, max: 4, percentage: 0.30 }, { min: 5, max: 5, percentage: 0.05 }],
    },
    Default: {
        100: [{ min: 0, max: 2, percentage: 0.15 }, { min: 3, max: 5, percentage: 0.50 }, { min: 6, max: 7, percentage: 0.30 }, { min: 8, max: 100, percentage: 0.05 }],
        60: [{ min: 0, max: 2, percentage: 0.20 }, { min: 3, max: 5, percentage: 0.50 }, { min: 6, max: 7, percentage: 0.25 }, { min: 8, max: 100, percentage: 0.05 }],
        40: [{ min: 0, max: 2, percentage: 0.30 }, { min: 3, max: 4, percentage: 0.45 }, { min: 5, max: 6, percentage: 0.20 }, { min: 7, max: 100, percentage: 0.05 }],
    },
    High: {
        100: [{ min: 0, max: 2, percentage: 0.05 }, { min: 3, max: 5, percentage: 0.40 }, { min: 6, max: 7, percentage: 0.40 }, { min: 8, max: 100, percentage: 0.15 }],
        60: [{ min: 0, max: 2, percentage: 0.05 }, { min: 3, max: 5, percentage: 0.35 }, { min: 6, max: 7, percentage: 0.40 }, { min: 8, max: 100, percentage: 0.15 }],
        40: [{ min: 0, max: 2, percentage: 0.10 }, { min: 3, max: 4, percentage: 0.30 }, { min: 5, max: 6, percentage: 0.45 }, { min: 7, max: 100, percentage: 0.15 }],
    },
};
function normalizeText(value) {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function countDeckCards(cards) {
    return cards.reduce((sum, card) => sum + card.amount, 0);
}
function hasCardType(card, type) {
    return card.cardTypes.includes(type);
}
function hasSuperType(card, superType) {
    return card.superTypes.includes(superType);
}
function colorKeysFromObject(color) {
    if (!color)
        return [];
    return COLOR_DEFINITIONS
        .filter(definition => color[definition.key])
        .map(definition => definition.key);
}
function cardColorKeys(card) {
    const colorKeys = colorKeysFromObject(card.color);
    return colorKeys.length > 0 ? colorKeys : colorKeysFromObject(card.frameColor);
}
function colorKeysFromSymbolText(value) {
    const symbolText = (value ?? '').toUpperCase();
    return COLOR_DEFINITIONS
        .filter(definition => symbolText.includes(definition.symbol))
        .map(definition => definition.key);
}
function cardManaSymbolColorKeys(card) {
    const colors = new Set();
    const manaCostSources = [
        ...(card.manaCostLeftStr ?? []),
        ...(card.manaCostRightStr ?? []),
    ];
    for (const source of manaCostSources) {
        const explicitSymbols = [...source.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
        const symbols = explicitSymbols.length > 0 ? explicitSymbols : [source];
        for (const symbol of symbols) {
            for (const color of colorKeysFromSymbolText(symbol)) {
                colors.add(color);
            }
        }
    }
    for (const rulesText of card.rules) {
        for (const match of rulesText.matchAll(/\{([^}]+)\}/g)) {
            for (const color of colorKeysFromSymbolText(match[1])) {
                colors.add(color);
            }
        }
    }
    return [...colors];
}
function cardColorIdentityKeys(card) {
    return Array.from(new Set([
        ...cardColorKeys(card),
        ...cardManaSymbolColorKeys(card),
    ]));
}
function cardFitsColors(card, selectedColors, includeColorless) {
    const colors = cardColorIdentityKeys(card);
    if (colors.length === 0)
        return includeColorless || hasCardType(card, 'LAND');
    const allowed = new Set(selectedColors);
    return colors.every(color => allowed.has(color));
}
function isCommanderCandidate(card, selectedColors) {
    if (!hasCardType(card, 'CREATURE') || !hasSuperType(card, 'LEGENDARY'))
        return false;
    const cardColors = new Set(cardColorKeys(card));
    return selectedColors.every(color => cardColors.has(color));
}
function isBasicLand(card) {
    return hasCardType(card, 'LAND') && hasSuperType(card, 'BASIC');
}
function toDeckCard(card, amount = 1) {
    return {
        amount,
        cardName: card.name,
        setCode: card.expansionSetCode,
        cardNumber: card.cardNumber,
    };
}
function printingKey(card) {
    return `${normalizeText(card.name)}|${card.expansionSetCode.toUpperCase()}|${card.cardNumber.toLowerCase()}`;
}
function cardIdentity(card) {
    return normalizeText('name' in card ? card.name : card.cardName);
}
function normalizeSetCode(value) {
    const normalized = (value ?? '').trim().toUpperCase();
    return /^[A-Z0-9]{2,8}$/.test(normalized) ? normalized : null;
}
function createFallbackSearchScope(format) {
    const trimmed = format.trim();
    const setCode = normalizeSetCode(trimmed);
    return setCode ? { setCodes: [setCode] } : { format: trimmed };
}
function createAuthoritativeSearchScope(format, deckTypes, expansionSets) {
    const trimmed = format.trim();
    const normalizedFormat = normalizeText(trimmed);
    const matchingDeckType = deckTypes.find(deckType => normalizeText(deckType) === normalizedFormat);
    if (matchingDeckType)
        return { format: matchingDeckType };
    const requestedSetCode = normalizeSetCode(trimmed);
    if (requestedSetCode) {
        const knownSet = expansionSets.find(set => normalizeSetCode(set.setCode) === requestedSetCode);
        if (knownSet)
            return { setCodes: [knownSet.setCode.toUpperCase()] };
    }
    return { format: trimmed };
}
function uniqueByPrinting(cards) {
    const seen = new Set();
    const uniqueCards = [];
    for (const card of cards) {
        const key = printingKey(card);
        if (seen.has(key))
            continue;
        seen.add(key);
        uniqueCards.push(card);
    }
    return uniqueCards;
}
function shuffle(items, random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}
function resolveSelectedColors(settings, random) {
    const selected = settings.colors.length > 0 ? [...settings.colors] : [...DEFAULT_DECK_GENERATOR_SETTINGS.colors];
    if (!settings.randomColor)
        return selected;
    const missingColors = COLOR_DEFINITIONS
        .map(definition => definition.key)
        .filter(color => !selected.includes(color));
    if (missingColors.length === 0)
        return selected;
    selected.push(missingColors[Math.floor(random() * missingColors.length)]);
    return selected;
}
function computeTargets(settings) {
    const creaturePercentage = settings.advanced ? settings.creaturePercentage : DEFAULT_CREATURE_PERCENTAGE;
    const nonCreaturePercentage = settings.advanced ? settings.nonCreaturePercentage : DEFAULT_NON_CREATURE_PERCENTAGE;
    const landPercentage = settings.advanced ? settings.landPercentage : DEFAULT_LAND_PERCENTAGE;
    const targets = {
        creatureCount: Math.ceil(settings.deckSize * (creaturePercentage / 100)),
        nonCreatureCount: Math.ceil(settings.deckSize * (nonCreaturePercentage / 100)),
        landCount: Math.ceil(settings.deckSize * (landPercentage / 100)),
    };
    while (targets.creatureCount + targets.nonCreatureCount + targets.landCount > settings.deckSize) {
        const largestKey = targets.landCount >= targets.creatureCount && targets.landCount >= targets.nonCreatureCount
            ? 'landCount'
            : targets.creatureCount >= targets.nonCreatureCount
                ? 'creatureCount'
                : 'nonCreatureCount';
        targets[largestKey] = Math.max(0, targets[largestKey] - 1);
    }
    while (targets.creatureCount + targets.nonCreatureCount + targets.landCount < settings.deckSize) {
        targets.landCount += 1;
    }
    return targets;
}
function buildCmcNeeds(totalCards, settings) {
    const ranges = CMC_PROFILES[settings.cmcProfile][settings.deckSize].map(range => ({
        ...range,
        amount: Math.ceil(totalCards * range.percentage),
    }));
    while (ranges.reduce((sum, range) => sum + range.amount, 0) > totalCards) {
        const largest = ranges.reduce((best, range) => range.amount > best.amount ? range : best, ranges[0]);
        largest.amount = Math.max(0, largest.amount - 1);
    }
    return ranges;
}
function addCardCopy(cards, card, countsByName, copyLimit) {
    const key = cardIdentity(card);
    const currentCount = countsByName.get(key) ?? 0;
    if (currentCount >= copyLimit)
        return false;
    const existing = cards.find(deckCard => (cardIdentity(deckCard) === key
        && (deckCard.setCode ?? '').toUpperCase() === card.expansionSetCode.toUpperCase()
        && (deckCard.cardNumber ?? '').toLowerCase() === card.cardNumber.toLowerCase()));
    if (existing) {
        existing.amount += 1;
    }
    else {
        cards.push(toDeckCard(card));
    }
    countsByName.set(key, currentCount + 1);
    return true;
}
function takeCardsForCurve(pool, count, settings, countsByName, random) {
    const selectedCards = [];
    const reserveCards = [];
    const reserveNames = new Set();
    const copyLimit = settings.singleton || settings.commander ? 1 : 4;
    const shuffledPool = shuffle(pool, random);
    const cmcNeeds = buildCmcNeeds(count, settings);
    const maxReserveCount = Math.floor(settings.deckSize / 2);
    const rememberReserve = (card) => {
        const key = cardIdentity(card);
        if (reserveCards.length >= maxReserveCount || reserveNames.has(key) || (countsByName.get(key) ?? 0) > 0)
            return;
        if (card.manaValue >= 7)
            return;
        reserveNames.add(key);
        reserveCards.push(card);
    };
    for (const cmcNeed of cmcNeeds) {
        let madeProgress = true;
        while (countDeckCards(selectedCards) < count && cmcNeed.amount > 0 && madeProgress) {
            madeProgress = false;
            for (const card of shuffledPool) {
                if (countDeckCards(selectedCards) >= count || cmcNeed.amount <= 0)
                    break;
                if (card.manaValue < cmcNeed.min || card.manaValue > cmcNeed.max) {
                    rememberReserve(card);
                    continue;
                }
                if (addCardCopy(selectedCards, card, countsByName, copyLimit)) {
                    cmcNeed.amount -= 1;
                    madeProgress = true;
                }
            }
        }
    }
    return { cards: selectedCards, reserveCards };
}
function fixSpellCountFromReserve(selectedCards, reserveCards, targetCount, settings, countsByName, random) {
    const result = [...selectedCards];
    let needed = Math.max(0, targetCount - countDeckCards(result));
    const possibleReserves = shuffle(reserveCards, random);
    const copyLimit = settings.singleton || settings.commander ? 1 : 4;
    for (const card of possibleReserves) {
        if (needed <= 0)
            break;
        if (addCardCopy(result, card, countsByName, copyLimit)) {
            needed -= 1;
        }
    }
    return result;
}
function removeSingleDeckCard(cards, card) {
    const key = cardIdentity(card);
    const expectedSet = card.expansionSetCode.toUpperCase();
    const expectedNumber = card.cardNumber.toLowerCase();
    const result = [];
    let removed = false;
    for (const deckCard of cards) {
        const isMatch = !removed
            && cardIdentity(deckCard) === key
            && (deckCard.setCode ?? '').toUpperCase() === expectedSet
            && (deckCard.cardNumber ?? '').toLowerCase() === expectedNumber;
        if (!isMatch) {
            result.push(deckCard);
            continue;
        }
        removed = true;
        if (deckCard.amount > 1) {
            result.push({ ...deckCard, amount: deckCard.amount - 1 });
        }
    }
    return result;
}
function addReserveCandidate(reserveCards, reserveNames, maxReserveCount, countsByName, card) {
    const key = cardIdentity(card);
    if (reserveCards.length >= maxReserveCount || reserveNames.has(key) || (countsByName.get(key) ?? 0) > 0)
        return;
    if (card.manaValue >= 7)
        return;
    reserveNames.add(key);
    reserveCards.push(card);
}
function fillCurveSelection(pool, count, settings, selectedCards, reserveCards, reserveNames, cmcNeeds, countsByName, random) {
    const copyLimit = settings.singleton || settings.commander ? 1 : 4;
    const shuffledPool = shuffle(pool, random);
    const maxReserveCount = Math.floor(settings.deckSize / 2);
    for (const cmcNeed of cmcNeeds) {
        let madeProgress = true;
        while (countDeckCards(selectedCards) < count && cmcNeed.amount > 0 && madeProgress) {
            madeProgress = false;
            for (const card of shuffledPool) {
                if (countDeckCards(selectedCards) >= count || cmcNeed.amount <= 0)
                    break;
                if (card.manaValue < cmcNeed.min || card.manaValue > cmcNeed.max) {
                    addReserveCandidate(reserveCards, reserveNames, maxReserveCount, countsByName, card);
                    continue;
                }
                if (addCardCopy(selectedCards, card, countsByName, copyLimit)) {
                    cmcNeed.amount -= 1;
                    madeProgress = true;
                }
            }
        }
    }
}
function takeCommanderCardsForCurve(pool, count, settings, countsByName, random, selectedColors) {
    const commanders = pool.filter(card => isCommanderCandidate(card, selectedColors));
    if (commanders.length === 0) {
        return { ...takeCardsForCurve(pool, count, settings, countsByName, random), commander: null };
    }
    const commanderAttempts = shuffle(commanders, random).slice(0, MAX_GENERATOR_TRIES);
    for (const commander of commanderAttempts) {
        const attemptCounts = new Map(countsByName);
        const selectedCards = [];
        const reserveCards = [];
        const reserveNames = new Set();
        const cmcNeeds = buildCmcNeeds(count, settings);
        const commanderNeed = cmcNeeds.find(cmcNeed => (cmcNeed.amount > 0
            && commander.manaValue >= cmcNeed.min
            && commander.manaValue <= cmcNeed.max));
        if (!commanderNeed)
            continue;
        if (!addCardCopy(selectedCards, commander, attemptCounts, 1))
            continue;
        commanderNeed.amount -= 1;
        fillCurveSelection(pool, count, settings, selectedCards, reserveCards, reserveNames, cmcNeeds, attemptCounts, random);
        countsByName.clear();
        for (const [key, amount] of attemptCounts) {
            countsByName.set(key, amount);
        }
        return {
            cards: removeSingleDeckCard(selectedCards, commander),
            reserveCards,
            commander: toDeckCard(commander),
        };
    }
    return { ...takeCardsForCurve(pool, count, settings, countsByName, random), commander: null };
}
function findExactCard(cards, cardName) {
    const expected = normalizeText(cardName);
    return cards.find(card => normalizeText(card.name) === expected || normalizeText(card.displayName) === expected) ?? null;
}
function findGeneratedMetadata(card, sourceCards) {
    const expectedName = cardIdentity(card);
    const expectedSet = (card.setCode ?? '').toUpperCase();
    const expectedNumber = (card.cardNumber ?? '').toLowerCase();
    return sourceCards.find(source => (cardIdentity(source) === expectedName
        && source.expansionSetCode.toUpperCase() === expectedSet
        && source.cardNumber.toLowerCase() === expectedNumber)) ?? sourceCards.find(source => cardIdentity(source) === expectedName) ?? null;
}
function manaCostSymbols(card) {
    if (!card)
        return [];
    return [
        ...(card.manaCostLeftStr ?? []),
        ...(card.manaCostRightStr ?? []),
    ];
}
function countSpellManaSymbols(spellCards, sourceCards, selectedColors) {
    const colors = selectedColors.length > 0 ? selectedColors : DEFAULT_DECK_GENERATOR_SETTINGS.colors;
    const counts = new Map(colors.map(color => [color, 0]));
    for (const spellCard of spellCards) {
        const metadata = findGeneratedMetadata(spellCard, sourceCards);
        for (const symbolText of manaCostSymbols(metadata)) {
            const normalizedSymbol = symbolText.replace(/[{}]/g, '').toUpperCase();
            for (const definition of COLOR_DEFINITIONS) {
                if (!counts.has(definition.key) || !normalizedSymbol.includes(definition.symbol))
                    continue;
                counts.set(definition.key, (counts.get(definition.key) ?? 0) + spellCard.amount);
            }
        }
    }
    return counts;
}
function calculateSpellColorPercentages(spellCards, sourceCards, selectedColors) {
    const colors = selectedColors.length > 0 ? selectedColors : DEFAULT_DECK_GENERATOR_SETTINGS.colors;
    const counts = countSpellManaSymbols(spellCards, sourceCards, colors);
    const total = [...counts.values()].reduce((sum, amount) => sum + amount, 0);
    if (total <= 0) {
        const evenPercentage = 100 / colors.length;
        return new Map(colors.map(color => [color, evenPercentage]));
    }
    return new Map(colors.map(color => [color, ((counts.get(color) ?? 0) / total) * 100]));
}
function landProducesSelectedColor(card, color) {
    const symbol = COLOR_DEFINITIONS.find(definition => definition.key === color)?.symbol;
    if (!symbol)
        return false;
    const text = card.rules.join('@');
    return new RegExp(`Add\\s+\\{${symbol}\\}`, 'i').test(text);
}
function landProducesMultipleSelectedColors(card, selectedColors) {
    if (selectedColors.length <= 1)
        return false;
    const producedColors = selectedColors.filter(color => landProducesSelectedColor(card, color));
    return producedColors.length > 1;
}
function countNonBasicProducedMana(nonBasicLands, selectedColors) {
    const colors = selectedColors.length > 0 ? selectedColors : DEFAULT_DECK_GENERATOR_SETTINGS.colors;
    const counts = new Map(colors.map(color => [color, 0]));
    for (const land of nonBasicLands) {
        for (const color of colors) {
            if (!landProducesSelectedColor(land, color))
                continue;
            counts.set(color, (counts.get(color) ?? 0) + 1);
        }
    }
    return counts;
}
function distributeBasicLandsByNeed(total, spellColorPercentages, producedManaCounts, selectedColors) {
    if (total <= 0)
        return [];
    const colors = selectedColors.length > 0 ? selectedColors : DEFAULT_DECK_GENERATOR_SETTINGS.colors;
    const distribution = new Map(colors.map(color => [color, 0]));
    let producedTotal = [...producedManaCounts.values()].reduce((sum, amount) => sum + amount, 0);
    let remaining = total;
    while (remaining > 0) {
        let colorToAdd = null;
        let largestDeficit = Number.NEGATIVE_INFINITY;
        for (const color of colors) {
            const neededPercentage = spellColorPercentages.get(color) ?? 0;
            if (neededPercentage <= 0)
                continue;
            const currentCount = producedManaCounts.get(color) ?? 0;
            const currentPercentage = currentCount > 0 && producedTotal > 0
                ? (currentCount / producedTotal) * 100
                : 0;
            const deficit = neededPercentage - currentPercentage;
            if (deficit > largestDeficit) {
                colorToAdd = color;
                largestDeficit = deficit;
            }
        }
        if (!colorToAdd) {
            colorToAdd = colors[0];
        }
        distribution.set(colorToAdd, (distribution.get(colorToAdd) ?? 0) + 1);
        producedManaCounts.set(colorToAdd, (producedManaCounts.get(colorToAdd) ?? 0) + 1);
        producedTotal += 1;
        remaining -= 1;
    }
    return colors.map(color => ({ color, amount: distribution.get(color) ?? 0 }));
}
function filterPool(cards, settings, selectedColors, extraFilter) {
    const warnings = [];
    const filteredCards = uniqueByPrinting(cards)
        .filter(card => cardFitsColors(card, selectedColors, settings.includeColorless))
        .filter(card => settings.includeArtifacts || !hasCardType(card, 'ARTIFACT'))
        .filter(extraFilter);
    if (filteredCards.length === 0) {
        warnings.push('No cards matched one of the generator pools.');
    }
    return { cards: filteredCards, warnings };
}
function padNumber(value, length) {
    return String(value).padStart(length, '0');
}
function formatGeneratedDeckName(timestamp) {
    const date = new Date(timestamp);
    const hour12 = date.getHours() % 12 || 12;
    return [
        'Generated-Deck',
        padNumber(date.getDate(), 2),
        padNumber(date.getMonth() + 1, 2),
        date.getFullYear(),
        padNumber(hour12, 2),
        padNumber(date.getMinutes(), 2),
        padNumber(date.getSeconds(), 2),
        padNumber(date.getMilliseconds(), 3),
    ].join('-');
}
export class DeckGeneratorService {
    searchCards;
    listDeckTypes;
    listExpansionSets;
    random;
    now;
    searchTimeoutMs;
    constructor(options = {}) {
        this.searchCards = options.searchCards ?? ((criteria) => wsService.searchCards(criteria));
        this.listDeckTypes = options.listDeckTypes ?? (() => wsService.getDeckTypes());
        this.listExpansionSets = options.listExpansionSets ?? (() => wsService.getExpansionSets());
        this.random = options.random ?? Math.random;
        this.now = options.now ?? Date.now;
        this.searchTimeoutMs = options.searchTimeoutMs ?? 4_000;
    }
    async generateDeck(settings) {
        const selectedColors = resolveSelectedColors(settings, this.random);
        const searchScope = await this.createSearchScope(settings.format);
        const [creatureSearch, nonCreatureSearch, landSearch, basicLandSearch] = await Promise.all([
            this.searchCardsWithBudget({ ...searchScope, types: ['CREATURE'], notTypes: ['LAND'], count: 500, sortBy: 'name' }, 'Creature pool'),
            this.searchCardsWithBudget({ ...searchScope, notTypes: ['LAND', 'CREATURE'], count: 500, sortBy: 'name' }, 'Non-creature pool'),
            settings.includeNonBasicLands
                ? this.searchCardsWithBudget({ ...searchScope, types: ['LAND'], count: 300, sortBy: 'name' }, 'Non-basic land pool')
                : Promise.resolve({ cards: [], warnings: [] }),
            this.searchBasicLands(searchScope),
        ]);
        const warnings = [];
        warnings.push(...creatureSearch.warnings, ...nonCreatureSearch.warnings, ...landSearch.warnings, ...basicLandSearch.warnings);
        const targets = computeTargets(settings);
        const creaturePool = filterPool(creatureSearch.cards, settings, selectedColors, card => hasCardType(card, 'CREATURE') && !hasCardType(card, 'LAND'));
        const nonCreaturePool = filterPool(nonCreatureSearch.cards, settings, selectedColors, card => !hasCardType(card, 'CREATURE') && !hasCardType(card, 'LAND'));
        const nonBasicLandPool = filterPool(landSearch.cards, { ...settings, includeColorless: true }, selectedColors, card => hasCardType(card, 'LAND')
            && !isBasicLand(card)
            && landProducesMultipleSelectedColors(card, selectedColors));
        warnings.push(...creaturePool.warnings, ...nonCreaturePool.warnings);
        const countsByName = new Map();
        const sideboard = [];
        let selectedCommander = null;
        let creatureSelection;
        if (settings.commander) {
            const commanderSelection = takeCommanderCardsForCurve(creaturePool.cards, targets.creatureCount, settings, countsByName, this.random, selectedColors);
            creatureSelection = commanderSelection;
            selectedCommander = commanderSelection.commander;
            if (!selectedCommander)
                warnings.push('No legendary creature was found for the commander slot.');
        }
        else {
            creatureSelection = takeCardsForCurve(creaturePool.cards, targets.creatureCount, settings, countsByName, this.random);
        }
        if (selectedCommander) {
            sideboard.push(selectedCommander);
        }
        const targetMainCreatureCount = settings.commander && sideboard.length > 0
            ? Math.max(0, targets.creatureCount - 1)
            : targets.creatureCount;
        const creatures = fixSpellCountFromReserve(creatureSelection.cards, creatureSelection.reserveCards, targetMainCreatureCount, settings, countsByName, this.random);
        const nonCreatureSelection = takeCardsForCurve(nonCreaturePool.cards, targets.nonCreatureCount, settings, countsByName, this.random);
        const nonCreatures = fixSpellCountFromReserve(nonCreatureSelection.cards, nonCreatureSelection.reserveCards, targets.nonCreatureCount, settings, countsByName, this.random);
        const selectedSpells = [...creatures, ...nonCreatures];
        const spellSources = [...creaturePool.cards, ...nonCreaturePool.cards];
        const lands = this.generateLands(targets.landCount, nonBasicLandPool.cards, basicLandSearch.cards, selectedColors, countsByName, settings, selectedSpells, spellSources);
        const cards = [...creatures, ...nonCreatures, ...lands];
        const mainCount = countDeckCards(cards);
        const expectedMainCount = settings.commander && sideboard.length > 0 ? settings.deckSize - 1 : settings.deckSize;
        if (mainCount < expectedMainCount) {
            warnings.push(`Generated ${mainCount}/${expectedMainCount} main-deck cards because the available pool was too small.`);
        }
        const generatedAt = this.now();
        const deckName = formatGeneratedDeckName(generatedAt);
        return {
            deck: {
                name: deckName,
                description: `Generated from ${settings.format} (${settings.deckSize} cards, ${selectedColors.join('/')})`,
                format: settings.format,
                cards,
                sideboard,
                createdAt: generatedAt,
                updatedAt: generatedAt,
            },
            selectedColors,
            warnings: Array.from(new Set(warnings)),
        };
    }
    async createSearchScope(format) {
        const [deckTypesResult, expansionSetsResult] = await Promise.allSettled([
            this.resolveWithBudget(this.listDeckTypes(), null),
            this.resolveWithBudget(this.listExpansionSets(), null),
        ]);
        const deckTypes = deckTypesResult.status === 'fulfilled' ? deckTypesResult.value : null;
        const expansionSets = expansionSetsResult.status === 'fulfilled' ? expansionSetsResult.value : null;
        if (deckTypes !== null || expansionSets !== null) {
            return createAuthoritativeSearchScope(format, deckTypes ?? [], expansionSets ?? []);
        }
        return createFallbackSearchScope(format);
    }
    async resolveWithBudget(promise, fallback) {
        promise.catch(() => undefined);
        if (this.searchTimeoutMs <= 0) {
            try {
                return await promise;
            }
            catch {
                return fallback;
            }
        }
        let timeoutId;
        const timeoutPromise = new Promise((resolve) => {
            timeoutId = setTimeout(() => resolve(fallback), this.searchTimeoutMs);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        }
        catch {
            return fallback;
        }
        finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    }
    async searchCardsWithBudget(criteria, label) {
        const searchPromise = this.searchCards(criteria);
        searchPromise.catch(() => undefined);
        if (this.searchTimeoutMs <= 0) {
            try {
                return { cards: await searchPromise, warnings: [] };
            }
            catch {
                return { cards: [], warnings: [`${label} search failed; generated deck may be incomplete.`] };
            }
        }
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Deck generator search timed out')), this.searchTimeoutMs);
        });
        try {
            return { cards: await Promise.race([searchPromise, timeoutPromise]), warnings: [] };
        }
        catch (error) {
            const didTimeout = error instanceof Error && error.message === 'Deck generator search timed out';
            return {
                cards: [],
                warnings: [`${label} search ${didTimeout ? 'timed out' : 'failed'}; generated deck may be incomplete.`],
            };
        }
        finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    }
    async searchBasicLands(searchScope) {
        const results = await Promise.all(BASIC_LANDS.map(land => (this.searchCardsWithBudget({
            ...searchScope,
            nameContains: land.cardName,
            types: ['LAND'],
            count: 100,
        }, `${land.label} basic land`))));
        return {
            cards: results.flatMap(result => result.cards),
            warnings: results.flatMap(result => result.warnings),
        };
    }
    generateLands(landCount, nonBasicLands, basicLands, selectedColors, countsByName, settings, selectedSpells, spellSources) {
        const lands = [];
        const selectedNonBasicLands = [];
        const copyLimit = settings.singleton || settings.commander ? 1 : 4;
        const maxNonBasics = settings.includeNonBasicLands && selectedColors.length > 1 ? Math.floor(landCount / 2) : 0;
        const shuffledNonBasicLands = shuffle(nonBasicLands, this.random);
        let madeNonBasicProgress = true;
        while (countDeckCards(lands) < maxNonBasics && madeNonBasicProgress) {
            madeNonBasicProgress = false;
            for (const land of shuffledNonBasicLands) {
                if (countDeckCards(lands) >= maxNonBasics)
                    break;
                if (addCardCopy(lands, land, countsByName, copyLimit)) {
                    selectedNonBasicLands.push(land);
                    madeNonBasicProgress = true;
                }
            }
        }
        const basicsNeeded = Math.max(0, landCount - countDeckCards(lands));
        const spellColorPercentages = calculateSpellColorPercentages(selectedSpells, spellSources, selectedColors);
        const producedManaCounts = countNonBasicProducedMana(selectedNonBasicLands, selectedColors);
        for (const { color, amount } of distributeBasicLandsByNeed(basicsNeeded, spellColorPercentages, producedManaCounts, selectedColors)) {
            const definition = COLOR_DEFINITIONS.find(item => item.key === color);
            const resolvedLand = findExactCard(basicLands, definition.basicLand);
            const card = resolvedLand
                ? toDeckCard(resolvedLand, amount)
                : { cardName: definition.basicLand, amount };
            lands.push(card);
        }
        return lands.filter(card => card.amount > 0);
    }
}
export const deckGeneratorService = new DeckGeneratorService();
