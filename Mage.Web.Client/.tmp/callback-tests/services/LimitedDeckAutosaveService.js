function countCards(deck) {
    return deck.cards.reduce((sum, card) => sum + card.amount, 0)
        + deck.sideboard.reduce((sum, card) => sum + card.amount, 0);
}
function autosaveTimestamp(now) {
    return new Date(now).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}
function sourceLabel(activityId) {
    return activityId?.trim() ? activityId.trim().slice(0, 8) : 'unknown';
}
export function shouldAutosaveLimitedDeck(deck) {
    return Boolean(deck && countCards(deck) > 0);
}
export function limitedDeckAutosaveName(options) {
    const source = sourceLabel(options.activityId);
    if (options.kind === 'sideboard' || options.limitedSideboard) {
        return `Limited Sideboard Autosave ${source}`;
    }
    return `Limited Construction Autosave ${source}`;
}
export function buildLimitedDeckAutosaveDeck(deck, options) {
    const now = options.now ?? Date.now();
    const source = sourceLabel(options.activityId);
    const totalCount = countCards(deck);
    const kindLabel = options.kind === 'sideboard' || options.limitedSideboard
        ? 'limited sideboarding'
        : 'limited construction';
    return {
        ...deck,
        id: undefined,
        name: limitedDeckAutosaveName(options),
        description: [
            `Autosaved from ${kindLabel} ${source} at ${autosaveTimestamp(now)}.`,
            `${totalCount} card${totalCount === 1 ? '' : 's'} preserved from the live limited deck activity.`,
            deck.description,
        ].filter(Boolean).join(' '),
        format: deck.format || 'Limited',
        createdAt: deck.createdAt ?? now,
        updatedAt: now,
    };
}
