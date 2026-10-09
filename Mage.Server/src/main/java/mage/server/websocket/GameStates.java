package mage.server.websocket;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.interfaces.callback.ClientCallbackMethod;
import mage.server.websocket.rpc.JsonCodec;

import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Web client bridge: the last game state a connection received for each game, so the next one can go out as a patch
 * (for clients that asked for {@value #CAPABILITY}, see docs/WebSocketAPI.md "State patches").
 * <p>
 * A message whose data is or holds a game view gets a {@code state} field. With {@code {"seq": 8}} the view is
 * complete; with {@code {"seq": 9, "base": 8, "patch": ...}} the view is left out of the data and the client
 * rebuilds it by applying the {@link StateDiff} patch to the view of {@code base}. Patches are only sent when they are
 * smaller than the full message.
 * <p>
 * One per connection, shared by the callback handlers of its logins. Not thread safe: callers hold its lock while they
 * encode and send, so the client receives states in the order they were encoded.
 */
final class GameStates {

    static final String CAPABILITY = "stateDiffs";

    /** games remembered per connection; an older game's next state goes out complete */
    static final int MAX_GAMES = 8;

    private static final Set<ClientCallbackMethod> VIEW_IS_DATA = EnumSet.of(
            ClientCallbackMethod.GAME_INIT, ClientCallbackMethod.GAME_UPDATE,
            ClientCallbackMethod.REPLAY_INIT, ClientCallbackMethod.REPLAY_UPDATE);
    private static final Set<ClientCallbackMethod> REPLAYS = EnumSet.of(
            ClientCallbackMethod.REPLAY_INIT, ClientCallbackMethod.REPLAY_UPDATE);
    /** the game is over: the client gets everything and both sides forget it */
    private static final Set<ClientCallbackMethod> LAST = EnumSet.of(
            ClientCallbackMethod.GAME_OVER, ClientCallbackMethod.REPLAY_DONE);

    private static final class Baseline {
        final long seq;
        final String view; // as text: a parsed tree takes several times the memory
        final boolean replay;

        Baseline(long seq, String view, boolean replay) {
            this.seq = seq;
            this.view = view;
            this.replay = replay;
        }
    }

    /** One message, ready to send. */
    static final class Encoded {
        final String json;
        /** size of the complete message, what a client without patches would have received */
        final int fullChars;
        final boolean patch;

        Encoded(String json, int fullChars, boolean patch) {
            this.json = json;
            this.fullChars = fullChars;
            this.patch = patch;
        }
    }

    private final Map<UUID, Baseline> games = new LinkedHashMap<UUID, Baseline>(MAX_GAMES * 2, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<UUID, Baseline> eldest) {
            return size() > MAX_GAMES;
        }
    };
    private long nextSeq = 1;
    private volatile boolean enabled;
    /** the newest message id sent on this connection's session */
    private int lastMessageId = -1;

    boolean isEnabled() {
        return enabled;
    }

    /** Turned on by the client; turning it off forgets every game. */
    void setEnabled(boolean enabled) {
        this.enabled = enabled;
        if (!enabled) {
            games.clear();
        }
    }

    void sent(int messageId) {
        lastMessageId = Math.max(lastMessageId, messageId);
    }

    /** A new login on the connection: message ids start again. */
    void newSession() {
        games.clear();
        lastMessageId = -1;
    }

    /**
     * @param message a server event as built by {@link WebSocketCallbackHandler#serializeTree}; changed in place
     * @return null when the message holds no game view (send it as it is)
     */
    Encoded encode(ClientCallbackMethod method, UUID gameId, JsonObject message) {
        if (gameId == null) {
            return null;
        }
        if (LAST.contains(method)) {
            games.remove(gameId);
            return null;
        }
        JsonElement data = message.get("data");
        if (data == null || !data.isJsonObject()) {
            return null;
        }
        JsonObject view;
        if (VIEW_IS_DATA.contains(method)) {
            view = data.getAsJsonObject();
        } else {
            JsonElement inner = data.getAsJsonObject().get("gameView");
            if (inner == null || !inner.isJsonObject()) {
                return null;
            }
            view = inner.getAsJsonObject();
        }

        long seq = nextSeq++;
        JsonObject state = new JsonObject();
        state.addProperty("seq", seq);
        message.add("state", state);
        String full = JsonCodec.GSON.toJson(message);
        Baseline previous = games.put(gameId, new Baseline(seq, JsonCodec.GSON.toJson(view), REPLAYS.contains(method)));
        if (previous == null) {
            return new Encoded(full, full.length(), false);
        }

        JsonElement patch = StateDiff.diff(JsonParser.parseString(previous.view), view);
        if (patch != null && patch.isJsonArray() && patch.getAsJsonArray().size() == 1) {
            return new Encoded(full, full.length(), false); // replaced as a whole: nothing to patch
        }
        if (view == data) {
            message.remove("data");
        } else {
            data.getAsJsonObject().remove("gameView");
        }
        state.addProperty("base", previous.seq);
        state.add("patch", patch == null ? new JsonObject() : patch);
        String patched = JsonCodec.GSON.toJson(message);
        return patched.length() < full.length()
                ? new Encoded(patched, full.length(), true)
                : new Encoded(full, full.length(), false);
    }

    /**
     * The client lost track of a game: its last state, complete, as an update event (the next patch builds on it).
     *
     * Its message id is the newest one sent, so the client does not take the update for an outdated one.
     *
     * @return null when nothing is remembered for the game (its next state goes out complete anyway)
     */
    String resync(UUID gameId) {
        Baseline baseline = gameId == null ? null : games.get(gameId);
        if (baseline == null) {
            return null;
        }
        long seq = nextSeq++;
        games.put(gameId, new Baseline(seq, baseline.view, baseline.replay));
        JsonObject state = new JsonObject();
        state.addProperty("seq", seq);
        JsonObject message = new JsonObject();
        message.addProperty("method", (baseline.replay ? ClientCallbackMethod.REPLAY_UPDATE : ClientCallbackMethod.GAME_UPDATE).name());
        message.addProperty("objectId", gameId.toString());
        message.addProperty("messageId", Math.max(0, lastMessageId));
        message.add("data", JsonParser.parseString(baseline.view));
        message.add("state", state);
        return JsonCodec.GSON.toJson(message);
    }

    void forget(UUID gameId) {
        if (gameId != null) {
            games.remove(gameId);
        }
    }

    void clear() {
        games.clear();
    }

    int size() {
        return games.size();
    }
}
