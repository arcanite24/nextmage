package mage.server.career;

import com.google.gson.Gson;
import mage.ObjectColor;
import mage.cards.Card;
import mage.cards.ExpansionSet;
import mage.cards.Sets;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.function.Function;

/**
 * Solo sealed and draft in Career: pay coins to enter, keep every card opened, then play until three wins or two
 * losses against AI opponents whose decks come from their own pools (the draft's other seats, or their own sealed
 * packs). The draft's other seven seats are simple bots: they pick the best card in the colours they've settled on.
 */
public final class CareerLimited {

    public static final String SEALED = "sealed";
    public static final String DRAFT = "draft";
    public static final int SEALED_PACKS = 6;
    public static final int DRAFT_PACKS = 3;
    public static final int SEATS = 8;
    public static final int DECK_SIZE = 40;
    public static final int WINS = 3;
    public static final int LOSSES = 2;
    public static final int OPPONENT_SKILL = 4;

    /** coins to enter */
    public static int entry(String kind) {
        return SEALED.equals(kind) ? 400 : 250;
    }

    /** coins by wins at the end of a run */
    public static int reward(String kind, int wins) {
        int[] table = SEALED.equals(kind) ? new int[]{60, 120, 220, 380} : new int[]{30, 90, 170, 320};
        return table[Math.max(0, Math.min(wins, table.length - 1))];
    }

    // ---- state, kept as JSON in the run's row

    /** A card in a pool: enough to show it, count it and build with it. */
    public static class CareerPoolCard {
        public String name;
        public String setCode;
        public String cardNumber;
        public String rarity;
        /** WUBRG letters; empty for colourless */
        public String colors;
        public boolean creature;
        public boolean land;
        public int manaValue;
    }

    static class Draft {
        int round = 1;
        int pick = 1;
        /** each seat's current pack; seat 0 is the player */
        List<List<CareerPoolCard>> packs = new ArrayList<>();
        List<List<CareerPoolCard>> pools = new ArrayList<>();
    }

    static class RunData {
        String kind;
        String setCode;
        String setName;
        /** "draft", "build" or "play" */
        String phase;
        List<CareerPoolCard> pool = new ArrayList<>();
        List<DeckCardInfo> deck;
        Draft draft;
        List<List<CareerPoolCard>> opponents = new ArrayList<>();
    }

    // ---- views

    public static class CareerLimitedRun {
        public String id;
        public String kind;
        public String setCode;
        public String setName;
        /** "draft", "build", "play", or the end state ("won", "lost", "abandoned") */
        public String phase;
        public String state;
        public int wins;
        public int losses;
        public List<CareerPoolCard> pool;
        /** the pack to pick from, while drafting */
        public List<CareerPoolCard> pack;
        public int round;
        public int pick;
        public List<DeckCardInfo> deck;
        public int nextReward;
    }

    public static class CareerLimitedState {
        public int sealedEntry;
        public int draftEntry;
        public int[] sealedRewards;
        public int[] draftRewards;
        public CareerLimitedRun run;
        public List<CareerLimitedRun> recent = new ArrayList<>();
    }

    private static volatile CareerLimited instance;

    private final Gson gson = new Gson();
    private Random random = new Random();
    /** opens a pack of a set; tests swap it */
    private Function<String, List<CareerPoolCard>> boosters = CareerLimited::openBooster;

    private CareerLimited() {
    }

    public static CareerLimited get() {
        CareerLimited current = instance;
        if (current == null) {
            synchronized (CareerLimited.class) {
                current = instance;
                if (current == null) {
                    current = new CareerLimited();
                    instance = current;
                }
            }
        }
        return current;
    }

    void useBoosters(Function<String, List<CareerPoolCard>> boosters, Random random) {
        this.boosters = boosters;
        this.random = random;
    }

    private static List<CareerPoolCard> openBooster(String setCode) {
        ExpansionSet set = Sets.findSet(setCode);
        List<CareerPoolCard> pack = new ArrayList<>();
        if (set == null) {
            return pack;
        }
        for (Card card : set.createBooster()) {
            pack.add(poolCard(card));
        }
        return pack;
    }

    static CareerPoolCard poolCard(Card card) {
        CareerPoolCard pool = new CareerPoolCard();
        pool.name = card.getName();
        pool.setCode = card.getExpansionSetCode();
        pool.cardNumber = card.getCardNumber();
        pool.rarity = CareerRules.rarityOf(card.getRarity());
        pool.colors = colors(card.getColor(null));
        pool.creature = card.isCreature();
        pool.land = card.isLand();
        pool.manaValue = card.getManaValue();
        if (pool.land && card.isBasic()) {
            pool.rarity = CareerRules.LAND;
        }
        return pool;
    }

