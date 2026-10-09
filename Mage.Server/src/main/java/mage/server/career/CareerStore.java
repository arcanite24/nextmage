package mage.server.career;

import org.apache.log4j.Logger;

import java.io.File;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

/**
 * Career progress per account: the collection, coins, wildcards, XP and every payout. Kept in db/career.db (SQLite),
 * apart from the card database, with a versioned schema: each migration runs once, in order, inside a transaction.
 * Every change that pays or spends runs in one transaction, so a crash never leaves half a reward.
 */
public final class CareerStore implements AutoCloseable {

    private static final Logger logger = Logger.getLogger(CareerStore.class);
    private static final String DEFAULT_URL = "jdbc:sqlite:./db/career.db";

    /** migrations, oldest first; the schema version is the number of migrations applied */
    private static final String[][] MIGRATIONS = {
            {
                    "CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
                    "CREATE TABLE profile (user TEXT PRIMARY KEY, created INTEGER NOT NULL, starter TEXT NOT NULL,"
                            + " coins INTEGER NOT NULL DEFAULT 0, xp INTEGER NOT NULL DEFAULT 0,"
                            + " wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,"
                            + " wc_common INTEGER NOT NULL DEFAULT 0, wc_uncommon INTEGER NOT NULL DEFAULT 0,"
                            + " wc_rare INTEGER NOT NULL DEFAULT 0, wc_mythic INTEGER NOT NULL DEFAULT 0)",
                    "CREATE TABLE cards (user TEXT NOT NULL, set_code TEXT NOT NULL, card_number TEXT NOT NULL,"
                            + " name TEXT NOT NULL, rarity TEXT NOT NULL, count INTEGER NOT NULL,"
                            + " PRIMARY KEY (user, set_code, card_number))",
                    "CREATE INDEX cards_by_name ON cards (user, name)",
                    "CREATE TABLE payouts (match_key TEXT PRIMARY KEY, user TEXT NOT NULL, at INTEGER NOT NULL,"
                            + " opponent TEXT NOT NULL, won INTEGER NOT NULL, coins INTEGER NOT NULL, xp INTEGER NOT NULL,"
                            + " note TEXT)",
                    "CREATE INDEX payouts_by_user ON payouts (user, at)"
            }
    };

    private static volatile CareerStore instance;

    private final Connection connection;

