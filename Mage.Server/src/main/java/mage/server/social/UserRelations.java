package mage.server.social;

import java.util.Collection;
import java.util.Collections;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

/**
 * Who each connected user ignores, by player name. A web client keeps its own list (names are not accounts while
 * authentication is off) and hands it over after login; the server only enforces it while the user is connected:
 * ignored players' table chat doesn't reach them and their whispers are refused.
 */
public final class UserRelations {

    /** names are compared case-insensitively, as user names are unique regardless of case */
    private static final ConcurrentMap<UUID, Set<String>> IGNORED = new ConcurrentHashMap<>();

    /** generous: a list is a convenience, not a moderation tool */
    public static final int MAX_IGNORED = 500;

    private UserRelations() {
    }

    public static void setIgnored(UUID userId, Collection<String> names) {
        if (userId == null) {
            return;
        }
        Set<String> normalized = names == null ? Collections.emptySet() : names.stream()
                .filter(name -> name != null && !name.trim().isEmpty())
                .map(name -> name.trim().toLowerCase(Locale.ENGLISH))
                .limit(MAX_IGNORED)
                .collect(Collectors.toSet());
        if (normalized.isEmpty()) {
            IGNORED.remove(userId);
        } else {
            IGNORED.put(userId, Collections.unmodifiableSet(normalized));
        }
    }

    public static boolean ignores(UUID userId, String name) {
        if (userId == null || name == null) {
            return false;
        }
        Set<String> ignored = IGNORED.get(userId);
        return ignored != null && ignored.contains(name.trim().toLowerCase(Locale.ENGLISH));
    }

    public static Set<String> ignored(UUID userId) {
        return userId == null ? Collections.emptySet() : IGNORED.getOrDefault(userId, Collections.emptySet());
    }

    public static void forget(UUID userId) {
        if (userId != null) {
            IGNORED.remove(userId);
        }
    }
}
