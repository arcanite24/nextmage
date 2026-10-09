package mage.server.websocket;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Web client bridge: state patches rebuild the new tree exactly, key order included.
 */
public class StateDiffTest {

    /**
     * Real game views from a live game, with the patches between them: the web client's tests apply the same patches.
     * Rewrite the patches after a format change with -Dxmage.updateStatePatchFixture=true.
     */
    private static final Path FIXTURE = Paths.get("..", "Mage.Web.Client", "src", "core", "rpc", "__fixtures__", "gameStatePatches.json");

    private static JsonElement json(String text) {
        return JsonParser.parseString(text);
    }

    /** Patches the old tree and compares as text, so key order counts. */
    private static JsonElement roundTrip(String from, String to) {
        return roundTrip(json(from), json(to));
    }

    private static JsonElement roundTrip(JsonElement from, JsonElement to) {
        JsonElement patch = StateDiff.diff(from, to);
        // patches travel as text: parse them again, like a client would
        JsonElement received = patch == null ? null : json(patch.toString());
        assertThat(StateDiff.apply(from, received).toString()).as("patch %s", patch).isEqualTo(to.toString());
        return patch;
    }

    @Test
    void equalTreesNeedNoPatch() {
        assertThat(roundTrip("{\"a\":1,\"b\":[1,2,{\"c\":null}]}", "{\"a\":1,\"b\":[1,2,{\"c\":null}]}")).isNull();
        assertThat(roundTrip("1.5", "1.5")).isNull();
    }

    @Test
    void changedValuesAreSet() {
        assertThat(roundTrip("{\"a\":1,\"b\":\"x\"}", "{\"a\":2,\"b\":\"x\"}").toString()).isEqualTo("{\"a\":[2]}");
        roundTrip("{\"a\":1}", "{\"a\":\"1\"}");
        roundTrip("{\"a\":true}", "{\"a\":false}");
        roundTrip("{\"a\":{\"b\":1}}", "{\"a\":[1,2]}");
        roundTrip("{\"a\":[1]}", "{\"a\":{\"0\":1}}");
        roundTrip("[1,2]", "{\"a\":1}");
    }

    @Test
    void nullIsAValueNotARemoval() {
        assertThat(roundTrip("{\"a\":1,\"b\":2}", "{\"a\":null,\"b\":2}").toString()).isEqualTo("{\"a\":[null]}");
        assertThat(roundTrip("{\"a\":null,\"b\":2}", "{\"b\":2}").toString()).isEqualTo("{\"a\":[]}");
        roundTrip("{\"a\":null}", "{\"a\":{\"b\":null}}");
        roundTrip("{}", "{\"a\":null}");
        roundTrip("[null,1]", "[1,null]");
    }

    @Test
    void mapKeysAreAddedAndRemoved() {
        String hand = "{\"" + UUID.randomUUID() + "\":{\"name\":\"Forest\"},\"" + UUID.randomUUID() + "\":{\"name\":\"Shock\"}}";
        JsonObject from = json(hand).getAsJsonObject();
        JsonObject to = from.deepCopy();
        String first = from.keySet().iterator().next();
        to.remove(first);
        JsonObject drawn = new JsonObject();
        drawn.addProperty("name", "Mountain");
        to.add(UUID.randomUUID().toString(), drawn);
        JsonElement patch = roundTrip(from, to);
        assertThat(patch.getAsJsonObject().get(first).toString()).isEqualTo("[]");
    }

    @Test
    void nestedChangesOnlyCarryTheChange() {
        JsonElement patch = roundTrip(
                "{\"players\":[{\"life\":20,\"battlefield\":{\"p1\":{\"tapped\":false,\"power\":\"2\"}}},{\"life\":20}],\"turn\":3}",
                "{\"players\":[{\"life\":20,\"battlefield\":{\"p1\":{\"tapped\":true,\"power\":\"2\"}}},{\"life\":17}],\"turn\":3}");
        assertThat(patch.toString()).isEqualTo("{\"players\":[2,{\"0\":{\"battlefield\":{\"p1\":{\"tapped\":[true]}}},\"1\":{\"life\":[17]}}]}");
    }

    @Test
    void arraysGrowShrinkOrAreReplaced() {
        roundTrip("[1,2,3,4,5]", "[1,2,3,4,5,6,7]");
        roundTrip("[1,2,3,4,5]", "[1,2,3]");
        roundTrip("[1,2,3,4,5]", "[1,9,3]");
        roundTrip("[]", "[1]");
        roundTrip("[1]", "[]");
        assertThat(roundTrip("[1,2,3]", "[4,5,6]").toString()).isEqualTo("[[4,5,6]]");
        roundTrip("{\"a\":[[1,2],[3,4]]}", "{\"a\":[[1,2],[3,5],[6]]}");
    }

