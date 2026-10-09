package mage.server.decks;

import com.j256.ormlite.field.DataType;
import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * One web client deck kept for an account: the deck's own JSON, as the client wrote it, or a tombstone once deleted
 * (so other devices learn about the deletion).
 */
@DatabaseTable(tableName = "web_deck")
public class StoredDeck {

    /** owner + '/' + deckId */
    @DatabaseField(id = true)
    String key;
    /** account name, lower case */
    @DatabaseField(index = true)
    String owner;
    @DatabaseField
    String deckId;
    @DatabaseField
    String name;
    /** client time of the last change, milliseconds */
    @DatabaseField
    long updatedAt;
    @DatabaseField
    boolean deleted;
    @DatabaseField(dataType = DataType.LONG_STRING)
    String data;

    public StoredDeck() {
    }
}
