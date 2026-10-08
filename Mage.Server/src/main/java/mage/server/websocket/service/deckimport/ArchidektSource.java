package mage.server.websocket.service.deckimport;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URI;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Web client bridge: Archidekt decks, from its public deck API ({@code /api/decks/{id}/}).
 * Each card lists its categories; the first is the card's main category, and categories can be marked as
 * not part of the deck (the maybeboard). Sideboard and Commander are ordinary category names.
 */
final class ArchidektSource implements DeckSource {

    private static final Pattern DECK_PATH = Pattern.compile("^/(?:api/)?decks/(\\d+)(?:/.*)?$");

    // Archidekt's format numbers, in the order of its format menu
    private static final Map<Integer, String> FORMATS = new HashMap<>();

    static {
        FORMATS.put(1, "Constructed - Standard");
        FORMATS.put(2, "Constructed - Modern");
        FORMATS.put(3, "Variant Magic - Commander");
        FORMATS.put(4, "Constructed - Legacy");
        FORMATS.put(5, "Constructed - Vintage");
        FORMATS.put(6, "Constructed - Pauper");
        FORMATS.put(8, "Constructed - Frontier");
        FORMATS.put(11, "Variant Magic - MTGO 1v1 Commander");
        FORMATS.put(12, "Variant Magic - Duel Commander");
        FORMATS.put(13, "Variant Magic - Brawl");
        FORMATS.put(14, "Variant Magic - Oathbreaker");
        FORMATS.put(15, "Constructed - Pioneer");
        FORMATS.put(16, "Constructed - Historic");
        FORMATS.put(20, "Variant Magic - Brawl");
        FORMATS.put(22, "Constructed - Premodern");
        FORMATS.put(25, "Constructed - Canadian Highlander");
    }

    @Override
    public String id() {
        return "archidekt";
    }

    @Override
    public List<String> pageHosts() {
        return Arrays.asList("archidekt.com", "www.archidekt.com");
    }

    @Override
    public List<String> fetchHosts() {
        return Arrays.asList("archidekt.com", "www.archidekt.com");
    }

    @Override
    public String deckId(URI url) {
        Matcher matcher = DECK_PATH.matcher(url.getPath() == null ? "" : url.getPath());
        return matcher.matches() ? matcher.group(1) : null;
    }

    @Override
    public ImportedDeck fetch(URI url, String deckId, Fetcher fetcher) throws DeckImportException {
        String body = fetcher.get(URI.create("https://archidekt.com/api/decks/" + deckId + "/"), "application/json");
        return read(body, deckId);
    }

    static ImportedDeck read(String body, String deckId) throws DeckImportException {
        JsonObject json = SourceSupport.parseObject(body, "Archidekt");
        if (json.has("error") && !json.has("cards")) {
            throw new DeckImportException(DeckImportException.Reason.NOT_FOUND, "Archidekt has no deck " + deckId);
        }
        if (!json.has("cards")) {
            throw new DeckImportException(DeckImportException.Reason.SITE_CHANGED, "Archidekt's deck has no card list");
        }
        ImportedDeck deck = new ImportedDeck("archidekt", deckId, "https://archidekt.com/decks/" + deckId);
        deck.setName(SourceSupport.string(json, "name"));
        deck.setAuthor(SourceSupport.string(SourceSupport.object(json, "owner"), "username"));
        deck.setRemoteUpdatedAt(SourceSupport.isoMillis(SourceSupport.string(json, "updatedAt")));
        deck.setFormat(FORMATS.get(SourceSupport.integer(json, "deckFormat", -1)));

        Set<String> outsideDeck = new HashSet<>();
        for (JsonElement element : SourceSupport.array(json, "categories")) {
            if (element.isJsonObject() && element.getAsJsonObject().has("includedInDeck")
                    && !SourceSupport.bool(element.getAsJsonObject(), "includedInDeck")) {
                outsideDeck.add(SourceSupport.string(element.getAsJsonObject(), "name"));
            }
        }

        String featured = SourceSupport.string(json, "featured");
        for (JsonElement element : SourceSupport.array(json, "cards")) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject entry = element.getAsJsonObject();
            JsonObject card = SourceSupport.object(entry, "card");
            JsonObject oracle = SourceSupport.object(card, "oracleCard");
            String name = SourceSupport.cardName(SourceSupport.string(oracle, "name"));
            String setCode = SourceSupport.string(SourceSupport.object(card, "edition"), "editioncode");
            String number = SourceSupport.string(card, "collectorNumber");
            int amount = SourceSupport.integer(entry, "quantity", 0);

            JsonArray categories = SourceSupport.array(entry, "categories");
            String primary = categories.size() > 0 && categories.get(0).isJsonPrimitive() ? categories.get(0).getAsString() : "";
            ImportedDeck.Section section;
            if (outsideDeck.contains(primary) || "Maybeboard".equalsIgnoreCase(primary)) {
                section = ImportedDeck.Section.MAYBE;
            } else if ("Commander".equalsIgnoreCase(primary)) {
                section = ImportedDeck.Section.COMMANDER;
            } else if (SourceSupport.bool(entry, "companion")) {
                section = ImportedDeck.Section.COMPANION;
            } else if ("Sideboard".equalsIgnoreCase(primary)) {
                section = ImportedDeck.Section.SIDE;
            } else {
                section = ImportedDeck.Section.MAIN;
            }
            deck.add(section, name, setCode, number, amount);

            String uid = SourceSupport.string(card, "uid");
            if (deck.getCover() == null && featured != null && uid != null && featured.contains(uid)) {
                deck.setCover(name, setCode, number);
            }
        }
        if (deck.cardCount() == 0) {
            throw new DeckImportException(DeckImportException.Reason.NOT_FOUND, "Archidekt's deck " + deckId + " has no cards");
        }
        return deck;
    }
}
