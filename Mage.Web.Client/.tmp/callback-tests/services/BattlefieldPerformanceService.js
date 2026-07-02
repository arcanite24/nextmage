export const COLLAPSED_STACK_VISIBLE_COUNT = 4;
export function getVisibleStackCards(cards, isExpanded, visibleCount = COLLAPSED_STACK_VISIBLE_COUNT) {
    if (isExpanded || cards.length <= visibleCount) {
        return cards;
    }
    return cards.slice(cards.length - visibleCount);
}
export function createValidTargetLookup(pendingAction) {
    if (pendingAction.type === 'target') {
        const validTargets = new Set(pendingAction.validTargets ?? []);
        if (validTargets.size === 0 && pendingAction.cardsView) {
            const selectableCards = new Set(Object.keys(pendingAction.cardsView));
            return (cardId) => selectableCards.has(cardId);
        }
        return (cardId) => validTargets.has(cardId);
    }
    if (pendingAction.type === 'select') {
        if (pendingAction.cardsView) {
            const selectableCards = new Set(Object.keys(pendingAction.cardsView));
            return (cardId) => selectableCards.has(cardId);
        }
        const min = typeof pendingAction.min === 'number' ? pendingAction.min : pendingAction.required ? 1 : 0;
        return () => Boolean(pendingAction.required || min > 0);
    }
    return () => false;
}
export function isPrioritySelectPrompt(message) {
    const normalizedMessage = message.replace(/\s+\(as .+\)$/, '').trim();
    return normalizedMessage === 'Play spells and abilities'
        || normalizedMessage === 'Play instants and activated abilities';
}
export function shouldCompleteSelectWithBooleanFalse(pendingAction) {
    const min = typeof pendingAction.min === 'number' ? pendingAction.min : pendingAction.required ? 1 : 0;
    return pendingAction.type === 'select' && !pendingAction.cardsView && !pendingAction.required && min === 0;
}
export function createCombatStateLookup(combat) {
    const combatStateByCardId = new Map();
    combat?.forEach(group => {
        Object.keys(group.attackers ?? {}).forEach(cardId => {
            combatStateByCardId.set(cardId, 'attacking');
        });
        Object.keys(group.blockers ?? {}).forEach(cardId => {
            combatStateByCardId.set(cardId, 'blocking');
        });
    });
    return combatStateByCardId;
}
export function areCountersEqual(first, second) {
    if (first === second)
        return true;
    if ((first?.length ?? 0) !== (second?.length ?? 0))
        return false;
    if (!first || !second)
        return true;
    const firstCounters = normalizeCounters(first);
    const secondCounters = normalizeCounters(second);
    for (let index = 0; index < firstCounters.length; index += 1) {
        const firstCounter = firstCounters[index];
        const secondCounter = secondCounters[index];
        if (firstCounter.name !== secondCounter.name || firstCounter.count !== secondCounter.count) {
            return false;
        }
    }
    return true;
}
function normalizeCounters(counters) {
    return [...counters].sort((first, second) => {
        const nameCompare = first.name.localeCompare(second.name);
        if (nameCompare !== 0)
            return nameCompare;
        return first.count - second.count;
    });
}
