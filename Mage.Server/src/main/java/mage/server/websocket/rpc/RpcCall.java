package mage.server.websocket.rpc;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;

import java.util.UUID;

/**
 * Web client bridge: one incoming request with typed, validated access to its positional parameters.
 */
public final class RpcCall {

    private final RpcMethod method;
    private final JsonArray params;
    private final RpcConnection connection;

    public RpcCall(RpcMethod method, JsonArray params, RpcConnection connection) {
        this.method = method;
        this.params = params == null ? new JsonArray() : params;
        this.connection = connection;
    }

    public RpcMethod getMethod() {
        return method;
    }

    public RpcConnection getConnection() {
        return connection;
    }

    public int size() {
        return params.size();
    }

    public boolean has(int index) {
        return index < params.size() && !params.get(index).isJsonNull();
    }

    public JsonElement raw(int index) throws RpcException {
        if (!has(index)) {
            throw RpcException.invalidParams("Missing parameter " + describe(index));
        }
        return params.get(index);
    }

    public String string(int index) throws RpcException {
        JsonElement value = raw(index);
        if (!value.isJsonPrimitive()) {
            throw RpcException.invalidParams("Parameter " + describe(index) + " must be a string");
        }
        return value.getAsString();
    }

    public String optString(int index, String defaultValue) throws RpcException {
        return has(index) ? string(index) : defaultValue;
    }

    public UUID uuid(int index) throws RpcException {
        String value = string(index);
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw RpcException.invalidParams("Parameter " + describe(index) + " must be a UUID");
        }
    }

    public UUID optUuid(int index) throws RpcException {
        return has(index) ? uuid(index) : null;
    }

    public int integer(int index) throws RpcException {
        JsonElement value = raw(index);
        try {
            return value.getAsInt();
        } catch (RuntimeException e) {
            throw RpcException.invalidParams("Parameter " + describe(index) + " must be an integer");
        }
    }

    public int optInteger(int index, int defaultValue) throws RpcException {
        return has(index) ? integer(index) : defaultValue;
    }

    public boolean bool(int index) throws RpcException {
        JsonElement value = raw(index);
        if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isBoolean()) {
            throw RpcException.invalidParams("Parameter " + describe(index) + " must be a boolean");
        }
        return value.getAsBoolean();
    }

    public boolean optBool(int index, boolean defaultValue) throws RpcException {
        return has(index) ? bool(index) : defaultValue;
    }

    public JsonObject jsonObject(int index) throws RpcException {
        JsonElement value = raw(index);
        if (!value.isJsonObject()) {
            throw RpcException.invalidParams("Parameter " + describe(index) + " must be an object");
        }
        return value.getAsJsonObject();
    }

    public JsonArray jsonArray(int index) throws RpcException {
        JsonElement value = raw(index);
        if (!value.isJsonArray()) {
            throw RpcException.invalidParams("Parameter " + describe(index) + " must be an array");
        }
        return value.getAsJsonArray();
    }

    public <T> T object(int index, Class<T> type) throws RpcException {
        JsonElement value = raw(index);
        try {
            T result = JsonCodec.GSON.fromJson(value, type);
            if (result == null) {
                throw RpcException.invalidParams("Parameter " + describe(index) + " must be an object");
            }
            return result;
        } catch (JsonSyntaxException e) {
            throw RpcException.invalidParams("Parameter " + describe(index) + " is malformed: " + e.getMessage());
        }
    }

    /**
     * @return the session bound to the calling connection (always set for session-checked methods)
     */
    public String sessionId() {
        return connection.getSessionId();
    }

    private String describe(int index) {
        if (index < method.getParams().size()) {
            return "'" + method.getParams().get(index).getName() + "' (#" + index + ")";
        }
        return "#" + index;
    }
}
