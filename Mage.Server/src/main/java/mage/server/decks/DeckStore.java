package mage.server.decks;

import com.j256.ormlite.dao.Dao;
import com.j256.ormlite.dao.DaoManager;
import com.j256.ormlite.jdbc.JdbcConnectionSource;
import com.j256.ormlite.stmt.DeleteBuilder;
import com.j256.ormlite.stmt.SelectArg;
import com.j256.ormlite.support.ConnectionSource;
import com.j256.ormlite.table.TableUtils;
import org.apache.log4j.Logger;

import java.io.File;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Web client decks per account, so a player's decks follow them to another browser. Last write wins, by the client's
 * own change time; deletions stay as tombstones for a while so every device hears about them.
 * Stored in db/web_decks.db (SQLite), next to the other server databases and in the same backups.
 */
public final class DeckStore {

    private static final Logger logger = Logger.getLogger(DeckStore.class);

    public static final int MAX_DECKS = 500;
    public static final int MAX_DECK_CHARS = 256 * 1024;
    static final long TOMBSTONE_MILLIS = 90L * 24 * 60 * 60 * 1000;
    private static final Pattern DECK_ID = Pattern.compile("[A-Za-z0-9_:.-]{1,64}");
    private static final String DEFAULT_URL = "jdbc:sqlite:./db/web_decks.db";

    private static volatile DeckStore instance;

    private final Dao<StoredDeck, String> dao;

    /**
     * What a write did: stored, or refused because the server already has a newer version (then updatedAt is that).
     */
    public static class DeckPutResult {
        public boolean stored;
        public long updatedAt;

        DeckPutResult(boolean stored, long updatedAt) {
            this.stored = stored;
            this.updatedAt = updatedAt;
        }
    }

    public DeckStore(String jdbcUrl) throws SQLException {
        ConnectionSource source = new JdbcConnectionSource(jdbcUrl);
        TableUtils.createTableIfNotExists(source, StoredDeck.class);
        dao = DaoManager.createDao(source, StoredDeck.class);
    }

    public static DeckStore get() {
        DeckStore current = instance;
        if (current == null) {
            synchronized (DeckStore.class) {
                current = instance;
                if (current == null) {
                    new File("db").mkdirs();
                    try {
                        current = new DeckStore(DEFAULT_URL);
                    } catch (SQLException | LinkageError e) {
                        logger.error("Web decks database can't be opened", e);
                        throw new IllegalStateException("Decks can't be stored on this server right now");
                    }
                    instance = current;
                }
            }
        }
        return current;
    }

    /**
     * Every deck of the account without its data, tombstones included. Old tombstones are dropped on the way.
     */
    public synchronized List<DeckSyncEntry> list(String owner, long now) throws SQLException {
        DeleteBuilder<StoredDeck, String> prune = dao.deleteBuilder();
        prune.where().eq("owner", new SelectArg(key(owner))).and().eq("deleted", true).and().lt("updatedAt", now - TOMBSTONE_MILLIS);
        prune.delete();

        List<DeckSyncEntry> entries = new ArrayList<>();
        for (StoredDeck deck : dao.queryForEq("owner", new SelectArg(key(owner)))) {
            entries.add(new DeckSyncEntry(deck, false));
        }
        return entries;
    }

    /**
     * @return the deck with its data, or null when the account has no such deck (or it was deleted)
     */
    public synchronized DeckSyncEntry get(String owner, String deckId) throws SQLException {
        StoredDeck deck = dao.queryForId(key(owner) + '/' + checkId(deckId));
        return deck == null || deck.deleted ? null : new DeckSyncEntry(deck, true);
    }

    public synchronized DeckPutResult put(String owner, String deckId, String name, long updatedAt, String data) throws SQLException {
        checkId(deckId);
        if (data == null || data.isEmpty()) {
            throw new IllegalArgumentException("The deck is empty");
        }
        if (data.length() > MAX_DECK_CHARS) {
            throw new IllegalArgumentException("The deck is too large to store (" + data.length() / 1024 + " KB)");
        }
        StoredDeck existing = dao.queryForId(key(owner) + '/' + deckId);
        if (existing != null && existing.updatedAt > updatedAt) {
            return new DeckPutResult(false, existing.updatedAt);
        }
        if (existing == null || existing.deleted) {
            long live = dao.queryBuilder().where().eq("owner", new SelectArg(key(owner))).and().eq("deleted", false).countOf();
            if (live >= MAX_DECKS) {
                throw new IllegalArgumentException("An account can keep up to " + MAX_DECKS + " decks on the server");
            }
        }
        StoredDeck deck = existing != null ? existing : new StoredDeck();
        deck.key = key(owner) + '/' + deckId;
        deck.owner = key(owner);
        deck.deckId = deckId;
        deck.name = name == null ? "" : name.length() > 200 ? name.substring(0, 200) : name;
        deck.updatedAt = updatedAt;
        deck.deleted = false;
        deck.data = data;
        dao.createOrUpdate(deck);
        return new DeckPutResult(true, updatedAt);
    }

    /**
     * Deletes a deck, unless the server has a version newer than the deletion.
     */
    public synchronized DeckPutResult delete(String owner, String deckId, long deletedAt) throws SQLException {
        StoredDeck existing = dao.queryForId(key(owner) + '/' + checkId(deckId));
        if (existing != null && existing.updatedAt > deletedAt) {
            return new DeckPutResult(false, existing.updatedAt);
        }
        StoredDeck deck = existing != null ? existing : new StoredDeck();
        deck.key = key(owner) + '/' + deckId;
        deck.owner = key(owner);
        deck.deckId = deckId;
        deck.updatedAt = deletedAt;
        deck.deleted = true;
        deck.data = null;
        dao.createOrUpdate(deck);
        return new DeckPutResult(true, deletedAt);
    }

    private static String key(String owner) {
        return owner.toLowerCase(Locale.ROOT);
    }

    private static String checkId(String deckId) {
        if (deckId == null || !DECK_ID.matcher(deckId).matches()) {
            throw new IllegalArgumentException("Bad deck id");
        }
        return deckId;
    }
}
