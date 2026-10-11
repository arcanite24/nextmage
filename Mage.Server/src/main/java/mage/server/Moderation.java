package mage.server;

import mage.interfaces.callback.ClientCallback;
import mage.interfaces.callback.ClientCallbackMethod;
import mage.server.managers.ManagerFactory;
import mage.util.ThreadUtils;
import mage.utils.SystemUtil;
import mage.view.ChatMessage;
import mage.view.ChatMessage.MessageColor;
import mage.view.UserView;
import org.apache.log4j.Logger;

import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Staff actions on players and tables, for staff signed in on their own player session as well as the admin console.
 * A mute or a lock reaches the account whether its player is online or not; zero minutes lifts it.
 */
public final class Moderation {

    private static final Logger logger = Logger.getLogger(Moderation.class);

    private final ManagerFactory managers;

    public Moderation(ManagerFactory managers) {
        this.managers = managers;
    }

    public List<UserView> users() {
        return managers.userManager().getUserInfoList();
    }

    /**
     * @return when the mute ends, or null when it was lifted
     */
    public Date mute(String userName, long minutes) {
        Date until = minutes > 0 ? new Date(System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(minutes)) : null;
        Optional<User> online = managers.userManager().getUserByName(userName);
        if (online.isPresent()) {
            online.get().setChatLockedUntil(until);
            online.get().showUserMessage("Staff", until == null ? "You can chat again."
                    : "You were muted for chat messages until " + SystemUtil.dateFormat.format(until) + '.');
        } else {
            AuthorizedUser account = account(userName);
            account.chatLockedUntil = until;
            AuthorizedUserRepository.getInstance().update(account);
        }
        return until;
    }

    /**
     * Locks the account out (signing its player out) or, with zero minutes, lets it back in.
     */
    public Date lock(String userName, long minutes) {
        Date until = minutes > 0 ? new Date(System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(minutes)) : null;
        Optional<User> online = managers.userManager().getUserByName(userName);
        AuthorizedUser account = AuthorizedUserRepository.getInstance().getByName(userName);
        if (online.isPresent()) {
            online.get().setLockedUntil(until);
            if (until != null) {
                signOut(online.get(), "Your account was locked until " + SystemUtil.dateFormat.format(until) + '.');
            }
        } else if (account != null) {
            account.lockedUntil = until;
            AuthorizedUserRepository.getInstance().update(account);
        } else {
            throw new IllegalArgumentException("There is no account named " + userName);
        }
        return until;
    }

    /**
     * Deactivates the account (signing its player out) or activates it again.
     */
    public void setActive(String userName, boolean active) {
        Optional<User> online = managers.userManager().getUserByName(userName);
        if (online.isPresent()) {
            online.get().setActive(active);
            if (!active) {
                signOut(online.get(), "Your account was deactivated.");
            }
            return;
        }
        AuthorizedUser account = account(userName);
        account.active = active;
        AuthorizedUserRepository.getInstance().update(account);
    }

    /**
     * Signs a player's session out. False when there is no such session.
     */
    public boolean disconnect(String userSessionId) {
        Optional<User> user = managers.sessionManager().getUser(userSessionId);
        if (!user.isPresent()) {
            return false;
        }
        signOut(user.get(), "You were signed out by the server's staff.");
        return true;
    }

    public String sessionUserName(String userSessionId) {
        return managers.sessionManager().getUser(userSessionId).map(User::getName).orElse(null);
    }

    public boolean removeTable(UUID tableId) {
        return managers.tableManager().removeTableByStaff(tableId);
    }

    /**
     * Opens a running game for a staff member's own player session to watch.
     *
     * @return the game, or null when the table has no running game or the staff member plays in it
     */
    public UUID watchTable(String staffSessionId, UUID tableId) {
        User user = managers.sessionManager().getUser(staffSessionId)
                .orElseThrow(() -> new IllegalStateException("Watch from your player session: sign in to the app as yourself"));
        return managers.tableManager().getController(tableId)
                .map(controller -> controller.watchTableAsStaff(user.getId()))
                .orElse(null);
    }

    /** Every connected player sees it; a message starting with "warn" shows in red. */
    public void broadcast(String message) {
        MessageColor color = message.toLowerCase(Locale.ENGLISH).startsWith("warn") ? MessageColor.RED : MessageColor.BLUE;
        for (User user : managers.userManager().getUsers()) {
            user.fireCallback(new ClientCallback(ClientCallbackMethod.SERVER_MESSAGE, null, new ChatMessage("SERVER", message, null, null, color)));
        }
    }

    private AuthorizedUser account(String userName) {
        AuthorizedUser account = AuthorizedUserRepository.getInstance().getByName(userName);
        if (account == null) {
            throw new IllegalArgumentException("There is no account named " + userName + ", and nobody by that name is online");
        }
        return account;
    }

    private void signOut(User user, String message) {
        String sessionId = user.getSessionId();
        user.showUserMessage("Signed out", message);
        logger.info(user.getName() + " signed out by staff");
        managers.threadExecutor().getCallExecutor().execute(() -> {
            ThreadUtils.sleep(1000); // time for the message to arrive
            managers.sessionManager().disconnect(sessionId, DisconnectReason.DisconnectedByAdmin, true);
        });
    }
}
