package mage.server.career;

import com.google.gson.Gson;
import mage.cards.Card;
import mage.cards.ExpansionSet;
import mage.cards.Sets;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import mage.constants.SetType;
import mage.constants.SuperType;
import org.apache.log4j.Logger;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Career rules over the store: opening a Career, owning cards, paying out matches once, the shop, crafting, and
 * export files. Off unless the server has accounts and XMAGE_CAREER (or -Dxmage.career) isn't "off".
 */
public final class CareerService {

    private static final Logger logger = Logger.getLogger(CareerService.class);
    private static final CareerService INSTANCE = new CareerService();
    private static final Set<String> BASIC_NAMES = new java.util.HashSet<>(java.util.Arrays.asList(
            "Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes",
            "Snow-Covered Plains", "Snow-Covered Island", "Snow-Covered Swamp", "Snow-Covered Mountain", "Snow-Covered Forest",
            "Snow-Covered Wastes"));

    /** Career tables running now: table id to who plays whom */
    private final Map<UUID, CareerTable> tables = new ConcurrentHashMap<>();
    private volatile Function<String, CardInfo> cardLookup = CareerService::lookupPrinting;

    public static class CareerTable {
        public final String user;
        public final String opponentId;
        public final int tier;

        CareerTable(String user, String opponentId, int tier) {
            this.user = user;
            this.opponentId = opponentId;
            this.tier = tier;
        }
    }

    /** One opponent of the roster as a player sees it. */
    public static class CareerOpponent {
        public String id;
        public String name;
        public int tier;
        public String tierName;
        public String colors;
        public String tagline;
        public boolean unlocked;
        public int wins;
        /** coins a win pays */
        public int winCoins;
    }

    /** A set the shop sells packs of. */
    public static class CareerShopSet {
        public String setCode;
        public String name;
        public String releaseDate;
        public int price;
    }

    /** What a pack gave, and the Career afterwards. */
    public static class CareerPackResult {
        public String setCode;
        public List<CareerCard> cards;
        public CareerProfile profile;
    }

    private CareerService() {
    }

    public static CareerService get() {
        return INSTANCE;
    }

    /** the server switch: Career runs only with accounts, and can be turned off */
    public static boolean enabled(boolean accounts) {
        String setting = System.getProperty("xmage.career", System.getenv("XMAGE_CAREER"));
        return accounts && !"off".equalsIgnoreCase(setting == null ? "" : setting.trim());
    }

    /** for tests: resolve cards without the card database */
    void useCardLookup(Function<String, CardInfo> lookup) {
        cardLookup = lookup;
    }

    // ---- opening a Career

    public CareerProfile start(String user, String starterId) throws SQLException, CareerException {
        CareerContent content = CareerContent.get();
        if (content.starter(starterId) == null) {
            throw new CareerException("There is no starter deck " + starterId + ".");
        }
        DeckCardLists deck;
        try {
            deck = content.starterDeck(starterId);
        } catch (java.io.IOException e) {
            throw new CareerException("The starter deck can't be read: " + e.getMessage());
        }
        CareerStore store = CareerStore.get();
        boolean created = store.transaction(() -> {
            if (!store.createProfile(user, starterId, CareerRules.START_COINS, System.currentTimeMillis())) {
                return false;
            }
            for (DeckCardInfo info : CareerContent.allCards(deck)) {
                CareerCard card = resolve(info);
                if (card != null && !CareerRules.LAND.equals(card.rarity)) {
                    store.addCard(user, card, info.getAmount());
                }
            }
            return true;
        });
        if (!created) {
            throw new CareerException("You already have a Career.");
        }
        return store.profile(user);
    }

    private CareerCard resolve(DeckCardInfo info) {
        CardInfo card = info.getSetCode() != null && info.getCardNumber() != null
                ? cardLookup.apply(info.getSetCode() + "|" + info.getCardNumber())
                : null;
        if (card == null) {
            card = cardLookup.apply("name|" + info.getCardName());
        }
        if (card == null) {
            logger.warn("Career: no card found for " + info.getCardName());
            return null;
        }
        return toCareerCard(card);
    }

    static CareerCard toCareerCard(CardInfo card) {
        boolean basic = card.getSupertypes().contains(SuperType.BASIC) || BASIC_NAMES.contains(card.getName());
        String rarity = basic ? CareerRules.LAND : CareerRules.rarityOf(card.getRarity());
        return new CareerCard(card.getName(), card.getSetCode(), card.getCardNumber(), rarity);
    }

