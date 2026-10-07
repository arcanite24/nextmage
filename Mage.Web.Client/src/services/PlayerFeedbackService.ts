import type { CounterView, PlayerView } from '../types/game.js';

export type PlayerFeedbackKind =
    | 'lifeLost'
    | 'lifeGained'
    | 'counterGained'
    | 'counterLost';

export interface PlayerFeedbackSnapshotPlayer {
    playerId: string;
    playerName: string;
    life: number;
    counters: Record<string, number>;
}

export type PlayerFeedbackSnapshot = Record<string, PlayerFeedbackSnapshotPlayer>;

export interface PlayerFeedbackEvent {
    playerId: string;
    playerName: string;
    kind: PlayerFeedbackKind;
    amount: number;
    counterName?: string;
    previousValue?: number;
    currentValue?: number;
}

export function createPlayerFeedbackSnapshot(players: readonly PlayerView[]): PlayerFeedbackSnapshot {
    return Object.fromEntries(players.map(player => [
        player.playerId,
        {
            playerId: player.playerId,
            playerName: player.name,
            life: player.life,
            counters: normalizePlayerCounters(player.counters),
        },
    ]));
}

export function diffPlayerFeedbackSnapshots(
    previous: PlayerFeedbackSnapshot,
    current: PlayerFeedbackSnapshot
): PlayerFeedbackEvent[] {
    const events: PlayerFeedbackEvent[] = [];

    for (const [playerId, currentPlayer] of Object.entries(current)) {
        const previousPlayer = previous[playerId];
        if (!previousPlayer) {
            continue;
        }

        const lifeDelta = currentPlayer.life - previousPlayer.life;
        if (lifeDelta < 0) {
            events.push({
                playerId,
                playerName: currentPlayer.playerName,
                kind: 'lifeLost',
                amount: Math.abs(lifeDelta),
                previousValue: previousPlayer.life,
                currentValue: currentPlayer.life,
            });
        } else if (lifeDelta > 0) {
            events.push({
                playerId,
                playerName: currentPlayer.playerName,
                kind: 'lifeGained',
                amount: lifeDelta,
                previousValue: previousPlayer.life,
                currentValue: currentPlayer.life,
            });
        }

        for (const counterName of getCounterNames(previousPlayer.counters, currentPlayer.counters)) {
            const previousCount = previousPlayer.counters[counterName] ?? 0;
            const currentCount = currentPlayer.counters[counterName] ?? 0;
            const counterDelta = currentCount - previousCount;
            if (counterDelta === 0) {
                continue;
            }

            events.push({
                playerId,
                playerName: currentPlayer.playerName,
                kind: counterDelta > 0 ? 'counterGained' : 'counterLost',
                amount: Math.abs(counterDelta),
                counterName,
                previousValue: previousCount,
                currentValue: currentCount,
            });
        }
    }

    return events;
}

export function formatPlayerFeedbackEvent(event: PlayerFeedbackEvent): string {
    if (event.kind === 'lifeLost') {
        return `${event.playerName} lost ${event.amount} life`;
    }
    if (event.kind === 'lifeGained') {
        return `${event.playerName} gained ${event.amount} life`;
    }

    const direction = event.kind === 'counterGained' ? 'gained' : 'lost';
    return `${event.playerName} ${direction} ${event.amount} ${event.counterName ?? 'counter'} ${event.amount === 1 ? 'counter' : 'counters'}`;
}

function normalizePlayerCounters(counters: readonly CounterView[] = []): Record<string, number> {
    const normalized: Record<string, number> = {};
    for (const counter of counters) {
        const name = counter.name.trim();
        if (!name) {
            continue;
        }
        normalized[name] = (normalized[name] ?? 0) + counter.count;
    }
    return normalized;
}

function getCounterNames(
    previousCounters: Record<string, number>,
    currentCounters: Record<string, number>
): string[] {
    return [...new Set([...Object.keys(previousCounters), ...Object.keys(currentCounters)])].sort((a, b) => a.localeCompare(b));
}
