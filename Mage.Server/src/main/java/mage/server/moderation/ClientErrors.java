package mage.server.moderation;

import mage.server.admin.AdminStore;
import mage.server.admin.ClientErrorGroup;
import org.apache.log4j.Logger;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Crash reports from web clients: written to the server log and counted in the admin database, grouped by kind
 * (message, source and top stack frame) so staff see each problem once, with how often and how recently it happened.
 * Self-hosted; nothing leaves the server. Each reporter gets a small budget per minute so a broken page can't flood it,
 * and visitors who aren't signed in share one more budget between them.
 */
public final class ClientErrors {

    private static final Logger logger = Logger.getLogger("mage.web.clientErrors");

    static final int PER_MINUTE = 20;
    /** reports a minute from everyone who isn't signed in, together */
    static final int VISITORS_PER_MINUTE = 60;
    private static final ClientErrors INSTANCE = new ClientErrors(AdminStore::get);

    /**
     * One report, as the client sends it; every field is optional and trimmed to size.
     */
    public static class ClientError {
        public String message;
        public String stack;
        /** where it was caught: window, promise, react, rpc */
        public String source;
        /** the page path, without query or hash */
        public String path;
        public String userAgent;
        public String appVersion;
        /** a little JSON about the situation, like the game id */
        public String context;
    }

    private final Supplier<AdminStore> store;
    private final Map<String, int[]> budgets = new HashMap<>();
    private int visitorsUsed;
    private long budgetMinute;

    ClientErrors(Supplier<AdminStore> store) {
        this.store = store;
    }

    public static ClientErrors get() {
        return INSTANCE;
    }

    /**
     * @return whether it was counted (false when the reporter is over its budget, or the database can't take it)
     */
    public boolean report(String reporter, String userName, ClientError error, long now) {
        if (!takeBudget(reporter, userName, now)) {
            return false;
        }
        ClientErrorGroup report = new ClientErrorGroup();
        report.message = clip(error.message, 500);
        report.stack = clip(error.stack, 4000);
        report.source = clip(error.source, 40);
        report.path = clip(error.path, 200);
        report.userAgent = clip(error.userAgent, 300);
        report.appVersion = clip(error.appVersion, 60);
        report.context = clip(error.context, 1000);
        report.lastUser = userName;
        report.fingerprint = fingerprint(report.message, report.source, report.stack);
        try {
            ClientErrorGroup group = store.get().recordClientError(report, now);
            // the log gets a new kind of error, then every hundredth time it happens
            if (group.count == 1 || group.count % 100 == 0) {
                logger.warn("Client error " + (group.count == 1 ? "(new)" : "(" + group.count + " times)") + " from "
                        + (userName == null ? "a visitor" : userName) + " [" + report.source + "] on " + report.path
                        + " (" + report.appVersion + "): " + report.message);
            }
            return true;
        } catch (SQLException | IllegalStateException e) {
            logger.warn("Client error not kept (" + e.getMessage() + "): " + report.message);
            return false;
        }
    }

    private synchronized boolean takeBudget(String reporter, String userName, long now) {
        long minute = now / 60_000;
        if (minute != budgetMinute) {
            budgets.clear();
            visitorsUsed = 0;
            budgetMinute = minute;
        }
        int[] used = budgets.computeIfAbsent(reporter == null ? "" : reporter, key -> new int[1]);
        if (used[0] >= PER_MINUTE || (userName == null && visitorsUsed >= VISITORS_PER_MINUTE)) {
            return false;
        }
        used[0]++;
        if (userName == null) {
            visitorsUsed++;
        }
        return true;
    }

    /**
     * The same problem gives the same fingerprint: numbers and ids in the message don't count, and of the stack only
     * the first frame does (without line and column, which move with every build).
     */
    static String fingerprint(String message, String source, String stack) {
        String text = (source == null ? "" : source) + '|' + normalize(message) + '|' + normalize(topFrame(stack));
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < 12; i++) {
                hex.append(String.format("%02x", hash[i]));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String topFrame(String stack) {
        if (stack == null) {
            return "";
        }
        for (String line : stack.split("\n")) {
            String frame = line.trim();
            if (frame.startsWith("at ") || frame.contains("@")) {
                // the file without its build hash, and the function
                return frame.replaceAll(":\\d+(:\\d+)?\\)?$", "").replaceAll("-[A-Za-z0-9_-]{8}\\.js", ".js");
            }
        }
        return "";
    }

    private static String normalize(String text) {
        if (text == null) {
            return "";
        }
        return text.replaceAll("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "<id>")
                .replaceAll("\\d+", "#")
                .trim();
    }

    private static String clip(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() > max ? text.substring(0, max) : text;
    }
}
