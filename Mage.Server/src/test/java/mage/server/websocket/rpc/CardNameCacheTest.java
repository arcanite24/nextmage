package mage.server.websocket.rpc;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Web client bridge: simple card views get their names from a cache instead of one database query per card.
 */
public class CardNameCacheTest {

    private final Map<String, String> database = new HashMap<>();
    private final List<String> queries = new ArrayList<>();
    private final AtomicLong contentVersion = new AtomicLong();

    private CardNameCache cache(int maxEntries) {
        return new CardNameCache((setCode, cardNumber) -> {
            queries.add(setCode + "/" + cardNumber);
            return database.get(setCode + "/" + cardNumber);
        }, contentVersion::get, maxEntries);
    }

    @Test
    public void looksEachPrintingUpOnce() {
        database.put("M10/146", "Lightning Bolt");
        database.put("ISD/51", "Delver of Secrets");
        CardNameCache cache = cache(100);

        for (int i = 0; i < 3; i++) {
            assertThat(cache.findName("M10", "146")).isEqualTo("Lightning Bolt");
            assertThat(cache.findName("ISD", "51")).isEqualTo("Delver of Secrets");
        }
        assertThat(queries).containsExactly("M10/146", "ISD/51");
    }

    @Test
    public void remembersUnknownPrintingsUntilTheDatabaseChanges() {
        CardNameCache cache = cache(100);
        assertThat(cache.findName("NEW", "1")).isNull();
        assertThat(cache.findName("NEW", "1")).isNull();
        assertThat(queries).containsExactly("NEW/1");

        // cards added (e.g. the server finished scanning new sets): misses and hits are looked up again
        database.put("NEW/1", "Brand New Card");
        contentVersion.incrementAndGet();
        assertThat(cache.findName("NEW", "1")).isEqualTo("Brand New Card");
        assertThat(cache.findName("NEW", "1")).isEqualTo("Brand New Card");
        assertThat(queries).containsExactly("NEW/1", "NEW/1");
    }

    @Test
    public void keysDoNotCollide() {
        database.put("AB/C1", "First");
        database.put("ABC/1", "Second");
        CardNameCache cache = cache(100);
        assertThat(cache.findName("AB", "C1")).isEqualTo("First");
        assertThat(cache.findName("ABC", "1")).isEqualTo("Second");
    }

    @Test
    public void staysBounded() {
        CardNameCache cache = cache(10);
        for (int i = 0; i < 25; i++) {
            database.put("SET/" + i, "Card " + i);
            assertThat(cache.findName("SET", String.valueOf(i))).isEqualTo("Card " + i);
            assertThat(cache.size()).isLessThanOrEqualTo(10);
        }
        // still correct after a reset
        assertThat(cache.findName("SET", "3")).isEqualTo("Card 3");
    }

    @Test
    public void doesNotReadTheDatabaseVersionUntilALookup() {
        AtomicLong reads = new AtomicLong();
        CardNameCache cache = new CardNameCache((setCode, cardNumber) -> null, () -> {
            reads.incrementAndGet();
            return 0;
        }, 10);
        assertThat(reads.get()).isZero();
        cache.findName("M10", "146");
        assertThat(reads.get()).isEqualTo(1);
    }
}
