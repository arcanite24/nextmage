package mage.server;

import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Password reset codes sent by email: six digits, valid for a while and for a few guesses only, so they can't be
 * found by trying them all. Kept in memory, so a server restart cancels every pending reset.
 */
final class ResetTokens {

    static final long VALID_MILLIS = 30 * 60 * 1000L;
    static final int ATTEMPTS = 5;
    private static final int MAX_PENDING = 1024;

    private static final class Pending {
        final String code;
        final long expiresAt;
        int attemptsLeft = ATTEMPTS;

        Pending(String code, long expiresAt) {
            this.code = code;
            this.expiresAt = expiresAt;
        }
    }

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Pending> pending = new LinkedHashMap<String, Pending>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Pending> eldest) {
            return size() > MAX_PENDING;
        }
    };

    /**
     * @return a new code for this email address; it replaces any earlier one
     */
    synchronized String issue(String email, long now) {
        String code = String.format("%06d", random.nextInt(1_000_000));
        pending.put(key(email), new Pending(code, now + VALID_MILLIS));
        return code;
    }

    /**
     * Checks a code, using up one guess. A right code is used up too.
     */
    synchronized boolean redeem(String email, String code, long now) {
        String key = key(email);
        Pending entry = pending.get(key);
        if (entry == null) {
            return false;
        }
        if (now > entry.expiresAt) {
            pending.remove(key);
            return false;
        }
        if (code != null && java.security.MessageDigest.isEqual(entry.code.getBytes(), code.trim().getBytes())) {
            pending.remove(key);
            return true;
        }
        entry.attemptsLeft--;
        if (entry.attemptsLeft <= 0) {
            pending.remove(key);
        }
        return false;
    }

    private static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
