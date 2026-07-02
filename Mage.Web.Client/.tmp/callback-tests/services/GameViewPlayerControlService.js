export function resolvePlayerControlIdentityFromGameView(current, gameView) {
    if (!gameView?.myPlayerId) {
        return current;
    }
    return {
        playerId: gameView.myPlayerId,
        isWatching: false,
    };
}
