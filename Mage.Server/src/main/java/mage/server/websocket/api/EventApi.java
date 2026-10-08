package mage.server.websocket.api;

import com.google.gson.JsonElement;
import mage.cards.decks.DeckCardLists;
import mage.server.websocket.rpc.RpcException;
import mage.server.websocket.rpc.RpcMethod;
import mage.server.websocket.service.OptionsMapper;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static mage.server.websocket.rpc.RpcParam.Type.ARRAY;
import static mage.server.websocket.rpc.RpcParam.Type.INT;
import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.object;
import static mage.server.websocket.rpc.RpcParam.of;
import static mage.server.websocket.rpc.RpcParam.optional;

/**
 * Web client bridge: tournaments and drafts.
 */
final class EventApi {

    private EventApi() {
    }

    static List<RpcMethod> methods(ApiContext ctx) {
        return Arrays.asList(
                RpcMethod.named("roomCreateTournament")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", uuid()), object("options", "WebTournamentOptions"))
                        .returns("TableView")
                        .doc("Create a tournament table.")
                        .handler(call -> ctx.server.roomCreateTournament(call.string(0), call.uuid(1),
                                OptionsMapper.toTournamentOptions(call.jsonObject(2)))),

                RpcMethod.named("roomJoinTournament")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", uuid()), of("tableId", uuid()), of("name", STRING),
                                of("playerType", STRING), of("skill", INT), object("deck", "DeckCardLists"), optional("password", STRING))
                        .doc("Join a tournament (yourself or an AI player).")
                        .handler(call -> ctx.server.roomJoinTournament(call.string(0), call.uuid(1), call.uuid(2), call.string(3),
                                OptionsMapper.toPlayerType(call.string(4)), call.integer(5),
                                call.object(6, DeckCardLists.class), call.optString(7, ""))),

                RpcMethod.named("roomWatchTournament")
                        .session(0)
                        .params(of("sessionId", STRING), of("tableId", uuid()))
                        .doc("Spectate a tournament.")
                        .handler(call -> ctx.server.roomWatchTournament(call.string(0), call.uuid(1))),

                RpcMethod.named("tournamentStart")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", uuid()), of("tableId", uuid()))
                        .doc("Start a tournament (owner only).")
                        .handler(call -> ctx.server.tournamentStart(call.string(0), call.uuid(1), call.uuid(2))),

                RpcMethod.named("tournamentJoin")
                        .session(1)
                        .params(of("tournamentId", uuid()), of("sessionId", STRING))
                        .doc("Open a started tournament (after START_TOURNAMENT).")
                        .handler(call -> {
                            ctx.server.tournamentJoin(call.uuid(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("tournamentQuit")
                        .session(1)
                        .params(of("tournamentId", uuid()), of("sessionId", STRING))
                        .doc("Leave a running tournament.")
                        .handler(call -> {
                            ctx.server.tournamentQuit(call.uuid(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("tournamentFindById")
                        .params(of("tournamentId", uuid()))
                        .returns("TournamentView | null")
                        .doc("Tournament standings and rounds.")
                        .handler(call -> ctx.server.tournamentFindById(call.uuid(0))),

                RpcMethod.named("draftJoin")
                        .session(1)
                        .params(of("draftId", uuid()), of("sessionId", STRING))
                        .doc("Open a started draft (after START_DRAFT).")
                        .handler(call -> {
                            ctx.server.draftJoin(call.uuid(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("draftQuit")
                        .session(1)
                        .params(of("draftId", uuid()), of("sessionId", STRING))
                        .doc("Leave a running draft.")
                        .handler(call -> {
                            ctx.server.draftQuit(call.uuid(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("sendDraftCardPick")
                        .session(1)
                        .params(of("draftId", uuid()), of("sessionId", STRING), of("cardId", uuid()), optional("hiddenCards", ARRAY).typed("UUID[]"))
                        .returns("DraftPickView | null")
                        .doc("Pick a card from the current booster.")
                        .handler(call -> {
                            Set<UUID> hiddenCards = new HashSet<>();
                            if (call.has(3)) {
                                for (JsonElement id : call.jsonArray(3)) {
                                    try {
                                        hiddenCards.add(UUID.fromString(id.getAsString()));
                                    } catch (RuntimeException e) {
                                        throw RpcException.invalidParams("hiddenCards must contain card ids");
                                    }
                                }
                            }
                            return ctx.server.sendDraftCardPick(call.uuid(0), call.string(1), call.uuid(2), hiddenCards);
                        }),

                RpcMethod.named("sendDraftCardMark")
                        .session(1)
                        .params(of("draftId", uuid()), of("sessionId", STRING), optional("cardId", uuid()))
                        .doc("Mark (or unmark with null) the card to auto-pick when the timer runs out.")
                        .handler(call -> {
                            ctx.server.sendDraftCardMark(call.uuid(0), call.string(1), call.optUuid(2));
                            return true;
                        }),

                RpcMethod.named("draftSetBoosterLoaded")
                        .session(1)
                        .params(of("draftId", uuid()), of("sessionId", STRING))
                        .doc("Tell the server the booster is on screen, so the pick timer may start.")
                        .handler(call -> {
                            ctx.server.draftSetBoosterLoaded(call.uuid(0), call.string(1));
                            return true;
                        })
        );
    }

    private static mage.server.websocket.rpc.RpcParam.Type uuid() {
        return mage.server.websocket.rpc.RpcParam.Type.UUID;
    }
}
