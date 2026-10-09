package mage.server.moderation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

public class ReportStoreTest {

    @TempDir
    Path dir;

    private ReportStore store;

    @BeforeEach
    void setUp() throws Exception {
        store = new ReportStore("jdbc:sqlite:" + dir.resolve("reports.db"));
    }

    @Test
    void filesAndClosesReports() throws Exception {
        PlayerReport report = store.file("ana", "Bob", "Abuse", "  called me names  ", "game-1", 100);
        assertThat(report.id).isPositive();
        assertThat(report.reason).isEqualTo("abuse");
        assertThat(report.details).isEqualTo("called me names");

        List<PlayerReport> open = store.list(true, 50);
        assertThat(open).extracting(r -> r.reported).containsExactly("Bob");

        assertThat(store.close(report.id, "muted for a day", 200)).isTrue();
        assertThat(store.close(report.id, "again", 300)).as("closing twice").isFalse();
        assertThat(store.list(true, 50)).isEmpty();
        PlayerReport closed = store.list(false, 50).get(0);
        assertThat(closed.open).isFalse();
        assertThat(closed.resolution).isEqualTo("muted for a day");
    }

    @Test
    void newestFirst() throws Exception {
        store.file("ana", "bob", "spam", "", null, 100);
        store.file("cleo", "bob", "spam", "", null, 300);
        store.file("dan", "bob", "spam", "", null, 200);
        assertThat(store.list(true, 50)).extracting(r -> r.reporter).containsExactly("cleo", "dan", "ana");
    }

    @Test
    void refusesSelfReportsUnknownReasonsAndFloods() throws Exception {
        assertThatThrownBy(() -> store.file("ana", "ANA", "spam", "", null, 1)).hasMessageContaining("yourself");
        assertThatThrownBy(() -> store.file("ana", "bob", "ugly deck", "", null, 1)).hasMessageContaining("reason");
        for (int i = 0; i < ReportStore.MAX_OPEN_PER_REPORTER; i++) {
            store.file("ana", "bob" + i, "spam", "", null, i);
        }
        assertThatThrownBy(() -> store.file("ana", "eve", "spam", "", null, 99)).hasMessageContaining("waiting");
    }
}
