package mage.server.moderation;

import org.apache.log4j.Logger;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Crash reports from web clients: written to the server log and kept in memory for the admin console.
 * Self-hosted; nothing leaves the server. Each reporter gets a small budget per minute so a broken page can't flood it.
 */
public final class ClientErrors {

    private static final Logger logger = Logger.getLogger("mage.web.clientErrors");

    static final int KEEP = 200;
    static final int PER_MINUTE = 20;
    private static final ClientErrors INSTANCE = new ClientErrors();

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
        /** filled in by the server */
        public String userName;
        public long receivedAt;
        /** the same error again within a minute; counted instead of stored */
        public int repeats;
    }

    private final Deque<ClientError> recent = new ArrayDeque<>();
    private final Map<String, int[]> budgets = new HashMap<>();
    private long budgetMinute;

    public static ClientErrors get() {
        return INSTANCE;
    }

    /**
     * @return whether it was kept (false when the reporter is over its budget)
     */
    public synchronized boolean report(String reporter, String userName, ClientError error, long now) {
        long minute = now / 60_000;
        if (minute != budgetMinute) {
            budgets.clear();
            budgetMinute = minute;
        }
        int[] used = budgets.computeIfAbsent(reporter == null ? "" : reporter, key -> new int[1]);
        if (used[0] >= PER_MINUTE) {
            return false;
        }
        used[0]++;

        ClientError kept = new ClientError();
        kept.message = clip(error.message, 500);
        kept.stack = clip(error.stack, 4000);
        kept.source = clip(error.source, 40);
        kept.path = clip(error.path, 200);
        kept.userAgent = clip(error.userAgent, 300);
        kept.appVersion = clip(error.appVersion, 60);
        kept.context = clip(error.context, 1000);
        kept.userName = userName;
        kept.receivedAt = now;

        ClientError last = recent.peekFirst();
        if (last != null && same(last, kept) && now - last.receivedAt < 60_000) {
            last.repeats++;
            return true;
        }
        recent.addFirst(kept);
        while (recent.size() > KEEP) {
            recent.removeLast();
        }
        logger.warn("Client error from " + (userName == null ? "a visitor" : userName) + " [" + kept.source + "] on " + kept.path
                + " (" + kept.appVersion + "): " + kept.message);
        return true;
    }

    /**
     * Newest first.
     */
    public synchronized List<ClientError> recent(int limit) {
        List<ClientError> list = new ArrayList<>();
        for (ClientError error : recent) {
            if (list.size() >= limit) {
                break;
            }
            list.add(error);
        }
        return list;
    }

    private static boolean same(ClientError a, ClientError b) {
        return java.util.Objects.equals(a.message, b.message) && java.util.Objects.equals(a.path, b.path)
                && java.util.Objects.equals(a.userName, b.userName);
    }

    private static String clip(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() > max ? text.substring(0, max) : text;
    }
}
