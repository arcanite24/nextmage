package mage.server.moderation;

import mage.server.admin.AdminStore;
import mage.server.admin.ClientErrorGroup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

public class ClientErrorsTest {

    @TempDir
    Path dir;
    private AdminStore store;
    private ClientErrors errors;

    @BeforeEach
    void open() throws Exception {
        store = new AdminStore("jdbc:sqlite:" + dir.resolve("admin.db"));
        errors = new ClientErrors(() -> store);
    }

    private static ClientErrors.ClientError error(String message) {
        ClientErrors.ClientError error = new ClientErrors.ClientError();
        error.message = message;
        error.path = "/game/1";
        error.source = "window";
        error.stack = "TypeError: " + message + "\n    at render (https://play.example/assets/main-AbCd1234.js:1:2345)";
        return error;
    }

    @Test
    void groupsTheSameProblemAndCountsIt() throws Exception {
        errors.report("1.2.3.4", "ana", error("Cannot read card 12"), 1_000);
        errors.report("1.2.3.5", "bo", error("Cannot read card 7"), 2_000);
        errors.report("1.2.3.4", "ana", error("Something else"), 3_000);

        List<ClientErrorGroup> groups = store.clientErrors(false, 10);
        assertThat(groups).extracting(g -> g.message).containsExactly("Something else", "Cannot read card 7");
        ClientErrorGroup cards = groups.get(1);
        assertThat(cards.count).isEqualTo(2);
        assertThat(cards.firstSeen).isEqualTo(1_000);
        assertThat(cards.lastSeen).isEqualTo(2_000);
        assertThat(cards.lastUser).isEqualTo("bo");
    }

    @Test
    void aResolvedProblemOpensAgainWhenItComesBack() throws Exception {
        errors.report("1.2.3.4", "ana", error("boom"), 1_000);
        long id = store.clientErrors(false, 10).get(0).id;
        store.resolveClientError(id, true, "mod", 1_500);
        assertThat(store.clientErrors(false, 10)).isEmpty();

        errors.report("1.2.3.4", "ana", error("boom"), 2_000);
        ClientErrorGroup group = store.clientErrors(false, 10).get(0);
        assertThat(group.resolved).isFalse();
        assertThat(group.regressed).isTrue();
        assertThat(group.count).isEqualTo(2);
    }

    @Test
    void eachReporterHasABudgetPerMinute() {
        for (int i = 0; i < ClientErrors.PER_MINUTE; i++) {
            assertThat(errors.report("1.2.3.4", "ana", error("e" + i), 60_000 + i)).isTrue();
        }
        assertThat(errors.report("1.2.3.4", "ana", error("over"), 60_500)).isFalse();
        assertThat(errors.report("5.6.7.8", "bo", error("someone else"), 60_500)).isTrue();
        assertThat(errors.report("1.2.3.4", "ana", error("next minute"), 120_000)).isTrue();
    }

    @Test
    void visitorsShareABudget() {
        int kept = 0;
        for (int i = 0; i < ClientErrors.VISITORS_PER_MINUTE + 10; i++) {
            if (errors.report("10.0.0." + i, null, error("e"), 60_000 + i)) {
                kept++;
            }
        }
        assertThat(kept).isEqualTo(ClientErrors.VISITORS_PER_MINUTE);
        assertThat(errors.report("10.0.0.1", "ana", error("signed in"), 60_900)).isTrue();
    }

    @Test
    void clipsLongFields() throws Exception {
        errors.report("1.2.3.4", null, error(new String(new char[2000]).replace('\0', 'x')), 1);
        assertThat(store.clientErrors(false, 1).get(0).message).hasSize(500);
    }
}
