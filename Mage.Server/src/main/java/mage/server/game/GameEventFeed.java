package mage.server.game;

import mage.view.GameEventView;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The recent events of one game (see {@link GameEventView}), for game views to carry to clients. Each session reads
 * the events newer than the last one it got. Feeds are found by game id, because the watcher that fills a feed is
 * deep-copied with the game state and can't hold a reference to it.
 */
public final class GameEventFeed {

    /** events kept for a session that falls behind; older ones are dropped */
    static final int CAPACITY = 512;

    private static final Map<UUID, GameEventFeed> FEEDS = new ConcurrentHashMap<>();

    private final Deque<Entry> events = new ArrayDeque<>();
    private long lastSeq = 0;

    private static final class Entry {
        final GameEventView event;
        /** the only player who may see the card's identity; null when everyone may */
        final UUID privateTo;

        Entry(GameEventView event, UUID privateTo) {
            this.event = event;
            this.privateTo = privateTo;
        }
    }

    public static GameEventFeed open(UUID gameId) {
        return FEEDS.computeIfAbsent(gameId, id -> new GameEventFeed());
    }

    /** null when the game has no feed (closed, or a game the server isn't running) */
    public static GameEventFeed of(UUID gameId) {
        return gameId == null ? null : FEEDS.get(gameId);
    }

    public static void close(UUID gameId) {
        if (gameId != null) {
            FEEDS.remove(gameId);
        }
    }

    public synchronized long nextSeq() {
        return ++lastSeq;
    }

    public synchronized long lastSeq() {
        return lastSeq;
    }

    public synchronized void add(GameEventView event, UUID privateTo) {
        events.addLast(new Entry(event, privateTo));
        while (events.size() > CAPACITY) {
            events.removeFirst();
        }
    }

    /**
     * Events after {@code afterSeq}, as {@code viewerId} may see them (null viewer: a spectator, who sees no private
     * card).
     */
    public synchronized List<GameEventView> since(long afterSeq, UUID viewerId) {
        List<GameEventView> result = new ArrayList<>();
        for (Entry entry : events) {
            if (entry.event.getSeq() <= afterSeq) {
                continue;
            }
            boolean visible = entry.privateTo == null || entry.privateTo.equals(viewerId);
            result.add(visible ? entry.event : entry.event.hidden());
        }
        return result;
    }
}
