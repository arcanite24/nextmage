package mage.server;

import mage.server.managers.ManagerFactory;
import org.apache.log4j.Logger;

/**
 * Password resets by emailed code, shared by the desktop protocol and the web client bridge. Methods return null when
 * they worked, or the reason they didn't, for the caller to show.
 */
public final class AccountService {

    private static final Logger logger = Logger.getLogger(AccountService.class);

    /** the reason when no account has the address; the web client doesn't tell, so addresses can't be probed */
    public static final String NO_SUCH_EMAIL = "No user was found with that email address";

    // one set of pending codes for every caller, so a code asked for in one client works in the other
    private static final ResetTokens TOKENS = new ResetTokens();

    private final ManagerFactory managers;

    public AccountService(ManagerFactory managers) {
        this.managers = managers;
    }

    public String sendResetCode(String email) {
        if (!managers.configSettings().isAuthenticationActivated()) {
            return Session.REGISTRATION_DISABLED_MESSAGE;
        }
        AuthorizedUser user = email == null ? null : AuthorizedUserRepository.getInstance().getByEmail(email.trim());
        if (user == null) {
            logger.info("Password reset code asked for an address without an account");
            return NO_SUCH_EMAIL;
        }
        String code = TOKENS.issue(email, System.currentTimeMillis());
        String server = managers.configSettings().getServerName();
        String subject = "Password reset code" + (server == null || server.trim().isEmpty() ? "" : " for " + server.trim());
        String text = "Use this code to reset " + user.getName() + "'s password: " + code + '\n'
                + "It works for " + (ResetTokens.VALID_MILLIS / 60000) + " minutes and " + ResetTokens.ATTEMPTS + " tries."
                + " If you didn't ask for it, ignore this email.";
        boolean sent = !managers.configSettings().getMailUser().isEmpty()
                ? managers.mailClient().sendMessage(user.email, subject, text)
                : managers.mailgunClient().sendMessage(user.email, subject, text);
        if (!sent) {
            if (Main.isTestMode()) {
                logger.info("Test mode, email failed: the password reset code for " + user.getName() + " is " + code);
                return null;
            }
            return "The server couldn't send the email. Try again later or ask the server's admin.";
        }
        return null;
    }

    public String resetPassword(String email, String code, String password) {
        if (!managers.configSettings().isAuthenticationActivated()) {
            return Session.REGISTRATION_DISABLED_MESSAGE;
        }
        AuthorizedUser user = email == null ? null : AuthorizedUserRepository.getInstance().getByEmail(email.trim());
        if (user == null) {
            // same answer as a wrong code
            return "That code is wrong or has expired. Ask for a new one.";
        }
        // checked before the code, so a weak password doesn't use the code up
        String problem = Session.passwordProblem(managers.configSettings(), password, user.getName());
        if (problem != null) {
            return problem;
        }
        if (!TOKENS.redeem(email, code, System.currentTimeMillis())) {
            logger.info("Wrong or expired password reset code for " + user.getName());
            return "That code is wrong or has expired. Ask for a new one.";
        }
        // the new password only: locks, the active flag and the email stay as they were
        if (!AuthorizedUserRepository.getInstance().changePassword(user.getName(), password)) {
            return "The password couldn't be changed. Try again.";
        }
        logger.info("Password reset for " + user.getName());
        return null;
    }
}
