package mage.server.websocket.api;

import com.google.gson.JsonElement;
import mage.server.AccountService;
import mage.server.Session;
import mage.players.net.UserData;
import mage.server.DisconnectReason;
import mage.server.Main;
import mage.server.websocket.rpc.RpcCall;
import mage.server.websocket.rpc.RpcException;
import mage.server.websocket.rpc.RpcMethod;
import mage.utils.MageVersion;
import org.apache.log4j.Logger;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static mage.server.websocket.rpc.RpcParam.Type.ARRAY;
import static mage.server.websocket.rpc.RpcParam.Type.BOOLEAN;
import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.object;
import static mage.server.websocket.rpc.RpcParam.of;
import static mage.server.websocket.rpc.RpcParam.optional;

/**
 * Web client bridge: login, registration, user settings and connection keep-alive.
 */
final class SessionApi {

    private static final Logger logger = Logger.getLogger(SessionApi.class);

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

                RpcMethod.named("setCapabilities")
                        .publicAccess()
                        .params(of("capabilities", ARRAY).typed("string[]"))
                        .returns("string[]")
                        .doc("Turn on optional protocol features for this connection; returns the ones now on. "
                                + "\"stateDiffs\": game states are sent as patches against the previous one (see State patches). "
                                + "Call it right after connecting, before logging in; a new connection starts without them.")
                        .handler(call -> {
                            List<String> requested = new ArrayList<>();
                            for (JsonElement capability : call.jsonArray(0)) {
                                if (capability.isJsonPrimitive()) {
                                    requested.add(capability.getAsString());
                                }
                            }
                            return call.getConnection().setCapabilities(requested);
                        }),

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
                        .doc("Log in as server admin. Disabled unless the server was started with a non-empty admin password "
                                + "(-adminPassword=... or -Dxmage.adminPassword=...). After a wrong password the caller's IP is "
                                + "locked out for 1, 2, 4... seconds (at most 5 minutes).")
                        .handler(call -> connectAdmin(ctx, call, serverVersion)),

                RpcMethod.named("sessionGetRestoreToken")
                        .session(0)
                        .params(of("sessionId", STRING))
                        .returns("string")
                        .doc("Token that reattaches this user (and its tables) from a later connection: pass it as "
                                + "connectUser's restoreSessionId. It changes on every login, so fetch it again after each one.")
                        .handler(call -> ctx.sessions.restoreToken(call.sessionId())
                                .orElseThrow(() -> RpcException.notAuthorized("Log in before asking for a restore token"))),

                RpcMethod.named("authRegister")
                        .establishes(0)
                        .params(of("sessionId", STRING), of("userName", STRING), of("password", STRING), of("email", STRING))
                        .doc("Register a new account (servers with authentication enabled). With a password it becomes the "
                                + "account's password; without one the server emails a generated password. Fails with the reason.")
                        .handler(call -> {
                            Session session = ctx.managers.sessionManager().getSession(call.string(0))
                                    .orElseThrow(() -> RpcException.notAuthorized("No session"));
                            String problem = session.registerUser(call.string(1), call.string(2), call.string(3));
                            if (problem != null) {
                                throw RpcException.invalidParams(problem);
                            }
                            return true;
                        }),

                RpcMethod.named("authSendTokenToEmail")
                        .establishes(0)
                        .params(of("sessionId", STRING), of("email", STRING))
                        .doc("Email a password reset code to an account's address. Succeeds whether or not an account has the "
                                + "address, so addresses can't be probed; fails only when the server can't send mail.")
                        .handler(call -> {
                            String problem = new AccountService(ctx.managers).sendResetCode(call.string(1));
                            if (problem != null && !AccountService.NO_SUCH_EMAIL.equals(problem)) {
                                throw RpcException.invalidParams(problem);
                            }
                            return true;
                        }),

                RpcMethod.named("authResetPassword")
                        .establishes(0)
                        .params(of("sessionId", STRING), of("email", STRING), of("authToken", STRING), of("password", STRING))
                        .doc("Set a new password with an emailed code (valid 30 minutes, 5 tries). Fails with the reason.")
                        .handler(call -> {
                            String problem = new AccountService(ctx.managers).resetPassword(call.string(1), call.string(2), call.string(3));
                            if (problem != null) {
                                throw RpcException.invalidParams(problem);
                            }
                            return true;
                        }),

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

    private static boolean connectAdmin(ApiContext ctx, RpcCall call, MageVersion serverVersion) throws Exception {
        String ip = call.getConnection().getRemoteHost();
        String password = call.string(0);
        RpcException rejection = null;
        long lockMillis = ctx.adminPassword.isEmpty() ? 0 : ctx.adminLoginThrottle.tryBegin(ip);
        if (ctx.adminPassword.isEmpty()) {
            rejection = RpcException.notAuthorized("Admin login is disabled on this server");
        } else if (lockMillis > 0) {
            rejection = new RpcException(RpcException.RATE_LIMITED,
                    "Too many failed admin logins, try again in " + ((lockMillis + 999) / 1000) + " s");
        } else if (!MessageDigest.isEqual(password.getBytes(StandardCharsets.UTF_8),
                ctx.adminPassword.getBytes(StandardCharsets.UTF_8))) {
            ctx.adminLoginThrottle.recordFailure(ip);
            logger.warn("Failed admin login over WebSocket from " + ip);
            rejection = RpcException.notAuthorized("Wrong admin password");
        }
        if (rejection != null) {
            // the dispatcher already opened a session for this login: do not leave it behind
            ctx.sessions.disconnect(call.sessionId(), DisconnectReason.LostConnection);
            call.getConnection().bindSession(null);
            throw rejection;
        }
        ctx.adminLoginThrottle.recordSuccess(ip);
        return ctx.server.connectAdmin(password, call.sessionId(), serverVersion);
    }
}
