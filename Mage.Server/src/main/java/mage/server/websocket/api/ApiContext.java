package mage.server.websocket.api;

import mage.interfaces.MageServer;
import mage.server.managers.ManagerFactory;
import mage.server.websocket.rpc.RpcSessions;
import mage.server.websocket.service.CardSearchService;
import mage.server.websocket.service.DeckValidationService;

/**
 * Web client bridge: dependencies shared by the RPC method groups.
 */
public final class ApiContext {

    final MageServer server;
    final ManagerFactory managers;
    final RpcSessions sessions;
    final CardSearchService cardSearch = new CardSearchService();
    final DeckValidationService deckValidation = new DeckValidationService();
    final LoginThrottle adminLoginThrottle = new LoginThrottle();
    /**
     * Server admin password; admin login over the bridge is disabled when it is empty.
     */
    final String adminPassword;

    public ApiContext(MageServer server, ManagerFactory managers, RpcSessions sessions) {
        this(server, managers, sessions, "");
    }

    public ApiContext(MageServer server, ManagerFactory managers, RpcSessions sessions, String adminPassword) {
        this.server = server;
        this.managers = managers;
        this.sessions = sessions;
        this.adminPassword = adminPassword == null ? "" : adminPassword;
    }
}
