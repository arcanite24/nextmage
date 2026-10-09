package mage.server.websocket;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.interfaces.callback.ClientCallback;
import mage.interfaces.callback.ClientCallbackMethod;
import mage.server.websocket.rpc.JsonCodec;
import org.java_websocket.WebSocket;
import org.jboss.remoting.callback.AsynchInvokerCallbackHandler;
import org.jboss.remoting.callback.Callback;
import org.jboss.remoting.callback.HandleCallbackException;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Web client bridge: pushes server callbacks (game updates, prompts, chat...) to a WebSocket as JSON.
 * <p>
 * Message shape: {@code {"method": "GAME_UPDATE", "objectId": "...", "messageId": 12, "data": {...}}}, plus a
 * {@code state} field for clients that take state patches (see {@link GameStates}).
 */
public class WebSocketCallbackHandler implements AsynchInvokerCallbackHandler {

    private static final Set<ClientCallbackMethod> PROMPTS = EnumSet.of(
            ClientCallbackMethod.GAME_TARGET, ClientCallbackMethod.GAME_CHOOSE_ABILITY, ClientCallbackMethod.GAME_CHOOSE_PILE,
            ClientCallbackMethod.GAME_CHOOSE_CHOICE, ClientCallbackMethod.GAME_ASK, ClientCallbackMethod.GAME_SELECT,
            ClientCallbackMethod.GAME_PLAY_MANA, ClientCallbackMethod.GAME_PLAY_XMANA, ClientCallbackMethod.GAME_GET_AMOUNT,
            ClientCallbackMethod.GAME_GET_MULTI_AMOUNT);

    private final WebSocket conn;
    /**
     * The last question of each game this connection has not answered yet, as sent (complete, without a state
     * patch), for {@code gameResync}.
     */
    private final Map<UUID, String> pendingPrompts = new ConcurrentHashMap<>();
    /** the connection's game states, for clients that take patches; its lock orders encoding and sending */
    private final GameStates states;

    public WebSocketCallbackHandler(WebSocket conn) {
        this(conn, new GameStates());
    }

    WebSocketCallbackHandler(WebSocket conn, GameStates states) {
        this.conn = conn;
        this.states = states;
    }

    /**
     * The player answered (or passed): the question is no longer open.
     */
    void promptAnswered(UUID gameId) {
        if (gameId != null) {
            pendingPrompts.remove(gameId);
        }
    }

    /**
     * Sends the game's open question again (a reply or the question itself was lost on the way).
     *
     * @return false when nothing is waiting for an answer from this player
     */
    boolean resendPrompt(UUID gameId) {
        String json = gameId == null ? null : pendingPrompts.get(gameId);
        if (json == null || !conn.isOpen()) {
            return false;
        }
        synchronized (states) {
            if (!states.isEnabled()) {
                WebSocketServerImpl.sendText(conn, json);
                return true;
            }
            // the question's view becomes the client's latest state again
            JsonObject message = JsonParser.parseString(json).getAsJsonObject();
            ClientCallbackMethod method = ClientCallbackMethod.valueOf(message.get("method").getAsString());
            GameStates.Encoded encoded = states.encode(method, gameId, message);
            sendState(encoded == null ? json : encoded.json, encoded);
        }
        return true;
    }

    /**
     * The client could not apply a state patch: sends the game's last state complete, then its open question.
     *
     * @return false when nothing is remembered for the game (its next state goes out complete anyway)
     */
    boolean resendState(UUID gameId) {
        synchronized (states) {
            String json = states.resync(gameId);
            if (json == null || !conn.isOpen()) {
                return false;
            }
            BridgeMetrics.get().stateResync();
            WebSocketServerImpl.sendText(conn, json);
            resendPrompt(gameId);
            return true;
        }
    }

