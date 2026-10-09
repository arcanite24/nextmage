package mage.server.career;

import com.google.gson.Gson;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Gauntlet runs, a roguelike evening: start with two of three Jumpstart packs (a 40-card deck), beat eight bosses
 * in a row, and after each win add one of three card bundles to the deck. One loss ends the run; the rewards grow
 * with the wins (resources/career/gauntlet.json). The run's deck is its own: the cards don't join the collection.
 */
public final class CareerGauntlet {

    public static final String KIND = "gauntlet";

    // ---- content

    static class Rules {
        int entryCoins;
        int startPacks;
        int pickStart;
        int bundleSize;
        int bundles;
        int maxWins;
        List<Payout> rewards;
        List<CareerCampaigns.NodeOpponent> bosses;
    }

    static class Payout {
        int wins;
        int coins;
        int packs;
        String wildcard;
    }

    // ---- run state, kept as JSON in the run's row

    public static class CareerRunCard {
        public String name;
        public String setCode;
        public String cardNumber;
        public int amount;

        CareerRunCard() {
        }

        CareerRunCard(DeckCardInfo info, int amount) {
            this.name = info.getCardName();
            this.setCode = info.getSetCode();
            this.cardNumber = info.getCardNumber();
            this.amount = amount;
        }
    }

    public static class CareerOfferOption {
        public String id;
        public String name;
        public String color;
        public List<CareerRunCard> cards = new ArrayList<>();
    }

    public static class CareerOffer {
        /** "start" (pick packs for the deck) or "bundle" (pick one to add after a win) */
        public String kind;
        public int pick;
        public List<CareerOfferOption> options = new ArrayList<>();
    }

    static class RunData {
        String colors = "";
        List<CareerRunCard> deck = new ArrayList<>();
        CareerOffer offer;
    }

    // ---- views

    public static class CareerRun {
        public String id;
        /** "active", "won", "lost" or "abandoned" */
        public String state;
        public int wins;
        public int losses;
        public int maxWins;
        public String colors;
        public List<CareerRunCard> deck;
        public int deckSize;
        /** a pick waiting before the next game */
        public CareerOffer offer;
        /** the next boss, while the run is on */
        public CareerRunBoss next;
        public List<CareerRunBoss> bosses = new ArrayList<>();
        public long started;
        public Long ended;
    }

    public static class CareerRunBoss {
        public int number;
        public String name;
        /** the card whose art is the boss's portrait */
        public CareerContent.CareerCover cover;
        public int skill;
        public CareerSetup.CareerTwists twists;
        public boolean beaten;
    }

    public static class CareerGauntletState {
        public int entryCoins;
        public int maxWins;
        public List<CareerRunReward> rewards = new ArrayList<>();
        /** the run in progress, or null */
        public CareerRun run;
        /** the best finished run */
        public int bestWins;
        public List<CareerRun> recent = new ArrayList<>();
    }

    public static class CareerRunReward {
        public int wins;
        public int coins;
        public int packs;
        public String wildcard;
    }

    private static volatile CareerGauntlet instance;

    private final Rules rules;
    private final Gson gson = new Gson();
    private Random random = new Random();

    private CareerGauntlet() throws IOException {
        InputStream stream = CareerGauntlet.class.getResourceAsStream("/career/gauntlet.json");
        if (stream == null) {
            throw new IOException("Missing career resource gauntlet.json");
        }
        try (Reader reader = new InputStreamReader(stream, StandardCharsets.UTF_8)) {
            rules = gson.fromJson(reader, Rules.class);
        }
    }

    public static CareerGauntlet get() {
        CareerGauntlet current = instance;
        if (current == null) {
            synchronized (CareerGauntlet.class) {
                current = instance;
                if (current == null) {
                    try {
                        current = new CareerGauntlet();
                    } catch (IOException | RuntimeException e) {
                        throw new IllegalStateException("The gauntlet can't be read: " + e.getMessage(), e);
                    }
                    instance = current;
                }
            }
        }
        return current;
    }

    void useRandom(Random random) {
        this.random = random;
    }

    List<CareerCampaigns.NodeOpponent> bosses() {
        return Collections.unmodifiableList(rules.bosses);
    }