    private static String colors(ObjectColor color) {
        StringBuilder letters = new StringBuilder();
        if (color.isWhite()) {
            letters.append('W');
        }
        if (color.isBlue()) {
            letters.append('U');
        }
        if (color.isBlack()) {
            letters.append('B');
        }
        if (color.isRed()) {
            letters.append('R');
        }
        if (color.isGreen()) {
            letters.append('G');
        }
        return letters.toString();
    }

    // ---- reading

    public CareerLimitedState state(String user) throws SQLException {
        CareerStore store = CareerStore.get();
        CareerLimitedState state = new CareerLimitedState();
        state.sealedEntry = entry(SEALED);
        state.draftEntry = entry(DRAFT);
        state.sealedRewards = new int[]{reward(SEALED, 0), reward(SEALED, 1), reward(SEALED, 2), reward(SEALED, 3)};
        state.draftRewards = new int[]{reward(DRAFT, 0), reward(DRAFT, 1), reward(DRAFT, 2), reward(DRAFT, 3)};
        List<CareerStore.RunRow> rows = new ArrayList<>(store.runs(user, SEALED, false, 5));
        rows.addAll(store.runs(user, DRAFT, false, 5));
        rows.sort(Comparator.comparingLong((CareerStore.RunRow row) -> row.started).reversed());
        for (CareerStore.RunRow row : rows) {
            if ("active".equals(row.state) && state.run == null) {
                state.run = view(row);
            } else if (!"active".equals(row.state)) {
                CareerLimitedRun run = view(row);
                run.pool = null; // the list only needs the outcome
                run.deck = null;
                state.recent.add(run);
            }
        }
        return state;
    }

    private CareerLimitedRun view(CareerStore.RunRow row) {
        RunData data = gson.fromJson(row.data, RunData.class);
        CareerLimitedRun run = new CareerLimitedRun();
        run.id = row.id;
        run.kind = data.kind;
        run.setCode = data.setCode;
        run.setName = data.setName;
        run.state = row.state;
        run.phase = "active".equals(row.state) ? data.phase : row.state;
        run.wins = row.wins;
        run.losses = row.losses;
        run.pool = data.pool;
        run.deck = data.deck;
        run.nextReward = reward(data.kind, row.wins + 1);
        if (data.draft != null && "draft".equals(data.phase)) {
            run.pack = data.draft.packs.get(0);
            run.round = data.draft.round;
            run.pick = data.draft.pick;
        }
        return run;
    }

    private static CareerStore.RunRow active(CareerStore store, String user) throws SQLException {
        for (String kind : new String[]{SEALED, DRAFT}) {
            List<CareerStore.RunRow> rows = store.runs(user, kind, true, 1);
            if (!rows.isEmpty()) {
                return rows.get(0);
            }
        }
        return null;
    }

    // ---- starting

    public CareerLimitedRun start(String user, String kind, String setCode) throws SQLException, CareerService.CareerException {
        if (!SEALED.equals(kind) && !DRAFT.equals(kind)) {
            throw new CareerService.CareerException("Choose sealed or draft.");
        }
        boolean offered = CareerService.get().shop(user).stream().anyMatch(set -> set.setCode.equals(setCode) && !set.locked);
        if (!offered) {
            throw new CareerService.CareerException("The shop doesn't sell " + setCode + " packs, so it can't be played here.");
        }
        CareerStore store = CareerStore.get();
        return refusing(() -> store.transaction(() -> {
            CareerProfile profile = store.profile(user);
            if (profile == null) {
                throw refusal("Open a Career first.");
            }
            if (active(store, user) != null) {
                throw refusal("Finish or give up your " + kind + " run first.");
            }
            int cost = entry(kind);
            if (profile.coins < cost) {
                throw refusal("A " + kind + " run costs " + cost + " coins; you have " + profile.coins + ".");
            }
            store.addCoins(user, -cost);
            RunData data = new RunData();
            data.kind = kind;
            data.setCode = setCode;
            ExpansionSet set = Sets.findSet(setCode);
            data.setName = set == null ? setCode : set.getName();
            if (SEALED.equals(kind)) {
                data.pool = openPacks(setCode, SEALED_PACKS);
                for (int seat = 1; seat <= WINS + LOSSES - 1; seat++) {
                    data.opponents.add(build(openPacks(setCode, SEALED_PACKS)));
                }
                keep(store, user, data.pool);
                data.phase = "build";
            } else {
                data.draft = new Draft();
                for (int seat = 0; seat < SEATS; seat++) {
                    data.draft.packs.add(boosters.apply(setCode));
                    data.draft.pools.add(new ArrayList<>());
                }
                data.phase = "draft";
            }
            CareerStore.RunRow row = new CareerStore.RunRow();
            row.id = UUID.randomUUID().toString();
            row.kind = kind;
            row.started = System.currentTimeMillis();
            row.state = "active";
            row.data = gson.toJson(data);
            store.putRun(user, row);
            store.addStat(user, kind + "_runs", 1);
            return view(row);
        }));
    }

