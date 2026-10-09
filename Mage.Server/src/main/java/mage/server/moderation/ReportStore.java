package mage.server.moderation;

import com.j256.ormlite.dao.Dao;
import com.j256.ormlite.dao.DaoManager;
import com.j256.ormlite.jdbc.JdbcConnectionSource;
import com.j256.ormlite.stmt.QueryBuilder;
import com.j256.ormlite.stmt.SelectArg;
import com.j256.ormlite.support.ConnectionSource;
import com.j256.ormlite.table.TableUtils;
import org.apache.log4j.Logger;

import java.io.File;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Player reports and the moderation queue. Stored in db/web_reports.db (SQLite).
 */
public final class ReportStore {

    private static final Logger logger = Logger.getLogger(ReportStore.class);

    public static final List<String> REASONS = Collections.unmodifiableList(Arrays.asList("abuse", "cheating", "spam", "stalling", "other"));
    /** open reports one player may have filed at a time, so the queue can't be flooded */
    public static final int MAX_OPEN_PER_REPORTER = 5;
    public static final int MAX_DETAILS = 1000;
    private static final String DEFAULT_URL = "jdbc:sqlite:./db/web_reports.db";

    private static volatile ReportStore instance;

    private final Dao<PlayerReport, Long> dao;

    public ReportStore(String jdbcUrl) throws SQLException {
        ConnectionSource source = new JdbcConnectionSource(jdbcUrl);
        TableUtils.createTableIfNotExists(source, PlayerReport.class);
        dao = DaoManager.createDao(source, PlayerReport.class);
    }

    public static ReportStore get() {
        ReportStore current = instance;
        if (current == null) {
            synchronized (ReportStore.class) {
                current = instance;
                if (current == null) {
                    new File("db").mkdirs();
                    try {
                        current = new ReportStore(DEFAULT_URL);
                    } catch (SQLException | LinkageError e) {
                        logger.error("Reports database can't be opened", e);
                        throw new IllegalStateException("Reports can't be filed on this server right now");
                    }
                    instance = current;
                }
            }
        }
        return current;
    }

    public synchronized PlayerReport file(String reporter, String reported, String reason, String details, String gameId, long now) throws SQLException {
        if (reported == null || reported.trim().isEmpty()) {
            throw new IllegalArgumentException("Who are you reporting?");
        }
        if (reported.trim().equalsIgnoreCase(reporter)) {
            throw new IllegalArgumentException("You can't report yourself");
        }
        String why = reason == null ? "" : reason.toLowerCase(Locale.ROOT);
        if (!REASONS.contains(why)) {
            throw new IllegalArgumentException("Pick a reason: " + String.join(", ", REASONS));
        }
        long open = dao.queryBuilder().where().eq("reporter", new SelectArg(reporter)).and().eq("open", true).countOf();
        if (open >= MAX_OPEN_PER_REPORTER) {
            throw new IllegalArgumentException("You have " + open + " reports waiting for a moderator already");
        }
        PlayerReport report = new PlayerReport();
        report.reporter = reporter;
        report.reported = reported.trim();
        report.reason = why;
        String text = details == null ? "" : details.trim();
        report.details = text.length() > MAX_DETAILS ? text.substring(0, MAX_DETAILS) : text;
        report.gameId = gameId == null || gameId.isEmpty() ? null : gameId;
        report.createdAt = now;
        report.open = true;
        dao.create(report);
        logger.info("Player report " + report.id + ": " + reporter + " reported " + report.reported + " for " + why);
        return report;
    }

    /**
     * Newest first; open ones only, or every report.
     */
    public synchronized List<PlayerReport> list(boolean openOnly, int limit) throws SQLException {
        QueryBuilder<PlayerReport, Long> query = dao.queryBuilder().orderBy("createdAt", false).limit((long) Math.max(1, Math.min(limit, 500)));
        if (openOnly) {
            query.where().eq("open", true);
        }
        return query.query();
    }

    public synchronized boolean close(long id, String resolution, long now) throws SQLException {
        PlayerReport report = dao.queryForId(id);
        if (report == null || !report.open) {
            return false;
        }
        report.open = false;
        String text = resolution == null ? "" : resolution.trim();
        report.resolution = text.length() > 500 ? text.substring(0, 500) : text;
        report.closedAt = now;
        dao.update(report);
        return true;
    }
}
