package org.mage.test.game.setup;

import mage.cards.Card;
import mage.cards.repository.CardRepository;
import mage.constants.PhaseStep;
import mage.constants.Zone;
import mage.game.Game;
import mage.game.GameSetup;
import mage.game.PutToBattlefieldInfo;
import mage.players.Player;
import org.junit.Test;
import org.mage.test.serverside.base.CardTestPlayerBase;

import java.util.Collections;
import java.util.UUID;

/**
 * A {@link GameSetup} changes the starting state once, before the first turn: the Career's boss twists and puzzles.
 */
public class GameSetupTest extends CardTestPlayerBase {

    /** the opponent starts with more life and a creature in play, like a Career boss */
    private static class BossSetup implements GameSetup {
        private int applied;

        @Override
        public void apply(Game game, UUID startingPlayerId) {
            applied++;
            Player boss = game.getPlayer(game.getOpponents(startingPlayerId).iterator().next());
            boss.setLife(25, game, null);
            Card bears = CardRepository.instance.findPreferredCoreExpansionCard("Grizzly Bears").createCard();
            game.cheat(boss.getId(), Collections.emptyList(), Collections.emptyList(),
                    Collections.singletonList(new PutToBattlefieldInfo(bears, false)),
                    Collections.emptyList(), Collections.emptyList(), Collections.emptyList());
        }
    }

    @Test
    public void theSetupChangesTheStartOnce() {
        BossSetup setup = new BossSetup();
        gameOptions.setup = setup;
        addCard(Zone.BATTLEFIELD, playerA, "Mountain", 1);
        addCard(Zone.HAND, playerA, "Lightning Bolt", 1);

        // the bears came in before the game started, so they can block on turn 2
        castSpell(1, PhaseStep.PRECOMBAT_MAIN, playerA, "Lightning Bolt", playerB);

        setStrictChooseMode(true);
        setStopAt(2, PhaseStep.END_TURN);
        execute();

        assertLife(playerB, 25 - 3);
        assertPermanentCount(playerB, "Grizzly Bears", 1);
        org.junit.Assert.assertEquals("applied once", 1, setup.applied);
    }
}
