package mage.server.career;

import mage.cards.decks.DeckCardInfo;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Jumpstart's 20-card themed packs (the client's sample list, copied to resources/career/jumpstart.txt): the
 * gauntlet's starting decks and the bundles it offers after a win. A pack's colour is its basic lands'.
 */
public final class CareerJumpstart {

    private static final Pattern LINE = Pattern.compile("(\\d+) (\\w+) (\\S+) (.+)");
    private static final Map<String, String> BASICS = new LinkedHashMap<>();

    static {
        BASICS.put("Plains", "W");
        BASICS.put("Island", "U");
        BASICS.put("Swamp", "B");
        BASICS.put("Mountain", "R");
        BASICS.put("Forest", "G");
    }

    public static class Pack {
        public String name;
        public String color;
        public List<DeckCardInfo> cards = new ArrayList<>();

        public boolean isBasic(DeckCardInfo card) {
            return BASICS.containsKey(card.getCardName());
        }
    }

    private static volatile CareerJumpstart instance;

    private final List<Pack> packs = new ArrayList<>();

    private CareerJumpstart() throws IOException {
        InputStream stream = CareerJumpstart.class.getResourceAsStream("/career/jumpstart.txt");
        if (stream == null) {
            throw new IOException("Missing career resource jumpstart.txt");
        }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            Pack pack = null;
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.startsWith("# ")) {
                    pack = new Pack();
                    pack.name = line.substring(2).trim();
                    packs.add(pack);
                    continue;
                }
                Matcher matcher = LINE.matcher(line);
                if (pack != null && matcher.matches()) {
                    String name = matcher.group(4).trim();
                    pack.cards.add(new DeckCardInfo(name, matcher.group(3), matcher.group(2), Integer.parseInt(matcher.group(1))));
                    String color = BASICS.get(name);
                    if (color != null && (pack.color == null || !pack.color.contains(color))) {
                        pack.color = pack.color == null ? color : pack.color + color;
                    }
                }
            }
        }
        // only one-colour packs: a run's colours stay readable
        packs.removeIf(pack -> pack.color == null || pack.color.length() != 1);
    }

    public static CareerJumpstart get() {
        CareerJumpstart current = instance;
        if (current == null) {
            synchronized (CareerJumpstart.class) {
                current = instance;
                if (current == null) {
                    try {
                        current = new CareerJumpstart();
                    } catch (IOException | RuntimeException e) {
                        throw new IllegalStateException("Jumpstart packs can't be read: " + e.getMessage(), e);
                    }
                    instance = current;
                }
            }
        }
        return current;
    }

    public List<Pack> packs() {
        return Collections.unmodifiableList(packs);
    }

    public Pack pack(String name) {
        return packs.stream().filter(pack -> pack.name.equals(name)).findFirst().orElse(null);
    }

    /** packs in any of these colours (all packs when the set is empty) */
    public List<Pack> inColors(String colors) {
        List<Pack> matching = new ArrayList<>();
        Set<String> wanted = colors == null || colors.isEmpty() ? new HashSet<>() : new HashSet<>(Arrays.asList(colors.split("")));
        for (Pack pack : packs) {
            if (wanted.isEmpty() || wanted.contains(pack.color)) {
                matching.add(pack);
            }
        }
        return matching;
    }
}
