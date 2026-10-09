package mage.server.career;

import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Career modes: campaigns, puzzles, the weekly challenge and the gauntlet. The content is validated here (every node,
 * deck and reward is well formed; Mage.Tests checks the card names), and each mode's
 * progress and pay rules are pinned.
 */
public class CareerModesTest {

    private Path file;
    private CareerStore store;
    private final CareerService service = CareerService.get();

    @BeforeEach
    public void setUp() throws Exception {
        file = Files.createTempFile("career-modes-test", ".db");
        store = new CareerStore("jdbc:sqlite:" + file);
        CareerStore.use(store);
        store.createProfile("Ana", "test", CareerRules.START_COINS, 1L);
    }

    @AfterEach
    public void tearDown() throws Exception {
        store.close();
        CareerStore.use(null);
        CareerChallenges.get().useClock(() -> LocalDate.now(java.time.ZoneOffset.UTC));
        Files.deleteIfExists(file);
    }

    private CareerProgress.CareerGameResult play(String kind, String ref, CareerSetup setup, boolean won) throws Exception {
        UUID table = UUID.randomUUID();
        service.register(table, "Ana", kind, ref, setup);
        assertEquals(kind, service.kindOf(table));
        service.matchEnded(table, null, won, 7, CareerTally.forTest(UUID.randomUUID()));
        return service.gameResult("Ana", table.toString());
    }

    // ---- content

    /** every card name in the content, to check against the card database */
    private final Set<String> names = new HashSet<>();

    private void deck(String file) throws Exception {
        DeckCardLists deck = CareerCampaigns.get().deck(file);
        int count = 0;
        for (DeckCardInfo card : CareerContent.allCards(deck)) {
            count += card.getAmount();
            names.add(card.getCardName());
        }
        assertTrue(count >= 40, file + " has at least 40 cards, has " + count);
    }

    private void twists(String where, CareerSetup.CareerTwists twists) {
        if (twists == null) {
            return;
        }
        assertNotNull(CareerSetup.ofTwists(twists), where + " has twists that change something");
        if (twists.permanents != null) {
            twists.permanents.forEach(entry -> names.add(CareerSetup.name(entry)));
        }
        if (twists.emblem != null) {
            names.add(twists.emblem);
        }
    }

    private void side(String where, CareerSetup.CareerPuzzleSide side) {
        assertNotNull(side, where);
        for (List<String> zone : Arrays.asList(side.hand, side.battlefield, side.graveyard, side.library)) {
            if (zone != null) {
                zone.forEach(entry -> names.add(CareerSetup.name(entry)));
            }
        }
    }

    @Test
    public void theContentIsWellFormed() throws Exception {
        Map<String, CareerCampaigns.Campaign> campaigns = CareerCampaigns.get().campaigns();
        assertFalse(campaigns.isEmpty(), "a campaign");
        for (CareerCampaigns.Campaign campaign : campaigns.values()) {
            assertEquals(5, campaign.chapters.size(), campaign.id + " has five chapters");
            Set<String> ids = new HashSet<>();
            for (CareerCampaigns.Chapter chapter : campaign.chapters) {
                deck(chapter.deck);
                assertNotNull(chapter.deckName, chapter.id);
                int duels = 0;
                boolean boss = false;
                for (CareerCampaigns.Node node : chapter.nodes) {
                    assertTrue(ids.add(node.id), "node ids are unique: " + node.id);
                    if (node.requires != null) {
                        for (String requirement : node.requires) {
                            String id = requirement.contains(":") ? requirement.substring(0, requirement.indexOf(':')) : requirement;
                            assertTrue(ids.contains(id), node.id + " requires an earlier node, not " + requirement);
                        }
                    }
                    if ("duel".equals(node.type)) {
                        duels++;
                        boss |= node.boss;
                        assertNotNull(node.opponent, node.id);
                        assertTrue(node.opponent.skill >= 1 && node.opponent.skill <= 10, node.id + " skill");
                        assertNotNull(node.reward, node.id + " pays something");
                        deck(node.opponent.deck);
                        twists(node.id, node.opponent.twists);
                    } else {
                        assertEquals("choice", node.type, node.id);
                        assertTrue(node.options != null && node.options.size() >= 2, node.id + " offers a choice");
                        node.options.forEach(option -> assertNotNull(option.reward, node.id + "/" + option.id));
                    }
                }
                assertEquals(5, duels, chapter.id + " has five duels");
                assertTrue(boss, chapter.id + " ends with a boss");
            }
            assertTrue(campaign.chapters.stream().map(chapter -> chapter.unlockSet).allMatch(set -> set != null),
                    "each chapter opens a set");
        }

        assertEquals(20, CareerPuzzles.get().puzzles().size(), "twenty puzzles");
        for (CareerSetup.Puzzle puzzle : CareerPuzzles.get().puzzles().values()) {
            assertNotNull(puzzle.name, puzzle.id);
            assertNotNull(puzzle.hint, puzzle.id + " has a hint");
            side(puzzle.id + " you", puzzle.you);
            side(puzzle.id + " opponent", puzzle.opponent);
        }

        assertTrue(CareerChallenges.get().challenges().size() >= 4, "a few weeks of challenges");
        for (CareerChallenges.Challenge challenge : CareerChallenges.get().challenges()) {
            deck(challenge.playerDeck);
            deck(challenge.opponent.deck);
            twists(challenge.id, challenge.opponent.twists);
        }

        CareerGauntlet.Rules gauntlet = CareerGauntlet.get().rules();
        assertEquals(gauntlet.maxWins, gauntlet.bosses.size(), "a boss for each win");
        assertEquals(gauntlet.maxWins + 1, gauntlet.rewards.size(), "a reward for every result");
        for (CareerCampaigns.NodeOpponent boss : gauntlet.bosses) {
            deck(boss.deck);
            twists(boss.name, boss.twists);
        }
        assertTrue(CareerJumpstart.get().packs().size() >= gauntlet.startPacks, "enough packs to offer");
        CareerJumpstart.get().packs().forEach(pack -> pack.cards.forEach(card -> names.add(card.getCardName())));

        // card names are checked against every card in Mage.Tests: CareerContentCardsTest
    }