    @Override
    public void handleCallbackOneway(Callback callback, boolean asynch) throws HandleCallbackException {
        if (!(callback.getCallbackObject() instanceof ClientCallback)) {
            return;
        }
        if (!conn.isOpen()) {
            // lets the session mark itself invalid and disconnect, instead of silently dropping data
            throw new HandleCallbackException("WebSocket connection is closed");
        }
        ClientCallback clientCallback = (ClientCallback) callback.getCallbackObject();
        clientCallback.decompressData(); // no-op unless the callback was compressed for a desktop client
        try {
            if (states.isEnabled()) {
                sendWithState(clientCallback);
                return;
            }
            String json = serialize(clientCallback);
            BridgeMetrics.get().callback(clientCallback.getMethod().name(), json.length(), clientCallback.getObjectId());
            remember(clientCallback, json);
            WebSocketServerImpl.sendText(conn, json);
        } catch (Exception e) {
            throw new HandleCallbackException("Error sending WebSocket message", e);
        }
    }

    /**
     * For clients that take state patches: game views go out as patches against the last state sent, when smaller.
     */
    private void sendWithState(ClientCallback clientCallback) {
        ClientCallbackMethod method = clientCallback.getMethod();
        JsonObject message = serializeTree(clientCallback);
        // a question is kept complete: when it is sent again, the client may have moved past this state
        String prompt = PROMPTS.contains(method) && clientCallback.getObjectId() != null ? JsonCodec.GSON.toJson(message) : null;
        synchronized (states) {
            // (null when the client turned patches off meanwhile)
            GameStates.Encoded encoded = states.isEnabled() ? states.encode(method, clientCallback.getObjectId(), message) : null;
            String json = encoded == null ? (prompt != null ? prompt : JsonCodec.GSON.toJson(message)) : encoded.json;
            BridgeMetrics.get().callback(method.name(), json.length(), clientCallback.getObjectId());
            states.sent(clientCallback.getMessageId());
            remember(clientCallback, prompt != null ? prompt : json);
            sendState(json, encoded);
        }
    }

    private void sendState(String json, GameStates.Encoded encoded) {
        if (encoded != null) {
            BridgeMetrics.get().state(encoded.patch, encoded.fullChars, json.length());
        }
        WebSocketServerImpl.sendText(conn, json);
    }

    private void remember(ClientCallback clientCallback, String json) {
        UUID gameId = clientCallback.getObjectId();
        if (gameId == null) {
            return;
        }
        if (PROMPTS.contains(clientCallback.getMethod())) {
            pendingPrompts.put(gameId, json);
        } else if (clientCallback.getMethod() == ClientCallbackMethod.GAME_OVER) {
            pendingPrompts.remove(gameId);
        }
    }

    /**
     * The JSON message for a callback; pre-game prompts get a marker for the web client (see {@link PromptMarkers}), and
     * the end of game summary leaves the players' zones out (see {@link EndGameInfo}).
     */
    static String serialize(ClientCallback clientCallback) {
        ClientCallbackMethod method = clientCallback.getMethod();
        if (method != ClientCallbackMethod.GAME_ASK && method != ClientCallbackMethod.GAME_TARGET
                && method != ClientCallbackMethod.END_GAME_INFO) {
            return JsonCodec.GSON.toJson(clientCallback);
        }
        return JsonCodec.GSON.toJson(serializeTree(clientCallback));
    }

    /**
     * Same as {@link #serialize}, as a tree.
     */
    static JsonObject serializeTree(ClientCallback clientCallback) {
        JsonObject json = JsonCodec.GSON.toJsonTree(clientCallback).getAsJsonObject();
        ClientCallbackMethod method = clientCallback.getMethod();
        if (method == ClientCallbackMethod.GAME_ASK || method == ClientCallbackMethod.GAME_TARGET) {
            PromptMarkers.annotate(json);
        } else if (method == ClientCallbackMethod.END_GAME_INFO) {
            EndGameInfo.slim(json);
        }
        return json;
    }

    @Override
    public void handleCallbackOneway(Callback callback) throws HandleCallbackException {
        handleCallbackOneway(callback, true);
    }

    @Override
    public void handleCallback(Callback callback) throws HandleCallbackException {
        handleCallbackOneway(callback, false);
    }

    @Override
    public void handleCallback(Callback callback, boolean asynch, boolean oneWay) throws HandleCallbackException {
        handleCallbackOneway(callback, asynch);
    }
}
