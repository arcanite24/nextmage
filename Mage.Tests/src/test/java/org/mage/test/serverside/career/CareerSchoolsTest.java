package org.mage.test.serverside.career;

import mage.cards.repository.CardScanner;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.io.IOException;
import java.util.ArrayList;

/**
 * Every deck a Career school hands the player or seats the AI with is legal in the school's format, and every card in
 * it has the printing the file names. The schools are where players learn a format, so a list that wouldn't be
 * allowed at a real table has no place there.
 */
public class CareerSchoolsTest {

    @Before
    public void setUp() {
        CardScanner.scan();
    }

    @Test
    public void everySchoolDeckIsLegalInItsFormat() throws IOException {
        Assert.assertEquals("school decks that aren't legal", new ArrayList<>(), CareerDeckTool.validate("all"));
    }

    @Test
    public void everySchoolIsWholeAndNamesRealCards() throws IOException {
        Assert.assertEquals("school structure", new ArrayList<>(), CareerDeckTool.check("all"));
    }
}
