package org.mage.test.serverside.career;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.cards.ExpansionSet;
import mage.cards.Sets;
import mage.cards.decks.Deck;
import mage.cards.decks.DeckCardLists;
import mage.cards.decks.DeckValidator;
import mage.cards.decks.DeckValidatorError;
import mage.cards.decks.importer.DeckImporter;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import mage.cards.repository.CardScanner;
import mage.constants.SetType;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Career school decks are written by card name ({@code Mage.Server/career-src/<school>/<deck>.txt}) and built into
 * {@code .dck} files with real printings, then checked against their school's format with XMage's own validators.
 * Writing names keeps set codes and collector numbers out of hand-written lists.
 * <p>
 * Source format, one entry per line:
 * <pre>
 * # name: Mono-Red Burn            (the deck's name; also "# archetype:", "# season:", "# source:", kept as comments)
 * 4 Lightning Bolt
 * SB: 2 Pyroblast                  (sideboard)
 * CMDR: Atraxa, Praetors' Voice    (a commander; goes to the sideboard, where XMage keeps it)
 * </pre>
 * Run from Mage.Tests: {@code java -cp ... org.mage.test.serverside.career.CareerDeckTool build pauper} then
 * {@code ... validate pauper}; {@code CareerSchoolsTest} runs the validation in CI.
 */
public final class CareerDeckTool {

    private static final Pattern LINE = Pattern.compile("^(SB:|CMDR:)?\\s*(\\d+)?\\s*(.+?)\\s*$");
    private static final Pattern DCK_LINE = Pattern.compile("^(SB:\\s*)?(\\d+)\\s+\\[([^:\\]]+):([^\\]]+)]\\s+(.+)$");
    /** sets whose printings make good default art: regular sets first, then anything */
    private static final Set<SetType> REGULAR = java.util.EnumSet.of(SetType.CORE, SetType.EXPANSION);

    private CareerDeckTool() {
    }

    public static Path careerRoot() {
        return Paths.get(System.getProperty("career.root", "../Mage.Server/src/main/resources/career"));
    }

    public static Path sourceRoot() {
        return Paths.get(System.getProperty("career.src", "../Mage.Server/career-src"));
    }

    // ---- build: names to printings

