package mage.server.admin;

import org.apache.log4j.Logger;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Who may play here: everyone (open), or only the people on the allowlist (a contributors server). Registration,
 * sign-in, a remembered device and a restored session all ask {@link #refusal}; staff and the owner are always let in.
 * <p>
 * The mode lives in db/web_admin.db, so /admin can switch it while the server runs. On the very first boot it comes
 * from {@code xmage.access} ("open" or "allowlist"), with {@code xmage.allowlist} (names and emails, comma separated,
 * or "@path" to a file with one per line) as the starting list, so a contributors server never starts open by accident.
 * {@code xmage.owner} names the owner, who is always allowed.
 */
public final class AccessPolicy {

    private static final Logger logger = Logger.getLogger(AccessPolicy.class);

    public static final String OPEN = "open";
    public static final String ALLOWLIST = "allowlist";

    public static final String MODE_SETTING = "access.mode";
    public static final String NOTICE_SETTING = "access.notice";
    public static final int MAX_NOTICE = 500;

    public static final String ACCESS_PROP = "xmage.access";
    public static final String OWNER_PROP = "xmage.owner";
    public static final String ALLOWLIST_PROP = "xmage.allowlist";

    public static final String REFUSED = "This server is for contributors only, and your account isn't on its list. "
            + "Ask for access from the sign-in screen, or use an invite link.";

    /** the actor of changes made on first boot from the environment */
    public static final String BOOT = "boot";

    private static volatile AccessPolicy instance;

    private final AdminStore store;
    private final String owner;
    private volatile String mode;
    private volatile String notice;

    AccessPolicy(AdminStore store, String owner) {
        this.store = store;
        this.owner = owner == null ? "" : owner.trim();
    }

    public static AccessPolicy get() {
        AccessPolicy current = instance;
        if (current == null) {
            synchronized (AccessPolicy.class) {
                current = instance;
                if (current == null) {
                    current = new AccessPolicy(AdminStore.get(), System.getProperty(OWNER_PROP, ""));
                    current.load(System.getProperty(ACCESS_PROP, ""), System.getProperty(ALLOWLIST_PROP, ""), System.currentTimeMillis());
                    instance = current;
                }
            }
        }
        return current;
    }

    /** For tests: the policy every server class sees. */
    public static void use(AccessPolicy policy) {
        instance = policy;
    }

    /** A policy on its own store, loaded as on boot. */
    public static AccessPolicy create(AdminStore store, String owner, String accessOnFirstBoot, String seedAllowlist, long now) {
        AccessPolicy policy = new AccessPolicy(store, owner);
        policy.load(accessOnFirstBoot, seedAllowlist, now);
        return policy;
    }

    private void load(String accessOnFirstBoot, String seedAllowlist, long now) {
        try {
            String stored = store.setting(MODE_SETTING);
            if (stored == null) {
                String first = parseMode(accessOnFirstBoot);
                store.putSetting(MODE_SETTING, first, BOOT, now);
                store.audit(BOOT, "access.mode", first, "first boot", null, now);
                int seeded = 0;
                for (String who : seedList(seedAllowlist)) {
                    store.allow(who, "seed allowlist", BOOT, now);
                    seeded++;
                }
                if (seeded > 0) {
                    store.audit(BOOT, "access.allow", seeded + " seeded", null, null, now);
                }
                stored = first;
            }
            mode = ALLOWLIST.equals(stored) ? ALLOWLIST : OPEN;
            notice = store.setting(NOTICE_SETTING);
        } catch (SQLException e) {
            // fail closed when a contributors server was asked for: nobody but staff gets in until the database is back
            logger.error("Access settings can't be read", e);
            mode = ALLOWLIST.equals(parseMode(accessOnFirstBoot)) ? ALLOWLIST : OPEN;
        }
        logger.info("Access: " + mode + (owner.isEmpty() ? "" : ", owner " + owner));
    }

    static String parseMode(String text) {
        String value = text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
        switch (value) {
            case "allowlist":
            case "contributors":
            case "closed":
            case "whitelist":
                return ALLOWLIST;
            case "":
            case "open":
                return OPEN;
            default:
                logger.warn(ACCESS_PROP + " is \"" + text + "\"; use open or allowlist. Starting closed to be safe.");
                return ALLOWLIST;
        }
    }

    static List<String> seedList(String text) {
        List<String> result = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) {
            return result;
        }
        String content = text.trim();
        if (content.startsWith("@")) {
            try {
                content = new String(Files.readAllBytes(Paths.get(content.substring(1).trim())), StandardCharsets.UTF_8);
            } catch (IOException e) {
                logger.error("Seed allowlist file can't be read: " + content.substring(1).trim());
                return result;
            }
        }
        for (String line : content.split("[,;\\n\\r]+")) {
            String who = line.replaceAll("#.*$", "").trim();
            if (!who.isEmpty()) {
                result.add(who);
            }
        }
        return result;
    }

    public AdminStore store() {
        return store;
    }

    public String mode() {
        return mode;
    }

    public boolean isAllowlist() {
        return ALLOWLIST.equals(mode);
    }

    public String owner() {
        return owner;
    }

    public boolean isOwner(String userName) {
        return !owner.isEmpty() && userName != null && owner.equalsIgnoreCase(userName.trim());
    }

    /**
     * The account's staff role: the owner's is always owner. Null for players, and when the role can't be read.
     */
    public StaffRole roleOf(String userName) {
        if (isOwner(userName)) {
            return StaffRole.OWNER;
        }
        try {
            return store.staffRole(userName);
        } catch (SQLException e) {
            logger.error("Staff list can't be read", e);
            return null;
        }
    }

    public String notice() {
        return notice == null ? "" : notice;
    }

    public void setMode(String newMode, String by, String reason, long now) throws SQLException {
        String value = ALLOWLIST.equals(newMode) ? ALLOWLIST : OPEN;
        store.putSetting(MODE_SETTING, value, by, now);
        mode = value;
        store.audit(by, "access.mode", value, null, reason, now);
    }

    public void setNotice(String text, String by, long now) throws SQLException {
        String value = AdminStore.cut(text == null ? "" : text, MAX_NOTICE);
        store.putSetting(NOTICE_SETTING, value, by, now);
        notice = value;
        store.audit(by, "access.notice", null, value.isEmpty() ? "cleared" : value, null, now);
    }

    /**
     * Whether this account may play here in the current mode.
     */
    public boolean allows(String userName, String email) {
        if (!isAllowlist() || isOwner(userName)) {
            return true;
        }
        try {
            return store.isListed(userName, email) || store.staffRole(userName) != null || isRepoPerson(userName);
        } catch (SQLException e) {
            logger.error("Allowlist can't be read; refusing " + userName, e);
            return false;
        }
    }

    /** an account that signs in with GitHub, whose GitHub user is one of the repository's people */
    private boolean isRepoPerson(String userName) throws SQLException {
        GithubAuth github = GithubAuth.get();
        if (github.repo().isEmpty()) {
            return false;
        }
        GithubLink link = store.githubLinkOf(userName);
        return link != null && github.isRepoPerson(link.login);
    }

    /**
     * Why this account can't sign in or register, or null when it may. Only servers with accounts are closed:
     * without them anyone can take any name.
     */
    public String refusal(boolean accounts, String userName, String email) {
        if (!accounts || allows(userName, email)) {
            return null;
        }
        return REFUSED;
    }
}
