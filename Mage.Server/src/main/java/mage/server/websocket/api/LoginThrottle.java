package mage.server.websocket.api;

import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

/**
 * Web client bridge: per-IP exponential lockout after failed logins.
 * <p>
 * Replaces the desktop server's {@code Thread.sleep} backoff, which would hold one of the bridge's shared worker
 * threads per failed attempt: a locked out caller is rejected immediately instead. After the n-th consecutive
 * failure the IP is locked for {@code 2^(n-1)} seconds, at most {@link #MAX_LOCK_MILLIS}; a success resets it.
 */
final class LoginThrottle {

    static final long BASE_LOCK_MILLIS = TimeUnit.SECONDS.toMillis(1);
    static final long MAX_LOCK_MILLIS = TimeUnit.MINUTES.toMillis(5);
    private static final long FORGET_AFTER_MILLIS = MAX_LOCK_MILLIS * 2;
    private static final int CLEANUP_THRESHOLD = 10_000;

    private static final class Entry {
        int failures;
        long lockedUntil;
        long lastSeen;
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final LongSupplier clock;

    LoginThrottle() {
        this(System::currentTimeMillis);
    }

    LoginThrottle(LongSupplier clock) {
        this.clock = clock;
    }

    /**
     * Starts a login attempt. While an attempt is running, other attempts from the same IP are refused too,
     * so parallel connections cannot multiply the guess rate.
     *
     * @return 0 when the attempt may proceed (finish it with {@link #recordFailure} or {@link #recordSuccess}),
     * otherwise the milliseconds until the IP may try again
     */
    long tryBegin(String ip) {
        long now = clock.getAsLong();
        if (entries.size() > CLEANUP_THRESHOLD) {
            cleanup(now);
        }
        Entry entry = entries.computeIfAbsent(key(ip), k -> new Entry());
        synchronized (entry) {
            if (entry.failures > 0 && now - entry.lastSeen > FORGET_AFTER_MILLIS) {
                entry.failures = 0; // long quiet period: start over
            }
            entry.lastSeen = now;
            long remaining = entry.lockedUntil - now;
            if (remaining > 0) {
                return remaining;
            }
            entry.lockedUntil = now + BASE_LOCK_MILLIS; // until the attempt's result is recorded
            return 0;
        }
    }

    void recordFailure(String ip) {
        long now = clock.getAsLong();
        Entry entry = entries.computeIfAbsent(key(ip), k -> new Entry());
        synchronized (entry) {
            entry.failures++;
            entry.lastSeen = now;
            int shift = Math.min(entry.failures - 1, 20);
            entry.lockedUntil = now + Math.min(MAX_LOCK_MILLIS, BASE_LOCK_MILLIS << shift);
        }
    }

    void recordSuccess(String ip) {
        entries.remove(key(ip));
    }

    private void cleanup(long now) {
        Iterator<Entry> it = entries.values().iterator();
        while (it.hasNext()) {
            Entry entry = it.next();
            synchronized (entry) {
                if (now - entry.lastSeen > FORGET_AFTER_MILLIS && entry.lockedUntil <= now) {
                    it.remove();
                }
            }
        }
    }

    private static String key(String ip) {
        return ip == null ? "" : ip;
    }
}
