package mage.server;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Games staff were let into from the admin console. A pass lets the staff member watch past the players' ignore lists
 * (and a tournament that closed watching); it is used up when they start watching.
 */
public final class StaffWatch {

    private static final Set<String> passes = ConcurrentHashMap.newKeySet();

    private StaffWatch() {
    }

    static void grant(UUID userId, UUID gameId) {
        passes.add(userId + "/" + gameId);
    }

    public static boolean take(UUID userId, UUID gameId) {
        return passes.remove(userId + "/" + gameId);
    }
}