    private static CardInfo lookupPrinting(String key) {
        if (key.startsWith("name|")) {
            return CardRepository.instance.findPreferredCoreExpansionCard(key.substring(5));
        }
        String[] parts = key.split("\\|", 2);
        return CardRepository.instance.findCard(parts[0], parts[1]);
    }

    // ---- owning cards

    public static boolean isBasic(String name) {
        return BASIC_NAMES.contains(name);
    }

    /**
     * Cards the deck has more copies of than the account owns, as "Name: 3 in the deck, 2 owned" lines. Basic lands are
     * free. Empty when the deck can be played.
     */
    public List<String> ownershipProblems(String user, DeckCardLists deck) throws SQLException {
        Map<String, Integer> needed = new LinkedHashMap<>();
        for (DeckCardInfo info : CareerContent.allCards(deck)) {
            if (!isBasic(info.getCardName())) {
                needed.merge(info.getCardName(), info.getAmount(), Integer::sum);
            }
        }
        List<String> problems = new ArrayList<>();
        CareerStore store = CareerStore.get();
        for (Map.Entry<String, Integer> entry : needed.entrySet()) {
            int owned = store.owned(user, entry.getKey());
            if (owned < entry.getValue()) {
                problems.add(entry.getKey() + ": " + entry.getValue() + " in the deck, " + owned + " owned");
            }
        }
        return problems;
    }

    // ---- opponents

    public List<CareerOpponent> opponents(String user) throws SQLException {
        CareerContent content = CareerContent.get();
        Map<String, Integer> wins = CareerStore.get().winsByOpponent(user);
        Map<Integer, Integer> winsByTier = new LinkedHashMap<>();
        for (CareerContent.Opponent opponent : content.opponents()) {
            winsByTier.merge(opponent.tier, wins.getOrDefault(opponent.id, 0), Integer::sum);
        }
        List<CareerOpponent> views = new ArrayList<>();
        for (CareerContent.Opponent opponent : content.opponents()) {
            CareerOpponent view = new CareerOpponent();
            view.id = opponent.id;
            view.name = opponent.name;
            view.tier = opponent.tier;
            view.tierName = content.tier(opponent.tier).name;
            view.colors = opponent.colors;
            view.tagline = opponent.tagline;
            view.wins = wins.getOrDefault(opponent.id, 0);
            view.unlocked = opponent.tier == 1 || winsByTier.getOrDefault(opponent.tier - 1, 0) >= CareerRules.WINS_TO_UNLOCK_NEXT_TIER;
            view.winCoins = CareerRules.winCoins(opponent.tier);
            views.add(view);
        }
        return views;
    }

    public boolean unlocked(String user, String opponentId) throws SQLException {
        return opponents(user).stream().anyMatch(view -> view.id.equals(opponentId) && view.unlocked);
    }

    // ---- Career tables and payouts

    public void register(UUID tableId, String user, String opponentId, int tier) {
        tables.put(tableId, new CareerTable(user, opponentId, tier));
    }

    public boolean isCareerTable(UUID tableId) {
        return tableId != null && tables.containsKey(tableId);
    }

    public void forget(UUID tableId) {
        if (tableId != null) {
            tables.remove(tableId);
        }
    }

    /**
     * A Career match ended: pay it, once. Called by the server when the match is over; the payout is keyed by the
     * table, so a second call (or a reconnect) pays nothing.
     *
     * @param turns the turn the last game ended on
     * @return the payout, or null when the table isn't a Career table or was paid before
     */
    public CareerPayout matchEnded(UUID tableId, boolean won, int turns) {
        CareerTable table = tables.remove(tableId);
        if (table == null) {
            return null;
        }
        CareerRules.Reward reward = CareerRules.reward(table.tier, won, turns);
        try {
            long now = System.currentTimeMillis();
            boolean paid = CareerStore.get().payout(tableId.toString(), table.user, table.opponentId, won,
                    reward.coins, reward.xp, reward.note, now);
            if (!paid) {
                return null;
            }
            CareerPayout payout = new CareerPayout();
            payout.matchKey = tableId.toString();
            payout.at = now;
            payout.opponent = table.opponentId;
            payout.won = won;
            payout.coins = reward.coins;
            payout.xp = reward.xp;
            payout.note = reward.note;
            return payout;
        } catch (SQLException | RuntimeException e) {
            logger.error("Career payout failed for " + table.user + " on table " + tableId, e);
            return null;
        }
    }

