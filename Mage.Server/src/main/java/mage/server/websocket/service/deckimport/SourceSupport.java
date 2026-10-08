package mage.server.websocket.service.deckimport;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Web client bridge: small, forgiving JSON readers and the format names deck sites use, for the deck sources.
 */
final class SourceSupport {

    private SourceSupport() {
    }

    static JsonObject parseObject(String body, String site) throws DeckImportException {
        try {
            JsonElement element = JsonParser.parseString(body);
            if (!element.isJsonObject()) {
                throw new DeckImportException(DeckImportException.Reason.SITE_CHANGED, site + " answered with something other than a deck");
            }
            return element.getAsJsonObject();
        } catch (JsonSyntaxException e) {
            throw new DeckImportException(DeckImportException.Reason.SITE_CHANGED, site + " answered with something other than JSON", e);
        }
    }

    static JsonObject object(JsonObject parent, String key) {
        JsonElement value = parent == null ? null : parent.get(key);
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : null;
    }

    static JsonArray array(JsonObject parent, String key) {
        JsonElement value = parent == null ? null : parent.get(key);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    static String string(JsonObject parent, String key) {
        JsonElement value = parent == null ? null : parent.get(key);
        return value != null && value.isJsonPrimitive() ? value.getAsString() : null;
    }

    static int integer(JsonObject parent, String key, int fallback) {
        JsonElement value = parent == null ? null : parent.get(key);
        try {
            return value != null && value.isJsonPrimitive() ? value.getAsInt() : fallback;
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    static long longValue(JsonObject parent, String key, long fallback) {
        JsonElement value = parent == null ? null : parent.get(key);
        try {
            return value != null && value.isJsonPrimitive() ? value.getAsLong() : fallback;
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    static boolean bool(JsonObject parent, String key) {
        JsonElement value = parent == null ? null : parent.get(key);
        return value != null && value.isJsonPrimitive() && value.getAsBoolean();
    }

    /** "2026-04-27T01:04:41.158476Z" → epoch milliseconds, or null. */
    static Long isoMillis(String value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return Instant.parse(value).toEpochMilli();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static final Map<String, String> FORMATS = new HashMap<>();

    static {
        FORMATS.put("standard", "Constructed - Standard");
        FORMATS.put("pioneer", "Constructed - Pioneer");
        FORMATS.put("modern", "Constructed - Modern");
        FORMATS.put("legacy", "Constructed - Legacy");
        FORMATS.put("vintage", "Constructed - Vintage");
        FORMATS.put("pauper", "Constructed - Pauper");
        FORMATS.put("historic", "Constructed - Historic");
        FORMATS.put("premodern", "Constructed - Premodern");
        FORMATS.put("frontier", "Constructed - Frontier");
        FORMATS.put("canadian highlander", "Constructed - Canadian Highlander");
        FORMATS.put("canlander", "Constructed - Canadian Highlander");
        FORMATS.put("commander", "Variant Magic - Commander");
        FORMATS.put("edh", "Variant Magic - Commander");
        FORMATS.put("cedh", "Variant Magic - Commander");
        FORMATS.put("duel commander", "Variant Magic - Duel Commander");
        FORMATS.put("duel", "Variant Magic - Duel Commander");
        FORMATS.put("1v1 commander", "Variant Magic - MTGO 1v1 Commander");
        FORMATS.put("brawl", "Variant Magic - Brawl");
        FORMATS.put("historic brawl", "Variant Magic - Brawl");
        FORMATS.put("historicbrawl", "Variant Magic - Brawl");
        FORMATS.put("oathbreaker", "Variant Magic - Oathbreaker");
        FORMATS.put("penny dreadful commander", "Variant Magic - Penny Dreadful Commander");
        FORMATS.put("tiny leaders", "Variant Magic - Tiny Leaders");
    }

    /** A site's format name ("modern", "Commander") as an XMage deck type, or null when we don't map it. */
    static String deckType(String siteFormat) {
        if (siteFormat == null) {
            return null;
        }
        return FORMATS.get(siteFormat.trim().toLowerCase(Locale.ROOT).replace('_', ' ').replace('-', ' '));
    }

    /** "Fire/Ice", "Wear / Tear" → "Fire // Ice". */
    static String cardName(String name) {
        if (name == null) {
            return null;
        }
        return name.replaceAll("\\s*/{1,3}\\s*", " // ").replaceAll("\\s+", " ").trim();
    }
}
