package mage.server.career;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
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

/**
 * Campaigns: chapters of duels and choices, as data (resources/career/campaigns). A node opens when every node it
 * requires is done ("node" or "node:option" for a particular choice); a duel's reward is paid the first time it's won.
 * The decks live next to the campaign files, and a chapter's deck is what the player plays its duels with.
 */
public final class CareerCampaigns {

    private static final String ROOT = "/career/campaigns/";

    // ---- content

    public static class Campaign {
        public String id;
        public String name;
        public String text;
        /** a client-side game played before the first chapter (the guided first game) */
        public String prologue;
        public List<Chapter> chapters;
    }

    public static class Chapter {
        public String id;
        public String name;
        /** WUBRG letters */
        public String color;
        public String text;
        /** the deck the player plays this chapter's duels with */
        public String deck;
        public String deckName;
        /** the shop set the chapter's boss opens */
        public String unlockSet;
        public List<Node> nodes;
    }

    public static class Node {
        public String id;
        /** "duel" or "choice" */
        public String type;
        public String name;
        public String text;
        public boolean boss;
        public NodeOpponent opponent;
        public List<String> requires;
        public CareerReward reward;
        public List<CareerOption> options;
        /** what the opponent says before the duel */
        public String before;
        /** what the opponent says once beaten */
        public String after;
    }

    public static class NodeOpponent {
        public String name;
        public String deck;
        public int skill;
        public String aiType;
        public CareerSetup.CareerTwists twists;
    }

    public static class CareerOption {
        public String id;
        public String text;
        public CareerReward reward;
    }

    /** What finishing a node gives, the first time. */
    public static class CareerReward {
        public int coins;
        public int xp;
        public int packs;
        /** a wildcard of this rarity */
        public String wildcard;
        /** the chapter's deck joins the collection */
        public boolean deckCards;
        /** this set's packs appear in the shop */
        public String unlockSet;
    }

    // ---- views

    public static class CareerCampaign {
        public String id;
        public String name;
        public String text;
        public String prologue;
        public List<CareerChapter> chapters = new ArrayList<>();
        public int done;
        public int total;
    }

    public static class CareerChapter {
        public String id;
        public String name;
        public String color;
        public String text;
        public String deckName;
        public String unlockSet;
        public boolean done;
        public List<CareerNode> nodes = new ArrayList<>();
    }

    public static class CareerNode {
        public String id;
        public String type;
        public String name;
        public String text;
        public boolean boss;
        /** "locked", "open" or "done" */
        public String state;
        /** the option taken, for a finished choice */
        public String choice;
        public List<String> requires;
        public CareerReward reward;
        public List<CareerOption> options;
        public int skill;
        public CareerSetup.CareerTwists twists;
        /** the card whose art is the opponent's portrait */
        public CareerContent.CareerCover cover;
        /** what the opponent says before the duel */
        public String before;
        /** what the opponent says once beaten */
        public String after;
    }

    /** What a played duel needs: who, with which decks, and how the game starts. */
    public static class DuelPlan {
        public String key;
        public String opponentName;
        public int skill;
        public String aiType;
        public DeckCardLists playerDeck;
        public DeckCardLists opponentDeck;
        public CareerSetup setup;
    }

    private static volatile CareerCampaigns instance;

    private final Map<String, Campaign> campaigns = new LinkedHashMap<>();

    private CareerCampaigns() throws IOException {
        Gson gson = new Gson();
        List<String> ids;
        try (Reader reader = resource("index.json")) {
            ids = gson.fromJson(reader, new TypeToken<List<String>>() {
            }.getType());
        }
        for (String id : ids) {
            try (Reader reader = resource(id + ".json")) {
                Campaign campaign = gson.fromJson(reader, Campaign.class);
                campaigns.put(campaign.id, campaign);
            }
        }
    }

    private static Reader resource(String name) throws IOException {
        InputStream stream = CareerCampaigns.class.getResourceAsStream(ROOT + name);
        if (stream == null) {
            throw new IOException("Missing campaign resource " + name);
        }
        return new InputStreamReader(stream, StandardCharsets.UTF_8);
    }

    public static CareerCampaigns get() {
        CareerCampaigns current = instance;
        if (current == null) {
            synchronized (CareerCampaigns.class) {
                current = instance;
                if (current == null) {
                    try {
                        current = new CareerCampaigns();
                    } catch (IOException | RuntimeException e) {
                        throw new IllegalStateException("Campaigns can't be read: " + e.getMessage(), e);
                    }
                    instance = current;
                }
            }
        }
        return current;
    }

    public Map<String, Campaign> campaigns() {
        return Collections.unmodifiableMap(campaigns);
    }

    public DeckCardLists deck(String file) throws IOException {
        return CareerContent.deck("campaigns/decks/" + file);
    }

    static String key(String campaign, String node) {
        return campaign + "/" + node;
    }

    private Campaign campaign(String id) throws CareerService.CareerException {
        Campaign campaign = campaigns.get(id);
        if (campaign == null) {
            throw new CareerService.CareerException("There is no campaign " + id + ".");
        }
        return campaign;
    }