    // ---- the shop

    /** sets with boosters, newest first: core sets and expansions that are out */
    public List<CareerShopSet> shop() {
        Date now = new Date();
        return Sets.getInstance().values().stream()
                .filter(ExpansionSet::hasBoosters)
                .filter(set -> set.getSetType() == SetType.EXPANSION || set.getSetType() == SetType.CORE)
                .filter(set -> set.getReleaseDate() != null && !set.getReleaseDate().after(now))
                .sorted(Comparator.comparing(ExpansionSet::getReleaseDate).reversed())
                .map(set -> {
                    CareerShopSet view = new CareerShopSet();
                    view.setCode = set.getCode();
                    view.name = set.getName();
                    view.releaseDate = new java.text.SimpleDateFormat("yyyy-MM-dd").format(set.getReleaseDate());
                    view.price = CareerRules.PACK_PRICE;
                    return view;
                })
                .collect(Collectors.toList());
    }

    public CareerPackResult buyPack(String user, String setCode) throws SQLException, CareerException {
        ExpansionSet set = Sets.findSet(setCode);
        if (set == null || shop().stream().noneMatch(offer -> offer.setCode.equals(set.getCode()))) {
            throw new CareerException("The shop has no packs of " + setCode + ".");
        }
        List<Card> booster = set.createBooster();
        if (booster.isEmpty()) {
            throw new CareerException("Packs of " + set.getName() + " can't be opened right now.");
        }
        List<CareerCard> cards = new ArrayList<>();
        for (Card card : booster) {
            CardInfo info = cardLookup.apply(card.getExpansionSetCode() + "|" + card.getCardNumber());
            CareerCard careerCard = info != null ? toCareerCard(info)
                    : new CareerCard(card.getName(), card.getExpansionSetCode(), card.getCardNumber(), CareerRules.rarityOf(card.getRarity()));
            cards.add(careerCard);
        }
        return open(user, set.getCode(), cards);
    }

    /** pays for a pack and adds its cards; copies past the playset become coins or wildcards */
    CareerPackResult open(String user, String setCode, List<CareerCard> cards) throws SQLException, CareerException {
        CareerStore store = CareerStore.get();
        refusing(() -> store.transaction(() -> {
            CareerProfile profile = store.profile(user);
            if (profile == null) {
                throw new SQLException(new CareerException("Open a Career first."));
            }
            if (profile.coins < CareerRules.PACK_PRICE) {
                throw new SQLException(new CareerException("A pack costs " + CareerRules.PACK_PRICE + " coins; you have " + profile.coins + "."));
            }
            store.addCoins(user, -CareerRules.PACK_PRICE);
            for (CareerCard card : cards) {
                if (CareerRules.LAND.equals(card.rarity)) {
                    continue;
                }
                if (store.owned(user, card.name) >= CareerRules.PLAYSET) {
                    int coins = CareerRules.spareCoins(card.rarity);
                    if (coins > 0) {
                        store.addCoins(user, coins);
                        card.convertedTo = "coins";
                    } else {
                        store.addWildcard(user, card.rarity, 1);
                        card.convertedTo = "wildcard";
                    }
                } else {
                    store.addCard(user, card, 1);
                }
            }
            return null;
        }));
        CareerPackResult result = new CareerPackResult();
        result.setCode = setCode;
        result.cards = cards;
        result.profile = store.profile(user);
        return result;
    }

    // ---- crafting

    public CareerProfile craft(String user, String setCode, String cardNumber) throws SQLException, CareerException {
        CardInfo info = cardLookup.apply(setCode + "|" + cardNumber);
        if (info == null) {
            throw new CareerException("There is no card " + setCode + " " + cardNumber + ".");
        }
        CareerCard card = toCareerCard(info);
        if (CareerRules.LAND.equals(card.rarity)) {
            throw new CareerException("Basic lands are free; there's nothing to craft.");
        }
        CareerStore store = CareerStore.get();
        refusing(() -> store.transaction(() -> {
            CareerProfile profile = store.profile(user);
            if (profile == null) {
                throw new SQLException(new CareerException("Open a Career first."));
            }
            if (store.owned(user, card.name) >= CareerRules.PLAYSET) {
                throw new SQLException(new CareerException("You already have " + CareerRules.PLAYSET + " copies of " + card.name + "."));
            }
            int coins = CareerRules.craftCoins(card.rarity);
            if (coins > 0) {
                if (profile.coins < coins) {
                    throw new SQLException(new CareerException(card.name + " costs " + coins + " coins to craft; you have " + profile.coins + "."));
                }
                store.addCoins(user, -coins);
            } else {
                int wildcards = CareerRules.MYTHIC.equals(card.rarity) ? profile.wildcards.mythic : profile.wildcards.rare;
                if (wildcards < 1) {
                    throw new SQLException(new CareerException(card.name + " takes a " + card.rarity + " wildcard; you have none."));
                }
                store.addWildcard(user, card.rarity, -1);
            }
            store.addCard(user, card, 1);
            return null;
        }));
        return store.profile(user);
    }

