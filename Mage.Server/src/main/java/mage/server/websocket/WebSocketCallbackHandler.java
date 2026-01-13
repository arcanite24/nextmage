package mage.server.websocket;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import mage.interfaces.callback.ClientCallback;
import org.java_websocket.WebSocket;
import org.jboss.remoting.callback.AsynchInvokerCallbackHandler;
import org.jboss.remoting.callback.Callback;
import org.jboss.remoting.callback.HandleCallbackException;

public class WebSocketCallbackHandler implements AsynchInvokerCallbackHandler {

    private final WebSocket conn;
    private final Gson gson = new GsonBuilder()
            .registerTypeAdapter(java.util.UUID.class, new com.google.gson.JsonSerializer<java.util.UUID>() {
                @Override
                public com.google.gson.JsonElement serialize(java.util.UUID src, java.lang.reflect.Type typeOfSrc, com.google.gson.JsonSerializationContext context) {
                    return src == null ? null : new com.google.gson.JsonPrimitive(src.toString());
                }
            })
            .registerTypeAdapter(java.util.UUID.class, new com.google.gson.JsonDeserializer<java.util.UUID>() {
                @Override
                public java.util.UUID deserialize(com.google.gson.JsonElement json, java.lang.reflect.Type typeOfT, com.google.gson.JsonDeserializationContext context) {
                    return json == null ? null : java.util.UUID.fromString(json.getAsString());
                }
            })
            .create();

    public WebSocketCallbackHandler(WebSocket conn) {
        this.conn = conn;
    }

    @Override
    public void handleCallbackOneway(Callback callback, boolean asynch) throws HandleCallbackException {
        if (callback.getCallbackObject() instanceof ClientCallback) {
            ClientCallback cc = (ClientCallback) callback.getCallbackObject();
            cc.decompressData(); // Ensure data is raw for JSON serialization
            
            try {
                String json = gson.toJson(cc);
                if (conn.isOpen()) {
                    conn.send(json);
                }
            } catch (Exception e) {
                throw new HandleCallbackException("Error sending WebSocket message", e);
            }
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
