package mage.server.career;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import mage.cards.decks.DeckCardLists;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.IsoFields;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * The weekly challenge: the same fixed deck against the same opponent for everyone on the server, a new one each
 * week (resources/career/challenges.json, in turn). The board ranks wins by fewest turns, then most life left.
 */
public final class CareerChallenges {

    public static final int FIRST_WIN_COINS = 50;
    public static final int FIRST_WIN_XP = 100;
    public static final int BOARD_SIZE = 20;

    public static class Challenge {
        public String id;
        public String name;
        public String text;
        public String playerDeck;
        public CareerCampaigns.NodeOpponent opponent;
    }

    /** This week's challenge, the player's result and the board. */
    public static class CareerChallenge {
        public String week;
        public String id;
        public String name;
        public String text;
        public String opponentName;
        /** the card whose art is the opponent's portrait */
        public CareerContent.CareerCover cover;
        public int skill;
        public CareerSetup.CareerTwists twists;
        public int attempts;
        public boolean won;
        public Integer bestTurns;
        public Integer bestLife;
        public List<CareerChallengeEntry> board = new ArrayList<>();
    }

    public static class CareerChallengeEntry {
        public int rank;
        public String user;
        public boolean won;
        public Integer turns;
        public Integer life;
        public int attempts;
        public boolean you;
    }

    private static volatile CareerChallenges instance;

    private final List<Challenge> challenges;
    private Supplier<LocalDate> today = () -> LocalDate.now(ZoneOffset.UTC);

    private CareerChallenges() throws IOException {
        InputStream stream = CareerChallenges.class.getResourceAsStream("/career/challenges.json");
        if (stream == null) {
            throw new IOException("Missing career resource challenges.json");
        }
        try (Reader reader = new InputStreamReader(stream, StandardCharsets.UTF_8)) {
            challenges = new Gson().fromJson(reader, new TypeToken<List<Challenge>>() {
            }.getType());
        }
    }

    public static CareerChallenges get() {
        CareerChallenges current = instance;
        if (current == null) {
            synchronized (CareerChallenges.class) {
                current = instance;
                if (current == null) {
                    try {
                        current = new CareerChallenges();
                    } catch (IOException | RuntimeException e) {
                        throw new IllegalStateException("Challenges can't be read: " + e.getMessage(), e);
                    }
                    instance = current;
                }
            }
        }
        return current;
    }

    void useClock(Supplier<LocalDate> today) {
        this.today = today;
    }

    public List<Challenge> challenges() {
        return challenges;
    }

    String week() {
        LocalDate date = today.get();
        return date.get(IsoFields.WEEK_BASED_YEAR) + "-W" + String.format("%02d", date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
    }

    /** this week's challenge: the list in turn, by weeks since 2026-01-05 */
    Challenge current() {
        long weeks = java.time.temporal.ChronoUnit.WEEKS.between(LocalDate.of(2026, 1, 5), today.get());
        return challenges.get((int) Math.floorMod(weeks, challenges.size()));
    }

    public CareerChallenge view(String user) throws SQLException {
        CareerStore store = CareerStore.get();
        Challenge challenge = current();
        CareerChallenge view = new CareerChallenge();
        view.week = week();
        view.id = challenge.id;
        view.name = challenge.name;
        view.text = challenge.text;
        view.opponentName = challenge.opponent.name;
        view.cover = CareerContent.coverOf("campaigns/decks/" + challenge.opponent.deck);
        view.skill = challenge.opponent.skill;
        view.twists = challenge.opponent.twists;
        int rank = 0;
        for (Object[] row : store.challengeBoard(view.week, Integer.MAX_VALUE)) {
            rank++;
            boolean you = CareerStore.key(user).equals(row[0]);
            if (you) {
                view.attempts = (Integer) row[1];
                view.won = (Boolean) row[2];
                view.bestTurns = (Integer) row[3];
                view.bestLife = (Integer) row[4];
            }
            if (rank <= BOARD_SIZE || you) {
                CareerChallengeEntry entry = new CareerChallengeEntry();
                entry.rank = rank;
                entry.user = (String) row[0];
                entry.attempts = (Integer) row[1];
                entry.won = (Boolean) row[2];
                entry.turns = (Integer) row[3];
                entry.life = (Integer) row[4];
                entry.you = you;
                view.board.add(entry);
            }
        }
        return view;
    }

    /** What a played challenge needs. */
    public static class Plan {
        public String week;
        public Challenge challenge;
        public DeckCardLists playerDeck;
        public DeckCardLists opponentDeck;
        public CareerSetup setup;
    }

    public Plan attempt(String user) throws SQLException, IOException {
        Plan plan = new Plan();
        plan.week = week();
        plan.challenge = current();
        plan.playerDeck = CareerCampaigns.get().deck(plan.challenge.playerDeck);
        plan.opponentDeck = CareerCampaigns.get().deck(plan.challenge.opponent.deck);
        plan.setup = CareerSetup.ofTwists(plan.challenge.opponent.twists);
        CareerStore.get().challengeAttempt(user, plan.week, System.currentTimeMillis());
        return plan;
    }

    void finished(CareerStore store, String user, String week, boolean won, CareerTally tally, CareerProgress.CareerGameResult result, long now) throws SQLException {
        Challenge challenge = current();
        result.mode = new CareerProgress.CareerModeResult("challenge", challenge.name);
        result.mode.ref = week;
        if (!won) {
            result.mode.lines.add("No win this time. Try again as often as you like this week.");
            return;
        }
        int turns = Math.max(1, tally.get("my_turns"));
        int life = tally.get("life_at_end");
        boolean first = store.challengeBoard(week, Integer.MAX_VALUE).stream()
                .noneMatch(row -> CareerStore.key(user).equals(row[0]) && (Boolean) row[2]);
        store.challengeWon(user, week, turns, life, now);
        result.mode.lines.add("Won in " + turns + (turns == 1 ? " turn" : " turns") + " with " + life + " life left.");
        if (first) {
            store.addCoins(user, FIRST_WIN_COINS);
            store.addProfileInt(user, "xp", FIRST_WIN_XP);
            result.coins += FIRST_WIN_COINS;
            result.xp += FIRST_WIN_XP;
            result.mode.coins += FIRST_WIN_COINS;
            result.mode.xp += FIRST_WIN_XP;
            result.mode.lines.add("Your first win this week.");
        }
    }
}
