package mage.server.websocket.service.deckimport;

import java.net.URI;

/**
 * Web client bridge: reads one page or API response from a deck website. Sources only fetch through this,
 * so tests can serve recorded responses and the real one can enforce the host allowlist and limits.
 */
public interface Fetcher {

    /**
     * @param accept the Accept header, e.g. "application/json"
     * @return the response body, decoded with the response's charset
     */
    String get(URI uri, String accept) throws DeckImportException;
}
