package mage.server.decks;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

public class DeckStoreTest {

    @TempDir
    Path dir;

    private DeckStore store;

    @BeforeEach
    void setUp() throws Exception {
        store = new DeckStore("jdbc:sqlite:" + dir.resolve("decks.db"));
    }

    @Test
    void storesDecksPerAccountIgnoringCase() throws Exception {
        assertThat(store.put("Ana", "d1", "Burn", 100, "{\"name\":\"Burn\"}").stored).isTrue();
        store.put("bob", "d1", "Bob's", 100, "{}");

        List<DeckSyncEntry> mine = store.list("ana", 200);
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).name).isEqualTo("Burn");
        assertThat(mine.get(0).data).as("the list leaves data out").isNull();
        assertThat(store.get("ANA", "d1").data).isEqualTo("{\"name\":\"Burn\"}");
        assertThat(store.get("bob", "d1").name).isEqualTo("Bob's");
    }

    @Test
    void theNewerChangeWins() throws Exception {
        store.put("ana", "d1", "Second", 200, "{\"v\":2}");
        DeckStore.DeckPutResult older = store.put("ana", "d1", "First", 100, "{\"v\":1}");
        assertThat(older.stored).isFalse();
        assertThat(older.updatedAt).isEqualTo(200);
        assertThat(store.get("ana", "d1").data).isEqualTo("{\"v\":2}");
    }

    @Test
    void deletionsLeaveTombstonesUntilTheyAreOld() throws Exception {
        store.put("ana", "d1", "Burn", 100, "{}");
        assertThat(store.delete("ana", "d1", 150).stored).isTrue();
        assertThat(store.get("ana", "d1")).isNull();
        List<DeckSyncEntry> list = store.list("ana", 200);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).deleted).isTrue();
        assertThat(list.get(0).updatedAt).isEqualTo(150);

        assertThat(store.list("ana", 150 + DeckStore.TOMBSTONE_MILLIS + 1)).isEmpty();
    }

    @Test
    void anOlderDeletionDoesNotRemoveANewerDeck() throws Exception {
        store.put("ana", "d1", "Burn", 300, "{}");
        assertThat(store.delete("ana", "d1", 200).stored).isFalse();
        assertThat(store.get("ana", "d1")).isNotNull();
    }

    @Test
    void aDeletedDeckCanComeBack() throws Exception {
        store.put("ana", "d1", "Burn", 100, "{}");
        store.delete("ana", "d1", 200);
        assertThat(store.put("ana", "d1", "Burn again", 300, "{\"back\":true}").stored).isTrue();
        assertThat(store.get("ana", "d1").name).isEqualTo("Burn again");
    }

    @Test
    void refusesBadIdsAndHugeDecks() {
        assertThatThrownBy(() -> store.put("ana", "../etc", "x", 1, "{}")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> store.put("ana", "d1", "x", 1, "")).isInstanceOf(IllegalArgumentException.class);
        StringBuilder huge = new StringBuilder();
        while (huge.length() <= DeckStore.MAX_DECK_CHARS) {
            huge.append("0123456789");
        }
        assertThatThrownBy(() -> store.put("ana", "d1", "x", 1, huge.toString()))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("too large");
    }
}
