package mage.server.websocket;

import org.apache.log4j.Logger;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;

/**
 * Web client bridge: how many messages go out, how large they are, and which callbacks are the heavy ones.
 * Sizes are in characters of JSON (close to bytes before compression). A callback over {@link #LARGE_CHARS} is logged
 * as a warning, at most once per {@link #WARN_EVERY_MILLIS} per method, and kept in a short list for the admin console.
 */
public final class BridgeMetrics {

    private static final Logger logger = Logger.getLogger(BridgeMetrics.class);

    public static final int LARGE_CHARS = 256 * 1024;
    static final long WARN_EVERY_MILLIS = 10_000;
    /** upper bounds of the size buckets; the last bucket is everything larger */
    public static final int[] BUCKETS = {4 * 1024, 16 * 1024, 64 * 1024, 256 * 1024, 1024 * 1024};
    private static final int KEEP_LARGE = 20;

    private static final BridgeMetrics INSTANCE = new BridgeMetrics();

    private final long startedAt = System.currentTimeMillis();
    private final LongAdder messages = new LongAdder();
    private final LongAdder chars = new LongAdder();
    private final LongAdder requests = new LongAdder();
    private final LongAdder[] histogram = new LongAdder[BUCKETS.length + 1];
    private final Map<String, MethodTotals> callbacks = new ConcurrentHashMap<>();
    private final Map<String, Long> lastWarned = new ConcurrentHashMap<>();
    private final Deque<LargeMessage> large = new ArrayDeque<>();
    private final AtomicInteger connections = new AtomicInteger();
    private final LongAdder stateComplete = new LongAdder();
    private final LongAdder statePatches = new LongAdder();
    private final LongAdder stateResyncs = new LongAdder();
    private final LongAdder stateChars = new LongAdder();
    private final LongAdder stateFullChars = new LongAdder();

    private static final class MethodTotals {
        final LongAdder count = new LongAdder();
        final LongAdder chars = new LongAdder();
        final AtomicLong max = new AtomicLong();
    }

    /** One message over the limit. */
    public static class LargeMessage {
        public String method;
        public int chars;
        public String objectId;
        public long at;
    }

    /** Totals for one callback method. */
    public static class CallbackStats {
        public String method;
        public long count;
        public long chars;
        public long maxChars;
    }

    /** Everything at once, for the admin console. */
    public static class BridgeSnapshot {
        public long startedAt;
        public long messages;
        public long chars;
        public long requests;
        public int connections;
        public int[] bucketLimits = BUCKETS;
        public long[] buckets;
        public List<CallbackStats> heaviest;
        public List<LargeMessage> large;
        /** game states sent complete to clients that take patches */
        public long stateComplete;
        /** game states sent as patches */
        public long statePatches;
        /** times a client could not apply a patch and asked for the complete state */
        public long stateResyncs;
        /** characters sent for those game states */
        public long stateChars;
        /** characters they would have taken without patches */
        public long stateFullChars;
    }

    private BridgeMetrics() {
        for (int i = 0; i < histogram.length; i++) {
            histogram[i] = new LongAdder();
        }
    }

    public static BridgeMetrics get() {
        return INSTANCE;
    }

    /** Every outgoing message: responses and callbacks. */
    void sent(int size) {
        messages.increment();
        chars.add(size);
        int bucket = 0;
        while (bucket < BUCKETS.length && size > BUCKETS[bucket]) {
            bucket++;
        }
        histogram[bucket].increment();
    }

    /** A server callback, by method; warns about large ones. */
    void callback(String method, int size, Object objectId) {
        MethodTotals totals = callbacks.computeIfAbsent(method, key -> new MethodTotals());
        totals.count.increment();
        totals.chars.add(size);
        totals.max.accumulateAndGet(size, Math::max);
        if (size > LARGE_CHARS) {
            long now = System.currentTimeMillis();
            LargeMessage message = new LargeMessage();
            message.method = method;
            message.chars = size;
            message.objectId = objectId == null ? null : objectId.toString();
            message.at = now;
            synchronized (large) {
                large.addFirst(message);
                while (large.size() > KEEP_LARGE) {
                    large.removeLast();
                }
            }
            Long last = lastWarned.get(method);
            if (last == null || now - last > WARN_EVERY_MILLIS) {
                lastWarned.put(method, now);
                logger.warn("Large WebSocket message: " + method + " is " + size / 1024 + " KB"
                        + (objectId == null ? "" : " (" + objectId + ')'));
            }
        }
    }

    /**
     * A game state for a client that takes patches.
     *
     * @param fullSize the size it would have had without patches
     */
    void state(boolean patch, int fullSize, int size) {
        (patch ? statePatches : stateComplete).increment();
        stateFullChars.add(fullSize);
        stateChars.add(size);
    }

    void stateResync() {
        stateResyncs.increment();
    }

    void request() {
        requests.increment();
    }

    void opened() {
        connections.incrementAndGet();
    }

    void closed() {
        connections.decrementAndGet();
    }

    public BridgeSnapshot snapshot() {
        BridgeSnapshot snapshot = new BridgeSnapshot();
        snapshot.startedAt = startedAt;
        snapshot.messages = messages.sum();
        snapshot.chars = chars.sum();
        snapshot.requests = requests.sum();
        snapshot.connections = Math.max(0, connections.get());
        snapshot.buckets = new long[histogram.length];
        for (int i = 0; i < histogram.length; i++) {
            snapshot.buckets[i] = histogram[i].sum();
        }
        List<CallbackStats> heaviest = new ArrayList<>();
        callbacks.forEach((method, totals) -> {
            CallbackStats stats = new CallbackStats();
            stats.method = method;
            stats.count = totals.count.sum();
            stats.chars = totals.chars.sum();
            stats.maxChars = totals.max.get();
            heaviest.add(stats);
        });
        heaviest.sort(Comparator.comparingLong((CallbackStats stats) -> stats.chars).reversed());
        snapshot.heaviest = heaviest.size() > 12 ? new ArrayList<>(heaviest.subList(0, 12)) : heaviest;
        synchronized (large) {
            snapshot.large = new ArrayList<>(large);
        }
        snapshot.stateComplete = stateComplete.sum();
        snapshot.statePatches = statePatches.sum();
        snapshot.stateResyncs = stateResyncs.sum();
        snapshot.stateChars = stateChars.sum();
        snapshot.stateFullChars = stateFullChars.sum();
        return snapshot;
    }
}