    // ---- reading

    Rules rules() {
        return rules;
    }

    public CareerGauntletState state(String user) throws SQLException {
        CareerStore store = CareerStore.get();
        CareerGauntletState state = new CareerGauntletState();
        state.entryCoins = rules.entryCoins;
        state.maxWins = rules.maxWins;
        for (Payout payout : rules.rewards) {
            CareerRunReward view = new CareerRunReward();
            view.wins = payout.wins;
            view.coins = payout.coins;
            view.packs = payout.packs;
            view.wildcard = payout.wildcard;
            state.rewards.add(view);
        }
        for (CareerStore.RunRow row : store.runs(user, KIND, false, 10)) {
            CareerRun run = view(row);
            if ("active".equals(row.state)) {
                state.run = run;
            } else {
                state.recent.add(run);
                state.bestWins = Math.max(state.bestWins, row.wins);
            }
        }
        return state;
    }

    private CareerRun view(CareerStore.RunRow row) {
        RunData data = gson.fromJson(row.data, RunData.class);
        CareerRun run = new CareerRun();
        run.id = row.id;
        run.state = row.state;
        run.wins = row.wins;
        run.losses = row.losses;
        run.maxWins = rules.maxWins;
        run.colors = data.colors;
        run.deck = data.deck;
        run.deckSize = data.deck.stream().mapToInt(card -> card.amount).sum();
        run.offer = data.offer;
        run.started = row.started;
        run.ended = row.ended;
        for (int i = 0; i < rules.bosses.size(); i++) {
            CareerCampaigns.NodeOpponent boss = rules.bosses.get(i);
            CareerRunBoss bossView = new CareerRunBoss();
            bossView.number = i + 1;
            bossView.name = boss.name;
            bossView.cover = CareerContent.coverOf("campaigns/decks/" + boss.deck);
            bossView.skill = boss.skill;
            bossView.twists = boss.twists;
            bossView.beaten = i < row.wins;
            run.bosses.add(bossView);
        }
        if ("active".equals(row.state) && row.wins < run.bosses.size()) {
            run.next = run.bosses.get(row.wins);
        }
        return run;
    }

    // ---- starting, picking, giving up

    public CareerRun start(String user) throws SQLException, CareerService.CareerException {
        CareerStore store = CareerStore.get();
        return refusing(() -> store.transaction(() -> {
            CareerProfile profile = store.profile(user);
            if (profile == null) {
                throw refusal("Open a Career first.");
            }
            if (!store.runs(user, KIND, true, 1).isEmpty()) {
                throw refusal("Finish or give up your gauntlet run first.");
            }
            if (profile.coins < rules.entryCoins) {
                throw refusal("A gauntlet run costs " + rules.entryCoins + " coins; you have " + profile.coins + ".");
            }
            store.addCoins(user, -rules.entryCoins);
            RunData data = new RunData();
            data.offer = new CareerOffer();
            data.offer.kind = "start";
            data.offer.pick = rules.pickStart;
            List<CareerJumpstart.Pack> packs = new ArrayList<>(CareerJumpstart.get().packs());
            Collections.shuffle(packs, random);
            for (CareerJumpstart.Pack pack : packs.subList(0, Math.min(rules.startPacks, packs.size()))) {
                CareerOfferOption option = new CareerOfferOption();
                option.id = pack.name;
                option.name = pack.name;
                option.color = pack.color;
                for (DeckCardInfo card : pack.cards) {
                    option.cards.add(new CareerRunCard(card, card.getAmount()));
                }
                data.offer.options.add(option);
            }
            CareerStore.RunRow row = new CareerStore.RunRow();
            row.id = UUID.randomUUID().toString();
            row.kind = KIND;
            row.started = System.currentTimeMillis();
            row.state = "active";
            row.data = gson.toJson(data);
            store.putRun(user, row);
            store.addStat(user, "gauntlet_runs", 1);
            return view(row);
        }));
    }

