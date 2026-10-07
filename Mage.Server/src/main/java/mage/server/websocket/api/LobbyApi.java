package mage.server.websocket.api;

import mage.cards.decks.DeckCardLists;
import mage.server.websocket.rpc.RpcException;
import mage.server.websocket.rpc.RpcMethod;
import mage.server.websocket.service.OptionsMapper;

import java.util.Arrays;
import java.util.List;

import static mage.server.websocket.rpc.RpcParam.Type.INT;
import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.Type.UUID;
import static mage.server.websocket.rpc.RpcParam.object;
import static mage.server.websocket.rpc.RpcParam.of;
import static mage.server.websocket.rpc.RpcParam.optional;

/**
 * Web client bridge: rooms, tables, seats, decks and chat.
 */
final class LobbyApi {

    private LobbyApi() {
    }

    static List<RpcMethod> methods(ApiContext ctx) {
        RpcMethod deckSubmit = RpcMethod.named("deckSubmit")
                .session(0)
                .params(of("sessionId", STRING), of("tableId", UUID), object("deck", "DeckCardLists"))
                .doc("Submit a deck for a table in construction or sideboarding.")
                .handler(call -> ctx.server.deckSubmit(call.string(0), call.uuid(1), call.object(2, DeckCardLists.class)));

        return Arrays.asList(
                RpcMethod.named("roomGetUsers")
                        .params(of("roomId", UUID))
                        .returns("RoomUsersView[]")
                        .doc("Users and server statistics of a room.")
                        .handler(call -> ctx.server.roomGetUsers(call.uuid(0))),

                RpcMethod.named("roomGetAllTables")
                        .params(of("roomId", UUID))
                        .returns("TableView[]")
                        .doc("All open and running tables of a room.")
                        .handler(call -> ctx.server.roomGetAllTables(call.uuid(0))),

                RpcMethod.named("roomGetTableById")
                        .params(of("roomId", UUID), of("tableId", UUID))
                        .returns("TableView | null")
                        .doc("One table of a room.")
                        .handler(call -> ctx.server.roomGetTableById(call.uuid(0), call.uuid(1))),

                RpcMethod.named("roomGetFinishedMatches")
                        .params(of("roomId", UUID))
                        .returns("MatchView[]")
                        .doc("Recently finished matches of a room.")
                        .handler(call -> ctx.server.roomGetFinishedMatches(call.uuid(0))),

                RpcMethod.named("roomCreateTable")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", UUID), object("options", "WebMatchOptions"))
                        .returns("TableView")
                        .doc("Create a match table. The creator still has to join a seat.")
                        .handler(call -> ctx.server.roomCreateTable(call.string(0), call.uuid(1),
                                OptionsMapper.toMatchOptions(call.jsonObject(2)))),

                RpcMethod.named("roomJoinTable")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", UUID), of("tableId", UUID), of("name", STRING),
                                of("playerType", STRING), of("skill", INT), object("deck", "DeckCardLists"), optional("password", STRING))
                        .doc("Take a seat at a table (yourself or an AI player).")
                        .handler(call -> ctx.server.roomJoinTable(call.string(0), call.uuid(1), call.uuid(2), call.string(3),
                                OptionsMapper.toPlayerType(call.string(4)), call.integer(5),
                                call.object(6, DeckCardLists.class), call.optString(7, ""))),

                RpcMethod.named("roomLeaveTableOrTournament")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", UUID), of("tableId", UUID))
                        .doc("Leave a table or tournament before it starts.")
                        .handler(call -> ctx.server.roomLeaveTableOrTournament(call.string(0), call.uuid(1), call.uuid(2))),

                RpcMethod.named("roomWatchTable")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", UUID), of("tableId", UUID))
                        .doc("Spectate a running match.")
                        .handler(call -> ctx.server.roomWatchTable(call.string(0), call.uuid(1), call.uuid(2))),

                RpcMethod.named("matchStart")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", UUID), of("tableId", UUID))
                        .doc("Start a match once all seats are filled (table owner only).")
                        .handler(call -> ctx.server.matchStart(call.string(0), call.uuid(1), call.uuid(2))),

                RpcMethod.named("tableSwapSeats")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", UUID), of("tableId", UUID), of("seatNum1", INT), of("seatNum2", INT))
                        .doc("Reorder seats (table owner only).")
                        .handler(call -> {
                            ctx.server.tableSwapSeats(call.string(0), call.uuid(1), call.uuid(2), call.integer(3), call.integer(4));
                            return true;
                        }),

                RpcMethod.named("tableRemove")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", UUID), of("tableId", UUID))
                        .doc("Remove a table (table owner only).")
                        .handler(call -> {
                            ctx.server.tableRemove(call.string(0), call.uuid(1), call.uuid(2));
                            return true;
                        }),

                RpcMethod.named("tableIsOwner")
                        .session(0)
                        .params(of("sessionId", STRING), of("roomId", UUID), of("tableId", UUID))
                        .doc("Whether the caller owns the table.")
                        .handler(call -> ctx.server.tableIsOwner(call.string(0), call.uuid(1), call.uuid(2))),

                deckSubmit,
                deckSubmit.alias("submitDeck"),

                RpcMethod.named("deckSave")
                        .session(0)
                        .params(of("sessionId", STRING), of("tableId", UUID), object("deck", "DeckCardLists"))
                        .doc("Save the in-progress limited deck without submitting it.")
                        .handler(call -> {
                            ctx.server.deckSave(call.string(0), call.uuid(1), call.object(2, DeckCardLists.class));
                            return true;
                        }),

                RpcMethod.named("chatJoin")
                        .session(1)
                        .params(of("chatId", UUID), of("sessionId", STRING), optional("userName", STRING))
                        .doc("Subscribe to a chat.")
                        .handler(call -> {
                            ctx.server.chatJoin(call.uuid(0), call.string(1), call.optString(2, ""));
                            return true;
                        }),

                RpcMethod.named("chatLeave")
                        .session(1)
                        .params(of("chatId", UUID), of("sessionId", STRING))
                        .doc("Unsubscribe from a chat.")
                        .handler(call -> {
                            ctx.server.chatLeave(call.uuid(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("chatSendMessage")
                        .params(of("chatId", UUID), optional("userName", STRING), of("message", STRING))
                        .doc("Post to a chat as the logged in user. userName is ignored; the session decides the author.")
                        .handler(call -> {
                            String userName = ctx.sessions.userName(call.sessionId())
                                    .orElseThrow(() -> RpcException.notAuthorized("Log in before chatting"));
                            ctx.server.chatSendMessage(call.uuid(0), userName, call.string(2));
                            return true;
                        }),

                RpcMethod.named("chatFindByGame")
                        .params(of("gameId", UUID))
                        .returns("UUID | null")
                        .doc("Chat of a game.")
                        .handler(call -> ctx.server.chatFindByGame(call.uuid(0))),

                RpcMethod.named("chatFindByTable")
                        .params(of("tableId", UUID))
                        .returns("UUID | null")
                        .doc("Chat of a table.")
                        .handler(call -> ctx.server.chatFindByTable(call.uuid(0))),

                RpcMethod.named("chatFindByTournament")
                        .params(of("tournamentId", UUID))
                        .returns("UUID | null")
                        .doc("Chat of a tournament.")
                        .handler(call -> ctx.server.chatFindByTournament(call.uuid(0))),

                RpcMethod.named("chatFindByRoom")
                        .params(of("roomId", UUID))
                        .returns("UUID | null")
                        .doc("Chat of a room.")
                        .handler(call -> ctx.server.chatFindByRoom(call.uuid(0)))
        );
    }
}