    private static Chapter chapterOf(Campaign campaign, String nodeId) {
        for (Chapter chapter : campaign.chapters) {
            for (Node node : chapter.nodes) {
                if (node.id.equals(nodeId)) {
                    return chapter;
                }
            }
        }
        return null;
    }

    private static Node node(Chapter chapter, String nodeId) {
        return chapter.nodes.stream().filter(node -> node.id.equals(nodeId)).findFirst().orElse(null);
    }

    /** every requirement is met: "node" is done, or "node:option" was chosen */
    static boolean open(Node node, Map<String, String> done) {
        if (node.requires == null) {
            return true;
        }
        for (String requirement : node.requires) {
            int colon = requirement.indexOf(':');
            String id = colon < 0 ? requirement : requirement.substring(0, colon);
            if (!done.containsKey(id) || (colon >= 0 && !requirement.substring(colon + 1).equals(done.get(id)))) {
                return false;
            }
        }
        return true;
    }

    // ---- reading progress

    public List<CareerCampaign> campaigns(String user) throws SQLException {
        CareerStore store = CareerStore.get();
        List<CareerCampaign> views = new ArrayList<>();
        for (Campaign campaign : campaigns.values()) {
            Map<String, String> done = store.campaignNodes(user, campaign.id);
            CareerCampaign view = new CareerCampaign();
            view.id = campaign.id;
            view.name = campaign.name;
            view.text = campaign.text;
            view.prologue = campaign.prologue;
            for (Chapter chapter : campaign.chapters) {
                CareerChapter chapterView = new CareerChapter();
                chapterView.id = chapter.id;
                chapterView.name = chapter.name;
                chapterView.color = chapter.color;
                chapterView.text = chapter.text;
                chapterView.deckName = chapter.deckName;
                chapterView.unlockSet = chapter.unlockSet;
                boolean all = true;
                for (Node node : chapter.nodes) {
                    CareerNode nodeView = new CareerNode();
                    nodeView.id = node.id;
                    nodeView.type = node.type;
                    nodeView.name = node.name;
                    nodeView.text = node.text;
                    nodeView.boss = node.boss;
                    nodeView.requires = node.requires;
                    nodeView.reward = node.reward;
                    nodeView.options = node.options;
                    if (node.opponent != null) {
                        nodeView.skill = node.opponent.skill;
                        nodeView.twists = node.opponent.twists;
                        nodeView.cover = CareerContent.coverOf("campaigns/decks/" + node.opponent.deck);
                        nodeView.before = node.before;
                        nodeView.after = node.after;
                    }
                    if (done.containsKey(node.id)) {
                        nodeView.state = "done";
                        nodeView.choice = done.get(node.id).isEmpty() ? null : done.get(node.id);
                        view.done++;
                    } else {
                        nodeView.state = open(node, done) ? "open" : "locked";
                        all = false;
                    }
                    view.total++;
                    chapterView.nodes.add(nodeView);
                }
                chapterView.done = all;
                view.chapters.add(chapterView);
            }
            views.add(view);
        }
        return views;
    }

    // ---- playing

    /** a duel the player may start now (open, or done and played again) */
    public DuelPlan plan(String user, String campaignId, String nodeId) throws SQLException, CareerService.CareerException, IOException {
        Campaign campaign = campaign(campaignId);
        Chapter chapter = chapterOf(campaign, nodeId);
        Node node = chapter == null ? null : node(chapter, nodeId);
        if (node == null || !"duel".equals(node.type) || node.opponent == null) {
            throw new CareerService.CareerException("There is no duel " + nodeId + " in " + campaign.name + ".");
        }
        Map<String, String> done = CareerStore.get().campaignNodes(user, campaignId);
        if (!done.containsKey(node.id) && !open(node, done)) {
            throw new CareerService.CareerException(node.name + " isn't open yet.");
        }
        DuelPlan plan = new DuelPlan();
        plan.key = key(campaignId, nodeId);
        plan.opponentName = node.opponent.name;
        plan.skill = node.opponent.skill;
        plan.aiType = node.opponent.aiType;
        plan.playerDeck = deck(chapter.deck);
        plan.opponentDeck = deck(node.opponent.deck);
        plan.setup = CareerSetup.ofTwists(node.opponent.twists);
        return plan;
    }

