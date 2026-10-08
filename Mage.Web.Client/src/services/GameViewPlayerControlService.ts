import type { GameView, UUID } from '../types/index.js';

export interface PlayerControlIdentity {
    playerId: UUID | null;
    isWatching: boolean;
}

export function resolvePlayerControlIdentityFromGameView(
    current: PlayerControlIdentity,
    gameView: Pick<GameView, 'myPlayerId'> | null | undefined,
): PlayerControlIdentity {
    if (!gameView?.myPlayerId) {
        return current;
    }

    return {
        playerId: gameView.myPlayerId,
        isWatching: false,
    };
}
