package mage.server.admin;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The contributors server's rules: first boot from the environment, the allowlist by name or email, invites and
 * access requests.
 */
public class AccessPolicyTest {

    @TempDir
    Path dir;

    private AdminStore store;

    @BeforeEach
    void setUp() throws Exception {
        store = new AdminStore("jdbc:sqlite:" + dir.resolve("admin.db"));
    }

    @Test
    void firstBootComesUpClosedWithTheSeedList() throws Exception {
        Path seed = dir.resolve("allow.txt");
        Files.write(seed, "alice # maintainer\nbob@example.test\n\n".getBytes(StandardCharsets.UTF_8));

        AccessPolicy policy = AccessPolicy.create(store, "Owner", "allowlist", "@" + seed, 1000);

        assertThat(policy.isAllowlist()).isTrue();
        assertThat(policy.allows("Alice", null)).as("names match in any case").isTrue();
        assertThat(policy.allows("bobby", "BOB@example.test")).as("or by email").isTrue();
        assertThat(policy.allows("owner", null)).as("the owner is always in").isTrue();
        assertThat(policy.allows("mallory", "m@example.test")).isFalse();
        assertThat(policy.refusal(true, "mallory", null)).isEqualTo(AccessPolicy.REFUSED);
        assertThat(policy.refusal(false, "mallory", null)).as("no accounts, nothing to close").isNull();
        assertThat(store.auditLog(null, "access", null, 0, 10)).extracting(e -> e.actor).containsOnly(AccessPolicy.BOOT);
    }

    @Test
    void laterBootsKeepWhatAdminChose() throws Exception {
        AccessPolicy first = AccessPolicy.create(store, "", "allowlist", "", 1000);
        first.setMode(AccessPolicy.OPEN, "console", "launch day", 2000);

        AccessPolicy again = AccessPolicy.create(store, "", "allowlist", "carol", 3000);

        assertThat(again.mode()).isEqualTo(AccessPolicy.OPEN);
        assertThat(store.isListed("carol", null)).as("the seed list is read on the first boot only").isFalse();
        assertThat(store.auditLog("console", null, null, 0, 10).get(0).reason).isEqualTo("launch day");
    }

    @Test
    void unknownModeStartsClosed() {
        assertThat(AccessPolicy.parseMode("contributors")).isEqualTo(AccessPolicy.ALLOWLIST);
        assertThat(AccessPolicy.parseMode("opne")).isEqualTo(AccessPolicy.ALLOWLIST);
        assertThat(AccessPolicy.parseMode("")).isEqualTo(AccessPolicy.OPEN);
    }

    @Test
    void openServerLetsEveryoneIn() {
        AccessPolicy policy = AccessPolicy.create(store, "", "", "", 1000);

        assertThat(policy.allows("anyone", null)).isTrue();
    }

    @Test
    void allowlistEntriesAreUniqueAndRemovable() throws Exception {
        AllowEntry alice = store.allow(" Alice ", "github: alice", "console", 1000);
        assertThat(store.allow("alice", "again", "console", 2000).id).isEqualTo(alice.id);
        store.allow("alice@example.test", null, "console", 3000);

        assertThat(store.listedCount("alice", "alice@example.test")).isEqualTo(2);
        store.disallow(alice.id);
        assertThat(store.isListed("alice", null)).isFalse();
        assertThat(store.isListed("alice", "Alice@Example.test")).isTrue();
        assertThatThrownBy(() -> store.allow("  ", null, "console", 1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void invitesCountTheirUsesAndExpire() throws Exception {
        Invite invite = store.createInvite("for the jam", 2, 7, "console", 1000);

        assertThat(invite.code).hasSizeGreaterThanOrEqualTo(16);
        assertThat(store.redeemInvite(invite.code, "carol", 2000)).isTrue();
        assertThat(store.redeemInvite(invite.code, "dave", 3000)).isTrue();
        assertThat(store.redeemInvite(invite.code, "erin", 4000)).as("used up").isFalse();
        assertThat(store.invite(invite.code).usedBy).isEqualTo("carol, dave");

        Invite late = store.createInvite(null, 5, 1, "console", 1000);
        assertThat(store.redeemInvite(late.code, "frank", 1000 + 86_400_000L)).as("expired").isFalse();

        Invite revoked = store.createInvite(null, 5, 7, "console", 1000);
        assertThat(store.revokeInvite(revoked.code)).isTrue();
        assertThat(store.revokeInvite(revoked.code)).isFalse();
        assertThat(store.redeemInvite(revoked.code, "gina", 2000)).isFalse();
        assertThat(store.redeemInvite("no-such-code", "gina", 2000)).isFalse();
    }

    @Test
    void accessRequestsWaitOnePerAddress() throws Exception {
        AccessRequest first = store.requestAccess("hana", "Hana@example.test", "I fixed the mulligan bug", 1000);
        AccessRequest again = store.requestAccess("hana2", "hana@example.test", "", 2000);

        assertThat(again.id).isEqualTo(first.id);
        assertThatThrownBy(() -> store.requestAccess("x", "not an address", "", 1)).isInstanceOf(IllegalArgumentException.class);

        AccessRequest decided = store.decide(first.id, true, "console", 3000);
        assertThat(decided.status).isEqualTo(AccessRequest.APPROVED);
        assertThat(store.decide(first.id, false, "console", 4000)).as("decided once").isNull();
        List<AccessRequest> all = store.accessRequests(10);
        assertThat(all).hasSize(1);
    }

    @Test
    void auditLogFiltersAndPages() throws Exception {
        for (int i = 0; i < 5; i++) {
            store.audit("console", "user.lock", "p" + i, null, "spam", 1000 + i);
        }
        store.audit("ana", "access.mode", "allowlist", null, "closing", 2000);

        List<AuditEntry> page = store.auditLog(null, null, null, 0, 3);
        assertThat(page).extracting(e -> e.target).containsExactly("allowlist", "p4", "p3");
        assertThat(store.auditLog(null, null, null, page.get(2).id, 10)).extracting(e -> e.target).containsExactly("p2", "p1", "p0");
        assertThat(store.auditLog(null, "user", null, 0, 10)).hasSize(5);
        assertThat(store.auditLog("ana", null, null, 0, 10)).hasSize(1);
        assertThat(store.auditLog(null, null, "p1", 0, 10)).hasSize(1);
    }
}
