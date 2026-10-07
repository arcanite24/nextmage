package mage.server.websocket.rpc;

/**
 * Web client bridge: one positional parameter of an RPC method (used for validation, docs and client codegen).
 */
public final class RpcParam {

    public enum Type {
        STRING("string"),
        UUID("UUID"),
        INT("number"),
        BOOLEAN("boolean"),
        OBJECT("unknown"),
        ARRAY("unknown[]"),
        ANY("unknown");

        private final String tsType;

        Type(String tsType) {
            this.tsType = tsType;
        }

        public String getTsType() {
            return tsType;
        }
    }

    private final String name;
    private final Type type;
    private final boolean optional;
    private final String tsType; // overrides the generic type in generated client code, e.g. "DeckCardLists"

    private RpcParam(String name, Type type, boolean optional, String tsType) {
        this.name = name;
        this.type = type;
        this.optional = optional;
        this.tsType = tsType;
    }

    public static RpcParam of(String name, Type type) {
        return new RpcParam(name, type, false, null);
    }

    public static RpcParam optional(String name, Type type) {
        return new RpcParam(name, type, true, null);
    }

    public static RpcParam object(String name, String tsType) {
        return new RpcParam(name, Type.OBJECT, false, tsType);
    }

    public static RpcParam optionalObject(String name, String tsType) {
        return new RpcParam(name, Type.OBJECT, true, tsType);
    }

    public RpcParam typed(String tsType) {
        return new RpcParam(name, type, optional, tsType);
    }

    public String getName() {
        return name;
    }

    public Type getType() {
        return type;
    }

    public boolean isOptional() {
        return optional;
    }

    public String getTsType() {
        return tsType != null ? tsType : type.getTsType();
    }
}