    /** takes the waiting offer: the starting packs (as many as it asks for) or one bundle */
    public CareerRun pick(String user, List<String> optionIds) throws SQLException, CareerService.CareerException {
        CareerStore store = CareerStore.get();
        return refusing(() -> store.transaction(() -> {
            CareerStore.RunRow row = active(store, user);
            RunData data = gson.fromJson(row.data, RunData.class);
            if (data.offer == null) {
                throw refusal("There's nothing to pick right now.");
            }
            if (optionIds == null || optionIds.size() != data.offer.pick
                    || optionIds.stream().distinct().count() != optionIds.size()) {
                throw refusal("Pick " + data.offer.pick + (data.offer.pick == 1 ? " option." : " options."));
            }
            Map<String, CareerRunCard> deck = new LinkedHashMap<>();
            for (CareerRunCard card : data.deck) {
                deck.put(card.setCode + "|" + card.cardNumber + "|" + card.name, card);
            }
            for (String id : optionIds) {
                CareerOfferOption option = data.offer.options.stream().filter(candidate -> candidate.id.equals(id)).findFirst().orElse(null);
                if (option == null) {
                    throw refusal("That isn't one of the options.");
                }
                for (CareerRunCard card : option.cards) {
                    deck.merge(card.setCode + "|" + card.cardNumber + "|" + card.name, copy(card), (a, b) -> {
                        a.amount += b.amount;
                        return a;
                    });
                }
                if (option.color != null && !data.colors.contains(option.color)) {
                    data.colors += option.color;
                }
            }
            data.deck = new ArrayList<>(deck.values());
            data.offer = null;
            row.data = gson.toJson(data);
            store.putRun(user, row);
            return view(row);
        }));
    }

    public CareerRun abandon(String user) throws SQLException, CareerService.CareerException {
        CareerStore store = CareerStore.get();
        return refusing(() -> store.transaction(() -> {
            CareerStore.RunRow row = active(store, user);
            row.state = "abandoned";
            row.ended = System.currentTimeMillis();
            store.putRun(user, row);
            return view(row);
        }));
    }

    private static CareerRunCard copy(CareerRunCard card) {
        CareerRunCard copy = new CareerRunCard();
        copy.name = card.name;
        copy.setCode = card.setCode;
        copy.cardNumber = card.cardNumber;
        copy.amount = card.amount;
        return copy;
    }

    private static CareerStore.RunRow active(CareerStore store, String user) throws SQLException {
        List<CareerStore.RunRow> runs = store.runs(user, KIND, true, 1);
        if (runs.isEmpty()) {
            throw refusal("You have no gauntlet run going.");
        }
        return runs.get(0);
    }

    // ---- playing

    /** What the next game needs. */
    public static class Plan {
        public String runId;
        public int bossNumber;
        public CareerCampaigns.NodeOpponent boss;
        public DeckCardLists playerDeck;
        public DeckCardLists opponentDeck;
        public CareerSetup setup;
    }

    public Plan plan(String user) throws SQLException, CareerService.CareerException, IOException {
        CareerStore store = CareerStore.get();
        CareerStore.RunRow row;
        try {
            row = active(store, user);
        } catch (SQLException e) {
            if (e.getCause() instanceof CareerService.CareerException) {
                throw (CareerService.CareerException) e.getCause();
            }
            throw e;
        }
        RunData data = gson.fromJson(row.data, RunData.class);
        if (data.offer != null) {
            throw new CareerService.CareerException("Make your pick before the next game.");
        }
        Plan plan = new Plan();
        plan.runId = row.id;
        plan.bossNumber = row.wins + 1;
        plan.boss = rules.bosses.get(Math.min(row.wins, rules.bosses.size() - 1));
        plan.playerDeck = new DeckCardLists();
        plan.playerDeck.setName("Gauntlet run");
        for (CareerRunCard card : data.deck) {
            plan.playerDeck.getCards().add(new DeckCardInfo(card.name, card.cardNumber, card.setCode, card.amount));
        }
        plan.opponentDeck = CareerCampaigns.get().deck(plan.boss.deck);
        plan.setup = CareerSetup.ofTwists(plan.boss.twists);
        return plan;
    }

