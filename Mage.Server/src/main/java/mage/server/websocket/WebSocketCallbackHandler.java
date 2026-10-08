package mage.server.websocket;

import com.google.gson.JsonObject;
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
 * Message shape: {@code {"method": "GAME_UPDATE", "objectId": "...", "messageId": 12, "data": {...}}}
 */
public class WebSocketCallbackHandler implements AsynchInvokerCallbackHandler {

    private static final Set<ClientCallbackMethod> PROMPTS = EnumSet.of(
            ClientCallbackMethod.GAME_TARGET, ClientCallbackMethod.GAME_CHOOSE_ABILITY, ClientCallbackMethod.GAME_CHOOSE_PILE,
            ClientCallbackMethod.GAME_CHOOSE_CHOICE, ClientCallbackMethod.GAME_ASK, ClientCallbackMethod.GAME_SELECT,
            ClientCallbackMethod.GAME_PLAY_MANA, ClientCallbackMethod.GAME_PLAY_XMANA, ClientCallbackMethod.GAME_GET_AMOUNT,
            ClientCallbackMethod.GAME_GET_MULTI_AMOUNT);

    private final WebSocket conn;
    /**
     * The last question of each game this connection has not answered yet, as sent, for {@code gameResync}.
     */
    private final Map<UUID, String> pendingPrompts = new ConcurrentHashMap<>();

    public WebSocketCallbackHandler(WebSocket conn) {
        this.conn = conn;
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
        WebSocketServerImpl.sendText(conn, json);
        return true;
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
            String json = serialize(clientCallback);
            remember(clientCallback, json);
            WebSocketServerImpl.sendText(conn, json);
        } catch (Exception e) {
            throw new HandleCallbackException("Error sending WebSocket message", e);
        }
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
     * The JSON message for a callback; pre-game prompts get a marker for the web client (see {@link PromptMarkers}).
     */
    static String serialize(ClientCallback clientCallback) {
        ClientCallbackMethod method = clientCallback.getMethod();
        if (method != ClientCallbackMethod.GAME_ASK && method != ClientCallbackMethod.GAME_TARGET) {
            return JsonCodec.GSON.toJson(clientCallback);
        }
        JsonObject json = JsonCodec.GSON.toJsonTree(clientCallback).getAsJsonObject();
        PromptMarkers.annotate(json);
        return JsonCodec.GSON.toJson(json);
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
