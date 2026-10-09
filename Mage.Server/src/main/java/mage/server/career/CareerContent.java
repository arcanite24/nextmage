package mage.server.career;

import com.google.gson.Gson;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import mage.cards.decks.importer.DeckImporter;
import org.apache.log4j.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Career content shipped with the server, as data: the starter decks a Career can open with, and the AI opponent
 * roster in tiers (resources/career). Adding an opponent is a line in opponents.json and a .dck file.
 */
public final class CareerContent {

    private static final Logger logger = Logger.getLogger(CareerContent.class);
    private static final String ROOT = "/career/";

    public static class Tier {
        public int tier;
        public String name;
        /** the server AI's skill for this tier's opponents (1-10) */
        public int skill;
    }

    public static class Opponent {
        public String id;
        public String name;
        public int tier;
        /** WUBRG letters */
        public String colors;
        public String deck;
        public String tagline;
        /** the server AI type; the usual one when absent */
        public String aiType;
        /** overrides the tier's skill */
        public Integer skill;
    }

    public static class CareerStarter {
        public String id;
        public String name;
        public int cards;
        public CareerCover cover;
    }

    public static class CareerCover {
        public String name;
        public String setCode;
        public String cardNumber;
    }

    private static class Roster {
        List<Tier> tiers;
        List<Opponent> opponents;
    }

    private static class StarterEntry {
        String file;
        String name;
        int cards;
        CareerCover cover;
    }

    private static volatile CareerContent instance;

    private final List<Tier> tiers;
    private final Map<String, Opponent> opponents = new LinkedHashMap<>();
    private final Map<String, CareerStarter> starters = new LinkedHashMap<>();

    private CareerContent() throws IOException {
        Gson gson = new Gson();
        Roster roster;
        try (Reader reader = resource("opponents.json")) {
            roster = gson.fromJson(reader, Roster.class);
        }
        tiers = Collections.unmodifiableList(roster.tiers);
        for (Opponent opponent : roster.opponents) {
            opponents.put(opponent.id, opponent);
        }
        StarterEntry[] index;
        try (Reader reader = resource("starters/index.json")) {
            index = gson.fromJson(reader, StarterEntry[].class);
        }
        for (StarterEntry entry : index) {
            // a Career is played with 60-card decks; the commander starters stay in free play
            if (entry.cards != 60) {
                continue;
            }
            CareerStarter starter = new CareerStarter();
            starter.id = entry.file.replaceAll("\\.dck$", "");
            starter.name = entry.name;
            starter.cards = entry.cards;
            starter.cover = entry.cover;
            starters.put(starter.id, starter);
        }
    }

    public static CareerContent get() {
        CareerContent current = instance;
        if (current == null) {
            synchronized (CareerContent.class) {
                current = instance;
                if (current == null) {
                    try {
                        current = new CareerContent();
                    } catch (IOException | RuntimeException e) {
                        logger.error("Career content can't be read", e);
                        throw new IllegalStateException("Career content is missing from this server");
                    }
                    instance = current;
                }
            }
        }
        return current;
    }

    private static Reader resource(String path) throws IOException {
        InputStream stream = CareerContent.class.getResourceAsStream(ROOT + path);
        if (stream == null) {
            throw new IOException("Missing career resource " + path);
        }
        return new InputStreamReader(stream, StandardCharsets.UTF_8);
    }

    public List<Tier> tiers() {
        return tiers;
    }

    public Tier tier(int tier) {
        return tiers.stream().filter(candidate -> candidate.tier == tier).findFirst().orElse(tiers.get(tiers.size() - 1));
    }

    public List<Opponent> opponents() {
        return new ArrayList<>(opponents.values());
    }

    public Opponent opponent(String id) {
        return opponents.get(id);
    }

    public List<CareerStarter> starters() {
        return new ArrayList<>(starters.values());
    }

    public CareerStarter starter(String id) {
        return starters.get(id);
    }

    public DeckCardLists starterDeck(String id) throws IOException {
        return deck("starters/" + id + ".dck");
    }

    public DeckCardLists opponentDeck(Opponent opponent) throws IOException {
        return deck("opponents/" + opponent.deck);
    }

    /** reads a .dck file shipped in resources (the importer reads files, so it goes through a temporary copy) */
    static DeckCardLists deck(String path) throws IOException {
        InputStream stream = CareerContent.class.getResourceAsStream(ROOT + path);
        if (stream == null) {
            throw new IOException("Missing career deck " + path);
        }
        Path file = Files.createTempFile("career-", ".dck");
        try {
            try (InputStream in = stream) {
                Files.copy(in, file, StandardCopyOption.REPLACE_EXISTING);
            }
            StringBuilder errors = new StringBuilder();
            DeckCardLists deck = DeckImporter.importDeckFromFile(file.toString(), errors, false);
            if ((deck == null || deck.getCards().isEmpty()) && mage.cards.repository.CardRepository.instance.findCards("Plains").isEmpty()) {
                // no card database (the bridge's own tests): take the file as written
                deck = readAsWritten(file);
            }
            if (deck == null || deck.getCards().isEmpty()) {
                throw new IOException("Career deck " + path + " can't be read: " + errors);
            }
            if (errors.length() > 0) {
                logger.warn("Career deck " + path + ": " + errors);
            }
            return deck;
        } finally {
            Files.deleteIfExists(file);
        }
    }

    private static final java.util.regex.Pattern DCK_LINE = java.util.regex.Pattern.compile("^(SB:\\s*)?(\\d+)\\s+\\[([^:\\]]+):([^\\]]+)]\\s+(.+)$");

    private static DeckCardLists readAsWritten(Path file) throws IOException {
        DeckCardLists deck = new DeckCardLists();
        for (String line : Files.readAllLines(file)) {
            line = line.trim();
            if (line.startsWith("NAME:")) {
                deck.setName(line.substring(5).trim());
                continue;
            }
            java.util.regex.Matcher matcher = DCK_LINE.matcher(line);
            if (matcher.matches()) {
                DeckCardInfo card = new DeckCardInfo(matcher.group(5).trim(), matcher.group(4), matcher.group(3), Integer.parseInt(matcher.group(2)));
                (matcher.group(1) == null ? deck.getCards() : deck.getSideboard()).add(card);
            }
        }
        return deck;
    }

    /** every card of a deck, main deck and sideboard */
    static List<DeckCardInfo> allCards(DeckCardLists deck) {
        List<DeckCardInfo> cards = new ArrayList<>(deck.getCards());
        cards.addAll(deck.getSideboard());
        return cards;
    }
}
