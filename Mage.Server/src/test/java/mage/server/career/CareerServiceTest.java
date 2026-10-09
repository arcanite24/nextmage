package mage.server.career;

import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Career contract tests: rewards are durable state, so each rule that pays or spends is pinned here.
 */
public class CareerServiceTest {

    private Path file;
    private CareerStore store;
    private final CareerService service = CareerService.get();

    @BeforeEach
    public void setUp() throws Exception {
        file = Files.createTempFile("career-test", ".db");
        store = new CareerStore("jdbc:sqlite:" + file);
        CareerStore.use(store);
        store.createProfile("Ana", "test", CareerRules.START_COINS, 1L);
    }

    @AfterEach
    public void tearDown() throws Exception {
        store.close();
        CareerStore.use(null);
        Files.deleteIfExists(file);
    }

    private static CareerCard card(String name, String rarity) {
        return new CareerCard(name, "TST", name.replace(' ', '-'), rarity);
    }

    @Test
    public void migrationsRunOnceAndRecordTheVersion() throws Exception {
        assertEquals(2, store.schemaVersion());
        store.close();
        store = new CareerStore("jdbc:sqlite:" + file);
        CareerStore.use(store);
        assertEquals(2, store.schemaVersion());
        assertNotNull(store.profile("ana"), "reopening keeps the data");
    }

    @Test
    public void aMatchPaysOnceAndOnlyOnce() throws Exception {
        UUID table = UUID.randomUUID();
        service.register(table, "Ana", "wren", 1);
        CareerPayout payout = service.matchEnded(table, true, 7);
        assertNotNull(payout);
        assertEquals(CareerRules.winCoins(1), payout.coins);
        assertNull(service.matchEnded(table, true, 7), "a second end of the same match pays nothing");

        // even if the table were registered again, the payout key is the match
        service.register(table, "Ana", "wren", 1);
        assertNull(service.matchEnded(table, true, 7));

        CareerProfile profile = store.profile("Ana");
        assertEquals(CareerRules.START_COINS + CareerRules.winCoins(1) + firstWinCoins(), profile.coins);
        assertEquals(1, profile.wins);
        assertEquals(1, store.payouts("Ana", 10).size());
    }

    @Test
    public void aLossBeforeTurnThreePaysNothing() throws Exception {
        UUID early = UUID.randomUUID();
        service.register(early, "Ana", "wren", 1);
        CareerPayout payout = service.matchEnded(early, false, 2);
        assertEquals(0, payout.coins);
        assertEquals(0, payout.xp);
        assertNotNull(payout.note);

        UUID late = UUID.randomUUID();
        service.register(late, "Ana", "wren", 1);
        assertEquals(5, service.matchEnded(late, false, 9).coins);
    }

    @Test
    public void tablesThatArentCareerPayNothing() {
        assertNull(service.matchEnded(UUID.randomUUID(), true, 9));
        UUID table = UUID.randomUUID();
        service.register(table, "Ana", "wren", 1);
        service.forget(table);
        assertNull(service.matchEnded(table, true, 9));
    }

    @Test
    public void winsInATierOpenTheNext() throws Exception {
        assertFalse(service.unlocked("Ana", "hask"));
        for (int i = 0; i < CareerRules.WINS_TO_UNLOCK_NEXT_TIER; i++) {
            UUID table = UUID.randomUUID();
            service.register(table, "Ana", i % 2 == 0 ? "wren" : "pip", 1);
            service.matchEnded(table, true, 6);
        }
        assertTrue(service.unlocked("Ana", "hask"));
        assertFalse(service.unlocked("Ana", "sera"));
    }

    @Test
    public void decksNeedOwnedCopiesButBasicLandsAreFree() throws Exception {
        store.addCard("Ana", card("Grizzly Bears", CareerRules.COMMON), 2);
        DeckCardLists deck = new DeckCardLists();
        deck.getCards().add(new DeckCardInfo("Grizzly Bears", "1", "XXX", 3));
        deck.getCards().add(new DeckCardInfo("Forest", "1", "XXX", 20));
        List<String> problems = service.ownershipProblems("Ana", deck);
        assertEquals(Arrays.asList("Grizzly Bears: 3 in the deck, 2 owned"), problems);

        store.addCard("Ana", new CareerCard("Grizzly Bears", "OTH", "7", CareerRules.COMMON), 1);
        assertTrue(service.ownershipProblems("Ana", deck).isEmpty(), "any printing counts");
    }