    /** takes an option at a choice node, once, and pays it */
    public CareerProgress.CareerGameResult choose(String user, String campaignId, String nodeId, String optionId)
            throws SQLException, CareerService.CareerException {
        Campaign campaign = campaign(campaignId);
        Chapter chapter = chapterOf(campaign, nodeId);
        Node node = chapter == null ? null : node(chapter, nodeId);
        if (node == null || !"choice".equals(node.type) || node.options == null) {
            throw new CareerService.CareerException("There is no choice " + nodeId + " in " + campaign.name + ".");
        }
        CareerOption option = node.options.stream().filter(candidate -> candidate.id.equals(optionId)).findFirst().orElse(null);
        if (option == null) {
            throw new CareerService.CareerException("That isn't one of the options.");
        }
        CareerStore store = CareerStore.get();
        try {
            return store.transaction(() -> {
                CareerProfile profile = store.profile(user);
                if (profile == null) {
                    throw new SQLException(new CareerService.CareerException("Open a Career first."));
                }
                Map<String, String> done = store.campaignNodes(user, campaignId);
                if (done.containsKey(node.id)) {
                    throw new SQLException(new CareerService.CareerException("You've already chosen here."));
                }
                if (!open(node, done)) {
                    throw new SQLException(new CareerService.CareerException(node.name + " isn't open yet."));
                }
                long now = System.currentTimeMillis();
                store.finishCampaignNode(user, campaignId, node.id, option.id, now);
                CareerProgress.CareerGameResult result = new CareerProgress.CareerGameResult();
                result.gameKey = key(campaignId, node.id);
                result.career = true;
                result.mode = new CareerProgress.CareerModeResult("campaign", node.name);
                pay(store, user, chapter, option.reward, result, now);
                CareerProgress.get().levelsIn(store, user, profile.xp, result, now);
                return result;
            });
        } catch (SQLException e) {
            if (e.getCause() instanceof CareerService.CareerException) {
                throw (CareerService.CareerException) e.getCause();
            }
            throw e;
        }
    }

    /**
     * A campaign duel ended (inside the payout transaction): the first win finishes the node and pays its reward.
     */
    void finished(CareerStore store, String user, String key, boolean won, CareerProgress.CareerGameResult result, long now) throws SQLException {
        int slash = key.indexOf('/');
        Campaign campaign = campaigns.get(key.substring(0, slash));
        String nodeId = key.substring(slash + 1);
        Chapter chapter = campaign == null ? null : chapterOf(campaign, nodeId);
        Node node = chapter == null ? null : node(chapter, nodeId);
        if (node == null) {
            return;
        }
        result.mode = new CareerProgress.CareerModeResult("campaign", node.name);
        if (!won) {
            result.mode.lines.add("Lost to " + node.name + ". The duel stays open; try again any time.");
            return;
        }
        if (!store.finishCampaignNode(user, campaign.id, node.id, null, now)) {
            result.mode.lines.add("Beat " + node.name + " again.");
            return;
        }
        result.mode.lines.add("Beat " + node.name + (node.boss ? ", the chapter's boss." : "."));
        pay(store, user, chapter, node.reward, result, now);
    }

    private void pay(CareerStore store, String user, Chapter chapter, CareerReward reward, CareerProgress.CareerGameResult result, long now) throws SQLException {
        if (reward == null) {
            return;
        }
        CareerProgress.CareerModeResult mode = result.mode;
        if (reward.coins > 0) {
            store.addCoins(user, reward.coins);
            result.coins += reward.coins;
            mode.coins += reward.coins;
        }
        if (reward.xp > 0) {
            store.addProfileInt(user, "xp", reward.xp);
            result.xp += reward.xp;
            mode.xp += reward.xp;
        }
        if (reward.packs > 0) {
            store.addProfileInt(user, "pack_tokens", reward.packs);
            result.packs += reward.packs;
            mode.lines.add(reward.packs == 1 ? "A free pack." : reward.packs + " free packs.");
        }
        if (reward.wildcard != null) {
            store.addWildcard(user, reward.wildcard, 1);
            mode.lines.add("A " + reward.wildcard + " wildcard.");
        }
        if (reward.deckCards && chapter != null) {
            try {
                DeckCardLists deck = deck(chapter.deck);
                List<CareerCard> cards = new ArrayList<>();
                for (DeckCardInfo info : CareerContent.allCards(deck)) {
                    for (int i = 0; i < info.getAmount(); i++) {
                        CareerCard card = CareerService.get().resolveCard(info);
                        if (card != null) {
                            cards.add(card);
                        }
                    }
                }
                CareerService.get().addCards(store, user, cards);
                mode.lines.add(chapter.deckName + " joins your collection.");
            } catch (IOException e) {
                throw new SQLException("The chapter deck can't be read", e);
            }
        }
        if (reward.unlockSet != null && store.addSetUnlock(user, reward.unlockSet, now)) {
            mode.lines.add("Packs of " + setName(reward.unlockSet) + " are now in the shop.");
            mode.unlockedSet = reward.unlockSet;
        }
    }

    private static String setName(String code) {
        mage.cards.ExpansionSet set = mage.cards.Sets.findSet(code);
        return set == null ? code : set.getName();
    }

    /** every set some campaign chapter opens */
    public List<String> unlockableSets() {
        List<String> sets = new ArrayList<>();
        for (Campaign campaign : campaigns.values()) {
            for (Chapter chapter : campaign.chapters) {
                collect(sets, chapter.unlockSet);
                for (Node node : chapter.nodes) {
                    if (node.reward != null) {
                        collect(sets, node.reward.unlockSet);
                    }
                }
            }
        }
        return sets;
    }

    private static void collect(List<String> sets, String set) {
        if (set != null && !sets.contains(set)) {
            sets.add(set);
        }
    }
}
