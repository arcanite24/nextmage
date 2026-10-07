import { hasCardType } from './BattlefieldLayoutService.js';
export function createBattlefieldFeedbackSnapshot(player, combatStateByCardId) {
    const snapshot = {};
    for (const card of Object.values(player.battlefield ?? {})) {
        if (card.phasedIn === false) {
            continue;
        }
        snapshot[card.id] = createSnapshotCard(card, combatStateByCardId);
    }
    return snapshot;
}
export function diffBattlefieldFeedbackSnapshots(previous, current) {
    const events = [];
    for (const [cardId, currentCard] of Object.entries(current)) {
        const previousCard = previous[cardId];
        if (!previousCard) {
            events.push({ cardId, kind: 'entered', cardName: currentCard.name });
            continue;
        }
        if (previousCard.tapped !== currentCard.tapped) {
            events.push({ cardId, kind: currentCard.tapped ? 'tapped' : 'untapped', cardName: currentCard.name });
        }
        if (previousCard.transformed !== currentCard.transformed) {
            events.push({ cardId, kind: 'transformed', cardName: currentCard.name });
        }
        if (previousCard.flipped !== currentCard.flipped) {
            events.push({ cardId, kind: 'flipped', cardName: currentCard.name });
        }
        if (previousCard.damage !== currentCard.damage) {
            events.push({ cardId, kind: 'damaged', cardName: currentCard.name });
        }
        if (previousCard.attachedTo !== currentCard.attachedTo || previousCard.attachments !== currentCard.attachments) {
            events.push({ cardId, kind: 'attachment', cardName: currentCard.name });
        }
        if (previousCard.combatState !== currentCard.combatState) {
            events.push({ cardId, kind: 'combat', cardName: currentCard.name });
        }
    }
    for (const [cardId, previousCard] of Object.entries(previous)) {
        if (!current[cardId]) {
            events.push({ cardId, kind: previousCard.isCreature ? 'died' : 'left', cardName: previousCard.name });
        }
    }
    return events;
}
function createSnapshotCard(card, combatStateByCardId) {
    return {
        id: card.id,
        name: card.name,
        isCreature: hasCardType(card, 'Creature'),
        tapped: card.tapped,
        transformed: card.transformed,
        flipped: card.flipped,
        damage: card.damage,
        attachedTo: card.attachedTo,
        attachments: [...(card.attachments ?? [])].sort().join(','),
        combatState: combatStateByCardId.get(card.id) ?? '',
    };
}
