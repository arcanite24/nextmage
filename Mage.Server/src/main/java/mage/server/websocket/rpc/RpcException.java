package mage.server.websocket.rpc;

/**
 * Web client bridge: an error that is reported to the caller as a JSON-RPC error object.
 */
public class RpcException extends Exception {

    // standard JSON-RPC 2.0 codes
    public static final int PARSE_ERROR = -32700;
    public static final int INVALID_REQUEST = -32600;
    public static final int METHOD_NOT_FOUND = -32601;
    public static final int INVALID_PARAMS = -32602;
    public static final int INTERNAL_ERROR = -32603;

    // implementation defined codes (-32000 to -32099)
    public static final int SERVER_ERROR = -32000;
    public static final int NOT_AUTHORIZED = -32001;
    public static final int SESSION_IN_USE = -32002;
    public static final int RATE_LIMITED = -32003;
    public static final int SERVER_BUSY = -32004;

    private final int code;

    public RpcException(int code, String message) {
        super(message);
        this.code = code;
    }

    public RpcException(int code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public int getCode() {
        return code;
    }

    public static RpcException invalidParams(String message) {
        return new RpcException(INVALID_PARAMS, message);
    }

    public static RpcException notAuthorized(String message) {
        return new RpcException(NOT_AUTHORIZED, message);
    }
}
