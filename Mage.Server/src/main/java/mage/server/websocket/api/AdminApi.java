package mage.server.websocket.api;

import mage.game.Game;
import mage.game.Table;
import mage.game.match.Match;
import mage.server.Main;
import mage.server.Session;
import mage.server.moderation.ClientErrors;
import mage.server.moderation.ReportStore;
import mage.server.websocket.BridgeMetrics;
import mage.server.websocket.rpc.RpcCall;
import mage.server.websocket.rpc.RpcException;
import mage.server.websocket.rpc.RpcMethod;
import org.apache.log4j.Logger;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static mage.server.websocket.rpc.RpcParam.Type.BOOLEAN;
import static mage.server.websocket.rpc.RpcParam.Type.INT;
import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.of;
import static mage.server.websocket.rpc.RpcParam.optional;

/**
 * Web client bridge: server administration (admin sessions only) and test-mode helpers for e2e tests.
 */
final class AdminApi {

    private static final Logger logger = Logger.getLogger(AdminApi.class);

    private AdminApi() {
    }

    static List<RpcMethod> methods(ApiContext ctx) {
        List<RpcMethod> methods = new ArrayList<>(Arrays.asList(
                RpcMethod.named("adminGetUsers")
                        .session(0)
                        .params(of("sessionId", STRING))
                        .returns("UserView[]")
                        .doc("Admin: all connected users.")
                        .handler(call -> ctx.server.adminGetUsers(call.string(0))),

                RpcMethod.named("adminDisconnectUser")
                        .session(0)
                        .params(of("sessionId", STRING), of("userSessionId", STRING))
                        .doc("Admin: disconnect a user.")
                        .handler(call -> {
                            ctx.server.adminDisconnectUser(call.string(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("adminEndUserSession")
                        .session(0)
                        .params(of("sessionId", STRING), of("userSessionId", STRING))
                        .doc("Admin: end a user's session and remove them from tables.")
                        .handler(call -> {
                            ctx.server.adminEndUserSession(call.string(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("adminMuteUser")
                        .session(0)
                        .params(of("sessionId", STRING), of("userName", STRING), of("durationMinutes", INT))
                        .doc("Admin: mute a user in chats.")
                        .handler(call -> {
                            ctx.server.adminMuteUser(call.string(0), call.string(1), call.integer(2));
                            return true;
                        }),

                RpcMethod.named("adminLockUser")
                        .session(0)
                        .params(of("sessionId", STRING), of("userName", STRING), of("durationMinutes", INT))
                        .doc("Admin: lock a user out.")
                        .handler(call -> {
                            ctx.server.adminLockUser(call.string(0), call.string(1), call.integer(2));
                            return true;
                        }),

                RpcMethod.named("adminActivateUser")
                        .session(0)
                        .params(of("sessionId", STRING), of("userName", STRING), of("active", BOOLEAN))
                        .doc("Admin: activate or deactivate an account.")
                        .handler(call -> {
                            ctx.server.adminActivateUser(call.string(0), call.string(1), call.bool(2));
                            return true;
                        }),

                RpcMethod.named("adminToggleActivateUser")
                        .session(0)
                        .params(of("sessionId", STRING), of("userName", STRING))
                        .doc("Admin: toggle an account's active state.")
                        .handler(call -> {
                            ctx.server.adminToggleActivateUser(call.string(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("adminTableRemove")
                        .session(0)
                        .params(of("sessionId", STRING), of("tableId", mage.server.websocket.rpc.RpcParam.Type.UUID))
                        .doc("Admin: remove any table.")
                        .handler(call -> {
                            ctx.server.adminTableRemove(call.string(0), call.uuid(1));
                            return true;
                        }),

                RpcMethod.named("adminSendBroadcastMessage")
                        .session(0)
                        .params(of("sessionId", STRING), of("message", STRING))
                        .doc("Admin: message every connected user.")
                        .handler(call -> {
                            ctx.server.adminSendBroadcastMessage(call.string(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("adminServerStats")
                        .returns("ServerStats")
                        .doc("Admin: load and traffic: users, tables, games, memory, CPU, and the size of messages sent to web clients "
                                + "(with the heaviest callbacks and every one over " + BridgeMetrics.LARGE_CHARS / 1024 + " KB).")
                        .handler(call -> {
                            requireAdmin(ctx, call);
                            return ServerStats.collect(ctx.managers);
                        }),

                RpcMethod.named("adminGetReports")
                        .params(optional("openOnly", BOOLEAN))
                        .returns("PlayerReport[]")
                        .doc("Admin: player reports, newest first; only the open ones unless openOnly is false.")
                        .handler(call -> {
                            requireAdmin(ctx, call);
                            boolean openOnly = call.optBool(0, true);
                            return AccountApi.decks(() -> ReportStore.get().list(openOnly, 200));
                        }),

                RpcMethod.named("adminCloseReport")
                        .params(of("reportId", INT), of("resolution", STRING))
                        .returns("boolean")
                        .doc("Admin: close a report with a note about what was done. False when it was closed already.")
                        .handler(call -> {
                            requireAdmin(ctx, call);
                            long id = AccountApi.longValue(call, 0);
                            return AccountApi.decks(() -> ReportStore.get().close(id, call.string(1), System.currentTimeMillis()));
                        }),

                RpcMethod.named("adminClientErrors")
                        .returns("ClientError[]")
                        .doc("Admin: the latest crash reports from web clients, newest first.")
                        .handler(call -> {
                            requireAdmin(ctx, call);
                            return ClientErrors.get().recent(200);
                        }),

                RpcMethod.named("testEndGame")
                        .session(0)
                        .params(of("sessionId", STRING), of("tableId", mage.server.websocket.rpc.RpcParam.Type.UUID))
                        .doc("Test mode only: end the running game of a table you own.")
                        .handler(call -> {
                            UUID tableId = ownedTestTable(ctx, call);
                            ctx.managers.tableManager().endGameOnGameThread(activeChildOrSelf(ctx, tableId));
                            return true;
                        }),

                RpcMethod.named("testConcedeMatch")
                        .session(0)
                        .params(of("sessionId", STRING), of("tableId", mage.server.websocket.rpc.RpcParam.Type.UUID), optional("losingPlayerIndex", INT))
                        .doc("Test mode only: make one player of a table you own concede the match.")
                        .handler(call -> testConcedeMatch(ctx, call))
        ));
        return methods;
    }

    private static void requireAdmin(ApiContext ctx, RpcCall call) throws RpcException {
        if (ctx.managers == null || !ctx.managers.sessionManager().checkAdminAccess(call.sessionId())) {
            throw RpcException.notAuthorized("Admin only");
        }
    }

    private static UUID ownedTestTable(ApiContext ctx, RpcCall call) throws RpcException {
        UUID tableId = call.uuid(1);
        if (!Main.isTestMode()) {
            throw RpcException.notAuthorized(call.getMethod().getName() + " is only available in server test mode");
        }
        Optional<Session> session = ctx.managers.sessionManager().getSession(call.sessionId());
        if (!session.isPresent() || !ctx.managers.tableManager().isTableOwner(tableId, session.get().getUserId())) {
            throw RpcException.notAuthorized("Only the table owner can do that");
        }
        return tableId;
    }

    private static Object testConcedeMatch(ApiContext ctx, RpcCall call) throws RpcException {
        UUID tableId = activeChildOrSelf(ctx, ownedTestTable(ctx, call));
        Match match = ctx.managers.tableManager().getMatch(tableId).orElse(null);
        Game game = match == null ? null : match.getGame();
        if (match == null || match.getPlayers().isEmpty() || game == null) {
            throw new RpcException(RpcException.SERVER_ERROR, "Table has no running game: " + tableId);
        }
        int index = Math.max(0, Math.min(call.optInteger(2, 0), match.getPlayers().size() - 1));
        UUID losingPlayerId = match.getPlayers().get(index).getPlayer().getId();
        ctx.managers.threadExecutor().getGameExecutor().execute(() -> {
            match.quitMatch(losingPlayerId);
            game.concede(losingPlayerId);
            if (game.checkIfGameIsOver() || game.hasEnded()) {
                ctx.managers.tableManager().endGame(tableId);
            } else {
                logger.warn("testConcedeMatch did not end the game of table " + tableId);
            }
        });
        return true;
    }

    /**
     * Tournament tables run their games on child tables.
     */
    private static UUID activeChildOrSelf(ApiContext ctx, UUID tableId) {
        return ctx.managers.tableManager().getTables().stream()
                .filter(table -> tableId.equals(table.getParentTableId()))
                .filter(table -> table.getMatch() != null && table.getMatch().getGame() != null)
                .findFirst()
                .map(Table::getId)
                .orElse(tableId);
    }
}