    public CareerStore(String jdbcUrl) throws SQLException {
        connection = DriverManager.getConnection(jdbcUrl);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA busy_timeout = 5000");
        }
        migrate();
    }

    public static CareerStore get() {
        CareerStore current = instance;
        if (current == null) {
            synchronized (CareerStore.class) {
                current = instance;
                if (current == null) {
                    new File("db").mkdirs();
                    try {
                        current = new CareerStore(DEFAULT_URL);
                    } catch (SQLException | LinkageError e) {
                        logger.error("Career database can't be opened", e);
                        throw new IllegalStateException("Career progress can't be stored on this server right now");
                    }
                    instance = current;
                }
            }
        }
        return current;
    }

    /** for tests: use this store instead of db/career.db */
    static void use(CareerStore store) {
        instance = store;
    }

    public synchronized int schemaVersion() throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
            try (ResultSet rows = statement.executeQuery("SELECT version FROM schema_version")) {
                return rows.next() ? rows.getInt(1) : 0;
            }
        }
    }

    private synchronized void migrate() throws SQLException {
        int version = schemaVersion();
        for (int next = version; next < MIGRATIONS.length; next++) {
            final int target = next + 1;
            transaction(() -> {
                try (Statement statement = connection.createStatement()) {
                    for (String sql : MIGRATIONS[target - 1]) {
                        statement.execute(sql);
                    }
                    statement.execute("DELETE FROM schema_version");
                    statement.execute("INSERT INTO schema_version (version) VALUES (" + target + ")");
                }
                return null;
            });
            logger.info("Career database schema is now version " + target);
        }
    }

    interface Work<T> {
        T run() throws SQLException;
    }

    /** runs the work in one transaction: all of it lands, or none */
    synchronized <T> T transaction(Work<T> work) throws SQLException {
        boolean auto = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            T result = work.run();
            connection.commit();
            return result;
        } catch (SQLException | RuntimeException e) {
            connection.rollback();
            throw e;
        } finally {
            connection.setAutoCommit(auto);
        }
    }

    // ---- meta

    /** the secret export files are signed with; made once per server */
    public synchronized String secret() throws SQLException {
        String existing = meta("secret");
        if (existing != null) {
            return existing;
        }
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String secret = Base64.getEncoder().encodeToString(bytes);
        try (PreparedStatement insert = connection.prepareStatement("INSERT INTO meta (key, value) VALUES ('secret', ?)")) {
            insert.setString(1, secret);
            insert.executeUpdate();
        }
        return secret;
    }

    private String meta(String key) throws SQLException {
        try (PreparedStatement select = connection.prepareStatement("SELECT value FROM meta WHERE key = ?")) {
            select.setString(1, key);
            try (ResultSet rows = select.executeQuery()) {
                return rows.next() ? rows.getString(1) : null;
            }
        }
    }

    // ---- profiles

    static String key(String user) {
        return user.toLowerCase(Locale.ENGLISH);
    }

    public synchronized CareerProfile profile(String user) throws SQLException {
        try (PreparedStatement select = connection.prepareStatement("SELECT * FROM profile WHERE user = ?")) {
            select.setString(1, key(user));
            try (ResultSet rows = select.executeQuery()) {
                if (!rows.next()) {
                    return null;
                }
                CareerProfile profile = new CareerProfile();
                profile.created = rows.getLong("created");
                profile.starter = rows.getString("starter");
                profile.coins = rows.getInt("coins");
                profile.xp = rows.getInt("xp");
                profile.wins = rows.getInt("wins");
                profile.losses = rows.getInt("losses");
                profile.wildcards = new CareerProfile.Wildcards(rows.getInt("wc_common"), rows.getInt("wc_uncommon"),
                        rows.getInt("wc_rare"), rows.getInt("wc_mythic"));
                profile.level = CareerRules.levelFor(profile.xp);
                profile.cards = cardTotal(user);
                return profile;
            }
        }
    }

    /** creates the profile; false when the account already has one */
    synchronized boolean createProfile(String user, String starter, int coins, long now) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT OR IGNORE INTO profile (user, created, starter, coins) VALUES (?, ?, ?, ?)")) {
            insert.setString(1, key(user));
            insert.setLong(2, now);
            insert.setString(3, starter);
            insert.setInt(4, coins);
            return insert.executeUpdate() == 1;
        }
    }

    synchronized void deleteProfile(String user) throws SQLException {
        for (String table : new String[]{"profile", "cards", "payouts"}) {
            try (PreparedStatement delete = connection.prepareStatement("DELETE FROM " + table + " WHERE user = ?")) {
                delete.setString(1, key(user));
                delete.executeUpdate();
            }
        }
    }

    synchronized void addCoins(String user, int coins) throws SQLException {
        update("UPDATE profile SET coins = coins + ? WHERE user = ?", coins, user);
    }

    synchronized void addWildcard(String user, String rarity, int amount) throws SQLException {
        update("UPDATE profile SET " + wildcardColumn(rarity) + " = " + wildcardColumn(rarity) + " + ? WHERE user = ?", amount, user);
    }

    static String wildcardColumn(String rarity) {
        switch (rarity) {
            case CareerRules.COMMON:
                return "wc_common";
            case CareerRules.UNCOMMON:
                return "wc_uncommon";
            case CareerRules.RARE:
                return "wc_rare";
            case CareerRules.MYTHIC:
                return "wc_mythic";
            default:
                throw new IllegalArgumentException("No wildcard for rarity " + rarity);
        }
    }

    private void update(String sql, int amount, String user) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(sql)) {
            update.setInt(1, amount);
            update.setString(2, key(user));
            if (update.executeUpdate() != 1) {
                throw new SQLException("No career for " + user);
            }
        }
    }

    /** sets the progress fields of an imported Career */
    synchronized void restoreProgress(String user, CareerProfile profile) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE profile SET coins = ?, xp = ?, wins = ?, losses = ?, wc_common = ?, wc_uncommon = ?, wc_rare = ?, wc_mythic = ? WHERE user = ?")) {
            update.setInt(1, profile.coins);
            update.setInt(2, profile.xp);
            update.setInt(3, profile.wins);
            update.setInt(4, profile.losses);
            CareerProfile.Wildcards wildcards = profile.wildcards == null ? new CareerProfile.Wildcards(0, 0, 0, 0) : profile.wildcards;
            update.setInt(5, wildcards.common);
            update.setInt(6, wildcards.uncommon);
            update.setInt(7, wildcards.rare);
            update.setInt(8, wildcards.mythic);
            update.setString(9, key(user));
            update.executeUpdate();
        }
    }

    /** puts back a payout record of an imported Career, without paying it again */
    synchronized void restorePayout(String user, CareerPayout payout) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT OR IGNORE INTO payouts (match_key, user, at, opponent, won, coins, xp, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, payout.matchKey);
            insert.setString(2, key(user));
            insert.setLong(3, payout.at);
            insert.setString(4, payout.opponent);
            insert.setInt(5, payout.won ? 1 : 0);
            insert.setInt(6, payout.coins);
            insert.setInt(7, payout.xp);
            insert.setString(8, payout.note);
            insert.executeUpdate();
        }
    }

    // ---- cards

    /** copies of a card owned in any printing */
    public synchronized int owned(String user, String name) throws SQLException {
        try (PreparedStatement select = connection.prepareStatement("SELECT COALESCE(SUM(count), 0) FROM cards WHERE user = ? AND name = ?")) {
            select.setString(1, key(user));
            select.setString(2, name);
            try (ResultSet rows = select.executeQuery()) {
                return rows.next() ? rows.getInt(1) : 0;
            }
        }
    }

    synchronized void addCard(String user, CareerCard card, int count) throws SQLException {
        try (PreparedStatement upsert = connection.prepareStatement(
                "INSERT INTO cards (user, set_code, card_number, name, rarity, count) VALUES (?, ?, ?, ?, ?, ?)"
                        + " ON CONFLICT (user, set_code, card_number) DO UPDATE SET count = count + excluded.count")) {
            upsert.setString(1, key(user));
            upsert.setString(2, card.setCode);
            upsert.setString(3, card.cardNumber);
            upsert.setString(4, card.name);
            upsert.setString(5, card.rarity);
            upsert.setInt(6, count);
            upsert.executeUpdate();
        }
    }

    public synchronized List<CareerCard> collection(String user) throws SQLException {
        List<CareerCard> cards = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT set_code, card_number, name, rarity, count FROM cards WHERE user = ? ORDER BY name, set_code, card_number")) {
            select.setString(1, key(user));
            try (ResultSet rows = select.executeQuery()) {
                while (rows.next()) {
                    CareerCard card = new CareerCard(rows.getString(3), rows.getString(1), rows.getString(2), rows.getString(4));
                    card.count = rows.getInt(5);
                    cards.add(card);
                }
            }
        }
        return cards;
    }

    private int cardTotal(String user) throws SQLException {
        try (PreparedStatement select = connection.prepareStatement("SELECT COALESCE(SUM(count), 0) FROM cards WHERE user = ?")) {
            select.setString(1, key(user));
            try (ResultSet rows = select.executeQuery()) {
                return rows.next() ? rows.getInt(1) : 0;
            }
        }
    }

    // ---- payouts

    /**
     * Records a match's payout and applies it, once: a second call for the same match changes nothing.
     *
     * @return true when this call paid
     */
    synchronized boolean payout(String matchKey, String user, String opponent, boolean won, int coins, int xp, String note, long now) throws SQLException {
        return transaction(() -> {
            try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT OR IGNORE INTO payouts (match_key, user, at, opponent, won, coins, xp, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
                insert.setString(1, matchKey);
                insert.setString(2, key(user));
                insert.setLong(3, now);
                insert.setString(4, opponent);
                insert.setInt(5, won ? 1 : 0);
                insert.setInt(6, coins);
                insert.setInt(7, xp);
                insert.setString(8, note);
                if (insert.executeUpdate() != 1) {
                    return false;
                }
            }
            try (PreparedStatement update = connection.prepareStatement(
                    "UPDATE profile SET coins = coins + ?, xp = xp + ?, wins = wins + ?, losses = losses + ? WHERE user = ?")) {
                update.setInt(1, coins);
                update.setInt(2, xp);
                update.setInt(3, won ? 1 : 0);
                update.setInt(4, won ? 0 : 1);
                update.setString(5, key(user));
                if (update.executeUpdate() != 1) {
                    throw new SQLException("No career for " + user);
                }
            }
            return true;
        });
    }

    /** the latest payouts, newest first */
    public synchronized List<CareerPayout> payouts(String user, int limit) throws SQLException {
        List<CareerPayout> payouts = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT match_key, at, opponent, won, coins, xp, note FROM payouts WHERE user = ? ORDER BY at DESC LIMIT ?")) {
            select.setString(1, key(user));
            select.setInt(2, limit);
            try (ResultSet rows = select.executeQuery()) {
                while (rows.next()) {
                    CareerPayout payout = new CareerPayout();
                    payout.matchKey = rows.getString(1);
                    payout.at = rows.getLong(2);
                    payout.opponent = rows.getString(3);
                    payout.won = rows.getInt(4) == 1;
                    payout.coins = rows.getInt(5);
                    payout.xp = rows.getInt(6);
                    payout.note = rows.getString(7);
                    payouts.add(payout);
                }
            }
        }
        return payouts;
    }

    /** wins against each opponent, for unlocking the next tier */
    public synchronized java.util.Map<String, Integer> winsByOpponent(String user) throws SQLException {
        java.util.Map<String, Integer> wins = new java.util.HashMap<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT opponent, SUM(won) FROM payouts WHERE user = ? GROUP BY opponent")) {
            select.setString(1, key(user));
            try (ResultSet rows = select.executeQuery()) {
                while (rows.next()) {
                    wins.put(rows.getString(1), rows.getInt(2));
                }
            }
        }
        return wins;
    }

    @Override
    public synchronized void close() throws SQLException {
        connection.close();
    }
}