    void finished(CareerStore store, String user, String runId, boolean won, CareerProgress.CareerGameResult result, long now) throws SQLException {
        CareerStore.RunRow row = store.run(user, runId);
        if (row == null || !"active".equals(row.state)) {
            return;
        }
        RunData data = gson.fromJson(row.data, RunData.class);
        CareerCampaigns.NodeOpponent boss = rules.bosses.get(Math.min(row.wins, rules.bosses.size() - 1));
        result.mode = new CareerProgress.CareerModeResult(KIND, "Gauntlet: " + boss.name);
        result.mode.ref = runId;
        if (won) {
            row.wins++;
            result.mode.lines.add("Beat " + boss.name + ". " + row.wins + " of " + rules.maxWins + ".");
            if (row.wins >= rules.maxWins) {
                row.state = "won";
                row.ended = now;
                result.mode.lines.add("You beat the whole gauntlet!");
                store.addStat(user, "gauntlets_won", 1);
                pay(store, user, row.wins, result);
            } else {
                data.offer = bundles(data.colors);
            }
        } else {
            row.losses++;
            row.state = "lost";
            row.ended = now;
            result.mode.lines.add(boss.name + " ended the run at " + row.wins + (row.wins == 1 ? " win." : " wins."));
            pay(store, user, row.wins, result);
        }
        store.maxStat(user, "gauntlet_best", row.wins);
        row.data = gson.toJson(data);
        store.putRun(user, row);
    }

    private CareerOffer bundles(String colors) {
        CareerOffer offer = new CareerOffer();
        offer.kind = "bundle";
        offer.pick = 1;
        List<CareerJumpstart.Pack> packs = new ArrayList<>(CareerJumpstart.get().inColors(colors));
        Collections.shuffle(packs, random);
        for (CareerJumpstart.Pack pack : packs.subList(0, Math.min(rules.bundles, packs.size()))) {
            List<DeckCardInfo> spells = new ArrayList<>();
            for (DeckCardInfo card : pack.cards) {
                if (!pack.isBasic(card)) {
                    for (int i = 0; i < card.getAmount(); i++) {
                        spells.add(card);
                    }
                }
            }
            Collections.shuffle(spells, random);
            CareerOfferOption option = new CareerOfferOption();
            option.id = pack.name;
            option.name = pack.name.replaceAll("\\s*\\(\\d+\\)$", "") + " bundle";
            option.color = pack.color;
            Map<String, CareerRunCard> cards = new LinkedHashMap<>();
            for (DeckCardInfo card : spells.subList(0, Math.min(rules.bundleSize, spells.size()))) {
                cards.merge(card.getSetCode() + "|" + card.getCardNumber(), new CareerRunCard(card, 1), (a, b) -> {
                    a.amount += b.amount;
                    return a;
                });
            }
            option.cards.addAll(cards.values());
            offer.options.add(option);
        }
        return offer;
    }

    private void pay(CareerStore store, String user, int wins, CareerProgress.CareerGameResult result) throws SQLException {
        Payout payout = null;
        for (Payout candidate : rules.rewards) {
            if (candidate.wins <= wins && (payout == null || candidate.wins > payout.wins)) {
                payout = candidate;
            }
        }
        if (payout == null) {
            return;
        }
        if (payout.coins > 0) {
            store.addCoins(user, payout.coins);
            result.coins += payout.coins;
            result.mode.coins += payout.coins;
        }
        if (payout.packs > 0) {
            store.addProfileInt(user, "pack_tokens", payout.packs);
            result.packs += payout.packs;
            result.mode.lines.add(payout.packs == 1 ? "A free pack." : payout.packs + " free packs.");
        }
        if (payout.wildcard != null) {
            store.addWildcard(user, payout.wildcard, 1);
            result.mode.lines.add("A " + payout.wildcard + " wildcard.");
        }
    }

    // ---- refusals out of a transaction

    private static SQLException refusal(String message) {
        return new SQLException(new CareerService.CareerException(message));
    }

    private interface Work<T> {
        T run() throws SQLException;
    }

    private static <T> T refusing(Work<T> work) throws SQLException, CareerService.CareerException {
        try {
            return work.run();
        } catch (SQLException e) {
            if (e.getCause() instanceof CareerService.CareerException) {
                throw (CareerService.CareerException) e.getCause();
            }
            throw e;
        }
    }
}
