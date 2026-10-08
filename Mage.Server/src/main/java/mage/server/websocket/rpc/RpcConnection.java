package mage.server.websocket.rpc;

import org.jboss.remoting.callback.InvokerCallbackHandler;

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
}
