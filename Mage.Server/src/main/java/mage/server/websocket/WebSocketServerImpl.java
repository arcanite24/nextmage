package mage.server.websocket;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;
import mage.interfaces.MageServer;
import mage.server.managers.ManagerFactory;
import mage.server.DisconnectReason;
import mage.utils.MageVersion;
import mage.cards.decks.DeckCardLists;
import mage.constants.ManaType;
import mage.constants.MatchBufferTime;
import mage.constants.MatchTimeLimit;
import mage.constants.PlayerAction;
import mage.constants.SkillLevel;
import mage.game.match.MatchOptions;
import mage.game.tournament.TournamentOptions;
import mage.players.PlayerType;
import mage.players.net.UserData;
import org.apache.log4j.Logger;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.lang.reflect.Type;
import java.net.InetSocketAddress;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public class WebSocketServerImpl extends WebSocketServer {
    private static final Logger logger = Logger.getLogger(WebSocketServerImpl.class);
    private final MageServer mageServer;
    private final ManagerFactory managerFactory;
    
    // Custom Gson with UUID serialization as strings
    private final Gson gson = new GsonBuilder()
        .registerTypeAdapter(UUID.class, new JsonSerializer<UUID>() {
            @Override
            public JsonElement serialize(UUID src, Type typeOfSrc, JsonSerializationContext context) {
                return src == null ? null : new JsonPrimitive(src.toString());
            }
        })
        .registerTypeAdapter(UUID.class, new JsonDeserializer<UUID>() {
            @Override
            public UUID deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context) {
                return json == null ? null : UUID.fromString(json.getAsString());
            }
        })
        .create();

    public WebSocketServerImpl(InetSocketAddress address, MageServer mageServer, ManagerFactory managerFactory) {
        super(address);
        this.mageServer = mageServer;
        this.managerFactory = managerFactory;
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        logger.info("New WebSocket connection: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        logger.info("Closed WebSocket connection: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            JsonObject json = JsonParser.parseString(message).getAsJsonObject();
            String method = json.has("method") ? json.get("method").getAsString() : "";
            JsonElement id = json.get("id");
            JsonArray params = json.has("params") ? json.get("params").getAsJsonArray() : new JsonArray();

            Object result = null;

            if ("ping".equals(method)) {
                result = true;
            } else if ("authRegister".equals(method)) {
                // sessionId, userName, password, email
                String sessionId = params.get(0).getAsString();
                String userName = params.get(1).getAsString();
                String password = params.get(2).getAsString();
                String email = params.get(3).getAsString();
                
                // Ensure session exists
                if (managerFactory.sessionManager().getSession(sessionId).isPresent()) {
                    managerFactory.sessionManager().disconnect(sessionId, DisconnectReason.LostConnection, false);
                }
                managerFactory.sessionManager().createSession(sessionId, new WebSocketCallbackHandler(conn));
                
                result = mageServer.authRegister(sessionId, userName, password, email);
                
            } else if ("connectUser".equals(method)) {
                 // userName, password, sessionId, restoreSessionId, version (obj), userIdStr
                 // We accept simplified version args from JSON: versionMajor, versionMinor, ...?
                 // Or just assume server version for now if passed "match"?
                 
                 String userName = params.get(0).getAsString();
                 String password = params.get(1).getAsString();
                 String sessionId = params.get(2).getAsString();
                 String restoreSessionId = params.size() > 3 ? params.get(3).getAsString() : "";
                 // skipping version construction for a moment, assuming we can reconstruct it
                 // Or we cheat and use Main.getVersion() if client says "match"
                 
                 MageVersion version = new MageVersion(mage.server.Main.class); // Use server version effectively
                 String userIdStr = params.size() > 5 ? params.get(5).getAsString() : "";
                 
                 // Register session handler if not exists
                 if (managerFactory.sessionManager().getSession(sessionId).isPresent()) {
                     managerFactory.sessionManager().disconnect(sessionId, DisconnectReason.LostConnection, false);
                 }
                 managerFactory.sessionManager().createSession(sessionId, new WebSocketCallbackHandler(conn));
                 
                 result = mageServer.connectUser(userName, password, sessionId, restoreSessionId, version, userIdStr);
            }

            else if ("roomGetUsers".equals(method)) {
                UUID roomId = UUID.fromString(params.get(0).getAsString());
                result = mageServer.roomGetUsers(roomId);

            } else if ("roomGetAllTables".equals(method)) {
                UUID roomId = UUID.fromString(params.get(0).getAsString());
                result = mageServer.roomGetAllTables(roomId);

            } else if ("roomCreateTable".equals(method)) {
                String sessionId = params.get(0).getAsString();
                UUID roomId = UUID.fromString(params.get(1).getAsString());
                
                logger.info("roomCreateTable called - sessionId: " + sessionId + ", roomId: " + roomId);
                
                // Manually construct MatchOptions since Gson can't handle the parameterized constructor
                JsonObject optionsJson = params.get(2).getAsJsonObject();
                logger.info("roomCreateTable options JSON: " + optionsJson.toString());
                
                String tableName = optionsJson.has("name") ? optionsJson.get("name").getAsString() : "Game";
                String gameType = optionsJson.has("gameType") ? optionsJson.get("gameType").getAsString() : "Two Player Duel";
                boolean multiPlayer = gameType.contains("Free For All") || gameType.contains("Commander");
                
                logger.info("roomCreateTable - tableName: " + tableName + ", gameType: " + gameType + ", multiPlayer: " + multiPlayer);
                
                MatchOptions matchOptions = new MatchOptions(tableName, gameType, multiPlayer);
                
                if (optionsJson.has("deckType")) {
                    matchOptions.setDeckType(optionsJson.get("deckType").getAsString());
                }
                if (optionsJson.has("winsNeeded")) {
                    matchOptions.setWinsNeeded(optionsJson.get("winsNeeded").getAsInt());
                }
                if (optionsJson.has("freeMulligans")) {
                    matchOptions.setFreeMulligans(optionsJson.get("freeMulligans").getAsInt());
                }
                if (optionsJson.has("password") && !optionsJson.get("password").isJsonNull()) {
                    matchOptions.setPassword(optionsJson.get("password").getAsString());
                }
                if (optionsJson.has("limited")) {
                    matchOptions.setLimited(optionsJson.get("limited").getAsBoolean());
                }
                if (optionsJson.has("rated")) {
                    matchOptions.setRated(optionsJson.get("rated").getAsBoolean());
                }
                if (optionsJson.has("rollbackTurnsAllowed")) {
                    matchOptions.setRollbackTurnsAllowed(optionsJson.get("rollbackTurnsAllowed").getAsBoolean());
                }
                if (optionsJson.has("spectatorsAllowed")) {
                    matchOptions.setSpectatorsAllowed(optionsJson.get("spectatorsAllowed").getAsBoolean());
                }
                if (optionsJson.has("matchTimeLimit")) {
                    try {
                        matchOptions.setMatchTimeLimit(MatchTimeLimit.valueOf(optionsJson.get("matchTimeLimit").getAsString()));
                    } catch (IllegalArgumentException e) {
                        logger.warn("Invalid matchTimeLimit: " + optionsJson.get("matchTimeLimit").getAsString());
                    }
                }
                if (optionsJson.has("matchBufferTime")) {
                    try {
                        matchOptions.setMatchBufferTime(MatchBufferTime.valueOf(optionsJson.get("matchBufferTime").getAsString()));
                    } catch (IllegalArgumentException e) {
                        logger.warn("Invalid matchBufferTime: " + optionsJson.get("matchBufferTime").getAsString());
                    }
                }
                if (optionsJson.has("skillLevel")) {
                    try {
                        matchOptions.setSkillLevel(SkillLevel.valueOf(optionsJson.get("skillLevel").getAsString()));
                    } catch (IllegalArgumentException e) {
                        logger.warn("Invalid skillLevel: " + optionsJson.get("skillLevel").getAsString());
                    }
                }
                
                // Add player type for the creator
                matchOptions.getPlayerTypes().add(PlayerType.HUMAN);
                // Add second player slot (will be filled when someone joins)
                matchOptions.getPlayerTypes().add(PlayerType.HUMAN);
                
                logger.info("roomCreateTable - MatchOptions created: name=" + matchOptions.getName() + 
                    ", gameType=" + matchOptions.getGameType() + 
                    ", deckType=" + matchOptions.getDeckType() +
                    ", winsNeeded=" + matchOptions.getWinsNeeded() +
                    ", playerTypes=" + matchOptions.getPlayerTypes().size());
                
                try {
                    result = mageServer.roomCreateTable(sessionId, roomId, matchOptions);
                    logger.info("roomCreateTable - result: " + (result != null ? result.toString() : "null"));
                } catch (Exception e) {
                    logger.error("roomCreateTable - Exception: " + e.getMessage(), e);
                    throw e;
                }

            } else if ("roomJoinTable".equals(method)) {
                String sessionId = params.get(0).getAsString();
                UUID roomId = UUID.fromString(params.get(1).getAsString());
                UUID tableId = UUID.fromString(params.get(2).getAsString());
                String name = params.get(3).getAsString();
                PlayerType playerType = PlayerType.getByDescription(params.get(4).getAsString());
                int skill = params.get(5).getAsInt();
                DeckCardLists deckList = gson.fromJson(params.get(6), DeckCardLists.class);
                String password = params.size() > 7 ? params.get(7).getAsString() : "";
                result = mageServer.roomJoinTable(sessionId, roomId, tableId, name, playerType, skill, deckList, password);

            } else if ("roomLeaveTableOrTournament".equals(method)) { // Unified leave
                String sessionId = params.get(0).getAsString();
                UUID roomId = UUID.fromString(params.get(1).getAsString());
                UUID tableId = UUID.fromString(params.get(2).getAsString());
                result = mageServer.roomLeaveTableOrTournament(sessionId, roomId, tableId);

            } else if ("roomWatchTable".equals(method)) {
                String sessionId = params.get(0).getAsString();
                UUID roomId = UUID.fromString(params.get(1).getAsString());
                UUID tableId = UUID.fromString(params.get(2).getAsString());
                result = mageServer.roomWatchTable(sessionId, roomId, tableId);
            
            } else if ("roomWatchTournament".equals(method)) {
                 String sessionId = params.get(0).getAsString();
                 UUID tableId = UUID.fromString(params.get(1).getAsString());
                 result = mageServer.roomWatchTournament(sessionId, tableId);

            } else if ("chatJoin".equals(method)) {
                UUID chatId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                String userName = params.get(2).getAsString();
                mageServer.chatJoin(chatId, sessionId, userName);
                result = true;

            } else if ("chatSendMessage".equals(method)) {
                UUID chatId = UUID.fromString(params.get(0).getAsString());
                String userName = params.get(1).getAsString();
                String msg = params.get(2).getAsString();
                mageServer.chatSendMessage(chatId, userName, msg);
                result = true;

            } else if ("chatLeave".equals(method)) {
                UUID chatId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.chatLeave(chatId, sessionId);
                result = true;

            } else if ("matchStart".equals(method)) {
                String sessionId = params.get(0).getAsString();
                UUID roomId = UUID.fromString(params.get(1).getAsString());
                UUID tableId = UUID.fromString(params.get(2).getAsString());
                result = mageServer.matchStart(sessionId, roomId, tableId);

            } else if ("matchQuit".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.matchQuit(gameId, sessionId);
                result = true;

            } else if ("gameJoin".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.gameJoin(gameId, sessionId);
                result = true;
            
            } else if ("gameWatchStart".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                result = mageServer.gameWatchStart(gameId, sessionId);
            
            } else if ("gameWatchStop".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.gameWatchStop(gameId, sessionId);
                result = true;

            } else if ("sendPlayerUUID".equals(method)) {
                 UUID gameId = UUID.fromString(params.get(0).getAsString());
                 String sessionId = params.get(1).getAsString();
                 UUID data = UUID.fromString(params.get(2).getAsString());
                 mageServer.sendPlayerUUID(gameId, sessionId, data);
                 result = true;

            } else if ("sendPlayerString".equals(method)) {
                 UUID gameId = UUID.fromString(params.get(0).getAsString());
                 String sessionId = params.get(1).getAsString();
                 String data = params.get(2).getAsString();
                 mageServer.sendPlayerString(gameId, sessionId, data);
                 result = true;

            } else if ("sendPlayerBoolean".equals(method)) {
                 UUID gameId = UUID.fromString(params.get(0).getAsString());
                 String sessionId = params.get(1).getAsString();
                 Boolean data = params.get(2).getAsBoolean();
                 mageServer.sendPlayerBoolean(gameId, sessionId, data);
                 result = true;

            } else if ("sendPlayerInteger".equals(method)) {
                 UUID gameId = UUID.fromString(params.get(0).getAsString());
                 String sessionId = params.get(1).getAsString();
                 Integer data = params.get(2).getAsInt();
                 mageServer.sendPlayerInteger(gameId, sessionId, data);
                 result = true;

            } else if ("sendPlayerManaType".equals(method)) {
                 UUID gameId = UUID.fromString(params.get(0).getAsString());
                 UUID playerId = UUID.fromString(params.get(1).getAsString());
                 String sessionId = params.get(2).getAsString();
                 ManaType data = ManaType.valueOf(params.get(3).getAsString());
                 mageServer.sendPlayerManaType(gameId, playerId, sessionId, data);
                 result = true;

            } else if ("sendPlayerAction".equals(method)) {
                 PlayerAction action = PlayerAction.valueOf(params.get(0).getAsString());
                 UUID gameId = UUID.fromString(params.get(1).getAsString());
                 String sessionId = params.get(2).getAsString();
                 // data is optional or polymorphic
                 Object data = null;
                 if (params.size() > 3 && !params.get(3).isJsonNull()) {
                     JsonElement dataElem = params.get(3);
                     if (dataElem.isJsonPrimitive()) {
                         if (dataElem.getAsJsonPrimitive().isString()) {
                             String dataStr = dataElem.getAsString();
                             try {
                                 data = UUID.fromString(dataStr);
                             } catch (IllegalArgumentException e) {
                                 data = dataStr;
                             }
                         } else if (dataElem.getAsJsonPrimitive().isNumber()) {
                             data = dataElem.getAsInt();
                         } else if (dataElem.getAsJsonPrimitive().isBoolean()) {
                             data = dataElem.getAsBoolean();
                         }
                     }
                 }
                 mageServer.sendPlayerAction(action, gameId, sessionId, data);
                 result = true;
             
             } else if ("cheatShow".equals(method)) {
                 UUID gameId = UUID.fromString(params.get(0).getAsString());
                 String sessionId = params.get(1).getAsString();
                 UUID playerId = UUID.fromString(params.get(2).getAsString());
                 mageServer.cheatShow(gameId, sessionId, playerId);
                 result = true;
             }

             else if ("roomCreateTournament".equals(method)) {
                 String sessionId = params.get(0).getAsString();
                 UUID roomId = UUID.fromString(params.get(1).getAsString());
                 TournamentOptions tournamentOptions = gson.fromJson(params.get(2), TournamentOptions.class);
                 result = mageServer.roomCreateTournament(sessionId, roomId, tournamentOptions);

             } else if ("roomJoinTournament".equals(method)) {
                 String sessionId = params.get(0).getAsString();
                 UUID roomId = UUID.fromString(params.get(1).getAsString());
                 UUID tableId = UUID.fromString(params.get(2).getAsString());
                 String name = params.get(3).getAsString();
                 PlayerType playerType = PlayerType.getByDescription(params.get(4).getAsString());
                 int skill = params.get(5).getAsInt();
                 DeckCardLists deckList = gson.fromJson(params.get(6), DeckCardLists.class);
                 String password = params.size() > 7 ? params.get(7).getAsString() : "";
                 result = mageServer.roomJoinTournament(sessionId, roomId, tableId, name, playerType, skill, deckList, password);

             } else if ("tournamentStart".equals(method)) {
                 String sessionId = params.get(0).getAsString();
                 UUID roomId = UUID.fromString(params.get(1).getAsString());
                 UUID tableId = UUID.fromString(params.get(2).getAsString());
                 result = mageServer.tournamentStart(sessionId, roomId, tableId);

             } else if ("tournamentJoin".equals(method)) {
                 UUID draftId = UUID.fromString(params.get(0).getAsString());
                 String sessionId = params.get(1).getAsString();
                 mageServer.tournamentJoin(draftId, sessionId);
                 result = true;

             } else if ("tournamentQuit".equals(method)) {
                 UUID tournamentId = UUID.fromString(params.get(0).getAsString());
                 String sessionId = params.get(1).getAsString();
                 mageServer.tournamentQuit(tournamentId, sessionId);
                 result = true;

            } else if ("draftJoin".equals(method)) {
                UUID draftId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.draftJoin(draftId, sessionId);
                result = true;
                
            } else if ("draftQuit".equals(method)) {
                UUID draftId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.draftQuit(draftId, sessionId);
                result = true;

            } else if ("sendDraftCardPick".equals(method)) {
               UUID draftId = UUID.fromString(params.get(0).getAsString());
               String sessionId = params.get(1).getAsString();
               UUID cardId = UUID.fromString(params.get(2).getAsString());
               Set<UUID> hiddenCards = new HashSet<>();
               if (params.size() > 3 && params.get(3).isJsonArray()) {
                   for (JsonElement e : params.get(3).getAsJsonArray()) {
                       hiddenCards.add(UUID.fromString(e.getAsString()));
                   }
               }
               result = mageServer.sendDraftCardPick(draftId, sessionId, cardId, hiddenCards);

            } else if ("sendDraftCardMark".equals(method)) {
               UUID draftId = UUID.fromString(params.get(0).getAsString());
               String sessionId = params.get(1).getAsString();
               UUID cardId = UUID.fromString(params.get(2).getAsString());
               mageServer.sendDraftCardMark(draftId, sessionId, cardId);
               result = true;
            }

            else if ("deckSubmit".equals(method)) {
                 String sessionId = params.get(0).getAsString();
                 UUID tableId = UUID.fromString(params.get(1).getAsString());
                 DeckCardLists deckList = gson.fromJson(params.get(2), DeckCardLists.class);
                 result = mageServer.deckSubmit(sessionId, tableId, deckList);
            
            } else if ("serverGetMainRoomId".equals(method)) {
                result = mageServer.serverGetMainRoomId();
            
            } else if ("connectSetUserData".equals(method)) {
                String userName = params.get(0).getAsString();
                String sessionId = params.get(1).getAsString();
                UserData userData = gson.fromJson(params.get(2), UserData.class);
                String clientVersion = params.get(3).getAsString();
                String userIdStr = params.get(4).getAsString();
                
                result = mageServer.connectSetUserData(userName, sessionId, userData, clientVersion, userIdStr);
            
            // Additional utility methods
            
            } else if ("draftSetBoosterLoaded".equals(method)) {
                UUID draftId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.draftSetBoosterLoaded(draftId, sessionId);
                result = true;
            
            // Replay methods
            } else if ("replayInit".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.replayInit(gameId, sessionId);
                result = true;
            
            } else if ("replayStart".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.replayStart(gameId, sessionId);
                result = true;
            
            } else if ("replayStop".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.replayStop(gameId, sessionId);
                result = true;
            
            } else if ("replayNext".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.replayNext(gameId, sessionId);
                result = true;
            
            } else if ("replayPrevious".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                mageServer.replayPrevious(gameId, sessionId);
                result = true;
            
            } else if ("replaySkipForward".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                int moves = params.get(2).getAsInt();
                mageServer.replaySkipForward(gameId, sessionId, moves);
                result = true;
            
            // Chat utility methods
            } else if ("chatFindByGame".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                result = mageServer.chatFindByGame(gameId);
            
            } else if ("chatFindByTable".equals(method)) {
                UUID tableId = UUID.fromString(params.get(0).getAsString());
                result = mageServer.chatFindByTable(tableId);
            
            } else if ("chatFindByTournament".equals(method)) {
                UUID tournamentId = UUID.fromString(params.get(0).getAsString());
                result = mageServer.chatFindByTournament(tournamentId);
            
            } else if ("chatFindByRoom".equals(method)) {
                UUID roomId = UUID.fromString(params.get(0).getAsString());
                result = mageServer.chatFindByRoom(roomId);
            
            // Table utility methods
            } else if ("tableSwapSeats".equals(method)) {
                String sessionId = params.get(0).getAsString();
                UUID roomId = UUID.fromString(params.get(1).getAsString());
                UUID tableId = UUID.fromString(params.get(2).getAsString());
                int seatNum1 = params.get(3).getAsInt();
                int seatNum2 = params.get(4).getAsInt();
                mageServer.tableSwapSeats(sessionId, roomId, tableId, seatNum1, seatNum2);
                result = true;
            
            } else if ("tableRemove".equals(method)) {
                String sessionId = params.get(0).getAsString();
                UUID roomId = UUID.fromString(params.get(1).getAsString());
                UUID tableId = UUID.fromString(params.get(2).getAsString());
                mageServer.tableRemove(sessionId, roomId, tableId);
                result = true;
            
            } else if ("tableIsOwner".equals(method)) {
                String sessionId = params.get(0).getAsString();
                UUID roomId = UUID.fromString(params.get(1).getAsString());
                UUID tableId = UUID.fromString(params.get(2).getAsString());
                result = mageServer.tableIsOwner(sessionId, roomId, tableId);
            
            // Room utility methods
            } else if ("roomGetFinishedMatches".equals(method)) {
                UUID roomId = UUID.fromString(params.get(0).getAsString());
                result = mageServer.roomGetFinishedMatches(roomId);
            
            } else if ("roomGetTableById".equals(method)) {
                UUID roomId = UUID.fromString(params.get(0).getAsString());
                UUID tableId = UUID.fromString(params.get(1).getAsString());
                result = mageServer.roomGetTableById(roomId, tableId);
            
            // Tournament utility methods
            } else if ("tournamentFindById".equals(method)) {
                UUID tournamentId = UUID.fromString(params.get(0).getAsString());
                result = mageServer.tournamentFindById(tournamentId);
            
            // Game utility methods
            } else if ("gameGetView".equals(method)) {
                UUID gameId = UUID.fromString(params.get(0).getAsString());
                String sessionId = params.get(1).getAsString();
                UUID playerId = UUID.fromString(params.get(2).getAsString());
                result = mageServer.gameGetView(gameId, sessionId, playerId);
            
            // Server info
            } else if ("getServerState".equals(method)) {
                result = mageServer.getServerState();
            
            // Deck methods
            } else if ("deckSave".equals(method)) {
                String sessionId = params.get(0).getAsString();
                UUID tableId = UUID.fromString(params.get(1).getAsString());
                DeckCardLists deckList = gson.fromJson(params.get(2), DeckCardLists.class);
                mageServer.deckSave(sessionId, tableId, deckList);
                result = true;
            }

            if (id != null) {
                JsonObject response = new JsonObject();
                response.addProperty("jsonrpc", "2.0");
                response.add("id", id);
                response.add("result", gson.toJsonTree(result));
                conn.send(gson.toJson(response));
            }

        } catch (Exception e) {
            logger.error("Error processing WebSocket message", e);
            if (conn.isOpen()) {
                JsonObject error = new JsonObject();
                error.addProperty("jsonrpc", "2.0");
                
                // Try to include ID if we parsed it
                try {
                    JsonObject json = JsonParser.parseString(message).getAsJsonObject();
                    if (json.has("id")) {
                        error.add("id", json.get("id"));
                    }
                } catch (Exception ignore) {}

                error.addProperty("error", e.getMessage());
                conn.send(gson.toJson(error));
            }
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        logger.error("WebSocket error", ex);
    }

    @Override
    public void onStart() {
        logger.info("WebSocket Server started on " + getAddress());
    }
}
