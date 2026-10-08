package mage.server.websocket.service.deckimport;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Web client bridge: TCGplayer Infinite decks, from the deck API behind infinite.tcgplayer.com.
 * Sub-decks are maindeck, sideboard and commandzone; cards carry a set code but no collector number,
 * so the client picks the printing by name and set (and the cover, since a cover needs a printing).
 */
final class TcgplayerSource implements DeckSource {

    private static final Pattern DECK_PATH = Pattern.compile("^/(?:content/)?magic-the-gathering/deck/[^/]+/(\\d+)/?$");

    @Override
    public String id() {
        return "tcgplayer";
    }

    @Override
    public List<String> pageHosts() {
        return Arrays.asList("infinite.tcgplayer.com", "www.tcgplayer.com", "tcgplayer.com");
    }

    @Override
    public List<String> fetchHosts() {
        return Arrays.asList("infinite-api.tcgplayer.com");
    }

    @Override
    public String deckId(URI url) {
        Matcher matcher = DECK_PATH.matcher(url.getPath() == null ? "" : url.getPath());
        return matcher.matches() ? matcher.group(1) : null;
    }

    @Override
    public ImportedDeck fetch(URI url, String deckId, Fetcher fetcher) throws DeckImportException {
        String body = fetcher.get(URI.create("https://infinite-api.tcgplayer.com/deck/magic/" + deckId
                + "/?source=infinite-content&subDecks=true&cards=true&stats=false"), "application/json");
        return read(body, deckId);
    }

    static ImportedDeck read(String body, String deckId) throws DeckImportException {
        JsonObject json = SourceSupport.parseObject(body, "TCGplayer");
        JsonObject result = SourceSupport.object(json, "result");
        if (result == null) {
            if (json.has("error")) {
                throw new DeckImportException(DeckImportException.Reason.NOT_FOUND, "TCGplayer has no deck " + deckId);
            }
            throw new DeckImportException(DeckImportException.Reason.SITE_CHANGED, "TCGplayer's deck has no result");
        }
        JsonObject info = SourceSupport.object(result, "deck");
        JsonObject subDecks = SourceSupport.object(info, "subDecks");
        JsonObject cards = SourceSupport.object(result, "cards");
        if (info == null || subDecks == null || cards == null) {
            throw new DeckImportException(DeckImportException.Reason.SITE_CHANGED, "TCGplayer's deck has no card list");
        }
        String canonical = SourceSupport.string(result, "canonicalURL");
        ImportedDeck deck = new ImportedDeck("tcgplayer", deckId,
                canonical != null ? "https://infinite.tcgplayer.com" + canonical : "https://infinite.tcgplayer.com/magic-the-gathering/deck/deck/" + deckId);
        deck.setName(SourceSupport.string(info, "name"));
        deck.setAuthor(SourceSupport.string(info, "playerName"));
        deck.setFormat(SourceSupport.deckType(SourceSupport.string(info, "format")));
        deck.setRemoteUpdatedAt(SourceSupport.isoMillis(SourceSupport.string(info, "updated")));
        String event = SourceSupport.string(info, "eventName");
        String rank = SourceSupport.string(info, "eventRank");
        if (event != null) {
            deck.setDescription(rank != null ? rank + " at " + event : event);
        }

        for (Map.Entry<String, JsonElement> group : subDecks.entrySet()) {
            ImportedDeck.Section section;
            switch (group.getKey()) {
                case "commandzone":
                    section = ImportedDeck.Section.COMMANDER;
                    break;
                case "sideboard":
                    section = ImportedDeck.Section.SIDE;
                    break;
                case "maindeck":
                    section = ImportedDeck.Section.MAIN;
                    break;
                default:
                    section = ImportedDeck.Section.MAYBE;
            }
            if (!group.getValue().isJsonArray()) {
                continue;
            }
            for (JsonElement element : group.getValue().getAsJsonArray()) {
                if (!element.isJsonObject()) {
                    continue;
                }
                JsonObject entry = element.getAsJsonObject();
                JsonObject card = SourceSupport.object(cards, SourceSupport.string(entry, "cardID"));
                if (card == null) {
                    continue;
                }
                String name = SourceSupport.cardName(SourceSupport.string(card, "name"));
                deck.add(section, name, SourceSupport.string(card, "set"), null, SourceSupport.integer(entry, "quantity", 0));
            }
        }
        if (deck.cardCount() == 0) {
            throw new DeckImportException(DeckImportException.Reason.NOT_FOUND, "TCGplayer's deck " + deckId + " has no cards");
        }
        return deck;
    }
}
