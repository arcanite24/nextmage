package mage.server.decks;

/**
 * A deck as the sync list and the deck download describe it. The list leaves data out.
 */
public class DeckSyncEntry {

    public String id;
    public String name;
    public long updatedAt;
    public boolean deleted;
    /** the deck's JSON; only in deckSyncGet */
    public String data;

    public DeckSyncEntry() {
    }

    DeckSyncEntry(StoredDeck deck, boolean withData) {
        this.id = deck.deckId;
        this.name = deck.name;
        this.updatedAt = deck.updatedAt;
        this.deleted = deck.deleted;
        this.data = withData && !deck.deleted ? deck.data : null;
    }
}
