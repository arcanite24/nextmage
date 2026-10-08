package mage.server;

import mage.server.managers.ManagerFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Anonymous (no authentication) reconnects: a server-issued restore id takes a user back from any address,
 * a wrong or empty one never does.
 */
public class SessionRestoreTest {

    private final Map<String, Function<Object[], Object>> overrides = new HashMap<>();
    private ManagerFactory managers;
    private User alice;

    @BeforeEach
    void setUp() {
        managers = deepProxy(ManagerFactory.class);
        alice = new User(managers, "alice", "198.51.100.1", null);
        alice.setSessionId("old-session");
        alice.setRestoreSessionId("old-session");

        overrides.put("isAuthenticationActivated", args -> false);
        overrides.put("getMinUserNameLength", args -> 3);
        overrides.put("getMaxUserNameLength", args -> 20);
        overrides.put("createUser", args -> Optional.empty()); // name is taken
        overrides.put("getUserByName", args -> Optional.of(alice));
        overrides.put("connectToSession", args -> {
            alice.setSessionId((String) args[0]);
            return true;
        });
    }

    @Test
    void restoreIdTakesTheUserBackFromAnotherAddress() throws Exception {
        Session session = newSession("new-session", "203.0.113.9");

        assertThat(session.connectUser("alice", "", "old-session")).isNull();
        assertThat(session.getUserId()).isEqualTo(alice.getId());
        assertThat(alice.getRestoreSessionId()).as("restore id rotates to the new session").isEqualTo("new-session");
    }

    @Test
    void wrongRestoreIdFromAnotherAddressDoesNotTakeOver() throws Exception {
        Session session = newSession("new-session", "203.0.113.9");

        assertThat(session.connectUser("alice", "", "guessed")).contains("already connected");
        assertThat(session.getUserId()).isNull();
        assertThat(alice.getSessionId()).isEqualTo("old-session");
    }

    @Test
    void emptyRestoreIdNeverMatches() throws Exception {
        alice.setRestoreSessionId("");
        Session session = newSession("new-session", "203.0.113.9");

        assertThat(session.connectUser("alice", "", "")).contains("already connected");
        assertThat(alice.getSessionId()).isEqualTo("old-session");
    }

    private Session newSession(String sessionId, String host) {
        Session session = new Session(managers, sessionId, null);
        session.setHost(host);
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
                return deepProxy(result); // managers, executors: calls on them do nothing
            }
            return null;
        });
    }
}
