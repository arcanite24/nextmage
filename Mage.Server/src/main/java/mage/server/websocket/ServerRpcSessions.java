package mage.server.websocket;

import mage.server.DisconnectReason;
import mage.server.User;
import mage.server.managers.ManagerFactory;
import mage.server.websocket.rpc.RpcSessions;
import org.jboss.remoting.callback.InvokerCallbackHandler;

import java.util.Optional;

/**
 * Web client bridge: sessions are regular server sessions, created with a WebSocket callback handler.
 */
final class ServerRpcSessions implements RpcSessions {

    private final ManagerFactory managers;

    ServerRpcSessions(ManagerFactory managers) {
        this.managers = managers;
    }

    @Override
    public void create(String sessionId, InvokerCallbackHandler callbackHandler, String host) {
        managers.sessionManager().createSession(sessionId, callbackHandler);
        // anonymous users are identified by host on reconnect, like desktop clients
        managers.sessionManager().getSession(sessionId).ifPresent(session -> session.setHost(host));
    }

    @Override
    public boolean exists(String sessionId) {
        return managers.sessionManager().getSession(sessionId).isPresent();
    }

    @Override
    public void disconnect(String sessionId, DisconnectReason reason) {
        managers.sessionManager().disconnect(sessionId, reason, true);
    }

    @Override
    public Optional<String> userName(String sessionId) {
        return managers.sessionManager().getSession(sessionId)
                .flatMap(session -> managers.userManager().getUser(session.getUserId()))
                .map(User::getName);
    }
}
