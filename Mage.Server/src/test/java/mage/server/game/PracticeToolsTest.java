package mage.server.game;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

public class PracticeToolsTest {

    @Test
    public void parsesToolNamesLeniently() {
        assertEquals(PracticeTools.Tool.UNTAP_ALL, PracticeTools.parse(" untap_all "));
        assertNull(PracticeTools.parse("WIN"));
        assertNull(PracticeTools.parse(null));
    }

    @Test
    public void refusesAmountsOutOfRange() {
        UUID player = UUID.randomUUID();
        StringBuilder problem = new StringBuilder();
        assertNull(PracticeTools.action(PracticeTools.Tool.DRAW, player, null, 0, problem));
        assertEquals("Draw 1 to 10 cards at a time.", problem.toString());

        problem.setLength(0);
        assertNull(PracticeTools.action(PracticeTools.Tool.HAND, player, "Plains", 11, problem));
        assertEquals("Add 1 to 10 cards at a time.", problem.toString());

        problem.setLength(0);
        assertNull(PracticeTools.action(PracticeTools.Tool.LIFE, player, null, 1000, problem));
        assertEquals("Life must be 1 to 999.", problem.toString());
    }

    @Test
    public void buildsActionsThatNeedNoCard() {
        StringBuilder problem = new StringBuilder();
        assertNotNull(PracticeTools.action(PracticeTools.Tool.UNTAP_ALL, UUID.randomUUID(), null, 0, problem));
        assertNotNull(PracticeTools.action(PracticeTools.Tool.LIFE, UUID.randomUUID(), null, 40, problem));
        assertEquals("", problem.toString());
    }
}