    private List<CareerPoolCard> openPacks(String setCode, int count) {
        List<CareerPoolCard> pool = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            pool.addAll(boosters.apply(setCode));
        }
        return pool;
    }

    /** the opened cards join the collection; copies past four become coins or wildcards as usual */
    private static void keep(CareerStore store, String user, List<CareerPoolCard> pool) throws SQLException {
        List<CareerCard> cards = new ArrayList<>();
        for (CareerPoolCard card : pool) {
            if (!CareerRules.LAND.equals(card.rarity)) {
                cards.add(new CareerCard(card.name, card.setCode, card.cardNumber, card.rarity));
            }
        }
        CareerService.get().addCards(store, user, cards);
    }

    // ---- drafting

    public CareerLimitedRun pick(String user, int index) throws SQLException, CareerService.CareerException {
        CareerStore store = CareerStore.get();
        return refusing(() -> store.transaction(() -> {
            CareerStore.RunRow row = active(store, user);
            if (row == null) {
                throw refusal("You have no limited run going.");
            }
            RunData data = gson.fromJson(row.data, RunData.class);
            if (!"draft".equals(data.phase) || data.draft == null) {
                throw refusal("The draft is over.");
            }
            Draft draft = data.draft;
            List<CareerPoolCard> mine = draft.packs.get(0);
            if (index < 0 || index >= mine.size()) {
                throw refusal("That card isn't in the pack.");
            }
            draft.pools.get(0).add(mine.remove(index));
            for (int seat = 1; seat < SEATS; seat++) {
                List<CareerPoolCard> pack = draft.packs.get(seat);
                if (!pack.isEmpty()) {
                    draft.pools.get(seat).add(pack.remove(botPick(pack, draft.pools.get(seat))));
                }
            }
            // pass: left in the first and third packs, right in the second
            if (draft.round % 2 == 1) {
                Collections.rotate(draft.packs, 1);
            } else {
                Collections.rotate(draft.packs, -1);
            }
            draft.pick++;
            if (draft.packs.get(0).isEmpty()) {
                if (draft.round < DRAFT_PACKS) {
                    draft.round++;
                    draft.pick = 1;
                    for (int seat = 0; seat < SEATS; seat++) {
                        draft.packs.set(seat, boosters.apply(data.setCode));
                    }
                } else {
                    data.pool = draft.pools.get(0);
                    for (int seat = 1; seat <= WINS + LOSSES - 1; seat++) {
                        data.opponents.add(build(draft.pools.get(seat)));
                    }
                    keep(store, user, data.pool);
                    data.draft = null;
                    data.phase = "build";
                }
            }
            row.data = gson.toJson(data);
            store.putRun(user, row);
            return view(row);
        }));
    }

    /** a bot takes the best card, keeping to its two main colours once it has a few picks */
    int botPick(List<CareerPoolCard> pack, List<CareerPoolCard> pool) {
        String colors = pool.size() < 4 ? "" : mainColors(pool);
        int best = 0;
        double bestScore = Double.NEGATIVE_INFINITY;
        for (int i = 0; i < pack.size(); i++) {
            CareerPoolCard card = pack.get(i);
            double score = value(card) + random.nextDouble() * 0.5;
            if (!colors.isEmpty() && !card.colors.isEmpty() && !fits(card, colors)) {
                score -= 3;
            }
            if (score > bestScore) {
                bestScore = score;
                best = i;
            }
        }
        return best;
    }

    private static double value(CareerPoolCard card) {
        double score;
        switch (card.rarity) {
            case CareerRules.MYTHIC:
                score = 5;
                break;
            case CareerRules.RARE:
                score = 4;
                break;
            case CareerRules.UNCOMMON:
                score = 2.5;
                break;
            case CareerRules.LAND:
                return -5;
            default:
                score = 1.5;
        }
        if (card.creature) {
            score += 0.75;
        }
        if (card.land) {
            score -= 1;
        }
        if (card.manaValue >= 6) {
            score -= 0.75;
        }
        return score;
    }

    private static boolean fits(CareerPoolCard card, String colors) {
        for (char color : card.colors.toCharArray()) {
            if (colors.indexOf(color) < 0) {
                return false;
            }
        }
        return true;
    }

    /** the two colours with the most value in a pool */
    static String mainColors(List<CareerPoolCard> pool) {
        Map<Character, Double> weight = new LinkedHashMap<>();
        for (char color : "WUBRG".toCharArray()) {
            weight.put(color, 0.0);
        }
        for (CareerPoolCard card : pool) {
            if (card.land) {
                continue;
            }
            for (char color : card.colors.toCharArray()) {
                weight.merge(color, value(card), Double::sum);
            }
        }
        List<Map.Entry<Character, Double>> sorted = new ArrayList<>(weight.entrySet());
        sorted.sort(Map.Entry.<Character, Double>comparingByValue().reversed());
        return "" + sorted.get(0).getKey() + sorted.get(1).getKey();
    }

    /** an AI's 40-card deck from a pool: its two best colours, 23 spells and 17 basic lands */
    static List<CareerPoolCard> build(List<CareerPoolCard> pool) {
        String colors = mainColors(pool);
        List<CareerPoolCard> spells = new ArrayList<>();
        for (CareerPoolCard card : pool) {
            if (!card.land && fits(card, colors)) {
                spells.add(card);
            }
        }
        spells.sort(Comparator.comparingDouble((CareerPoolCard card) -> -value(card)).thenComparingInt(card -> card.manaValue));
        List<CareerPoolCard> deck = new ArrayList<>(spells.subList(0, Math.min(23, spells.size())));
        int lands = DECK_SIZE - deck.size();
        Map<Character, Integer> symbols = new LinkedHashMap<>();
        for (char color : colors.toCharArray()) {
            symbols.put(color, 0);
        }
        for (CareerPoolCard card : deck) {
            for (char color : card.colors.toCharArray()) {
                symbols.merge(color, 1, Integer::sum);
            }
        }
        int total = Math.max(1, symbols.values().stream().mapToInt(Integer::intValue).sum());
        int left = lands;
        List<Character> order = new ArrayList<>(symbols.keySet());
        for (int i = 0; i < order.size(); i++) {
            char color = order.get(i);
            int count = i == order.size() - 1 ? left : Math.round((float) lands * symbols.get(color) / total);
            count = Math.min(left, count);
            left -= count;
            for (int n = 0; n < count; n++) {
                deck.add(basic(color));
            }
        }
        return deck;
    }

    private static final Map<Character, String> BASIC_NAMES = new LinkedHashMap<>();

    static {
        BASIC_NAMES.put('W', "Plains");
        BASIC_NAMES.put('U', "Island");
        BASIC_NAMES.put('B', "Swamp");
        BASIC_NAMES.put('R', "Mountain");
        BASIC_NAMES.put('G', "Forest");
    }

    private static CareerPoolCard basic(char color) {
        CareerPoolCard card = new CareerPoolCard();
        card.name = BASIC_NAMES.get(color);
        card.rarity = CareerRules.LAND;
        card.colors = "";
        card.land = true;
        return card;
    }

    // ---- building and playing

    /** saves the player's deck: at least 40 cards, only cards from the pool plus any basic lands */
    public CareerLimitedRun submitDeck(String user, DeckCardLists deck) throws SQLException, CareerService.CareerException {
        CareerStore store = CareerStore.get();
        return refusing(() -> store.transaction(() -> {
            CareerStore.RunRow row = active(store, user);
            if (row == null) {
                throw refusal("You have no limited run going.");
            }
            RunData data = gson.fromJson(row.data, RunData.class);
            if ("draft".equals(data.phase)) {
                throw refusal("Finish the draft first.");
            }
            int size = deck.getCards().stream().mapToInt(DeckCardInfo::getAmount).sum();
            if (size < DECK_SIZE) {
                throw refusal("A limited deck needs at least " + DECK_SIZE + " cards; this one has " + size + ".");
            }
            Map<String, Integer> available = new LinkedHashMap<>();
            for (CareerPoolCard card : data.pool) {
                available.merge(card.name, 1, Integer::sum);
            }
            Map<String, Integer> used = new LinkedHashMap<>();
            for (DeckCardInfo card : deck.getCards()) {
                if (!CareerService.isBasic(card.getCardName())) {
                    used.merge(card.getCardName(), card.getAmount(), Integer::sum);
                }
            }
            for (Map.Entry<String, Integer> entry : used.entrySet()) {
                int have = available.getOrDefault(entry.getKey(), 0);
                if (entry.getValue() > have) {
                    throw refusal(entry.getKey() + ": " + entry.getValue() + " in the deck, " + have + " in your pool.");
                }
            }
            data.deck = new ArrayList<>(deck.getCards());
            data.phase = "play";
            row.data = gson.toJson(data);
            store.putRun(user, row);
            return view(row);
        }));
    }

    public CareerLimitedRun abandon(String user) throws SQLException, CareerService.CareerException {
        CareerStore store = CareerStore.get();
        return refusing(() -> store.transaction(() -> {
            CareerStore.RunRow row = active(store, user);
            if (row == null) {
                throw refusal("You have no limited run going.");
            }
            RunData data = gson.fromJson(row.data, RunData.class);
            if ("draft".equals(data.phase) && data.draft != null) {
                // the cards picked so far are kept
                keep(store, user, data.draft.pools.get(0));
            }
            row.state = "abandoned";
            row.ended = System.currentTimeMillis();
            store.putRun(user, row);
            return view(row);
        }));
    }

    /** What the next game needs. */
    public static class Plan {
        public String runId;
        public String opponentName;
        public DeckCardLists playerDeck;
        public DeckCardLists opponentDeck;
    }

    public Plan plan(String user) throws SQLException, CareerService.CareerException {
        CareerStore store = CareerStore.get();
        CareerStore.RunRow row = active(store, user);
        if (row == null) {
            throw new CareerService.CareerException("You have no limited run going.");
        }
        RunData data = gson.fromJson(row.data, RunData.class);
        if (!"play".equals(data.phase) || data.deck == null) {
            throw new CareerService.CareerException("Build your deck first.");
        }
        int game = row.wins + row.losses;
        Plan plan = new Plan();
        plan.runId = row.id;
        plan.opponentName = "Rival " + (game + 1);
        plan.playerDeck = new DeckCardLists();
        plan.playerDeck.setName(data.setName + " " + data.kind);
        for (DeckCardInfo card : data.deck) {
            plan.playerDeck.getCards().add(withPrinting(card));
        }
        plan.opponentDeck = new DeckCardLists();
        plan.opponentDeck.setName(plan.opponentName);
        Map<String, Integer> counts = new LinkedHashMap<>();
        Map<String, CareerPoolCard> byKey = new LinkedHashMap<>();
        for (CareerPoolCard card : data.opponents.get(Math.min(game, data.opponents.size() - 1))) {
            String key = card.name + "|" + card.setCode + "|" + card.cardNumber;
            counts.merge(key, 1, Integer::sum);
            byKey.put(key, card);
        }
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            CareerPoolCard card = byKey.get(entry.getKey());
            plan.opponentDeck.getCards().add(withPrinting(new DeckCardInfo(card.name, card.cardNumber, card.setCode, entry.getValue())));
        }
        return plan;
    }

    /** basic lands without a printing get the preferred one, so the deck loads */
    private static DeckCardInfo withPrinting(DeckCardInfo card) {
        if (card.getSetCode() != null && card.getCardNumber() != null) {
            return card;
        }
        CardInfo info = CardRepository.instance.findPreferredCoreExpansionCard(card.getCardName());
        return info == null ? card : new DeckCardInfo(info.getName(), info.getCardNumber(), info.getSetCode(), card.getAmount());
    }

    void finished(CareerStore store, String user, String runId, boolean won, CareerProgress.CareerGameResult result, long now) throws SQLException {
        CareerStore.RunRow row = store.run(user, runId);
        if (row == null || !"active".equals(row.state)) {
            return;
        }
        RunData data = gson.fromJson(row.data, RunData.class);
        result.mode = new CareerProgress.CareerModeResult("limited", data.setName + " " + data.kind);
        result.mode.ref = runId;
        if (won) {
            row.wins++;
        } else {
            row.losses++;
        }
        result.mode.lines.add((won ? "A win. " : "A loss. ") + row.wins + "-" + row.losses + " so far.");
        if (row.wins >= WINS || row.losses >= LOSSES) {
            row.state = row.wins >= WINS ? "won" : "lost";
            row.ended = now;
            int coins = reward(data.kind, row.wins);
            store.addCoins(user, coins);
            result.coins += coins;
            result.mode.coins += coins;
            result.mode.lines.add("The run is over at " + row.wins + "-" + row.losses + ".");
            store.maxStat(user, data.kind + "_best", row.wins);
        }
        store.putRun(user, row);
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
