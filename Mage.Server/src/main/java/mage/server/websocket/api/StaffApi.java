package mage.server.websocket.api;

import mage.server.AuthorizedUser;
import mage.server.AuthorizedUserRepository;
import mage.server.admin.AccessPolicy;
import mage.server.admin.StaffMember;
import mage.server.admin.StaffRole;
import mage.server.notify.DiscordNotifier;
import mage.server.websocket.rpc.RpcException;
import mage.server.websocket.rpc.RpcMethod;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.of;
import static mage.server.websocket.rpc.RpcParam.optional;

/**
 * Web client bridge: staff roles. Anyone can ask for their own role (the app shows /admin to staff); the owner
 * grants and revokes them.
 */
final class StaffApi {

    /** The calling session's staff role. */
    public static class StaffMe {
        /** moderator, admin or owner; null for players */
        public String role;
        /** the name the audit log records */
        public String actor;
    }

    /** Everyone with a role, the configured owner first. */
    public static class StaffList {
        /** the xmage.owner account, whose role can't be changed here; empty when there is none */
        public String owner;
        public List<StaffMember> members;
        /** roles need accounts; without them nobody but the console is staff */
        public boolean accounts;
    }

    private StaffApi() {
    }

    static List<RpcMethod> methods(ApiContext ctx) {
        return Arrays.asList(
                RpcMethod.named("staffMe")
                        .returns("StaffMe")
                        .doc("The calling session's staff role, or a null role for players.")
                        .handler(call -> {
                            Staff.Member member = Staff.member(ctx, call.sessionId());
                            StaffMe me = new StaffMe();
                            if (member != null) {
                                me.role = member.role.id();
                                me.actor = member.actor;
                            }
                            return me;
                        }),

                RpcMethod.named("adminStaff")
                        .returns("StaffList")
                        .doc("Staff (owner): who has a staff role.")
                        .handler(call -> {
                            Staff.require(ctx, call, StaffRole.OWNER);
                            StaffList list = new StaffList();
                            list.owner = AccessPolicy.get().owner();
                            list.members = AccessApi.store(() -> AccessPolicy.get().store().staff());
                            list.accounts = accountsOn(ctx);
                            return list;
                        }),

                RpcMethod.named("adminStaffGrant")
                        .params(of("userName", STRING), of("role", STRING), optional("reason", STRING))
                        .returns("StaffMember")
                        .doc("Staff (owner): give an account a role (moderator, admin or owner), or change it.")
                        .handler(call -> {
                            String actor = Staff.require(ctx, call, StaffRole.OWNER);
                            StaffRole role = StaffRole.parse(call.string(1));
                            if (role == null) {
                                throw RpcException.invalidParams("The role is moderator, admin or owner");
                            }
                            String name = account(ctx, call.string(0));
                            checkChange(actor, name);
                            StaffMember member = AccessApi.store(() -> AccessPolicy.get().store().grantStaff(name, role, actor, System.currentTimeMillis()));
                            Staff.audit(actor, "staff.grant", name, role.id(), reason(call.optString(2, "")));
                            DiscordNotifier.staff().staffChanged(actor, "made " + name + " " + role.id());
                            return member;
                        }),

                RpcMethod.named("adminStaffRevoke")
                        .params(of("userName", STRING), optional("reason", STRING))
                        .returns("boolean")
                        .doc("Staff (owner): take an account's role away. False when it had none.")
                        .handler(call -> {
                            String actor = Staff.require(ctx, call, StaffRole.OWNER);
                            String name = call.string(0).trim();
                            checkChange(actor, name);
                            boolean revoked = AccessApi.store(() -> AccessPolicy.get().store().revokeStaff(name));
                            if (revoked) {
                                Staff.audit(actor, "staff.revoke", name, null, reason(call.optString(1, "")));
                                DiscordNotifier.staff().staffChanged(actor, "took " + name + "'s staff role away");
                            }
                            return revoked;
                        })
        );
    }

    /**
     * The configured owner's role is fixed, and an owner can't change their own role while they are the only owner:
     * someone must always be able to manage staff.
     */
    private static void checkChange(String actor, String name) throws RpcException {
        AccessPolicy access = AccessPolicy.get();
        if (access.isOwner(name)) {
            throw RpcException.invalidParams(name + " is the server's owner (XMAGE_OWNER); that role can't be changed here");
        }
        if (!actor.equalsIgnoreCase(name) || !access.owner().isEmpty()) {
            return;
        }
        List<StaffMember> owners = new ArrayList<>();
        for (StaffMember member : AccessApi.store(() -> access.store().staff())) {
            if (StaffRole.OWNER.id().equals(member.role)) {
                owners.add(member);
            }
        }
        if (owners.size() <= 1) {
            throw RpcException.invalidParams("You are the only owner. Make someone else an owner first.");
        }
    }

    /** the account's name as it was registered */
    private static String account(ApiContext ctx, String userName) throws RpcException {
        if (!accountsOn(ctx)) {
            throw RpcException.invalidParams("Staff roles need accounts (XMAGE_AUTH=true)");
        }
        AuthorizedUser account = AuthorizedUserRepository.getInstance().getByName(userName.trim());
        if (account == null) {
            throw RpcException.invalidParams("There is no account named " + userName.trim());
        }
        return account.getName();
    }

    private static boolean accountsOn(ApiContext ctx) {
        return ctx.managers != null && ctx.managers.configSettings().isAuthenticationActivated();
    }

    private static String reason(String text) {
        String reason = text.trim();
        return reason.isEmpty() ? null : reason;
    }
}