    // ---- export and import

    static class ExportFile {
        int version = 1;
        String user;
        long exportedAt;
        CareerProfile profile;
        List<CareerCard> cards;
        List<CareerPayout> payouts;
    }

    /** the whole Career as a signed text file, for keeping a copy or moving it back after a loss */
    public String export(String user) throws SQLException, CareerException {
        CareerStore store = CareerStore.get();
        ExportFile file = new ExportFile();
        file.user = user;
        file.exportedAt = System.currentTimeMillis();
        file.profile = store.profile(user);
        if (file.profile == null) {
            throw new CareerException("There's no Career to export.");
        }
        file.cards = store.collection(user);
        file.payouts = store.payouts(user, Integer.MAX_VALUE);
        String body = Base64.getEncoder().encodeToString(new Gson().toJson(file).getBytes(StandardCharsets.UTF_8));
        return "career1." + body + "." + sign(body, store.secret());
    }

    /**
     * Brings back an exported Career for an account that has none (lost, or moved to a new database). Only files this
     * server signed, for this account, are taken. An existing Career is never replaced, so an old file can't be used to
     * undo pack openings.
     */
    public CareerProfile importFile(String user, String text) throws SQLException, CareerException {
        CareerStore store = CareerStore.get();
        if (store.profile(user) != null) {
            throw new CareerException("You already have a Career; a Career file only brings one back to an account without one.");
        }
        String[] parts = text == null ? new String[0] : text.trim().split("\\.");
        if (parts.length != 3 || !"career1".equals(parts[0])) {
            throw new CareerException("That isn't a Career file.");
        }
        byte[] expected = sign(parts[1], store.secret()).getBytes(StandardCharsets.US_ASCII);
        if (!MessageDigest.isEqual(expected, parts[2].getBytes(StandardCharsets.US_ASCII))) {
            throw new CareerException("That Career file wasn't made by this server, or it was changed.");
        }
        ExportFile file;
        try {
            file = new Gson().fromJson(new String(Base64.getDecoder().decode(parts[1]), StandardCharsets.UTF_8), ExportFile.class);
        } catch (RuntimeException e) {
            throw new CareerException("That Career file can't be read.");
        }
        if (file == null || file.profile == null || file.user == null
                || !file.user.toLowerCase(Locale.ENGLISH).equals(user.toLowerCase(Locale.ENGLISH))) {
            throw new CareerException("That Career file belongs to another account.");
        }
        store.transaction(() -> {
            store.deleteProfile(user);
            if (!store.createProfile(user, file.profile.starter, file.profile.coins, file.profile.created)) {
                throw new SQLException("A Career appeared for " + user + " during the import");
            }
            store.restoreProgress(user, file.profile);
            for (CareerCard card : file.cards == null ? Collections.<CareerCard>emptyList() : file.cards) {
                store.addCard(user, card, card.count);
            }
            for (CareerPayout payout : file.payouts == null ? Collections.<CareerPayout>emptyList() : file.payouts) {
                store.restorePayout(user, payout);
            }
            return null;
        });
        return store.profile(user);
    }

    static String sign(String body, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** A Career rule said no; the message is for the player. */
    public static class CareerException extends Exception {
        public CareerException(String message) {
            super(message);
        }
    }

    private interface Refusable {
        void run() throws SQLException;
    }

    /** a refusal is thrown out of a store transaction wrapped in an SQLException (to roll it back); unwrap it */
    private static void refusing(Refusable work) throws SQLException, CareerException {
        try {
            work.run();
        } catch (SQLException e) {
            if (e.getCause() instanceof CareerException) {
                throw (CareerException) e.getCause();
            }
            throw e;
        }
    }
}