    // ---- campaigns

    @Test
    public void aCampaignOpensInOrderAndPaysTheFirstWinOnly() throws Exception {
        CareerCampaigns campaigns = CareerCampaigns.get();
        CareerCampaigns.CareerChapter white = campaigns.campaigns("Ana").get(0).chapters.get(0);
        assertEquals("open", white.nodes.get(0).state);
        assertEquals("locked", white.nodes.get(1).state);
        assertThrows(CareerService.CareerException.class, () -> campaigns.plan("Ana", "five-paths", "white-2"));

        CareerCampaigns.DuelPlan plan = campaigns.plan("Ana", "five-paths", "white-1");
        assertEquals("five-paths/white-1", plan.key);
        assertNull(plan.setup, "no twists for the first duel");

        int coins = store.profile("Ana").coins;
        CareerProgress.CareerGameResult lost = play("campaign", plan.key, null, false);
        assertEquals("campaign", lost.mode.kind);
        assertEquals("locked", campaigns.campaigns("Ana").get(0).chapters.get(0).nodes.get(1).state, "a loss opens nothing");

        CareerProgress.CareerGameResult won = play("campaign", plan.key, null, true);
        assertEquals(25, won.mode.coins, "the node's coins");
        assertEquals(coins + lost.coins + won.coins, store.profile("Ana").coins);
        assertEquals("done", campaigns.campaigns("Ana").get(0).chapters.get(0).nodes.get(0).state);
        assertEquals("open", campaigns.campaigns("Ana").get(0).chapters.get(0).nodes.get(1).state);

        CareerProgress.CareerGameResult again = play("campaign", plan.key, null, true);
        assertEquals(0, again.mode.coins, "a node pays once");
    }

    @Test
    public void aChoicePaysOnceAndTheBossHasItsTwists() throws Exception {
        CareerCampaigns campaigns = CareerCampaigns.get();
        assertThrows(CareerService.CareerException.class, () -> campaigns.choose("Ana", "five-paths", "white-choice", "coins"));
        for (String node : Arrays.asList("white-1", "white-2", "white-3")) {
            play("campaign", "five-paths/" + node, null, true);
        }
        int coins = store.profile("Ana").coins;
        CareerProgress.CareerGameResult chose = campaigns.choose("Ana", "five-paths", "white-choice", "coins");
        assertEquals(60, chose.coins);
        assertEquals(coins + 60, store.profile("Ana").coins);
        assertThrows(CareerService.CareerException.class, () -> campaigns.choose("Ana", "five-paths", "white-choice", "xp"));
        assertEquals("coins", campaigns.campaigns("Ana").get(0).chapters.get(0).nodes.get(3).choice);

        play("campaign", "five-paths/white-4", null, true);
        CareerCampaigns.DuelPlan boss = campaigns.plan("Ana", "five-paths", "white-5");
        assertNotNull(boss.setup, "the boss has an edge");
        assertEquals(Integer.valueOf(25), boss.setup.twists().startingLife);

        assertFalse(store.setUnlocks("Ana").contains("M21"));
        CareerProgress.CareerGameResult beat = play("campaign", "five-paths/white-5", boss.setup, true);
        assertEquals("M21", beat.mode.unlockedSet, "the chapter opens its set");
        assertTrue(store.setUnlocks("Ana").contains("M21"));
        assertTrue(campaigns.campaigns("Ana").get(0).chapters.get(0).done);
    }

    // ---- puzzles

