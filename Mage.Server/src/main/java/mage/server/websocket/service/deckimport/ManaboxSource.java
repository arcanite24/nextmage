package mage.server.websocket.service.deckimport;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Web client bridge: ManaBox decks shared as links, from its cloud API ({@code cloud.manabox.app/decks/{id}}).
 * Each card has a board: 0 is the deck, 1 the sideboard, 2 the commander. Other boards (the maybeboard)
 * are left out.
 */
final class ManaboxSource implements DeckSource {

    private static final Pattern DECK_PATH = Pattern.compile("^/decks/([A-Za-z0-9_-]{22})/?$");
    private static final int FORMAT_COMMANDER = 4;

    @Override
    public String id() {
        return "manabox";
    }

    @Override
    public List<String> pageHosts() {
        return Arrays.asList("manabox.app", "www.manabox.app");
    }

    @Override
    public List<String> fetchHosts() {
        return Arrays.asList("cloud.manabox.app");
    }

    @Override
    public String deckId(URI url) {
        Matcher matcher = DECK_PATH.matcher(url.getPath() == null ? "" : url.getPath());
        return matcher.matches() ? matcher.group(1) : null;
    }

    @Override
    public ImportedDeck fetch(URI url, String deckId, Fetcher fetcher) throws DeckImportException {
        return read(fetcher.get(URI.create("https://cloud.manabox.app/decks/" + deckId), "application/json"), deckId);
    }

    static ImportedDeck read(String body, String deckId) throws DeckImportException {
        JsonObject json = SourceSupport.parseObject(body, "ManaBox");
        if (!json.has("cards")) {
            throw new DeckImportException(DeckImportException.Reason.SITE_CHANGED, "ManaBox's deck has no card list");
        }
        ImportedDeck deck = new ImportedDeck("manabox", deckId, "https://manabox.app/decks/" + deckId);
        deck.setName(SourceSupport.string(json, "name"));
        if (SourceSupport.integer(json, "format", -1) == FORMAT_COMMANDER) {
            deck.setFormat("Variant Magic - Commander");
        }
        long edited = SourceSupport.longValue(json, "editDateUTC", -1L);
        if (edited > 0) {
            deck.setRemoteUpdatedAt(edited);
        }
        int coverId = SourceSupport.integer(json, "coverImageCvId", -1);

        for (JsonElement element : SourceSupport.array(json, "cards")) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject card = element.getAsJsonObject();
            ImportedDeck.Section section;
            switch (SourceSupport.integer(card, "boardCategory", 0)) {
                case 0:
                    section = ImportedDeck.Section.MAIN;
                    break;
                case 1:
                    section = ImportedDeck.Section.SIDE;
                    break;
                case 2:
                    section = ImportedDeck.Section.COMMANDER;
                    break;
                default:
                    section = ImportedDeck.Section.MAYBE;
            }
            String name = SourceSupport.cardName(SourceSupport.string(card, "name"));
            String setCode = SourceSupport.string(card, "setId");
            String number = SourceSupport.string(card, "collectorNumber");
            deck.add(section, name, setCode, number, SourceSupport.integer(card, "quantity", 0));
            if (coverId >= 0 && SourceSupport.integer(card, "cvId", -2) == coverId && deck.getCover() == null) {
                deck.setCover(name, setCode, number);
            }
        }
        if (deck.cardCount() == 0) {
            throw new DeckImportException(DeckImportException.Reason.NOT_FOUND, "ManaBox's deck " + deckId + " has no cards");
        }
        return deck;
    }
}
