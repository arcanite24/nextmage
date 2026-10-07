package mage.server.websocket.api;

import mage.server.websocket.rpc.RpcDispatcher;

/**
 * Web client bridge: every RPC method the web client can call.
 */
public final class WebClientApi {

    private WebClientApi() {
    }

    public static RpcDispatcher createDispatcher(ApiContext ctx) {
        RpcDispatcher dispatcher = new RpcDispatcher(ctx.sessions);
        dispatcher.registerAll(SessionApi.methods(ctx));
        dispatcher.registerAll(CatalogApi.methods(ctx));
        dispatcher.registerAll(LobbyApi.methods(ctx));
        dispatcher.registerAll(GameApi.methods(ctx));
        dispatcher.registerAll(EventApi.methods(ctx));
        dispatcher.registerAll(AdminApi.methods(ctx));
        return dispatcher;
    }
}
