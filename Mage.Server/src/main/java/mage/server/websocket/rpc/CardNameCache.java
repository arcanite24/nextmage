package mage.server.websocket.rpc;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;
import java.util.function.LongSupplier;

/**
 * Web client bridge: card names by set code and card number, so serializing a draft pack or a deck does not run one
 * database query per card.
 * <p>
 * Misses are cached too (unknown printings stay unknown). Everything is dropped when the card database reports a
 * content change (cards added, database reopened), and the whole cache is reset when it grows past its bound, which
 * only happens if clients ask for more printings than the database holds.
 */
final class CardNameCache {

    static final int DEFAULT_MAX_ENTRIES = 100_000;

    private static final String MISSING = "\u0000missing";

    private final BiFunction<String, String, String> loader;
    private final LongSupplier contentVersion;
    private final int maxEntries;
    private final Map<String, String> names = new ConcurrentHashMap<>();
    private volatile long cachedVersion;

    /**
     * @param loader         set code and card number to card name, or null for an unknown printing
     * @param contentVersion changes whenever the loader's answers may have changed
     */
    CardNameCache(BiFunction<String, String, String> loader, LongSupplier contentVersion, int maxEntries) {
        this.loader = loader;
        this.contentVersion = contentVersion;
        this.maxEntries = maxEntries;
        this.cachedVersion = Long.MIN_VALUE; // read lazily: the card database must not open just because this class loaded
    }

    /**
     * @return the card name, or null for an unknown printing
     */
    String findName(String setCode, String cardNumber) {
        long version = contentVersion.getAsLong();
        if (version != cachedVersion) {
            synchronized (this) {
                if (version != cachedVersion) {
                    names.clear();
                    cachedVersion = version;
                }
            }
        }

        String key = setCode + '\u0000' + cardNumber;
        String name = names.get(key);
        if (name == null) {
            String loaded = loader.apply(setCode, cardNumber);
            name = loaded == null ? MISSING : loaded;
            if (names.size() >= maxEntries) {
                names.clear();
            }
            names.put(key, name);
        }
        return MISSING.equals(name) ? null : name;
    }

    int size() {
        return names.size();
    }
}
