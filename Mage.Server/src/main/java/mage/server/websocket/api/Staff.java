package mage.server.websocket.api;

import mage.server.Session;
import mage.server.User;
import mage.server.admin.AccessPolicy;
import mage.server.admin.StaffRole;
import mage.server.websocket.rpc.RpcCall;
import mage.server.websocket.rpc.RpcException;


/**
 * Web client bridge: who may call the admin methods, and the audit trail they leave.
 * <p>
 * Staff are player accounts with a role (see {@link StaffRole}), signed in as themselves; the role is looked up on
 * every call, so a revoked role stops working at once. The shared admin password's console session is an owner.
 * Roles need accounts: without them anyone could take a staff member's name.
 */
final class Staff {

    /** the actor recorded for the shared admin password's sessions */
    static final String CONSOLE = "console";

    /** who is calling: the name for the audit log and the role */
    static final class Member {
        final String actor;
        final StaffRole role;

        Member(String actor, StaffRole role) {
            this.actor = actor;
            this.role = role;
        }
    }

    private Staff() {
    }

    /**
     * The staff member making this call, for the audit log; refuses players and staff below the role.
     */
    static String require(ApiContext ctx, RpcCall call, StaffRole least) throws RpcException {
        Member member = member(ctx, call.sessionId());
        if (member == null) {
            if (ctx.managers != null && call.sessionId() != null) {
                ctx.managers.sessionManager().checkAdminAccess(call.sessionId()); // logs the refusal
            }
            throw RpcException.notAuthorized("Staff only");
        }
        if (!member.role.atLeast(least)) {
            throw RpcException.notAuthorized("This needs the " + least.id() + " role; yours is " + member.role.id());
        }
        return member.actor;
    }

    /** The calling session's staff role, or null for players. */
    static Member member(ApiContext ctx, String sessionId) {
        if (sessionId == null) {
            return null;
        }
        if (ctx.staff != null) {
            return ctx.staff.apply(sessionId).map(actor -> new Member(actor, StaffRole.OWNER)).orElse(null);
        }
        if (ctx.managers == null) {
            return null;
        }
        if (ctx.managers.sessionManager().getSession(sessionId).map(Session::isAdmin).orElse(false)) {
            return new Member(CONSOLE, StaffRole.OWNER);
        }
        if (!ctx.managers.configSettings().isAuthenticationActivated()) {
            return null;
        }
        String name = ctx.managers.sessionManager().getUser(sessionId).map(User::getName).orElse(null);
        StaffRole role = name == null ? null : AccessPolicy.get().roleOf(name);
        return role == null ? null : new Member(name, role);
    }

    static void audit(String actor, String action, String target, String detail, String reason) {
        AccessPolicy.get().store().audit(actor, action, target, detail, reason, System.currentTimeMillis());
    }
}
