package mage.server.websocket.api;

import mage.interfaces.MageServer;
import mage.server.managers.ManagerFactory;
import mage.server.websocket.rpc.RpcSessions;
import mage.server.websocket.service.CardSearchService;
import mage.server.websocket.service.DeckValidationService;
import mage.server.websocket.service.deckimport.DeckImportService;

/**
 * Web client bridge: dependencies shared by the RPC method groups.
 */
public final class ApiContext {

    final MageServer server;
    final ManagerFactory managers;
    final RpcSessions sessions;
    final CardSearchService cardSearch = new CardSearchService();
    final DeckValidationService deckValidation = new DeckValidationService();
    final DeckImportService deckImport = new DeckImportService();

    public ApiContext(MageServer server, ManagerFactory managers, RpcSessions sessions) {
        this.server = server;
        this.managers = managers;
        this.sessions = sessions;
    }
}
