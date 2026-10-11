package mage.server.websocket.api;

import mage.server.AuthorizedUser;
import mage.server.AuthorizedUserRepository;
import mage.server.Moderation;
import mage.server.User;
import mage.server.admin.AccessPolicy;
import mage.server.admin.AdminStore;
import mage.server.admin.StaffRole;
import mage.server.managers.ManagerFactory;
import mage.server.websocket.rpc.RpcCall;
import mage.server.websocket.rpc.RpcConnection;
import mage.server.websocket.rpc.RpcMethod;
import com.google.gson.JsonArray;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Staff act from their own player accounts: the role is read on every call, the owner is always an owner, players
 * and servers without accounts get nothing, and staff actions reach accounts that aren't online.
 */
public class StaffRolesTest {

    @TempDir
    Path dir;

    private final Map<String, Function<Object[], Object>> overrides = new HashMap<>();
    private final Map<String, String> sessionNames = new HashMap<>();
    private AuthorizedUserRepository previousAccounts;
    private AuthorizedUserRepository accounts;
    private AdminStore store;
    private ApiContext ctx;
    private ManagerFactory managers;

    @BeforeEach
    void setUp() throws Exception {
        previousAccounts = AuthorizedUserRepository.getInstance();
        accounts = new AuthorizedUserRepository("jdbc:h2:mem:staff-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        AuthorizedUserRepository.use(accounts);
        store = new AdminStore("jdbc:sqlite:" + dir.resolve("admin.db"));
        AccessPolicy.use(AccessPolicy.create(store, "Owner", "allowlist", "", 1000));
        managers = deepProxy(ManagerFactory.class);
        overrides.put("isAuthenticationActivated", args -> true);
        overrides.put("getUser", args -> args[0] instanceof String && sessionNames.containsKey(args[0])
                ? Optional.of(new User(managers, sessionNames.get(args[0]), "192.0.2.1", null)) : Optional.empty());
        ctx = new ApiContext(null, managers, null);
        sessionNames.put("s-owner", "owner");
        sessionNames.put("s-mod", "Mia");
        sessionNames.put("s-player", "pat");
    }

    @AfterEach
    void tearDown() {
        AuthorizedUserRepository.use(previousAccounts);
        AccessPolicy.use(null);
    }

    @Test
    void rolesComeFromTheStaffListAndTheOwnerSetting() throws Exception {
        assertThat(Staff.member(ctx, "s-owner").role).as("xmage.owner, any case").isEqualTo(StaffRole.OWNER);
        assertThat(Staff.member(ctx, "s-player")).isNull();
        assertThat(Staff.member(ctx, "s-mod")).isNull();

        store.grantStaff("Mia", StaffRole.MODERATOR, "owner", 2000);
        Staff.Member mia = Staff.member(ctx, "s-mod");
        assertThat(mia.role).isEqualTo(StaffRole.MODERATOR);
        assertThat(mia.actor).isEqualTo("Mia");

        store.revokeStaff("mia");
        assertThat(Staff.member(ctx, "s-mod")).as("revoking works at once").isNull();
    }

    @Test
    void eachActionNeedsItsRole() throws Exception {
        store.grantStaff("Mia", StaffRole.MODERATOR, "owner", 2000);

        assertThat(Staff.require(ctx, call("s-mod"), StaffRole.MODERATOR)).isEqualTo("Mia");
        assertThatThrownBy(() -> Staff.require(ctx, call("s-mod"), StaffRole.ADMIN)).hasMessageContaining("needs the admin role");
        assertThatThrownBy(() -> Staff.require(ctx, call("s-player"), StaffRole.MODERATOR)).hasMessageContaining("Staff only");
        assertThat(Staff.require(ctx, call("s-owner"), StaffRole.OWNER)).isEqualTo("owner");
    }

    private RpcCall call(String sessionId) {
        RpcConnection connection = (RpcConnection) Proxy.newProxyInstance(RpcConnection.class.getClassLoader(),
                new Class<?>[]{RpcConnection.class}, (proxy, method, args) -> "getSessionId".equals(method.getName()) ? sessionId : null);
        return new RpcCall(RpcMethod.named("adminTest").handler(c -> null), new JsonArray(), connection);
    }

    @Test
    void rolesNeedAccounts() throws Exception {
        store.grantStaff("Mia", StaffRole.ADMIN, "owner", 2000);
        overrides.put("isAuthenticationActivated", args -> false);

        assertThat(Staff.member(ctx, "s-mod")).as("anyone could take the name").isNull();
        assertThat(Staff.member(ctx, "s-owner")).isNull();
    }

    @Test
    void rolesAreOrdered() {
        assertThat(StaffRole.OWNER.atLeast(StaffRole.ADMIN)).isTrue();
        assertThat(StaffRole.ADMIN.atLeast(StaffRole.MODERATOR)).isTrue();
        assertThat(StaffRole.MODERATOR.atLeast(StaffRole.ADMIN)).isFalse();
        assertThat(StaffRole.parse(" Admin ")).isEqualTo(StaffRole.ADMIN);
        assertThat(StaffRole.parse("root")).isNull();
    }

    @Test
    void staffAreAlwaysLetIn() throws Exception {
        AccessPolicy access = AccessPolicy.get();
        assertThat(access.allows("Mia", null)).isFalse();

        store.grantStaff("Mia", StaffRole.MODERATOR, "owner", 2000);
        assertThat(access.allows("mia", null)).isTrue();
    }

    @Test
    void offlineAccountsAreMutedAndLocked() {
        accounts.add("pat", "secret12", "pat@example.test");
        Moderation moderation = new Moderation(managers);

        assertThat(moderation.mute("pat", 60)).isInTheFuture();
        assertThat(moderation.lock("pat", 30)).isInTheFuture();
        moderation.setActive("pat", false);
        AuthorizedUser pat = accounts.getByName("pat");
        assertThat(pat.getChatLockedUntil()).isInTheFuture();
        assertThat(pat.getLockedUntil()).isInTheFuture();
        assertThat(pat.isActive()).isFalse();

        assertThat(moderation.mute("pat", 0)).isNull();
        assertThat(moderation.lock("pat", 0)).isNull();
        moderation.setActive("pat", true);
        pat = accounts.getByName("pat");
        assertThat(pat.getChatLockedUntil()).isNull();
        assertThat(pat.getLockedUntil()).isNull();
        assertThat(pat.isActive()).isTrue();

        assertThatThrownBy(() -> moderation.lock("nobody", 5)).isInstanceOf(IllegalArgumentException.class);
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
