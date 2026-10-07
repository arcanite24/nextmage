package mage.server.websocket;

import mage.interfaces.callback.ClientCallback;
import mage.server.websocket.rpc.JsonCodec;
import org.java_websocket.WebSocket;
import org.jboss.remoting.callback.AsynchInvokerCallbackHandler;
import org.jboss.remoting.callback.Callback;
import org.jboss.remoting.callback.HandleCallbackException;

/**
 * Web client bridge: pushes server callbacks (game updates, prompts, chat...) to a WebSocket as JSON.
 * <p>
 * Message shape: {@code {"method": "GAME_UPDATE", "objectId": "...", "messageId": 12, "data": {...}}}
 */
public class WebSocketCallbackHandler implements AsynchInvokerCallbackHandler {

    private final WebSocket conn;

    public WebSocketCallbackHandler(WebSocket conn) {
        this.conn = conn;
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
            conn.send(JsonCodec.GSON.toJson(clientCallback));
        } catch (Exception e) {
            throw new HandleCallbackException("Error sending WebSocket message", e);
        }
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
