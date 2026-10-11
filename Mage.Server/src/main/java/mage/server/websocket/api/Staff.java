package mage.server.websocket.api;

import mage.server.Session;
import mage.server.admin.AccessPolicy;
import mage.server.websocket.rpc.RpcCall;
import mage.server.websocket.rpc.RpcException;

import java.util.Optional;

/**
 * Web client bridge: who may call the admin methods, and the audit trail they leave.
 */
final class Staff {

    /** the actor recorded for the shared admin password's sessions */
    static final String CONSOLE = "console";

    private Staff() {
    }

    /**
     * The staff member making this call, for the audit log; refuses everyone else.
     */
    static String require(ApiContext ctx, RpcCall call) throws RpcException {
        String sessionId = call.sessionId();
        if (ctx.staff != null && sessionId != null) {
            return ctx.staff.apply(sessionId).orElseThrow(() -> RpcException.notAuthorized("Staff only"));
        }
        if (ctx.managers == null || sessionId == null) {
            throw RpcException.notAuthorized("Staff only");
        }
        Optional<Session> session = ctx.managers.sessionManager().getSession(sessionId);
        if (session.isPresent() && session.get().isAdmin()) {
            return CONSOLE;
        }
        ctx.managers.sessionManager().checkAdminAccess(sessionId); // logs the refusal
        throw RpcException.notAuthorized("Staff only");
    }

    static void audit(String actor, String action, String target, String detail, String reason) {
        AccessPolicy.get().store().audit(actor, action, target, detail, reason, System.currentTimeMillis());
    }
}
