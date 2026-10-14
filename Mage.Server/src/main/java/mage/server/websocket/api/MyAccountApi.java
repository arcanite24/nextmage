package mage.server.websocket.api;

import mage.server.AuthorizedUser;
import mage.server.AuthorizedUserRepository;
import mage.server.EmailVerification;
import mage.server.Mailer;
import mage.server.admin.AccessPolicy;
import mage.server.websocket.rpc.RpcCall;
import mage.server.websocket.rpc.RpcException;
import mage.server.websocket.rpc.RpcMethod;

import java.util.Arrays;
import java.util.List;

import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.of;

/**
 * Web client bridge: the signed-in player's own account. Confirming its email address.
 */
final class MyAccountApi {

    private MyAccountApi() {
    }

    /** The account's email as Settings shows it. */
    public static class AccountEmailStatus {
        /** masked, like n***@example.com; empty when the account has none */
        public String email;
        /** the player proved they read it */
        public boolean verified;
        /** the server can send mail, so a code can be sent */
        public boolean mail;
        /** the account signs in with GitHub (it may have no password of its own) */
        public boolean github;
    }

    static List<RpcMethod> methods(ApiContext ctx) {
        return Arrays.asList(
                RpcMethod.named("accountEmailStatus")
                        .returns("AccountEmailStatus")
                        .doc("The signed-in account's email, masked, and whether it is confirmed. Only on servers with accounts.")
                        .handler(call -> {
                            AuthorizedUser account = account(ctx, call);
                            AccountEmailStatus status = new AccountEmailStatus();
                            status.email = EmailVerification.mask(account.getEmail());
                            status.verified = EmailVerification.isVerified(account.getName(), account.getEmail());
                            status.mail = Mailer.configured(ctx.managers.configSettings());
                            status.github = AccessApi.store(() -> AccessPolicy.get().store().githubLinkOf(account.getName())) != null;
                            return status;
                        }),

                RpcMethod.named("accountEmailVerifyStart")
                        .returns("boolean")
                        .doc("Email a six-digit code that confirms the signed-in account's address (" + EmailVerification.SENDS_PER_HOUR
                                + " an hour, one a minute; each works 30 minutes and 5 tries). Fails with the reason.")
                        .handler(call -> {
                            AuthorizedUser account = account(ctx, call);
                            String problem = EmailVerification.get().sendCode(ctx.managers, account.getName(), System.currentTimeMillis());
                            if (problem != null) {
                                throw RpcException.invalidParams(problem);
                            }
                            return true;
                        }),

                RpcMethod.named("accountEmailVerify")
                        .params(of("code", STRING))
                        .returns("boolean")
                        .doc("Confirm the signed-in account's email with the mailed code. False when the code is wrong or has expired.")
                        .handler(call -> {
                            AuthorizedUser account = account(ctx, call);
                            return EmailVerification.get().verify(account.getName(), call.string(0), System.currentTimeMillis());
                        })
        );
    }

    /** The signed-in player's account; refused on servers without accounts. */
    static AuthorizedUser account(ApiContext ctx, RpcCall call) throws RpcException {
        String userName = ctx.sessions.userName(call.sessionId())
                .orElseThrow(() -> RpcException.notAuthorized("Sign in first"));
        if (!AccessApi.accounts(ctx)) {
            throw RpcException.invalidParams("This server has no accounts");
        }
        AuthorizedUser account = AuthorizedUserRepository.getInstance().getByName(userName);
        if (account == null) {
            throw RpcException.invalidParams("There is no account named " + userName);
        }
        return account;
    }
}
