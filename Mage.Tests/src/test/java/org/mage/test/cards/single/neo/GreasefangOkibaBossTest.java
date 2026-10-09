package org.mage.test.cards.single.neo;

import mage.constants.PhaseStep;
import mage.constants.Zone;
import org.junit.Test;
import org.mage.test.serverside.base.CardTestPlayerBase;

/**
 * Greasefang, Okiba Boss {1}{W}{B}
 * Legendary Creature — Rat Pilot 4/3
 * At the beginning of combat on your turn, return target Vehicle card from your graveyard to the battlefield.
 * It gains haste. Return it to its owner's hand at the beginning of your next end step.
 */
public class GreasefangOkibaBossTest extends CardTestPlayerBase {

    private static final String greasefang = "Greasefang, Okiba Boss";
    // Flying, first strike, vigilance; attacking makes two 4/4 flying vigilant Angels tapped and attacking; Crew 4
    private static final String parhelion = "Parhelion II";

    @Test
    public void returnedVehicleIsCrewedAndAttacksTheSameCombat() {
        setStrictChooseMode(true);

        addCard(Zone.BATTLEFIELD, playerA, greasefang);
        addCard(Zone.GRAVEYARD, playerA, parhelion);

        addTarget(playerA, parhelion);
        waitStackResolved(1, PhaseStep.BEGIN_COMBAT);
        // crewed in the beginning of combat, after the trigger has put it back
        activateAbility(1, PhaseStep.BEGIN_COMBAT, playerA, "Crew 4");
        setChoice(playerA, greasefang);

        attack(1, playerA, parhelion, playerB);

        setStopAt(1, PhaseStep.POSTCOMBAT_MAIN);
        execute();

        assertPermanentCount(playerA, parhelion, 1);
        assertTapped(greasefang, true);
        // Parhelion II deals 5, its two Angels 4 each
        assertLife(playerB, 20 - 5 - 4 - 4);
    }

    @Test
    public void vehicleGoesBackToHandAtTheEndStep() {
        setStrictChooseMode(true);

        addCard(Zone.BATTLEFIELD, playerA, greasefang);
        addCard(Zone.GRAVEYARD, playerA, parhelion);

        addTarget(playerA, parhelion);

        setStopAt(2, PhaseStep.UPKEEP);
        execute();

        assertPermanentCount(playerA, parhelion, 0);
        assertHandCount(playerA, parhelion, 1);
    }
}
