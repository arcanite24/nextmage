package mage.server.websocket;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Web client bridge: counts open connections per client IP.
 */
final class ConnectionLimiter {

    private final int maxPerIp;
    private final ConcurrentMap<String, AtomicInteger> open = new ConcurrentHashMap<>();

    /**
     * @param maxPerIp connections allowed per IP, 0 = unlimited
     */
    ConnectionLimiter(int maxPerIp) {
        this.maxPerIp = maxPerIp;
    }

    /**
     * @return true when the connection may stay open; it must be {@link #release released} when it closes
     */
    boolean tryAcquire(String ip) {
        if (maxPerIp <= 0) {
            return true;
        }
        boolean[] acquired = new boolean[1];
        open.compute(ip, (key, count) -> {
            AtomicInteger current = count == null ? new AtomicInteger() : count;
            if (current.get() < maxPerIp) {
                current.incrementAndGet();
                acquired[0] = true;
            }
            return current.get() == 0 ? null : current;
        });
        return acquired[0];
    }

    void release(String ip) {
        if (maxPerIp <= 0) {
            return;
        }
        open.computeIfPresent(ip, (key, count) -> count.decrementAndGet() <= 0 ? null : count);
    }

    int openConnections(String ip) {
        AtomicInteger count = open.get(ip);
        return count == null ? 0 : count.get();
    }
}
