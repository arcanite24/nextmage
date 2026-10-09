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

    /**
     * @return true when the game is over for the table once every human player has lost or left: the AI players
     * still in it don't play it out, and the one with the most life wins
     */
    default boolean endsWhenHumansAreOut() {
        return false;
    }

    void apply(Game game, UUID startingPlayerId);
}
