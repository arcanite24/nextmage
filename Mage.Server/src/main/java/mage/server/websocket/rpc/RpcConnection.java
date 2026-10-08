package mage.server.websocket.rpc;

import org.jboss.remoting.callback.InvokerCallbackHandler;

import java.util.UUID;

/**
 * Web client bridge: what the dispatcher may know about the calling connection.
 */
public interface RpcConnection {

    /**
     * @return the server-issued session bound to this connection, or null before login
     */
    String getSessionId();

    void bindSession(String sessionId);

    /**
     * @return remote IP address, used by the server to identify anonymous users on reconnect
     */
    String getRemoteHost();

    /**
     * @return a callback handler that pushes server events to this connection
     */
    InvokerCallbackHandler createCallbackHandler();

    /**
     * The player answered the open question of a game (see {@link #resendPrompt}).
     */
    default void promptAnswered(UUID gameId) {
    }

    /**
     * Sends the game's unanswered question to this connection again.
     *
     * @return false when no question is waiting for an answer
     */
    default boolean resendPrompt(UUID gameId) {
        return false;
    }
}
