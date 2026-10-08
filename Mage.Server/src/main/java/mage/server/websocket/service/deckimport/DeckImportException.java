package mage.server.websocket.service.deckimport;

import java.util.Locale;

/**
 * Web client bridge: why a deck couldn't be imported from a deck website. The reason reaches the client
 * (as the RPC error's data) so it can say what to do next.
 */
public final class DeckImportException extends Exception {

    public enum Reason {
        /** the deck exists but its owner hasn't shared it */
        PRIVATE,
        NOT_FOUND,
        /** the site turned the server away (bot protection) */
        BLOCKED,
        RATE_LIMITED,
        /** the site answered, but not in the shape we read: it changed */
        SITE_CHANGED,
        /** not a deck link we can read */
        UNSUPPORTED,
        TOO_LARGE,
        TIMEOUT,
        /** the site is down or unreachable */
        UNAVAILABLE;

        public String wireName() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    private final Reason reason;

    public DeckImportException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public DeckImportException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }
}
