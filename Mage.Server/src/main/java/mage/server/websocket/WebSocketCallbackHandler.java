package mage.server.websocket;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;
import mage.interfaces.callback.ClientCallback;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import mage.view.SimpleCardView;
import org.java_websocket.WebSocket;
import org.jboss.remoting.callback.AsynchInvokerCallbackHandler;
import org.jboss.remoting.callback.Callback;
import org.jboss.remoting.callback.HandleCallbackException;

import java.lang.reflect.Type;

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
            .registerTypeAdapter(SimpleCardView.class, new SimpleCardViewSerializer())
            .create();

    public WebSocketCallbackHandler(WebSocket conn) {
        this.conn = conn;
    }

    @Override
    public void handleCallbackOneway(Callback callback, boolean asynch) throws HandleCallbackException {
        if (callback.getCallbackObject() instanceof ClientCallback) {
            ClientCallback cc = (ClientCallback) callback.getCallbackObject();
            cc.decompressData(); // Ensure data is raw for JSON serialization
            
            if (!conn.isOpen()) {
                // lets the session mark itself invalid and disconnect, instead of silently dropping data
                throw new HandleCallbackException("WebSocket connection is closed");
            }
            try {
                conn.send(gson.toJson(cc));
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

    private static class SimpleCardViewSerializer implements JsonSerializer<SimpleCardView> {

        @Override
        public JsonElement serialize(SimpleCardView src, Type typeOfSrc, JsonSerializationContext context) {
            JsonObject json = new JsonObject();
            json.add("id", context.serialize(src.getId()));
            json.addProperty("expansionSetCode", src.getExpansionSetCode());
            json.addProperty("setCode", src.getExpansionSetCode());
            json.addProperty("cardNumber", src.getCardNumber());
            json.addProperty("usesVariousArt", src.getUsesVariousArt());
            json.addProperty("gameObject", src.isGameObject());
            json.addProperty("isChoosable", src.isChoosable());
            json.addProperty("isSelected", src.isSelected());

            String name = findCardName(src);
            if (name != null) {
                json.add("name", new JsonPrimitive(name));
                json.add("displayName", new JsonPrimitive(name));
            }

            return json;
        }

        private static String findCardName(SimpleCardView card) {
            String setCode = card.getExpansionSetCode();
            String cardNumber = card.getCardNumber();
            if (setCode == null || cardNumber == null) {
                return null;
            }

            CardInfo cardInfo = CardRepository.instance.findCard(setCode, cardNumber);
            return cardInfo == null ? null : cardInfo.getName();
        }
    }
}
