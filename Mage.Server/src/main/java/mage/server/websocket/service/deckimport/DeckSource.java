package mage.server.websocket.service.deckimport;

import java.net.URI;
import java.util.List;

/**
 * Web client bridge: one deck website the server reads decks from.
 */
public interface DeckSource {

    /** the site id shared with the web client (core/deckImport/sites.ts) */
    String id();

    /** hosts of the site's deck pages, as players paste them */
    List<String> pageHosts();

    /** every host this source fetches from (deck pages and API hosts); together they form the allowlist */
    List<String> fetchHosts();

    /** the deck id in a deck page link, or null when the link isn't a deck page */
    String deckId(URI url);

    ImportedDeck fetch(URI url, String deckId, Fetcher fetcher) throws DeckImportException;
}
