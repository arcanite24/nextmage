package mage.server.websocket.api;

import mage.players.net.UserData;
import mage.server.DisconnectReason;
import mage.server.Main;
import mage.server.websocket.rpc.RpcMethod;
import mage.utils.MageVersion;

import java.util.Arrays;
import java.util.List;

import static mage.server.websocket.rpc.RpcParam.Type.BOOLEAN;
import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.object;
import static mage.server.websocket.rpc.RpcParam.of;
import static mage.server.websocket.rpc.RpcParam.optional;

/**
 * Web client bridge: login, registration, user settings and connection keep-alive.
 */
final class SessionApi {

    private SessionApi() {
    }

    static List<RpcMethod> methods(ApiContext ctx) {
        // the web client is released together with the server, so it always reports the server version
        MageVersion serverVersion = new MageVersion(Main.class);

        RpcMethod disconnect = RpcMethod.named("disconnectSession")
                .session(0)
                .params(of("sessionId", STRING), optional("keepGames", BOOLEAN))
                .doc("Log out. With keepGames the user's active tables survive for a later reconnect.")
                .handler(call -> {
                    DisconnectReason reason = call.optBool(1, false)
                            ? DisconnectReason.DisconnectedByUserButKeepTables
                            : DisconnectReason.DisconnectedByUser;
                    ctx.sessions.disconnect(call.sessionId(), reason);
                    call.getConnection().bindSession(null);
                    return true;
                });

        return Arrays.asList(
                RpcMethod.named("ping")
                        .optionalSession(0)
                        .params(optional("sessionId", STRING), optional("pingInfo", STRING))
                        .doc("Keep-alive. Extends the logged in user's session; always succeeds before login.")
                        .handler(call -> !call.has(0) || ctx.server.ping(call.string(0), call.optString(1, "websocket"))),

                RpcMethod.named("connectUser")
                        .establishes(2)
                        .params(of("userName", STRING), of("password", STRING), of("sessionId", STRING),
                                optional("restoreSessionId", STRING), optional("clientVersion", STRING), optional("userIdStr", STRING))
                        .doc("Log in. Creates the connection's session; restoreSessionId reattaches a user that lost its connection.")
                        .handler(call -> ctx.server.connectUser(call.string(0), call.string(1), call.string(2),
                                call.optString(3, ""), serverVersion, call.optString(5, ""))),

                RpcMethod.named("connectAdmin")
                        .establishes(1)
                        .params(of("password", STRING), of("sessionId", STRING))
                        .doc("Log in as server admin.")
                        .handler(call -> ctx.server.connectAdmin(call.string(0), call.string(1), serverVersion)),

                RpcMethod.named("authRegister")
                        .establishes(0)
                        .params(of("sessionId", STRING), of("userName", STRING), of("password", STRING), of("email", STRING))
                        .doc("Register a new account (servers with authentication enabled).")
                        .handler(call -> ctx.server.authRegister(call.string(0), call.string(1), call.string(2), call.string(3))),

                RpcMethod.named("authSendTokenToEmail")
                        .establishes(0)
                        .params(of("sessionId", STRING), of("email", STRING))
                        .doc("Send a password reset token by email.")
                        .handler(call -> ctx.server.authSendTokenToEmail(call.string(0), call.string(1))),

                RpcMethod.named("authResetPassword")
                        .establishes(0)
                        .params(of("sessionId", STRING), of("email", STRING), of("authToken", STRING), of("password", STRING))
                        .doc("Set a new password with an emailed token.")
                        .handler(call -> ctx.server.authResetPassword(call.string(0), call.string(1), call.string(2), call.string(3))),

                disconnect,
                disconnect.alias("playerLogout"),

                RpcMethod.named("connectSetUserData")
                        .session(1)
                        .params(optional("userName", STRING), of("sessionId", STRING), object("userData", "UserData"),
                                optional("clientVersion", STRING), optional("userIdStr", STRING))
                        .doc("Store user preferences (avatar, flag, auto-pass settings). userName is ignored; the session identifies the user.")
                        .handler(call -> ctx.server.connectSetUserData(call.string(1), call.object(2, UserData.class),
                                call.optString(3, ""), call.optString(4, ""))),

                RpcMethod.named("sendFeedback")
                        .session(0)
                        .params(of("sessionId", STRING), of("userName", STRING), of("title", STRING), of("type", STRING),
                                of("message", STRING), optional("email", STRING))
                        .doc("Send feedback to the server admin.")
                        .handler(call -> {
                            String userName = ctx.sessions.userName(call.sessionId()).orElse(call.string(1));
                            ctx.server.serverAddFeedbackMessage(call.string(0), userName, call.string(2), call.string(3),
                                    call.string(4), call.optString(5, ""));
                            return true;
                        })
        );
    }
}