    @Test
    public void packsCostCoinsAndSpareCopiesConvert() throws Exception {
        store.addCard("Ana", card("Shock", CareerRules.COMMON), 4);
        store.addCard("Ana", card("Baneslayer Angel", CareerRules.MYTHIC), 4);
        List<CareerCard> pack = new ArrayList<>(Arrays.asList(
                card("Shock", CareerRules.COMMON),
                card("Baneslayer Angel", CareerRules.MYTHIC),
                card("Giant Growth", CareerRules.COMMON),
                card("Forest", CareerRules.LAND)));
        CareerService.CareerPackResult result = service.open("Ana", "TST", pack);
        assertEquals("coins", pack.get(0).convertedTo);
        assertEquals("wildcard", pack.get(1).convertedTo);
        assertNull(pack.get(2).convertedTo);
        assertEquals(CareerRules.START_COINS - CareerRules.PACK_PRICE + CareerRules.spareCoins(CareerRules.COMMON), result.profile.coins);
        assertEquals(1, result.profile.wildcards.mythic);
        assertEquals(1, store.owned("Ana", "Giant Growth"));
        assertEquals(0, store.owned("Ana", "Forest"), "basic lands are never stored");
    }

    @Test
    public void aPackYouCantAffordChangesNothing() throws Exception {
        store.addCoins("Ana", -CareerRules.START_COINS);
        List<CareerCard> pack = new ArrayList<>(Arrays.asList(card("Shock", CareerRules.COMMON)));
        CareerService.CareerException refusal = assertThrows(CareerService.CareerException.class, () -> service.open("Ana", "TST", pack));
        assertTrue(refusal.getMessage().contains("costs"));
        assertEquals(0, store.owned("Ana", "Shock"));
        assertEquals(0, store.profile("Ana").coins);
    }

    @Test
    public void exportedCareersComeBackOnlyIntact() throws Exception {
        store.addCard("Ana", card("Shock", CareerRules.COMMON), 3);
        UUID table = UUID.randomUUID();
        service.register(table, "Ana", "wren", 1);
        service.matchEnded(table, true, 5);
        String exported = service.export("Ana");

        assertThrows(CareerService.CareerException.class, () -> service.importFile("Ana", exported),
                "an existing Career is never replaced");

        store.deleteProfile("Ana");
        String forged = exported.substring(0, exported.lastIndexOf('.')) + ".AAAA";
        assertThrows(CareerService.CareerException.class, () -> service.importFile("Ana", forged));
        assertThrows(CareerService.CareerException.class, () -> service.importFile("Bea", exported), "another account's file");

        CareerProfile restored = service.importFile("Ana", exported);
        assertEquals(CareerRules.START_COINS + CareerRules.winCoins(1) + firstWinCoins(), restored.coins);
        assertEquals(3, store.owned("Ana", "Shock"));
        service.register(table, "Ana", "wren", 1);
        assertNull(service.matchEnded(table, true, 5), "a restored payout is not paid again");
    }

    /** the first win also earns its achievement */
    private static int firstWinCoins() {
        return CareerProgress.get().achievementTemplates().get("first-win").coins;
    }

    private static byte[] readAll(java.io.InputStream in) throws java.io.IOException {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) > 0) {
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }

    @Test
    public void levelsFollowXp() {
        assertEquals(1, CareerRules.levelFor(0));
        assertEquals(2, CareerRules.levelFor(CareerRules.xpForLevel(1)));
        assertEquals(CareerRules.MAX_LEVEL, CareerRules.levelFor(Integer.MAX_VALUE / 2));
    }

    @Test
    public void theRosterIsDataWithTwelveOpponentsInThreeTiers() throws Exception {
        CareerContent content = CareerContent.get();
        assertEquals(12, content.opponents().size());
        for (int tier = 1; tier <= 3; tier++) {
            final int t = tier;
            assertEquals(4, content.opponents().stream().filter(opponent -> opponent.tier == t).count());
        }
        // the card database isn't loaded in unit tests: count the deck files' lines instead
        for (CareerContent.Opponent opponent : content.opponents()) {
            try (java.io.InputStream in = CareerContent.class.getResourceAsStream("/career/opponents/" + opponent.deck)) {
                assertNotNull(in, opponent.id + "'s deck file is shipped");
                int size = 0;
                for (String line : new String(readAll(in), java.nio.charset.StandardCharsets.UTF_8).split("\\R")) {
                    java.util.regex.Matcher card = java.util.regex.Pattern.compile("^(\\d+) \\[").matcher(line);
                    if (card.find()) {
                        size += Integer.parseInt(card.group(1));
                    }
                }
                assertTrue(size >= 60, opponent.id + " plays a 60-card main deck, has " + size);
            }
        }
        assertFalse(content.starters().isEmpty());
    }
}
