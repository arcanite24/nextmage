const COLOR_KEYS = ['white', 'blue', 'black', 'red', 'green'];
const COLOR_SYMBOLS = {
    white: 'W',
    blue: 'U',
    black: 'B',
    red: 'R',
    green: 'G',
};
const PENNY_DREADFUL_SEARCH_FORMAT_FALLBACK = 'Variant Magic - Penny Dreadful Commander';
const PENNY_DREADFUL_FORMAT_CANDIDATES = [
    'Variant Magic - Penny Dreadful Commander',
    'Penny Dreadful Commander',
    'Penny Dreadful',
];
const RARITY_ORDER = {
    LAND: 0,
    COMMON: 1,
    UNCOMMON: 2,
    RARE: 3,
    MYTHIC: 4,
    SPECIAL: 5,
    BONUS: 6,
};
function normalizeText(value) {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function parseJavaSearchTokens(value) {
    const tokens = [];
    const pattern = /"([^"]*)"|(\S+)/g;
    const text = (value ?? '').toLowerCase();
    let match;
    while ((match = pattern.exec(text)) !== null) {
        tokens.push(match[1] ?? match[2]);
    }
    return tokens;
}
function javaTextHasTokens(text, tokens) {
    const searchingText = `${text}@${text.replace(/, /g, ' ')}`.toLowerCase();
    return tokens.every(token => searchingText.includes(token));
}
export function resolvePennyDreadfulSearchFormat(deckTypes = []) {
    const byNormalized = new Map(deckTypes
        .filter(Boolean)
        .map(format => [normalizeText(format), format]));
    for (const candidate of PENNY_DREADFUL_FORMAT_CANDIDATES) {
        const match = byNormalized.get(normalizeText(candidate));
        if (match)
            return match;
    }
    const fuzzyMatch = deckTypes.find(format => {
        const normalized = normalizeText(format);
        return normalized.includes('penny dreadful') && normalized.includes('commander');
    });
    return fuzzyMatch ?? PENNY_DREADFUL_SEARCH_FORMAT_FALLBACK;
}
function normalizeSetCode(value) {
    return (value ?? '').trim().toUpperCase();
}
function compareText(a, b) {
    return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base', numeric: true });
}
function selectedColors(colors) {
    return COLOR_KEYS.filter(color => colors[color]);
}
function cardColors(card) {
    return COLOR_KEYS.filter(color => card.color?.[color]);
}
function isColorless(card) {
    return cardColors(card).length === 0;
}
function colorSignature(card) {
    const colors = cardColors(card);
    return colors.length > 0 ? colors.map(color => COLOR_SYMBOLS[color]).join('') : 'C';
}
function colorSortRank(card) {
    const colors = cardColors(card);
    if (colors.length === 0)
        return 0;
    if (colors.length > 1)
        return 7;
    switch (colors[0]) {
        case 'black':
            return 1;
        case 'blue':
            return 2;
        case 'green':
            return 3;
        case 'red':
            return 4;
        case 'white':
            return 5;
        default:
            return 6;
    }
}
function colorCategoryLabel(card) {
    const colors = cardColors(card);
    return colors.length > 0 ? colors.map(color => `{${COLOR_SYMBOLS[color]}}`).join('') : '{C}';
}
function cardTypeCategoryLabel(card) {
    return (card.cardTypes ?? []).join(', ') || 'Unknown';
}
function collectorNumberValue(card) {
    const digits = (card.cardNumber ?? '').replace(/\D/g, '');
    return digits ? Number.parseInt(digits, 10) : Number.MAX_SAFE_INTEGER;
}
function collectorNumberCategoryLabel(card) {
    return card.cardNumber ? `No. ${card.cardNumber}` : 'No. Unknown';
}
function pileCategory(card, sortBy) {
    switch (sortBy) {
        case 'cardType':
            return cardTypeCategoryLabel(card);
        case 'manaValue':
            return `CMC: ${card.manaValue ?? 0}`;
        case 'color':
            return colorCategoryLabel(card);
        case 'rarity':
            return String(card.rarity ?? 'Unknown');
        case 'cardNumber':
            return collectorNumberCategoryLabel(card);
        case 'name':
        default:
            return card.name || card.displayName || 'Unknown';
    }
}
function cardMatchesColorMode(card, colors, mode) {
    const requestedColors = selectedColors(colors);
    const wantsColorless = colors.colorless;
    if (requestedColors.length === 0 && !wantsColorless)
        return true;
    const candidateColors = cardColors(card);
    const candidateColorSet = new Set(candidateColors);
    if (isColorless(card)) {
        return wantsColorless;
    }
    switch (mode) {
        case 'exact':
            return requestedColors.length === candidateColors.length
                && requestedColors.every(color => candidateColorSet.has(color));
        case 'include':
            return requestedColors.every(color => candidateColorSet.has(color));
        case 'any':
        default:
            return requestedColors.some(color => candidateColorSet.has(color));
    }
}
function hasExcludedColor(card, excludedColors) {
    const excluded = selectedColors(excludedColors);
    const candidateColors = cardColors(card);
    if (excludedColors.colorless && candidateColors.length === 0)
        return true;
    if (excluded.length === 0)
        return false;
    const candidateColorSet = new Set(candidateColors);
    return excluded.some(color => candidateColorSet.has(color));
}
function hasAnyType(card, types) {
    if (types.length === 0)
        return true;
    const cardTypes = new Set(card.cardTypes);
    return types.some(type => cardTypes.has(type));
}
function hasExcludedType(card, excludedTypes) {
    if (excludedTypes.length === 0)
        return false;
    const cardTypes = new Set(card.cardTypes);
    return excludedTypes.some(type => cardTypes.has(type));
}
function hasIncludedRarity(card, rarities) {
    return rarities.length === 0 || rarities.includes(String(card.rarity));
}
function hasExcludedRarity(card, rarities) {
    return rarities.includes(String(card.rarity));
}
function matchesRules(card, rulesContains) {
    const query = normalizeText(rulesContains);
    if (!query)
        return true;
    return normalizeText(card.rules.join(' ')).includes(query);
}
function cardTypeSearchText(card) {
    return [
        ...(card.cardTypes ?? []),
        ...(card.subTypes ?? []),
        ...(card.superTypes ?? []),
    ].join('@');
}
function cardManaCostSearchText(card) {
    return [
        ...(card.manaCostLeftStr ?? []),
        ...(card.manaCostRightStr ?? []),
    ].join('@');
}
function matchesJavaTextSearch(card, filters) {
    const query = filters.searchText || filters.nameContains;
    const tokens = parseJavaSearchTokens(query);
    if (tokens.length === 0)
        return true;
    if (filters.searchNames && javaTextHasTokens(card.displayName || card.name, tokens))
        return true;
    if (filters.searchRules && javaTextHasTokens(card.rules.join('@'), tokens))
        return true;
    if (filters.searchRules && javaTextHasTokens(cardManaCostSearchText(card), tokens))
        return true;
    if (filters.searchTypes && javaTextHasTokens(cardTypeSearchText(card), tokens))
        return true;
    return false;
}
function matchesSetCodes(card, setCodes) {
    return setCodes.length === 0 || setCodes.includes(normalizeSetCode(card.expansionSetCode));
}
function matchesManaValue(card, manaValue, operator) {
    if (manaValue === null)
        return true;
    const value = Number.isFinite(card.manaValue) ? card.manaValue : 0;
    switch (operator) {
        case 'lte':
            return value <= manaValue;
        case 'gte':
            return value >= manaValue;
        case 'eq':
        default:
            return value === manaValue;
    }
}
function addReportEntry(report, entry) {
    if (entry.provenance === 'client-presentation') {
        report.clientPresentation.push(entry);
    }
    else if (entry.provenance === 'server-with-client-fallback') {
        report.clientFallbacks.push(entry);
    }
    else {
        report.serverBacked.push(entry);
    }
}
function uniqueByName(cards) {
    const seen = new Set();
    const uniqueCards = [];
    for (const card of cards) {
        const key = card.name;
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        uniqueCards.push(card);
    }
    return uniqueCards;
}
function compareSearchCards(a, b, sortBy) {
    switch (sortBy) {
        case 'manaValue':
            return (a.manaValue ?? 0) - (b.manaValue ?? 0) || compareText(a.name, b.name);
        case 'cardType':
            return compareText(cardTypeCategoryLabel(a), cardTypeCategoryLabel(b)) || compareText(a.name, b.name);
        case 'color':
            return colorSortRank(a) - colorSortRank(b)
                || compareText(colorSignature(a), colorSignature(b))
                || compareText(a.name, b.name);
        case 'rarity':
            return (RARITY_ORDER[String(a.rarity)] ?? 0) - (RARITY_ORDER[String(b.rarity)] ?? 0) || compareText(a.name, b.name);
        case 'cardNumber':
            return collectorNumberValue(a) - collectorNumberValue(b)
                || compareText(a.cardNumber, b.cardNumber)
                || compareText(a.expansionSetCode, b.expansionSetCode)
                || compareText(a.name, b.name);
        case 'name':
        default:
            return compareText(a.name, b.name);
    }
}
export function sortSearchResults(results, filters) {
    const direction = filters.sortDirection === 'desc' ? -1 : 1;
    return [...results].sort((a, b) => compareSearchCards(a, b, filters.sortBy) * direction);
}
export function createSearchResultPiles(results, filters) {
    const sortedResults = sortSearchResults(results, filters);
    const piles = [];
    for (const card of sortedResults) {
        const label = pileCategory(card, filters.sortBy);
        const key = normalizeText(label) || 'unknown';
        const lastPile = piles[piles.length - 1];
        if (lastPile?.key === key) {
            lastPile.cards.push(card);
        }
        else {
            piles.push({ key, label, cards: [card] });
        }
    }
    return piles;
}
export function buildCardSearchCriteria(filters, options) {
    const criteria = {
        count: options.count ?? 200,
        sortBy: options.sortBy === 'cardType' ? 'name' : options.sortBy,
    };
    const selected = selectedColors(filters.colors);
    const format = filters.pennyDreadful
        ? (filters.format || resolvePennyDreadfulSearchFormat(options.deckTypes))
        : filters.format || (filters.useDeckFormat ? options.deckFormat : undefined);
    const searchText = filters.searchText || filters.nameContains;
    const searchTokens = parseJavaSearchTokens(searchText);
    const canServerNarrowText = searchTokens.length === 1 && searchTokens[0] === normalizeText(searchText);
    const canNarrowByName = canServerNarrowText && filters.searchNames && !filters.searchTypes && !filters.searchRules;
    const canNarrowByRules = canServerNarrowText && filters.searchRules && !filters.searchNames && !filters.searchTypes;
    const needsBroadTextSearch = searchText && !canNarrowByName && !canNarrowByRules;
    if (canNarrowByName)
        criteria.nameContains = searchText;
    if (canNarrowByRules)
        criteria.rules = searchText;
    if (!searchText && filters.rulesContains)
        criteria.rules = filters.rulesContains;
    if (needsBroadTextSearch) {
        criteria.searchText = searchText;
        criteria.searchNames = filters.searchNames;
        criteria.searchTypes = filters.searchTypes;
        criteria.searchRules = filters.searchRules;
        criteria.uniqueNames = filters.uniqueNames;
        criteria.count = Math.max(criteria.count ?? 0, 1000);
    }
    if (format)
        criteria.format = format;
    if (filters.setCodes.length > 0)
        criteria.setCodes = filters.setCodes;
    if (filters.types.length > 0)
        criteria.types = filters.types;
    if (filters.excludedTypes.length > 0)
        criteria.notTypes = filters.excludedTypes;
    if (filters.rarities.length > 0)
        criteria.rarities = filters.rarities;
    if (filters.excludedRarities.length > 0)
        criteria.excludedRarities = filters.excludedRarities;
    if (filters.manaValue !== null && filters.manaValueOperator === 'eq')
        criteria.manaValue = filters.manaValue;
    if (filters.manaValue !== null && filters.manaValueOperator !== 'eq') {
        criteria.manaValue = filters.manaValue;
        criteria.manaValueOperator = filters.manaValueOperator;
    }
    if (selected.length > 0 || filters.colors.colorless) {
        criteria.webColors = [
            ...selected,
            ...(filters.colors.colorless ? ['colorless'] : []),
        ];
        criteria.colorMatch = filters.colorMatch;
    }
    const excluded = selectedColors(filters.excludedColors);
    if (excluded.length > 0 || filters.excludedColors.colorless) {
        criteria.webExcludedColors = [
            ...excluded,
            ...(filters.excludedColors.colorless ? ['colorless'] : []),
        ];
    }
    if (selected.length > 0 || filters.colors.colorless) {
        criteria.white = filters.colors.white;
        criteria.blue = filters.colors.blue;
        criteria.black = filters.colors.black;
        criteria.red = filters.colors.red;
        criteria.green = filters.colors.green;
        criteria.colorless = filters.colors.colorless;
    }
    return criteria;
}
export function describeCardSearchRefinements(filters, options) {
    const criteria = buildCardSearchCriteria(filters, options);
    const report = {
        serverBacked: [],
        clientFallbacks: [],
        clientPresentation: [],
    };
    if (criteria.nameContains) {
        addReportEntry(report, {
            key: 'name',
            label: 'Name text',
            provenance: 'server',
            reason: 'Sent as CardCriteria.nameContains for repository filtering.',
        });
    }
    if (criteria.rules) {
        addReportEntry(report, {
            key: 'rules',
            label: 'Rules text',
            provenance: 'server',
            reason: 'Sent as CardCriteria.rules for repository filtering.',
        });
    }
    if (criteria.searchText) {
        addReportEntry(report, {
            key: 'multiScopeText',
            label: 'Names/Types/Rules text',
            provenance: 'server-with-client-fallback',
            reason: 'Sent as searchText plus scope toggles; the WebSocket adapter applies the Java CardTextPredicate before paging and the client repeats it for older servers.',
        });
    }
    if (criteria.format) {
        addReportEntry(report, {
            key: filters.pennyDreadful ? 'pennyDreadful' : 'format',
            label: filters.pennyDreadful ? 'Penny Dreadful format' : 'Format',
            provenance: 'server',
            reason: 'Sent as CardCriteria.format so the repository/deck validator constrains legal sets.',
        });
    }
    if (criteria.setCodes?.length) {
        addReportEntry(report, {
            key: 'setCodes',
            label: 'Expansion sets',
            provenance: 'server',
            reason: 'Sent as CardCriteria.setCodes for repository filtering.',
        });
    }
    if (criteria.types?.length) {
        addReportEntry(report, {
            key: 'types',
            label: 'Included card types',
            provenance: 'server',
            reason: 'Sent as CardCriteria.types for repository filtering.',
        });
    }
    if (criteria.notTypes?.length) {
        addReportEntry(report, {
            key: 'excludedTypes',
            label: 'Excluded card types',
            provenance: 'server',
            reason: 'Sent as CardCriteria.notTypes for repository filtering.',
        });
    }
    if (criteria.rarities?.length) {
        addReportEntry(report, {
            key: 'rarities',
            label: 'Included rarities',
            provenance: 'server',
            reason: 'Sent as CardCriteria.rarities for repository filtering.',
        });
    }
    if (criteria.excludedRarities?.length) {
        addReportEntry(report, {
            key: 'excludedRarities',
            label: 'Excluded rarities',
            provenance: 'server-with-client-fallback',
            reason: 'Sent as excludedRarities; the WebSocket adapter filters before paging and the client repeats it for older servers.',
        });
    }
    if (criteria.webColors?.length) {
        addReportEntry(report, {
            key: 'colors',
            label: 'Color filters',
            provenance: 'server-with-client-fallback',
            reason: 'Sent as legacy color booleans plus webColors/colorMatch; the WebSocket adapter applies exact/include/any semantics before paging and the client repeats them for older servers.',
        });
    }
    if (criteria.webExcludedColors?.length) {
        addReportEntry(report, {
            key: 'excludedColors',
            label: 'Excluded colors',
            provenance: 'server-with-client-fallback',
            reason: 'Sent as webExcludedColors; the WebSocket adapter filters before paging and the client repeats it for older servers.',
        });
    }
    if (criteria.manaValue !== undefined) {
        addReportEntry(report, {
            key: 'manaValue',
            label: 'Mana value',
            provenance: criteria.manaValueOperator && criteria.manaValueOperator !== 'eq'
                ? 'server-with-client-fallback'
                : 'server',
            reason: criteria.manaValueOperator && criteria.manaValueOperator !== 'eq'
                ? 'Sent as manaValue plus manaValueOperator; the WebSocket adapter filters ranges before paging and the client repeats them for older servers.'
                : 'Sent as CardCriteria.manaValue for repository filtering.',
        });
    }
    if (filters.uniqueNames) {
        addReportEntry(report, {
            key: 'uniqueNames',
            label: 'Unique card names',
            provenance: criteria.searchText ? 'server-with-client-fallback' : 'client-presentation',
            reason: criteria.searchText
                ? 'Sent with broad Java text search so the server CardTextPredicate can de-duplicate, then repeated locally for cached results.'
                : 'Matches the Java grid presentation by collapsing already-returned alternate printings by raw card name.',
        });
    }
    addReportEntry(report, {
        key: 'sort',
        label: 'Collection sort',
        provenance: options.sortBy === 'name' ? 'server' : 'client-presentation',
        reason: options.sortBy === 'name'
            ? 'Name sort is safe to request from repository search.'
            : 'Matches the Java DragCardGrid/table presentation after the authoritative card pool has been fetched.',
    });
    if (filters.piles) {
        addReportEntry(report, {
            key: 'piles',
            label: 'Piles',
            provenance: 'client-presentation',
            reason: 'Matches the Java grid presentation by grouping visible results by the active sort category.',
        });
    }
    return report;
}
export function applyCardSearchFilters(results, filters) {
    const filteredResults = results.filter(card => (cardMatchesColorMode(card, filters.colors, filters.colorMatch)
        && !hasExcludedColor(card, filters.excludedColors)
        && hasAnyType(card, filters.types)
        && !hasExcludedType(card, filters.excludedTypes)
        && hasIncludedRarity(card, filters.rarities)
        && !hasExcludedRarity(card, filters.excludedRarities)
        && matchesJavaTextSearch(card, filters)
        && (!filters.searchText ? matchesRules(card, filters.rulesContains) : true)
        && matchesSetCodes(card, filters.setCodes)
        && matchesManaValue(card, filters.manaValue, filters.manaValueOperator)));
    return filters.uniqueNames ? uniqueByName(filteredResults) : filteredResults;
}
