package org.mage.test.serverside.career;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import mage.cards.repository.CardScanner;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * The server's Career content (decks, puzzles, campaign and gauntlet twists) names real cards. The bridge's own tests
 * run without the sets, so the names are checked here, against every card.
 */
public class CareerContentCardsTest {

    private static final Path CAREER = Paths.get("..", "Mage.Server", "src", "main", "resources", "career");
    private static final Pattern DCK_LINE = Pattern.compile("^(?:SB:\\s*)?\\d+\\s+\\[([^:\\]]+):([^\\]]+)]\\s+(.+)$");
    /** jumpstart.txt: "1 JMP 471 Juggernaut" */
    private static final Pattern PACK_LINE = Pattern.compile("^\\d+\\s+([A-Z0-9]+)\\s+(\\S+)\\s+(.+)$");
    /** JSON fields that hold card names; a battlefield entry may end in "|tapped" */
    private static final List<String> CARD_FIELDS = Arrays.asList("hand", "battlefield", "graveyard", "library", "permanents", "emblem");

    private final List<String> problems = new ArrayList<>();

    @Before
    public void setUp() {
        CardScanner.scan();
    }

    @Test
    public void everyCareerCardExists() throws IOException {
        Assert.assertTrue("career content at " + CAREER.toAbsolutePath(), Files.isDirectory(CAREER));
        List<Path> files;
        try (Stream<Path> walk = Files.walk(CAREER)) {
            files = walk.filter(Files::isRegularFile).sorted().collect(Collectors.toList());
        }
        int checked = 0;
        for (Path file : files) {
            String name = file.getFileName().toString();
            if (name.endsWith(".dck") || name.equals("jumpstart.txt")) {
                checked += deck(file);
            } else if (name.endsWith(".json")) {
                checked += json(file, JsonParser.parseString(new String(Files.readAllBytes(file), StandardCharsets.UTF_8)));
            }
        }
        Assert.assertTrue("found the content's cards, checked " + checked, checked > 500);
        Assert.assertEquals("unknown Career cards", new ArrayList<>(), new ArrayList<>(new TreeSet<>(problems)));
    }

    private int deck(Path file) throws IOException {
        int checked = 0;
        for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
            Matcher matcher = DCK_LINE.matcher(line.trim());
            if (!matcher.matches()) {
                matcher = PACK_LINE.matcher(line.trim());
                if (!matcher.matches()) {
                    continue;
                }
            }
            checked++;
            String set = matcher.group(1);
            String number = matcher.group(2);
            String card = matcher.group(3).trim();
            CardInfo info = CardRepository.instance.findCard(set, number);
            if (info == null || !info.getName().equals(card)) {
                if (CardRepository.instance.findCards(card).isEmpty()) {
                    problems.add(CAREER.relativize(file) + ": " + card);
                } else {
                    problems.add(CAREER.relativize(file) + ": " + card + " isn't " + set + ":" + number);
                }
            }
        }
        return checked;
    }

    private int json(Path file, JsonElement element) {
        int checked = 0;
        if (element.isJsonArray()) {
            for (JsonElement child : element.getAsJsonArray()) {
                checked += json(file, child);
            }
        } else if (element.isJsonObject()) {
            JsonObject object = element.getAsJsonObject();
            for (String key : object.keySet()) {
                JsonElement value = object.get(key);
                if (CARD_FIELDS.contains(key)) {
                    checked += names(file, value);
                } else {
                    checked += json(file, value);
                }
            }
        }
        return checked;
    }

    private int names(Path file, JsonElement value) {
        List<String> names = new ArrayList<>();
        if (value.isJsonArray()) {
            JsonArray array = value.getAsJsonArray();
            array.forEach(entry -> names.add(entry.getAsString()));
        } else if (value.isJsonPrimitive()) {
            names.add(value.getAsString());
        }
        for (String entry : names) {
            int bar = entry.indexOf('|');
            String card = (bar < 0 ? entry : entry.substring(0, bar)).trim();
            if (CardRepository.instance.findPreferredCoreExpansionCard(card) == null) {
                problems.add(CAREER.relativize(file) + ": " + card);
            }
        }
        return names.size();
    }
}
