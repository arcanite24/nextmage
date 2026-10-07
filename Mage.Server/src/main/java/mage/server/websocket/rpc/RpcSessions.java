package mage.server.websocket.rpc;

import mage.server.DisconnectReason;
import org.jboss.remoting.callback.InvokerCallbackHandler;

import java.util.Optional;

/**
 * Web client bridge: the session operations the dispatcher needs from the server.
 */
public interface RpcSessions {

    void create(String sessionId, InvokerCallbackHandler callbackHandler, String host);

    boolean exists(String sessionId);

    void disconnect(String sessionId, DisconnectReason reason);

    /**
     * @return name of the user logged in with this session
     */
    Optional<String> userName(String sessionId);
}
