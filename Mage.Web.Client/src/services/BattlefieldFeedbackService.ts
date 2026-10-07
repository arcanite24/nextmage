import type { CombatState } from './BattlefieldPerformanceService.js';
import { hasCardType } from './BattlefieldLayoutService.js';
import type { PermanentView, PlayerView } from '../types/game.js';

export type BattlefieldFeedbackKind =
    | 'entered'
    | 'left'
    | 'died'
    | 'tapped'
    | 'untapped'
    | 'transformed'
    | 'flipped'
    | 'damaged'
    | 'attachment'
    | 'combat';

export interface BattlefieldFeedbackSnapshotCard {
    id: string;
    name: string;
    isCreature: boolean;
    tapped: boolean;
    transformed: boolean;
    flipped: boolean;
    damage: number;
    attachedTo?: string;
    attachments: string;
    combatState: CombatState | '';
}

export type BattlefieldFeedbackSnapshot = Record<string, BattlefieldFeedbackSnapshotCard>;

export interface BattlefieldFeedbackEvent {
    cardId: string;
    kind: BattlefieldFeedbackKind;
    cardName: string;
}

export function createBattlefieldFeedbackSnapshot(
    player: PlayerView,
    combatStateByCardId: ReadonlyMap<string, CombatState>
): BattlefieldFeedbackSnapshot {
    const snapshot: BattlefieldFeedbackSnapshot = {};

    for (const card of Object.values(player.battlefield ?? {})) {
        if (card.phasedIn === false) {
            continue;
        }

        snapshot[card.id] = createSnapshotCard(card, combatStateByCardId);
    }

    return snapshot;
}

export function diffBattlefieldFeedbackSnapshots(
    previous: BattlefieldFeedbackSnapshot,
    current: BattlefieldFeedbackSnapshot
): BattlefieldFeedbackEvent[] {
    const events: BattlefieldFeedbackEvent[] = [];

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

function createSnapshotCard(
    card: PermanentView,
    combatStateByCardId: ReadonlyMap<string, CombatState>
): BattlefieldFeedbackSnapshotCard {
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
