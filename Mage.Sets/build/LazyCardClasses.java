import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Build step for Mage.Sets (runs with "java LazyCardClasses.java", JDK 11 or later):
 * copies the set sources to a generated folder with each card's class literal written as its class name,
 * {@code mage.cards.a.Abc.class} becoming {@code "mage.cards.a.Abc"}. A set then names its cards without loading
 * them, and a card's class loads the first time the card is made, so a server no longer loads every one of the
 * ~30,000 card classes at startup. The sets in src stay exactly as upstream writes them.
 *
 * Usage: java LazyCardClasses.java <set sources> <output folder>
 */
public class LazyCardClasses {

    private static final Pattern CARD_CLASS = Pattern.compile("\\b(mage\\.cards\\.[a-z0-9]+\\.[A-Za-z0-9_]+)\\.class\\b");

    public static void main(String[] args) throws IOException {
        Path source = Paths.get(args[0]);
        Path output = Paths.get(args[1]);
        Files.createDirectories(output);
        Set<String> names = new HashSet<>();
        int written = 0;
        int literals = 0;
        try (DirectoryStream<Path> sets = Files.newDirectoryStream(source, "*.java")) {
            for (Path set : sets) {
                String name = set.getFileName().toString();
                names.add(name);
                String text = new String(Files.readAllBytes(set), StandardCharsets.UTF_8);
                Matcher matcher = CARD_CLASS.matcher(text);
                StringBuffer lazy = new StringBuffer(text.length());
                while (matcher.find()) {
                    matcher.appendReplacement(lazy, "\"$1\"");
                    literals++;
                }
                matcher.appendTail(lazy);
                byte[] bytes = lazy.toString().getBytes(StandardCharsets.UTF_8);
                Path target = output.resolve(name);
                // rewrite only what changed, so the compiler's stale-source check still works
                if (!Files.exists(target) || !java.util.Arrays.equals(Files.readAllBytes(target), bytes)) {
                    Files.write(target, bytes);
                    written++;
                }
            }
        }
        int removed = 0;
        try (DirectoryStream<Path> generated = Files.newDirectoryStream(output, "*.java")) {
            for (Path file : generated) {
                if (!names.contains(file.getFileName().toString())) {
                    Files.delete(file);
                    removed++;
                }
            }
        }
        System.out.println("LazyCardClasses: " + names.size() + " sets, " + literals + " card classes named lazily, "
                + written + " files written, " + removed + " removed");
    }
}
