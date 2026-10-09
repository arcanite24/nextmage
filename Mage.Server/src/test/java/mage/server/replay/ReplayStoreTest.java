package mage.server.replay;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.server.websocket.rpc.JsonCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.zip.GZIPOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Web client replays: what the store lists, how it pages a recording out (each reader sees only their own hand), and
 * what it throws away.
 */
public class ReplayStoreTest {

    @TempDir
    Path dir;

    private ReplayStore store(int retentionDays, int maxCount) {
        return new ReplayStore(new ReplaySettings(true, dir, retentionDays, maxCount));
    }

    /** a finished recording of `frames` snapshots, each followed by a log line */
    private UUID record(ReplayStore store, long startedAt, int frames) throws IOException {
        UUID gameId = UUID.randomUUID();
        ReplayInfo info = new ReplayInfo();
        info.gameId = gameId.toString();
        info.startedAt = startedAt;
        info.endedAt = startedAt + 60_000;
        info.players.add(new ReplayInfo.ReplayPlayer("Ana", true));
        info.players.add(new ReplayInfo.ReplayPlayer("Bo", true));
        info.result = "Player Ana is the winner";
        try (Writer out = new OutputStreamWriter(new GZIPOutputStream(Files.newOutputStream(store.partFile(info.gameId))), StandardCharsets.UTF_8)) {
            for (int i = 0; i < frames; i++) {
                JsonObject frame = new JsonObject();
                JsonObject view = new JsonObject();
                view.addProperty("turn", i + 1);
                frame.add("view", view);
                JsonObject hands = new JsonObject();
                hands.add("Ana", hand("ana-card-" + i));
                hands.add("Bo", hand("bo-card-" + i));
                frame.add("hands", hands);
                frame.addProperty("t", i * 1000);
                out.write(frame.toString());
                out.write('\n');
                JsonObject log = new JsonObject();
                JsonObject message = new JsonObject();
                message.addProperty("message", "line " + i);
                log.add("log", message);
                log.addProperty("t", i * 1000 + 500);
                out.write(log.toString());
                out.write('\n');
            }
        }
        info.events = frames * 2;
        store.complete(info);
        return gameId;
    }

    private static JsonObject hand(String cardId) {
        JsonObject card = new JsonObject();
        card.addProperty("id", cardId);
        JsonObject hand = new JsonObject();
        hand.add(cardId, card);
        return hand;
    }

    @Test
    public void listsFinishedRecordingsNewestFirst() throws IOException {
        ReplayStore store = store(30, 100);
        long now = System.currentTimeMillis();
        UUID older = record(store, now - 10_000, 1);
        UUID newer = record(store, now, 1);
        // a recording still in progress is not listed
        Files.write(store.partFile(UUID.randomUUID().toString()), new byte[]{1});

        List<String> listed = store.list().stream().map(info -> info.gameId).collect(Collectors.toList());

        assertThat(listed).containsExactly(newer.toString(), older.toString());
        assertThat(store.info(older).result).isEqualTo("Player Ana is the winner");
        assertThat(store.info(UUID.randomUUID())).isNull();
    }

    @Test
    public void pagesEventsWithOnlyTheReadersOwnHand() throws IOException {
        ReplayStore store = store(30, 100);
        UUID gameId = record(store, System.currentTimeMillis(), 3);

        JsonObject first = store.page(gameId, 0, 4, "Ana");
        assertThat(first.get("total").getAsInt()).isEqualTo(6);
        assertThat(first.get("start").getAsInt()).isEqualTo(0);
        assertThat(first.getAsJsonObject("info").get("gameId").getAsString()).isEqualTo(gameId.toString());
        JsonArray events = first.getAsJsonArray("events");
        assertThat(events).hasSize(4);
        JsonObject frame = events.get(0).getAsJsonObject();
        assertThat(frame.has("hands")).isFalse();
        assertThat(frame.getAsJsonObject("myHand").has("ana-card-0")).isTrue();
        assertThat(frame.toString()).doesNotContain("bo-card");
        assertThat(events.get(1).getAsJsonObject().getAsJsonObject("log").get("message").getAsString()).isEqualTo("line 0");

        JsonObject rest = store.page(gameId, 4, 100, "Ana");
        assertThat(rest.getAsJsonArray("events")).hasSize(2);

        // a spectator (or someone who wasn't in the game) sees no hand at all
        JsonObject watcher = store.page(gameId, 0, 1, "Cy");
        assertThat(watcher.getAsJsonArray("events").get(0).getAsJsonObject().has("myHand")).isFalse();

        // past the end: an empty page, not an error
        assertThat(store.page(gameId, 99, 10, "Ana").getAsJsonArray("events")).isEmpty();
        assertThat(store.page(UUID.randomUUID(), 0, 10, "Ana")).isNull();
    }

    @Test
    public void pagesAreCapped() throws IOException {
        ReplayStore store = store(30, 100);
        UUID gameId = record(store, System.currentTimeMillis(), ReplayStore.MAX_PAGE);

        assertThat(store.page(gameId, 0, 10_000, null).getAsJsonArray("events")).hasSize(ReplayStore.MAX_PAGE);
    }

    @Test
    public void prunesOldReplaysAndKeepsTheNewestWithinTheCount() throws IOException {
        ReplayStore store = store(30, 2);
        long now = System.currentTimeMillis();
        UUID expired = record(store, now - TimeUnit.DAYS.toMillis(31), 1);
        UUID first = record(store, now - 3000, 1);
        UUID second = record(store, now - 2000, 1);
        UUID third = record(store, now - 1000, 1);

        List<String> listed = store.list().stream().map(info -> info.gameId).collect(Collectors.toList());
        assertThat(listed).containsExactly(third.toString(), second.toString());
        assertThat(Files.exists(store.eventsFile(expired.toString()))).isFalse();
        assertThat(Files.exists(store.infoFile(first.toString()))).isFalse();
    }

    @Test
    public void dropsRecordingsACrashLeftUnfinished() throws IOException {
        ReplayStore store = store(30, 100);
        Path stale = store.partFile(UUID.randomUUID().toString());
        Path fresh = store.partFile(UUID.randomUUID().toString());
        Files.write(stale, new byte[]{1});
        Files.write(fresh, new byte[]{1});
        Files.setLastModifiedTime(stale, FileTime.fromMillis(System.currentTimeMillis() - TimeUnit.DAYS.toMillis(2)));

        store.prune();

        assertThat(Files.exists(stale)).isFalse();
        assertThat(Files.exists(fresh)).isTrue();
    }

    @Test
    public void infoRoundTripsThroughTheWireCodec() {
        ReplayInfo info = new ReplayInfo();
        info.gameId = UUID.randomUUID().toString();
        info.players.add(new ReplayInfo.ReplayPlayer("Ana", true));

        ReplayInfo copy = JsonCodec.GSON.fromJson(JsonCodec.GSON.toJson(info), ReplayInfo.class);

        assertThat(copy.gameId).isEqualTo(info.gameId);
        assertThat(copy.players).extracting(player -> player.name).containsExactly("Ana");
    }
}
