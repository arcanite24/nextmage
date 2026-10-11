package mage.server.admin;

import java.util.Locale;

/**
 * What a staff member may do in /admin. Each role can do everything the ones below it can.
 * <ul>
 * <li>moderator: players (mute, sign out), reports, the audit log, server stats and client errors</li>
 * <li>admin: also locks and account activation, tables, broadcasts and who may play (access)</li>
 * <li>owner: also the staff list; the {@code xmage.owner} account and the admin console are always owners</li>
 * </ul>
 */
public enum StaffRole {
    MODERATOR, ADMIN, OWNER;

    public String id() {
        return name().toLowerCase(Locale.ROOT);
    }

    public boolean atLeast(StaffRole other) {
        return compareTo(other) >= 0;
    }

    /** null for anything that isn't a role */
    public static StaffRole parse(String text) {
        if (text == null) {
            return null;
        }
        for (StaffRole role : values()) {
            if (role.id().equals(text.trim().toLowerCase(Locale.ROOT))) {
                return role;
            }
        }
        return null;
    }
}