    @Test
    public void puzzlesOpenInOrderAndStarsGoByAttempts() throws Exception {
        CareerPuzzles puzzles = CareerPuzzles.get();
        List<CareerPuzzles.CareerPuzzle> book = puzzles.puzzles("Ana");
        assertTrue(book.get(2).open, "the first three are open");
        assertFalse(book.get(3).open);
        String first = book.get(0).id;
        assertThrows(CareerService.CareerException.class, () -> puzzles.attempt("Ana", book.get(3).id));

        CareerSetup.Puzzle puzzle = puzzles.attempt("Ana", first);
        CareerSetup setup = CareerSetup.ofPuzzle(puzzle);
        assertTrue(setup.replacesOpeningHands());
        CareerProgress.CareerGameResult failed = play("puzzle", first, setup, false);
        assertEquals(0, failed.coins, "a puzzle pays nothing for a loss");
        assertEquals(0, failed.xp, "and nothing for the game itself");

        puzzles.attempt("Ana", first);
        int coins = store.profile("Ana").coins;
        CareerProgress.CareerGameResult solved = play("puzzle", first, setup, true);
        assertEquals(2, solved.mode.stars, "solved on the second try");
        assertEquals(CareerPuzzles.FIRST_SOLVE_COINS, solved.mode.coins);
        assertEquals(coins + solved.coins, store.profile("Ana").coins);

        puzzles.attempt("Ana", first);
        CareerProgress.CareerGameResult again = play("puzzle", first, setup, true);
        assertEquals(0, again.coins, "a puzzle pays once");
        assertEquals(2, puzzles.puzzles("Ana").get(0).stars, "the best stars stay");
        assertTrue(puzzles.puzzles("Ana").get(1).open);
        assertEquals(3, CareerPuzzles.stars(1));
        assertEquals(2, CareerPuzzles.stars(3));
        assertEquals(1, CareerPuzzles.stars(4));
    }

    // ---- the weekly challenge

    @Test
    public void theChallengeRotatesWeeklyAndRanksByTurns() throws Exception {
        CareerChallenges challenges = CareerChallenges.get();
        challenges.useClock(() -> LocalDate.of(2027, 5, 3));
        String week = challenges.view("Ana").week;
        String id = challenges.view("Ana").id;
        challenges.useClock(() -> LocalDate.of(2027, 5, 10));
        assertFalse(id.equals(challenges.view("Ana").id) && week.equals(challenges.view("Ana").week), "a new week");
        challenges.useClock(() -> LocalDate.of(2027, 5, 3));

        store.createProfile("Bo", "test", CareerRules.START_COINS, 1L);
        CareerChallenges.Plan plan = challenges.attempt("Ana");
        assertEquals(week, plan.week);
        int coins = store.profile("Ana").coins;
        CareerProgress.CareerGameResult won = play("challenge", plan.week, plan.setup, true);
        assertEquals(CareerChallenges.FIRST_WIN_COINS, won.mode.coins);
        assertEquals(coins + won.coins, store.profile("Ana").coins);
        assertEquals(0, play("challenge", plan.week, plan.setup, true).mode.coins, "the first win of the week pays");
        assertNotNull(won.mode);

        CareerChallenges.CareerChallenge view = challenges.view("Ana");
        assertTrue(view.won);
        assertEquals(1, view.board.size());
        assertTrue(view.board.get(0).you);
    }

    // ---- the gauntlet

    @Test
    public void aGauntletRunPicksPlaysAndPaysByWins() throws Exception {
        CareerGauntlet gauntlet = CareerGauntlet.get();
        int coins = store.profile("Ana").coins;
        CareerGauntlet.CareerRun run = gauntlet.start("Ana");
        assertEquals(coins - gauntlet.rules().entryCoins, store.profile("Ana").coins);
        assertThrows(CareerService.CareerException.class, () -> gauntlet.start("Ana"), "one run at a time");
        assertThrows(CareerService.CareerException.class, () -> gauntlet.plan("Ana"), "pick first");
        assertEquals(3, run.offer.options.size());
        assertThrows(CareerService.CareerException.class,
                () -> gauntlet.pick("Ana", Arrays.asList(run.offer.options.get(0).id)), "pick two");

        CareerGauntlet.CareerRun picked = gauntlet.pick("Ana", Arrays.asList(run.offer.options.get(0).id, run.offer.options.get(1).id));
        assertNull(picked.offer);
        CareerGauntlet.Plan plan = gauntlet.plan("Ana");
        int cards = plan.playerDeck.getCards().stream().mapToInt(DeckCardInfo::getAmount).sum();
        assertTrue(cards >= 40, "two packs make a deck, has " + cards);

        play("gauntlet", plan.runId, plan.setup, true);
        CareerGauntlet.CareerRun afterWin = gauntlet.state("Ana").run;
        assertEquals(1, afterWin.wins);
        assertNotNull(afterWin.offer, "a win offers a bundle");
        gauntlet.pick("Ana", Arrays.asList(afterWin.offer.options.get(0).id));

        int before = store.profile("Ana").coins;
        CareerProgress.CareerGameResult lost = play("gauntlet", plan.runId, null, false);
        assertNull(gauntlet.state("Ana").run, "a loss ends the run");
        assertEquals(30, lost.mode.coins, "one win pays 30");
        assertEquals(before + lost.coins, store.profile("Ana").coins);
        assertNull(play("gauntlet", plan.runId, null, true).mode, "a finished run counts no more games");
    }
}
