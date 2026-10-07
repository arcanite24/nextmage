package mage.server.websocket.api;

import mage.cards.decks.DeckCardLists;
import mage.cards.repository.CardCriteria;
import mage.server.websocket.rpc.RpcMethod;

import java.util.Arrays;
import java.util.List;

import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.object;
import static mage.server.websocket.rpc.RpcParam.of;
import static mage.server.websocket.rpc.RpcParam.optional;

/**
 * Web client bridge: server state, game/deck/tournament types, sets, card search and deck validation.
 */
final class CatalogApi {

    private CatalogApi() {
    }

    static List<RpcMethod> methods(ApiContext ctx) {
        return Arrays.asList(
                RpcMethod.named("serverGetMainRoomId")
                        .publicAccess()
                        .returns("UUID")
                        .doc("Id of the main lobby room.")
                        .handler(call -> ctx.server.serverGetMainRoomId()),

                RpcMethod.named("serverGetPromotionMessages")
                        .optionalSession(0)
                        .params(optional("sessionId", STRING))
                        .returns("unknown")
                        .doc("Server news shown after login.")
                        .handler(call -> ctx.server.serverGetPromotionMessages(call.optString(0, ""))),

                RpcMethod.named("getServerState")
                        .publicAccess()
                        .returns("ServerState")
                        .doc("Server version and every game, tournament, player and deck type. Also used as a status probe.")
                        .handler(call -> ctx.server.getServerState()),

                RpcMethod.named("getGameTypes")
                        .publicAccess()
                        .returns("GameTypeView[]")
                        .doc("Match game types.")
                        .handler(call -> ctx.server.getServerState().getGameTypes()),

                RpcMethod.named("getTournamentGameTypes")
                        .publicAccess()
                        .returns("GameTypeView[]")
                        .doc("Game types usable in tournaments.")
                        .handler(call -> ctx.server.getServerState().getTournamentGameTypes()),

                RpcMethod.named("getTournamentTypes")
                        .publicAccess()
                        .returns("TournamentTypeView[]")
                        .doc("Tournament types.")
                        .handler(call -> ctx.server.getServerState().getTournamentTypes()),

                RpcMethod.named("getPlayerTypes")
                        .publicAccess()
                        .returns("string[]")
                        .doc("Seat types (human and AI players).")
                        .handler(call -> ctx.server.getServerState().getPlayerTypes()),

                RpcMethod.named("getDeckTypes")
                        .publicAccess()
                        .returns("string[]")
                        .doc("Deck formats.")
                        .handler(call -> ctx.server.getServerState().getDeckTypes()),

                RpcMethod.named("getDraftCubes")
                        .publicAccess()
                        .returns("string[]")
                        .doc("Cubes available for cube drafts.")
                        .handler(call -> ctx.server.getServerState().getDraftCubes()),

                RpcMethod.named("getExpansionSets")
                        .publicAccess()
                        .returns("ExpansionSetInfo[]")
                        .doc("All card sets.")
                        .handler(call -> ctx.cardSearch.expansionSets()),

                RpcMethod.named("getBasicLandSets")
                        .publicAccess()
                        .returns("BasicLandSetInfo[]")
                        .doc("Sets with basic lands, newest first.")
                        .handler(call -> ctx.cardSearch.basicLandSets()),

                RpcMethod.named("searchCards")
                        .params(object("criteria", "CardCriteria"))
                        .returns("CardView[]")
                        .doc("Search the card database (paged with start/count, at most 1000 per page).")
                        .handler(call -> ctx.cardSearch.search(call.object(0, CardCriteria.class))),

                RpcMethod.named("deckValidate")
                        .params(of("deckType", STRING), object("deck", "DeckCardLists"))
                        .returns("DeckValidationResult")
                        .doc("Check a deck against a format, with EDH power level and Commander brackets.")
                        .handler(call -> ctx.deckValidation.validate(call.string(0), call.object(1, DeckCardLists.class)))
        );
    }
}