    /** builds every source deck of a school (or every school for "all"); returns the problems found */
    public static List<String> build(String school) throws IOException {
        List<String> problems = new ArrayList<>();
        List<Path> dirs;
        try (Stream<Path> list = Files.list(sourceRoot())) {
            dirs = list.filter(Files::isDirectory)
                    .filter(dir -> "all".equals(school) || dir.getFileName().toString().equals(school))
                    .sorted().collect(Collectors.toList());
        }
        if (dirs.isEmpty()) {
            problems.add("no source folder for " + school + " under " + sourceRoot().toAbsolutePath());
        }
        for (Path dir : dirs) {
            Path out = careerRoot().resolve("campaigns").resolve("decks").resolve(dir.getFileName().toString());
            Files.createDirectories(out);
            List<Path> sources;
            try (Stream<Path> list = Files.list(dir)) {
                sources = list.filter(file -> file.toString().endsWith(".txt")).sorted().collect(Collectors.toList());
            }
            for (Path source : sources) {
                String base = source.getFileName().toString().replaceAll("\\.txt$", "");
                StringBuilder dck = new StringBuilder();
                List<String> deckProblems = new ArrayList<>();
                for (String raw : Files.readAllLines(source, StandardCharsets.UTF_8)) {
                    String line = raw.trim();
                    if (line.isEmpty()) {
                        continue;
                    }
                    if (line.startsWith("#")) {
                        String comment = line.substring(1).trim();
                        if (comment.toLowerCase(Locale.ROOT).startsWith("name:")) {
                            dck.insert(0, "NAME:" + comment.substring(5).trim() + "\n");
                        }
                        continue;
                    }
                    Matcher matcher = LINE.matcher(line);
                    if (!matcher.matches()) {
                        deckProblems.add("can't read \"" + line + "\"");
                        continue;
                    }
                    String zone = matcher.group(1);
                    int amount = matcher.group(2) == null ? 1 : Integer.parseInt(matcher.group(2));
                    String name = matcher.group(3);
                    CardInfo printing = printing(name);
                    if (printing == null) {
                        deckProblems.add("unknown card \"" + name + "\"" + suggest(name));
                        continue;
                    }
                    dck.append(zone == null ? "" : "SB: ").append(amount)
                            .append(" [").append(printing.getSetCode()).append(':').append(printing.getCardNumber()).append("] ")
                            .append(printing.getName()).append('\n');
                }
                for (String problem : deckProblems) {
                    problems.add(dir.getFileName() + "/" + base + ": " + problem);
                }
                if (deckProblems.isEmpty()) {
                    Files.write(out.resolve(base + ".dck"), dck.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
        }
        return problems;
    }

    /** the printing a name builds to: the newest from a core set or expansion, else the newest of any */
    static CardInfo printing(String name) {
        List<CardInfo> found = CardRepository.instance.findCards(name);
        if (found.isEmpty()) {
            // a double-faced or split card written by its front face
            found = CardRepository.instance.findCards(name.split(" // ")[0]);
        }
        List<CardInfo> named = found.stream().filter(info -> info.getName().equalsIgnoreCase(name)
                || info.getName().split(" // ")[0].equalsIgnoreCase(name.split(" // ")[0])).collect(Collectors.toList());
        if (named.isEmpty()) {
            return null;
        }
        Comparator<CardInfo> newest = Comparator.comparing(CareerDeckTool::released);
        return named.stream().filter(CareerDeckTool::regular).filter(info -> info.getCardNumber().matches("\\d+"))
                .max(newest)
                .orElseGet(() -> named.stream().max(newest).orElse(named.get(0)));
    }

    private static boolean regular(CardInfo info) {
        ExpansionSet set = Sets.findSet(info.getSetCode());
        return set != null && REGULAR.contains(set.getSetType());
    }

    private static LocalDate released(CardInfo info) {
        ExpansionSet set = Sets.findSet(info.getSetCode());
        return set == null || set.getReleaseDate() == null ? LocalDate.MIN
                : set.getReleaseDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private static String suggest(String name) {
        String wanted = name.toLowerCase(Locale.ROOT);
        List<String> close = CardRepository.instance.getNames().stream()
                .filter(candidate -> distance(candidate.toLowerCase(Locale.ROOT), wanted) <= Math.max(2, wanted.length() / 6))
                .limit(3).collect(Collectors.toList());
        return close.isEmpty() ? "" : " (did you mean " + String.join(", ", close) + "?)";
    }

    private static int distance(String a, String b) {
        if (Math.abs(a.length() - b.length()) > 4) {
            return 99;
        }
        int[] previous = new int[b.length() + 1];
        int[] current = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            previous[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            current[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                current[j] = Math.min(Math.min(current[j - 1] + 1, previous[j] + 1), previous[j - 1] + cost);
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[b.length()];
    }

    // ---- validate: every school deck against its format

    /** One deck a campaign uses, with the format it's played in. */
    public static class DeckUse {
        public final String campaign;
        public final String where;
        public final String deck;
        public final String deckType;

        DeckUse(String campaign, String where, String deck, String deckType) {
            this.campaign = campaign;
            this.where = where;
            this.deck = deck;
            this.deckType = deckType;
        }
    }

    /** every deck the campaigns with a format use (the player's loaners and the opponents') */
    public static List<DeckUse> uses(String only) throws IOException {
        Path root = careerRoot().resolve("campaigns");
        JsonArray ids = JsonParser.parseString(read(root.resolve("index.json"))).getAsJsonArray();
        List<DeckUse> uses = new ArrayList<>();
        for (JsonElement id : ids) {
            if (only != null && !"all".equals(only) && !only.equals(id.getAsString())) {
                continue;
            }
            JsonObject campaign = JsonParser.parseString(read(root.resolve(id.getAsString() + ".json"))).getAsJsonObject();
            String campaignType = string(campaign, "deckType");
            if (campaignType == null) {
                // the Five Paths and other freeform campaigns: no format to check
                continue;
            }
            for (JsonElement chapterElement : campaign.getAsJsonArray("chapters")) {
                JsonObject chapter = chapterElement.getAsJsonObject();
                String chapterDeck = string(chapter, "deck");
                for (JsonElement nodeElement : chapter.getAsJsonArray("nodes")) {
                    JsonObject node = nodeElement.getAsJsonObject();
                    if (!"duel".equals(string(node, "type"))) {
                        continue;
                    }
                    String deckType = string(node, "deckType") != null ? string(node, "deckType") : campaignType;
                    String where = id.getAsString() + "/" + string(node, "id");
                    String playerDeck = string(node, "deck") != null ? string(node, "deck") : chapterDeck;
                    uses.add(new DeckUse(id.getAsString(), where + " (yours)", playerDeck, deckType));
                    List<JsonObject> opponents = new ArrayList<>();
                    if (node.has("opponent")) {
                        opponents.add(node.getAsJsonObject("opponent"));
                    }
                    if (node.has("opponents")) {
                        for (JsonElement more : node.getAsJsonArray("opponents")) {
                            opponents.add(more.getAsJsonObject());
                        }
                    }
                    for (JsonObject opponent : opponents) {
                        uses.add(new DeckUse(id.getAsString(), where + " (" + string(opponent, "name") + ")", string(opponent, "deck"), deckType));
                    }
                }
            }
        }
        return uses;
    }

    /** checks every deck the given school (or "all") uses; returns the problems */
    public static List<String> validate(String only) throws IOException {
        Map<String, DeckValidator> validators = new LinkedHashMap<>();
        Map<String, List<String>> checked = new LinkedHashMap<>();
        Set<String> problems = new TreeSet<>();
        for (DeckUse use : uses(only)) {
            if (use.deck == null) {
                problems.add(use.where + ": no deck");
                continue;
            }
            String key = use.deck + "|" + use.deckType;
            List<String> found = checked.get(key);
            if (found == null) {
                found = check(use.deck, use.deckType, validators);
                checked.put(key, found);
            }
            for (String problem : found) {
                problems.add(use.deck + " in " + use.deckType + ": " + problem);
            }
        }
        return new ArrayList<>(problems);
    }

    private static List<String> check(String deckPath, String deckType, Map<String, DeckValidator> validators) throws IOException {
        List<String> problems = new ArrayList<>();
        Path file = careerRoot().resolve("campaigns").resolve("decks").resolve(deckPath);
        if (!Files.isRegularFile(file)) {
            problems.add("missing file " + file);
            return problems;
        }
        for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
            Matcher matcher = DCK_LINE.matcher(line.trim());
            if (matcher.matches() && CardRepository.instance.findCard(matcher.group(3), matcher.group(4)) == null) {
                problems.add("no printing " + matcher.group(3) + ":" + matcher.group(4) + " of " + matcher.group(5));
            }
        }
        if (!problems.isEmpty()) {
            return problems;
        }
        StringBuilder errors = new StringBuilder();
        DeckCardLists lists = DeckImporter.importDeckFromFile(file.toString(), errors, false);
        if (lists == null || lists.getCards().isEmpty()) {
            problems.add("can't be read: " + errors);
            return problems;
        }
        DeckValidator validator = validators.computeIfAbsent(deckType, CareerDeckTool::validator);
        if (validator == null) {
            problems.add("no validator for " + deckType);
            return problems;
        }
        Deck deck;
        try {
            deck = Deck.load(lists, true, false);
        } catch (Exception e) {
            problems.add("can't be loaded: " + e.getMessage());
            return problems;
        }
        if (!validator.validate(deck)) {
            for (DeckValidatorError error : validator.getErrorsListSorted(50)) {
                problems.add(error.getGroup() + ": " + error.getMessage());
            }
        }
        return problems;
    }

    /** the validator a deck type names in the server's config.xml */
    static DeckValidator validator(String deckType) {
        try {
            String config = read(Paths.get(System.getProperty("career.config", "../Mage.Server/config/config.xml")));
            Matcher matcher = Pattern.compile("<deckType name=\"" + Pattern.quote(deckType) + "\"[^>]*className=\"([^\"]+)\"").matcher(config);
            if (!matcher.find()) {
                return null;
            }
            return (DeckValidator) Class.forName(matcher.group(1)).getConstructor().newInstance();
        } catch (IOException | ReflectiveOperationException e) {
            return null;
        }
    }

    // ---- check: a school's structure and every card it names

    private static final Pattern TRIGGER = Pattern.compile(
            "^(start|mulligan|opponentSpell|attack|block|turn:\\d+|life:\\d+|opponentLife:\\d+|graveyard:\\d+|cast:.+|play:.+)$");
    private static final Pattern REQUIREMENT = Pattern.compile("^[a-z0-9-]+(@\\d+)?$");
    private static final List<String> COSMETICS = java.util.Arrays.asList("sleeve", "title", "avatar", "playmat");

    /** a school's (or every school's) structure: nodes, requirements, lessons, tips, trials and the cards they name */
    public static List<String> check(String only) throws IOException {
        Path root = careerRoot().resolve("campaigns");
        String config = read(Paths.get(System.getProperty("career.config", "../Mage.Server/config/config.xml")));
        JsonArray ids = JsonParser.parseString(read(root.resolve("index.json"))).getAsJsonArray();
        List<String> known = new ArrayList<>();
        ids.forEach(id -> known.add(id.getAsString()));
        List<String> problems = new ArrayList<>();
        for (String id : known) {
            if (only != null && !"all".equals(only) && !only.equals(id)) {
                continue;
            }
            JsonObject campaign = JsonParser.parseString(read(root.resolve(id + ".json"))).getAsJsonObject();
            if (!campaign.has("school")) {
                continue;
            }
            List<String> found = new ArrayList<>();
            checkSchool(id, campaign, known, config, found);
            for (String problem : found) {
                problems.add(id + ": " + problem);
            }
        }
        return problems;
    }

    private static void checkSchool(String id, JsonObject campaign, List<String> campaigns, String config, List<String> problems) {
        if (!id.equals(string(campaign, "id"))) {
            problems.add("the id must be the file name");
        }
        for (String field : new String[]{"name", "format", "summary", "text", "deckType", "gameType", "colors"}) {
            if (string(campaign, field) == null) {
                problems.add("no " + field);
            }
        }
        checkType(config, "deckType", string(campaign, "deckType"), problems, "the school");
        checkType(config, "gameType", string(campaign, "gameType"), problems, "the school");
        if (campaign.has("requires")) {
            for (JsonElement requirement : campaign.getAsJsonArray("requires")) {
                for (String either : requirement.getAsString().split("\\|")) {
                    String campaignId = either.split("@")[0];
                    if (!REQUIREMENT.matcher(either).matches() || !campaigns.contains(campaignId)) {
                        problems.add("requirement " + either + " doesn't name a campaign");
                    }
                }
            }
        }
        JsonArray chapters = campaign.getAsJsonArray("chapters");
        if (chapters == null || chapters.size() != 4) {
            problems.add("a school has four acts");
            return;
        }
        Map<String, JsonObject> nodes = new LinkedHashMap<>();
        for (JsonElement chapterElement : chapters) {
            JsonObject chapter = chapterElement.getAsJsonObject();
            for (JsonElement nodeElement : chapter.getAsJsonArray("nodes")) {
                JsonObject node = nodeElement.getAsJsonObject();
                if (nodes.put(string(node, "id"), node) != null) {
                    problems.add("node " + string(node, "id") + " appears twice");
                }
            }
        }
        List<String> seen = new ArrayList<>();
        JsonObject last = null;
        int act = 0;
        for (JsonElement chapterElement : chapters) {
            act++;
            JsonObject chapter = chapterElement.getAsJsonObject();
            String chapterDeck = string(chapter, "deck");
            for (JsonElement nodeElement : chapter.getAsJsonArray("nodes")) {
                JsonObject node = nodeElement.getAsJsonObject();
                String nodeId = string(node, "id");
                String type = string(node, "type");
                last = node;
                if (string(node, "name") == null || string(node, "text") == null) {
                    problems.add(nodeId + ": needs a name and a text");
                }
                if (node.has("requires")) {
                    for (JsonElement requirement : node.getAsJsonArray("requires")) {
                        String[] parts = requirement.getAsString().split(":");
                        if (!seen.contains(parts[0])) {
                            problems.add(nodeId + ": requires " + requirement.getAsString() + ", which isn't an earlier node");
                        } else if (parts.length > 1 && !hasOption(nodes.get(parts[0]), parts[1])) {
                            problems.add(nodeId + ": requires option " + parts[1] + " that " + parts[0] + " doesn't offer");
                        }
                    }
                } else if (!seen.isEmpty()) {
                    problems.add(nodeId + ": needs requires (only the first node has none)");
                }
                seen.add(nodeId);
                if ("duel".equals(type)) {
                    checkDuel(nodeId, node, chapterDeck, config, problems);
                    if (act == 4) {
                        checkMeta(nodeId, node, chapterDeck, problems);
                    }
                } else if ("trial".equals(type)) {
                    checkTrial(nodeId, node, problems);
                } else if ("choice".equals(type)) {
                    if (!node.has("options") || node.getAsJsonArray("options").size() < 2) {
                        problems.add(nodeId + ": a choice offers at least two options");
                    } else {
                        for (JsonElement option : node.getAsJsonArray("options")) {
                            checkReward(nodeId, option.getAsJsonObject().getAsJsonObject("reward"), problems);
                        }
                    }
                } else {
                    problems.add(nodeId + ": unknown type " + type);
                }
                if (!"choice".equals(type)) {
                    checkLesson(nodeId, node, problems);
                    checkReward(nodeId, node.getAsJsonObject("reward"), problems);
                }
            }
        }
        if (last == null || !node(last, "winsNeeded", 1).equals(2) || !hasCosmetic(last)) {
            problems.add("the last node is the final: a best of three (winsNeeded 2) that pays the school's title and sleeve");
        }
    }

    /** act 4 plays the real metagame: each of its decks says which season it's from and where the list came from */
    private static void checkMeta(String nodeId, JsonObject node, String chapterDeck, List<String> problems) {
        List<String> decks = new ArrayList<>();
        decks.add(node.has("deck") ? string(node, "deck") : chapterDeck);
        if (node.has("opponent")) {
            decks.add(string(node.getAsJsonObject("opponent"), "deck"));
        }
        if (node.has("opponents")) {
            node.getAsJsonArray("opponents").forEach(seat -> decks.add(string(seat.getAsJsonObject(), "deck")));
        }
        Path src = Paths.get(System.getProperty("career.src", "../Mage.Server/career-src"));
        for (String deck : decks) {
            if (deck == null) {
                continue;
            }
            Path file = src.resolve(deck.replaceAll("\\.dck$", ".txt"));
            try {
                String text = read(file);
                if (!text.contains("# season:") || !text.contains("# source:")) {
                    problems.add(nodeId + ": the meta deck " + deck + " needs a # season: and a # source:");
                }
            } catch (IOException e) {
                problems.add(nodeId + ": no source file for " + deck);
            }
        }
    }

    private static Object node(JsonObject node, String field, int otherwise) {
        return node.has(field) ? node.get(field).getAsInt() : otherwise;
    }

    private static boolean hasCosmetic(JsonObject node) {
        JsonObject reward = node.getAsJsonObject("reward");
        return reward != null && reward.has("cosmetics") && reward.getAsJsonArray("cosmetics").size() >= 2;
    }

    private static boolean hasOption(JsonObject node, String option) {
        if (node == null || !node.has("options")) {
            return false;
        }
        for (JsonElement candidate : node.getAsJsonArray("options")) {
            if (option.equals(string(candidate.getAsJsonObject(), "id"))) {
                return true;
            }
        }
        return false;
    }

    private static void checkType(String config, String kind, String name, List<String> problems, String where) {
        if (name != null && !config.contains("<" + kind + " name=\"" + name + "\"")) {
            problems.add(where + ": " + kind + " \"" + name + "\" isn't one the server offers");
        }
    }

    private static void checkDuel(String nodeId, JsonObject node, String chapterDeck, String config, List<String> problems) {
        checkType(config, "deckType", string(node, "deckType"), problems, nodeId);
        checkType(config, "gameType", string(node, "gameType"), problems, nodeId);
        if (string(node, "deck") == null && chapterDeck == null) {
            problems.add(nodeId + ": no deck for the player (node or chapter deck)");
        }
        if (!node.has("opponent")) {
            problems.add(nodeId + ": a duel needs an opponent");
        } else {
            checkOpponent(nodeId, node.getAsJsonObject("opponent"), problems);
        }
        if (node.has("opponents")) {
            if (string(node, "gameType") == null || !string(node, "gameType").contains("Free For All")) {
                problems.add(nodeId + ": more opponents need a Free For All game type");
            }
            for (JsonElement more : node.getAsJsonArray("opponents")) {
                checkOpponent(nodeId, more.getAsJsonObject(), problems);
            }
        }
        int wins = (Integer) node(node, "winsNeeded", 1);
        if (wins < 1 || wins > 3) {
            problems.add(nodeId + ": winsNeeded is 1 to 3");
        }
        if (wins > 1 && string(node, "sideboard") == null) {
            problems.add(nodeId + ": a best of three teaches sideboarding (sideboard)");
        }
        if (string(node, "before") == null || string(node, "after") == null) {
            problems.add(nodeId + ": the opponent needs a before and an after line");
        }
        if (node.has("tips")) {
            for (JsonElement tipElement : node.getAsJsonArray("tips")) {
                JsonObject tip = tipElement.getAsJsonObject();
                String on = string(tip, "on");
                if (on == null || !TRIGGER.matcher(on).matches()) {
                    problems.add(nodeId + ": tip trigger \"" + on + "\" isn't one of the triggers");
                } else if (on.startsWith("cast:") || on.startsWith("play:")) {
                    card(nodeId + " tip", on.substring(5), problems);
                }
                if (string(tip, "title") == null || string(tip, "text") == null) {
                    problems.add(nodeId + ": a tip needs a title and a text");
                }
            }
        }
    }

    private static void checkOpponent(String nodeId, JsonObject opponent, List<String> problems) {
        if (string(opponent, "name") == null || string(opponent, "deck") == null) {
            problems.add(nodeId + ": an opponent needs a name and a deck");
        }
        int skill = opponent.has("skill") ? opponent.get("skill").getAsInt() : 0;
        if (skill < 1 || skill > 9) {
            problems.add(nodeId + ": opponent skill is 1 to 9");
        }
        if (opponent.has("twists")) {
            JsonObject twists = opponent.getAsJsonObject("twists");
            if (twists.has("permanents")) {
                for (JsonElement permanent : twists.getAsJsonArray("permanents")) {
                    card(nodeId + " twist", permanent.getAsString().split("\\|")[0], problems);
                }
            }
            if (twists.has("emblem")) {
                card(nodeId + " twist", twists.get("emblem").getAsString(), problems);
            }
        }
    }

    private static void checkTrial(String nodeId, JsonObject node, List<String> problems) {
        JsonObject trial = node.getAsJsonObject("trial");
        if (trial == null) {
            problems.add(nodeId + ": a trial needs its position (trial)");
            return;
        }
        String objective = string(trial, "objective");
        if (!"win".equals(objective) && !"survive".equals(objective)) {
            problems.add(nodeId + ": a trial's objective is win or survive");
        }
        if (string(node, "hint") == null) {
            problems.add(nodeId + ": a trial needs a hint");
        }
        for (String sideName : new String[]{"you", "opponent"}) {
            JsonObject side = trial.getAsJsonObject(sideName);
            if (side == null) {
                problems.add(nodeId + ": the trial needs both sides");
                continue;
            }
            for (String zone : new String[]{"hand", "battlefield", "graveyard", "library"}) {
                if (side.has(zone)) {
                    for (JsonElement entry : side.getAsJsonArray(zone)) {
                        card(nodeId + " " + sideName + " " + zone, entry.getAsString().split("\\|")[0], problems);
                    }
                }
            }
        }
    }

    private static void checkLesson(String nodeId, JsonObject node, List<String> problems) {
        JsonObject lesson = node.getAsJsonObject("lesson");
        if (lesson == null || string(lesson, "title") == null || string(lesson, "text") == null) {
            problems.add(nodeId + ": every duel and trial has a lesson with a title and a text");
            return;
        }
        if (lesson.has("cards")) {
            JsonArray cards = lesson.getAsJsonArray("cards");
            if (cards.size() > 4) {
                problems.add(nodeId + ": a lesson shows up to four cards");
            }
            for (JsonElement card : cards) {
                card(nodeId + " lesson", card.getAsString(), problems);
            }
        }
    }

    private static void checkReward(String nodeId, JsonObject reward, List<String> problems) {
        if (reward == null) {
            problems.add(nodeId + ": no reward");
            return;
        }
        if (reward.has("cosmetics")) {
            for (JsonElement element : reward.getAsJsonArray("cosmetics")) {
                JsonObject cosmetic = element.getAsJsonObject();
                if (!COSMETICS.contains(string(cosmetic, "kind")) || string(cosmetic, "id") == null) {
                    problems.add(nodeId + ": a cosmetic is a sleeve, title, avatar or playmat with an id");
                }
            }
        }
    }

    private static void card(String where, String name, List<String> problems) {
        if (CardRepository.instance.findCards(name).isEmpty() && CardRepository.instance.findCards(name.split(" // ")[0]).isEmpty()) {
            problems.add(where + ": unknown card \"" + name + "\"" + suggest(name));
        }
    }

    private static String read(Path file) throws IOException {
        return new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
    }

    private static String string(JsonObject object, String field) {
        return object.has(field) && !object.get(field).isJsonNull() ? object.get(field).getAsString() : null;
    }

    /** {@code build <school|all>} or {@code validate <school|all>}; exits 1 on problems */
    public static void main(String[] args) throws IOException {
        if (args.length < 2) {
            System.err.println("usage: CareerDeckTool build|validate|check <school|all>");
            System.exit(2);
        }
        CardScanner.scan();
        List<String> problems;
        if ("check".equals(args[0])) {
            problems = check(args[1]);
        } else {
            problems = "build".equals(args[0]) ? build(args[1]) : validate(args[1]);
            if ("build".equals(args[0]) && problems.isEmpty()) {
                problems = validate(args[1]);
            }
        }
        problems.forEach(System.out::println);
        System.out.println(problems.isEmpty() ? "OK" : problems.size() + " problem(s)");
        System.exit(problems.isEmpty() ? 0 : 1);
    }
}
