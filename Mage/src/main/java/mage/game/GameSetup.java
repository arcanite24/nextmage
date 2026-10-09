package mage.game;

import java.io.Serializable;
import java.util.UUID;

/**
 * Changes a game's starting state, once, after the opening hands and mulligans and before the first turn: a
 * stronger opponent (more life, extra cards, a permanent in play) or a fixed position to solve. Set it in
 * {@link GameOptions#setup} before the game starts.
 */
public interface GameSetup extends Serializable {

    /**
     * @return true when the setup deals every hand itself, so no opening hands are drawn and nobody mulligans
     */
    default boolean replacesOpeningHands() {
        return false;
    }

    /**
     * @return the player who takes the first turn, or null to choose as usual
     */
    default UUID startingPlayer(Game game) {
        return null;
    }

    void apply(Game game, UUID startingPlayerId);
}
