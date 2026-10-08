package mage.server.websocket.rpc;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Web client bridge: one callable method with its access rule, parameters and handler.
 */
public final class RpcMethod {

    public enum Access {
        /**
         * Callable without a session, e.g. server status probes from the login screen.
         */
        PUBLIC,
        /**
         * Requires a session bound to the calling connection; the session parameter (if any) must match it.
         */
        SESSION,
        /**
         * Creates (or replaces) the session named by the session parameter and binds it to the connection.
         */
        ESTABLISH
    }

    @FunctionalInterface
    public interface Handler {
        Object handle(RpcCall call) throws Exception;
    }

    private final String name;
    private final Access access;
    private final int sessionParam; // index of the sessionId parameter, -1 if none
    private final List<RpcParam> params;
    private final String resultType;
    private final String description;
    private final Handler handler;
    private final String aliasOf;

    private RpcMethod(Builder builder) {
        this.name = builder.name;
        this.access = builder.access;
        this.sessionParam = builder.sessionParam;
        this.params = Collections.unmodifiableList(new ArrayList<>(builder.params));
        this.resultType = builder.resultType;
        this.description = builder.description;
        this.handler = builder.handler;
        this.aliasOf = builder.aliasOf;
    }

    public static Builder named(String name) {
        return new Builder(name);
    }

    public RpcMethod alias(String aliasName) {
        Builder builder = new Builder(aliasName);
        builder.access = access;
        builder.sessionParam = sessionParam;
        builder.params.addAll(params);
        builder.resultType = resultType;
        builder.description = "Alias of `" + name + "`.";
        builder.handler = handler;
        builder.aliasOf = name;
        return builder.build();
    }

    public String getName() {
        return name;
    }

    public Access getAccess() {
        return access;
    }

    public int getSessionParam() {
        return sessionParam;
    }

    public List<RpcParam> getParams() {
        return params;
    }

    public String getResultType() {
        return resultType;
    }

    public String getDescription() {
        return description;
    }

    public Handler getHandler() {
        return handler;
    }

    public String getAliasOf() {
        return aliasOf;
    }

    public int getRequiredParamCount() {
        int count = 0;
        for (RpcParam param : params) {
            if (!param.isOptional()) {
                count++;
            }
        }
        return count;
    }

    public static final class Builder {
        private final String name;
        private Access access = Access.SESSION;
        private int sessionParam = -1;
        private final List<RpcParam> params = new ArrayList<>();
        private String resultType = "boolean";
        private String description = "";
        private Handler handler;
        private String aliasOf;

        private Builder(String name) {
            this.name = name;
        }

        public Builder publicAccess() {
            this.access = Access.PUBLIC;
            return this;
        }

        /**
         * Session-checked method; {@code index} is the position of its sessionId parameter.
         */
        public Builder session(int index) {
            this.access = Access.SESSION;
            this.sessionParam = index;
            return this;
        }

        /**
         * Public method that uses the caller's session when there is one, e.g. ping.
         */
        public Builder optionalSession(int index) {
            this.access = Access.PUBLIC;
            this.sessionParam = index;
            return this;
        }

        /**
         * Session-creating method; {@code index} is the position of its sessionId parameter.
         */
        public Builder establishes(int index) {
            this.access = Access.ESTABLISH;
            this.sessionParam = index;
            return this;
        }

        public Builder params(RpcParam... params) {
            this.params.addAll(Arrays.asList(params));
            return this;
        }

        public Builder returns(String resultType) {
            this.resultType = resultType;
            return this;
        }

        public Builder doc(String description) {
            this.description = description;
            return this;
        }

        public RpcMethod handler(Handler handler) {
            this.handler = handler;
            return build();
        }

        private RpcMethod build() {
            if (handler == null) {
                throw new IllegalStateException("RPC method without handler: " + name);
            }
            if (access == Access.ESTABLISH && sessionParam < 0) {
                throw new IllegalStateException("Session-creating RPC method must declare its session param: " + name);
            }
            if (sessionParam >= params.size()) {
                throw new IllegalStateException("Session param index out of range: " + name);
            }
            return new RpcMethod(this);
        }
    }
}