    @Test
    void keyOrderIsKept() {
        // removing or appending keeps the order: a plain object patch
        assertThat(roundTrip("{\"a\":1,\"b\":2,\"c\":3}", "{\"a\":1,\"c\":3,\"d\":4}").toString()).startsWith("{");
        // moved keys, or new keys in the middle (a null field that is back): the patch lists the order
        assertThat(roundTrip("{\"a\":1,\"b\":2,\"c\":3}", "{\"b\":2,\"a\":1,\"c\":3}").toString())
                .isEqualTo("[\"o\",{\"b\":0,\"a\":0,\"c\":0}]");
        assertThat(roundTrip("{\"a\":1,\"c\":{\"x\":1}}", "{\"a\":1,\"b\":2,\"c\":{\"x\":2}}").toString())
                .isEqualTo("[\"o\",{\"a\":0,\"b\":[2],\"c\":{\"x\":[2]}}]");
    }

    @Test
    void patchesThatDoNotFitAreRejected() {
        assertThatThrownBy(() -> StateDiff.apply(json("[1]"), json("{\"a\":[1]}"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> StateDiff.apply(json("{}"), json("{\"a\":[]}"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> StateDiff.apply(json("[1]"), json("[3,{\"1\":[2]}]"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> StateDiff.apply(json("{}"), json("[\"o\",{\"a\":0}]"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> StateDiff.apply(json("[]"), json("[\"o\",{}]"))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void realGameViewsMatchTheSharedFixture() throws Exception {
        JsonObject fixture = json(new String(Files.readAllBytes(FIXTURE), StandardCharsets.UTF_8)).getAsJsonObject();
        JsonArray views = fixture.getAsJsonArray("views");
        JsonArray patches = new JsonArray();
        for (int i = 1; i < views.size(); i++) {
            JsonElement patch = roundTrip(views.get(i - 1), views.get(i));
            assertThat(patch.toString().length()).isLessThan(views.get(i).toString().length() / 2);
            patches.add(patch);
        }
        if (Boolean.getBoolean("xmage.updateStatePatchFixture")) {
            fixture.add("patches", patches);
            Files.write(FIXTURE, fixture.toString().getBytes(StandardCharsets.UTF_8));
        }
        assertThat(fixture.get("patches")).as("patches in %s (rewrite with -Dxmage.updateStatePatchFixture=true)", FIXTURE)
                .isEqualTo(patches);
    }

    @Test
    void randomTreesRoundTrip() {
        Random random = new Random(7);
        for (int i = 0; i < 2000; i++) {
            JsonElement from = randomValue(random, 0);
            JsonElement to = mutate(random, from, 0);
            roundTrip(from, to);
        }
    }

    private static JsonElement randomValue(Random random, int depth) {
        int kind = random.nextInt(depth > 3 ? 4 : 7);
        switch (kind) {
            case 0:
                return JsonNull.INSTANCE;
            case 1:
                return new JsonPrimitive(random.nextInt(5));
            case 2:
                return new JsonPrimitive(random.nextBoolean());
            case 3:
                return new JsonPrimitive(random.nextInt(3) == 0 ? "" : "s" + random.nextInt(4));
            case 4:
            case 5: {
                JsonObject object = new JsonObject();
                int size = random.nextInt(6);
                for (int i = 0; i < size; i++) {
                    object.add("k" + random.nextInt(8), randomValue(random, depth + 1));
                }
                return object;
            }
            default: {
                JsonArray array = new JsonArray();
                int size = random.nextInt(6);
                for (int i = 0; i < size; i++) {
                    array.add(randomValue(random, depth + 1));
                }
                return array;
            }
        }
    }

    private static JsonElement mutate(Random random, JsonElement value, int depth) {
        if (random.nextInt(6) == 0) {
            return randomValue(random, depth); // replaced
        }
        if (value.isJsonObject()) {
            List<Map.Entry<String, JsonElement>> entries = new ArrayList<>(value.getAsJsonObject().entrySet());
            if (random.nextInt(8) == 0 && entries.size() > 1) {
                java.util.Collections.swap(entries, 0, entries.size() - 1);
            }
            JsonObject result = new JsonObject();
            for (Map.Entry<String, JsonElement> entry : entries) {
                int change = random.nextInt(4);
                if (change == 0) {
                    continue; // removed
                }
                result.add(entry.getKey(), change == 1 ? mutate(random, entry.getValue(), depth + 1) : entry.getValue().deepCopy());
            }
            if (random.nextBoolean()) {
                result.add("n" + random.nextInt(4), randomValue(random, depth + 1));
            }
            if (random.nextInt(6) == 0) {
                // a key comes back in front (like a field that is no longer null)
                JsonObject front = new JsonObject();
                front.add("f" + random.nextInt(3), randomValue(random, depth + 1));
                result.entrySet().forEach(entry -> front.add(entry.getKey(), entry.getValue()));
                return front;
            }
            return result;
        }
        if (value.isJsonArray()) {
            JsonArray result = new JsonArray();
            for (JsonElement element : value.getAsJsonArray()) {
                int change = random.nextInt(5);
                if (change == 0) {
                    continue;
                }
                result.add(change == 1 ? mutate(random, element, depth + 1) : element.deepCopy());
            }
            if (random.nextBoolean()) {
                result.add(randomValue(random, depth + 1));
            }
            return result;
        }
        return random.nextBoolean() ? value : randomValue(random, depth);
    }
}
