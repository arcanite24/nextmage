package mage.server;

import mage.server.admin.AccessPolicy;
import mage.server.admin.AdminStore;
import mage.server.admin.AllowEntry;
import mage.server.admin.Invite;
import mage.server.managers.ManagerFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.lang.reflect.Proxy;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A contributors server is a security boundary: an account that isn't on the allowlist can't register, sign in, come
 * back on a remembered device or restore a session, and an invite link lets its account in.
 */
public class AccessGateTest {

    private static final String PASSWORD = "correct horse 7";

    @TempDir
    Path dir;

    private final Map<String, Function<Object[], Object>> overrides = new HashMap<>();
    private final Map<String, User> users = new HashMap<>();
    private AuthorizedUserRepository previousAccounts;
    private AuthorizedUserRepository accounts;
    private AdminStore store;
    private ManagerFactory managers;

    @BeforeEach
    void setUp() throws Exception {
        previousAccounts = AuthorizedUserRepository.getInstance();
        accounts = new AuthorizedUserRepository("jdbc:h2:mem:gate-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        AuthorizedUserRepository.use(accounts);
        store = new AdminStore("jdbc:sqlite:" + dir.resolve("admin.db"));
        AccessPolicy.use(AccessPolicy.create(store, "owner", "allowlist", "alice", 1000));

        managers = deepProxy(ManagerFactory.class);
        overrides.put("isAuthenticationActivated", args -> true);
        overrides.put("getMinUserNameLength", args -> 3);
        overrides.put("getMaxUserNameLength", args -> 20);
        overrides.put("getMinPasswordLength", args -> 8);
        overrides.put("getMaxPasswordLength", args -> 100);
        overrides.put("getInvalidUserNamePattern", args -> "[^a-zA-Z0-9_-]");
        overrides.put("getMailUser", args -> "");
        overrides.put("getMailgunApiKey", args -> "");
        overrides.put("getServerName", args -> "contributors");
        overrides.put("createUser", args -> {
            String name = (String) args[0];
            if (users.containsKey(name)) {
                return Optional.empty();
            }
            User user = new User(managers, name, (String) args[1], (AuthorizedUser) args[2]);
            users.put(name, user);
            return Optional.of(user);
        });
        overrides.put("getUserByName", args -> Optional.ofNullable(users.get((String) args[0])));
        overrides.put("connectToSession", args -> true);
    }

    @AfterEach
    void tearDown() {
        AuthorizedUserRepository.use(previousAccounts);
        AccessPolicy.use(null);
    }

    @Test
    void unlistedAccountCantRegister() {
        assertThat(newSession().registerUser("mallory", PASSWORD, "mallory@example.test")).isEqualTo(AccessPolicy.REFUSED);
        assertThat(accounts.getByName("mallory")).isNull();
    }

    @Test
    void listedAccountRegistersAndSignsIn() throws Exception {
        assertThat(newSession().registerUser("alice", PASSWORD, "alice@example.test")).isNull();
        assertThat(newSession().connectUser("alice", PASSWORD, "")).isNull();
    }

    @Test
    void listedEmailRegistersAnyName() throws Exception {
        store.allow("bea@example.test", "approved request", "console", 2000);

        assertThat(newSession().registerUser("bea", PASSWORD, "bea@example.test")).isNull();
        assertThat(newSession().connectUser("bea", PASSWORD, "")).isNull();
    }

    @Test
    void inviteRegistersAndAllowlistsOnce() throws Exception {
        Invite invite = store.createInvite("for carol", 1, 7, "console", System.currentTimeMillis());

        assertThat(newSession().registerUser("carol", PASSWORD, "carol@example.test", invite.code)).isNull();
        assertThat(store.isListed("carol", null)).isTrue();
        assertThat(newSession().connectUser("carol", PASSWORD, "")).isNull();

        String reused = newSession().registerUser("dave", PASSWORD, "dave@example.test", invite.code);
        assertThat(reused).contains("used up");
        assertThat(accounts.getByName("dave")).isNull();
    }

    @Test
    void unlistedAccountCantSignIn() throws Exception {
        accounts.add("mallory", PASSWORD, "mallory@example.test"); // registered while the server was open

        assertThat(newSession().connectUser("mallory", PASSWORD, "")).isEqualTo(AccessPolicy.REFUSED);
        assertThat(newSession().connectUser("owner", PASSWORD, "")).as("not registered").contains("Wrong username");

        accounts.add("owner", PASSWORD, "owner@example.test");
        assertThat(newSession().connectUser("owner", PASSWORD, "")).as("the owner is always in").isNull();
    }

    @Test
    void rememberedDeviceStopsWorkingOnceTakenOffTheList() throws Exception {
        assertThat(newSession().registerUser("alice", PASSWORD, "alice@example.test")).isNull();
        Session remembered = newSession();
        remembered.trustRememberedLogin("alice");
        assertThat(remembered.connectUser("alice", "", "")).isNull();

        AllowEntry entry = store.allowlist().stream().filter(e -> "alice".equals(e.name)).findFirst().get();
        store.disallow(entry.id);
        Session later = newSession();
        later.trustRememberedLogin("alice");
        assertThat(later.connectUser("alice", "", "")).isEqualTo(AccessPolicy.REFUSED);
    }

    @Test
    void restoredSessionStopsWorkingOnceTakenOffTheList() throws Exception {
        assertThat(newSession().registerUser("alice", PASSWORD, "alice@example.test")).isNull();
        assertThat(newSession().connectUser("alice", PASSWORD, "")).isNull();
        User alice = users.get("alice");
        alice.setRestoreSessionId("restore-me");

        AccessPolicy.get().setMode(AccessPolicy.ALLOWLIST, "console", "test", 2000);
        AllowEntry entry = store.allowlist().stream().filter(e -> "alice".equals(e.name)).findFirst().get();
        store.disallow(entry.id);
        assertThat(newSession().connectUser("alice", "", "restore-me")).isEqualTo(AccessPolicy.REFUSED);
    }

    @Test
    void nobodySignsInAsTheAdminConsole() throws Exception {
        overrides.put("isAuthenticationActivated", args -> false);

        assertThat(newSession().connectUser("Admin", "", "")).contains("already in use");
        assertThat(newSession().connectUser("admin ", "", "")).contains("already in use");
    }

    private Session newSession() {
        Session session = new Session(managers, UUID.randomUUID().toString(), null);
        session.setHost("192.0.2.10");
        return session;
    }

    @SuppressWarnings("unchecked")
    private <T> T deepProxy(Class<T> type) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) -> {
            Function<Object[], Object> override = overrides.get(method.getName());
            if (override != null) {
                return override.apply(args == null ? new Object[0] : args);
            }
            Class<?> result = method.getReturnType();
            if (result == Optional.class) {
                return Optional.empty();
            }
            if (result == boolean.class) {
                return false;
            }
            if (result == int.class || result == long.class) {
                return result == int.class ? (Object) 0 : (Object) 0L;
            }
            if (result.isInterface()) {
                return deepProxy(result);
            }
            return null;
        });
    }
}
