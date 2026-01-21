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
import mage.cards.repository.CardCriteria;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import mage.view.CardView;
import java.util.List;
import java.util.stream.Collectors;
import org.apache.log4j.Logger;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.util.HashMap;
import java.util.Map;

import java.lang.reflect.Type;
import java.net.InetSocketAddress;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public class WebSocketServerImpl extends WebSocketServer {
    private static final Logger logger = Logger.getLogger(WebSocketServerImpl.class);
    private final MageServer mageServer;
    private final ManagerFactory managerFactory;
    private final Map<String, MessageHandler> handlers = new HashMap<>();

    @FunctionalInterface
    private interface MessageHandler {
        Object handle(WebSocket conn, JsonArray params) throws Exception;
    }
    
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
        registerHandlers();
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

            MessageHandler handler = handlers.get(method);
            if (handler == null) {
                logger.warn("Unknown method: " + method);
                return;
            }

            Object result = handler.handle(conn, params);

            if (id != null) {
                JsonObject response = new JsonObject();
                response.addProperty("jsonrpc", "2.0");
                response.add("id", id);
                response.add("result", gson.toJsonTree(result));
                conn.send(gson.toJson(response));
            }

        } catch (Exception e) {
            logger.error("Error processing WebSocket message: " + message, e);
            if (conn.isOpen()) {
                JsonObject error = new JsonObject();
                error.addProperty("jsonrpc", "2.0");
                
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

    private void registerHandlers() {
        handlers.put("ping", (conn, params) -> true);
        handlers.put("authRegister", this::handleAuthRegister);
        handlers.put("connectUser", this::handleConnectUser);
        
        // Room
        handlers.put("roomGetUsers", (conn, params) -> mageServer.roomGetUsers(getUUID(params, 0)));
        handlers.put("roomGetAllTables", (conn, params) -> mageServer.roomGetAllTables(getUUID(params, 0)));
        handlers.put("roomCreateTable", this::handleRoomCreateTable);
        handlers.put("roomJoinTable", (conn, params) -> mageServer.roomJoinTable(getString(params, 0), getUUID(params, 1), getUUID(params, 2), getString(params, 3), PlayerType.getByDescription(getString(params, 4)), getInt(params, 5), getObject(params, 6, DeckCardLists.class), params.size() > 7 ? getString(params, 7) : ""));
        handlers.put("roomLeaveTableOrTournament", (conn, params) -> mageServer.roomLeaveTableOrTournament(getString(params, 0), getUUID(params, 1), getUUID(params, 2)));
        handlers.put("roomWatchTable", (conn, params) -> mageServer.roomWatchTable(getString(params, 0), getUUID(params, 1), getUUID(params, 2)));
        handlers.put("roomWatchTournament", (conn, params) -> mageServer.roomWatchTournament(getString(params, 0), getUUID(params, 1)));
        
        // Chat
        handlers.put("chatJoin", (conn, params) -> { mageServer.chatJoin(getUUID(params, 0), getString(params, 1), getString(params, 2)); return true; });
        handlers.put("chatSendMessage", (conn, params) -> { mageServer.chatSendMessage(getUUID(params, 0), getString(params, 1), getString(params, 2)); return true; });
        handlers.put("chatLeave", (conn, params) -> { mageServer.chatLeave(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("chatFindByGame", (conn, params) -> mageServer.chatFindByGame(getUUID(params, 0)));
        handlers.put("chatFindByTable", (conn, params) -> mageServer.chatFindByTable(getUUID(params, 0)));
        handlers.put("chatFindByTournament", (conn, params) -> mageServer.chatFindByTournament(getUUID(params, 0)));
        handlers.put("chatFindByRoom", (conn, params) -> mageServer.chatFindByRoom(getUUID(params, 0)));

        // Match
        handlers.put("matchStart", (conn, params) -> mageServer.matchStart(getString(params, 0), getUUID(params, 1), getUUID(params, 2)));
        handlers.put("matchQuit", (conn, params) -> { mageServer.matchQuit(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("gameJoin", (conn, params) -> { mageServer.gameJoin(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("gameWatchStart", (conn, params) -> mageServer.gameWatchStart(getUUID(params, 0), getString(params, 1)));
        handlers.put("gameWatchStop", (conn, params) -> { mageServer.gameWatchStop(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("gameGetView", (conn, params) -> mageServer.gameGetView(getUUID(params, 0), getString(params, 1), getUUID(params, 2)));

        // Player Data
        handlers.put("sendPlayerUUID", (conn, params) -> { mageServer.sendPlayerUUID(getUUID(params, 0), getString(params, 1), getUUID(params, 2)); return true; });
        handlers.put("sendPlayerString", (conn, params) -> { mageServer.sendPlayerString(getUUID(params, 0), getString(params, 1), getString(params, 2)); return true; });
        handlers.put("sendPlayerBoolean", (conn, params) -> { mageServer.sendPlayerBoolean(getUUID(params, 0), getString(params, 1), getBoolean(params, 2)); return true; });
        handlers.put("sendPlayerInteger", (conn, params) -> { mageServer.sendPlayerInteger(getUUID(params, 0), getString(params, 1), getInt(params, 2)); return true; });
        handlers.put("sendPlayerManaType", (conn, params) -> { mageServer.sendPlayerManaType(getUUID(params, 0), getUUID(params, 1), getString(params, 2), ManaType.valueOf(getString(params, 3))); return true; });
        handlers.put("sendPlayerAction", this::handleSendPlayerAction);
        handlers.put("cheatShow", (conn, params) -> { mageServer.cheatShow(getUUID(params, 0), getString(params, 1), getUUID(params, 2)); return true; });
        
        // Tournaments & Drafts
        handlers.put("roomCreateTournament", (conn, params) -> mageServer.roomCreateTournament(getString(params, 0), getUUID(params, 1), getObject(params, 2, TournamentOptions.class)));
        handlers.put("roomJoinTournament", (conn, params) -> mageServer.roomJoinTournament(getString(params, 0), getUUID(params, 1), getUUID(params, 2), getString(params, 3), PlayerType.getByDescription(getString(params, 4)), getInt(params, 5), getObject(params, 6, DeckCardLists.class), params.size() > 7 ? getString(params, 7) : ""));
        handlers.put("tournamentStart", (conn, params) -> mageServer.tournamentStart(getString(params, 0), getUUID(params, 1), getUUID(params, 2)));
        handlers.put("tournamentJoin", (conn, params) -> { mageServer.tournamentJoin(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("tournamentQuit", (conn, params) -> { mageServer.tournamentQuit(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("tournamentFindById", (conn, params) -> mageServer.tournamentFindById(getUUID(params, 0)));
        
        handlers.put("draftJoin", (conn, params) -> { mageServer.draftJoin(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("draftQuit", (conn, params) -> { mageServer.draftQuit(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("sendDraftCardPick", this::handleSendDraftCardPick);
        handlers.put("sendDraftCardMark", (conn, params) -> { mageServer.sendDraftCardMark(getUUID(params, 0), getString(params, 1), getUUID(params, 2)); return true; });
        handlers.put("draftSetBoosterLoaded", (conn, params) -> { mageServer.draftSetBoosterLoaded(getUUID(params, 0), getString(params, 1)); return true; });

        // Decks
        handlers.put("deckSubmit", (conn, params) -> mageServer.deckSubmit(getString(params, 0), getUUID(params, 1), getObject(params, 2, DeckCardLists.class)));
        handlers.put("deckSave", (conn, params) -> { mageServer.deckSave(getString(params, 0), getUUID(params, 1), getObject(params, 2, DeckCardLists.class)); return true; });

        // User
        handlers.put("connectSetUserData", this::handleConnectSetUserData);
        
        // Utils
        handlers.put("serverGetMainRoomId", (conn, params) -> mageServer.serverGetMainRoomId());
        handlers.put("getServerState", (conn, params) -> mageServer.getServerState());
        handlers.put("searchCards", this::handleSearchCards);
        
        // Replay
        handlers.put("replayInit", (conn, params) -> { mageServer.replayInit(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("replayStart", (conn, params) -> { mageServer.replayStart(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("replayStop", (conn, params) -> { mageServer.replayStop(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("replayNext", (conn, params) -> { mageServer.replayNext(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("replayPrevious", (conn, params) -> { mageServer.replayPrevious(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("replaySkipForward", (conn, params) -> { mageServer.replaySkipForward(getUUID(params, 0), getString(params, 1), getInt(params, 2)); return true; });

        // Table Utils
        handlers.put("tableSwapSeats", (conn, params) -> { mageServer.tableSwapSeats(getString(params, 0), getUUID(params, 1), getUUID(params, 2), getInt(params, 3), getInt(params, 4)); return true; });
        handlers.put("tableRemove", (conn, params) -> { mageServer.tableRemove(getString(params, 0), getUUID(params, 1), getUUID(params, 2)); return true; });
        handlers.put("tableIsOwner", (conn, params) -> mageServer.tableIsOwner(getString(params, 0), getUUID(params, 1), getUUID(params, 2)));
        handlers.put("roomGetFinishedMatches", (conn, params) -> mageServer.roomGetFinishedMatches(getUUID(params, 0)));
        handlers.put("roomGetTableById", (conn, params) -> mageServer.roomGetTableById(getUUID(params, 0), getUUID(params, 1)));
    }

    private Object handleAuthRegister(WebSocket conn, JsonArray params) throws Exception {
        String sessionId = getString(params, 0);
        String userName = getString(params, 1);
        String password = getString(params, 2);
        String email = getString(params, 3);
        
        if (managerFactory.sessionManager().getSession(sessionId).isPresent()) {
            managerFactory.sessionManager().disconnect(sessionId, DisconnectReason.LostConnection, false);
        }
        managerFactory.sessionManager().createSession(sessionId, new WebSocketCallbackHandler(conn));
        
        return mageServer.authRegister(sessionId, userName, password, email);
    }

    private Object handleConnectUser(WebSocket conn, JsonArray params) throws Exception {
         String userName = getString(params, 0);
         String password = getString(params, 1);
         String sessionId = getString(params, 2);
         String restoreSessionId = params.size() > 3 ? getString(params, 3) : "";
         MageVersion version = new MageVersion(mage.server.Main.class);
         String userIdStr = params.size() > 5 ? getString(params, 5) : "";
         
         if (managerFactory.sessionManager().getSession(sessionId).isPresent()) {
             managerFactory.sessionManager().disconnect(sessionId, DisconnectReason.LostConnection, false);
         }
         managerFactory.sessionManager().createSession(sessionId, new WebSocketCallbackHandler(conn));
         
         return mageServer.connectUser(userName, password, sessionId, restoreSessionId, version, userIdStr);
    }

    private Object handleRoomCreateTable(WebSocket conn, JsonArray params) throws Exception {
        String sessionId = getString(params, 0);
        UUID roomId = getUUID(params, 1);
        JsonObject optionsJson = params.get(2).getAsJsonObject();
        
        String tableName = optionsJson.has("name") ? optionsJson.get("name").getAsString() : "Game";
        String gameType = optionsJson.has("gameType") ? optionsJson.get("gameType").getAsString() : "Two Player Duel";
        boolean multiPlayer = gameType.contains("Free For All") || gameType.contains("Commander");
        
        MatchOptions matchOptions = new MatchOptions(tableName, gameType, multiPlayer);
        
        if (optionsJson.has("deckType")) matchOptions.setDeckType(optionsJson.get("deckType").getAsString());
        if (optionsJson.has("winsNeeded")) matchOptions.setWinsNeeded(optionsJson.get("winsNeeded").getAsInt());
        if (optionsJson.has("freeMulligans")) matchOptions.setFreeMulligans(optionsJson.get("freeMulligans").getAsInt());
        if (optionsJson.has("password") && !optionsJson.get("password").isJsonNull()) matchOptions.setPassword(optionsJson.get("password").getAsString());
        if (optionsJson.has("limited")) matchOptions.setLimited(optionsJson.get("limited").getAsBoolean());
        if (optionsJson.has("rated")) matchOptions.setRated(optionsJson.get("rated").getAsBoolean());
        if (optionsJson.has("rollbackTurnsAllowed")) matchOptions.setRollbackTurnsAllowed(optionsJson.get("rollbackTurnsAllowed").getAsBoolean());
        if (optionsJson.has("spectatorsAllowed")) matchOptions.setSpectatorsAllowed(optionsJson.get("spectatorsAllowed").getAsBoolean());
        if (optionsJson.has("matchTimeLimit")) {
            try { matchOptions.setMatchTimeLimit(MatchTimeLimit.valueOf(optionsJson.get("matchTimeLimit").getAsString())); } catch (Exception e) {}
        }
        if (optionsJson.has("matchBufferTime")) {
            try { matchOptions.setMatchBufferTime(MatchBufferTime.valueOf(optionsJson.get("matchBufferTime").getAsString())); } catch (Exception e) {}
        }
        if (optionsJson.has("skillLevel")) {
            try { matchOptions.setSkillLevel(SkillLevel.valueOf(optionsJson.get("skillLevel").getAsString())); } catch (Exception e) {}
        }
        
        // Default quitRatio to 100 (allow everyone) if not specified, to avoid blocking users with >0% quit ratio from creating tables
        matchOptions.setQuitRatio(optionsJson.has("quitRatio") ? optionsJson.get("quitRatio").getAsInt() : 100);
        
        if (optionsJson.has("minimumRating")) matchOptions.setMinimumRating(optionsJson.get("minimumRating").getAsInt());
        if (optionsJson.has("edhPowerLevel")) matchOptions.setEdhPowerLevel(optionsJson.get("edhPowerLevel").getAsInt());
        
        matchOptions.getPlayerTypes().add(PlayerType.HUMAN);
        matchOptions.getPlayerTypes().add(PlayerType.HUMAN);
        
        return mageServer.roomCreateTable(sessionId, roomId, matchOptions);
    }

    private Object handleSendPlayerAction(WebSocket conn, JsonArray params) throws Exception {
         PlayerAction action = PlayerAction.valueOf(getString(params, 0));
         UUID gameId = getUUID(params, 1);
         String sessionId = getString(params, 2);
         Object data = null;
         
         if (params.size() > 3 && !params.get(3).isJsonNull()) {
             JsonElement dataElem = params.get(3);
             if (dataElem.isJsonPrimitive()) {
                 if (dataElem.getAsJsonPrimitive().isString()) {
                     String dataStr = dataElem.getAsString();
                     try { data = UUID.fromString(dataStr); } catch (Exception e) { data = dataStr; }
                 } else if (dataElem.getAsJsonPrimitive().isNumber()) {
                     data = dataElem.getAsInt();
                 } else if (dataElem.getAsJsonPrimitive().isBoolean()) {
                     data = dataElem.getAsBoolean();
                 }
             }
         }
         mageServer.sendPlayerAction(action, gameId, sessionId, data);
         return true;
    }

    private Object handleSendDraftCardPick(WebSocket conn, JsonArray params) throws Exception {
       UUID draftId = getUUID(params, 0);
       String sessionId = getString(params, 1);
       UUID cardId = getUUID(params, 2);
       Set<UUID> hiddenCards = new HashSet<>();
       if (params.size() > 3 && params.get(3).isJsonArray()) {
           for (JsonElement e : params.get(3).getAsJsonArray()) {
               hiddenCards.add(UUID.fromString(e.getAsString()));
           }
       }
       return mageServer.sendDraftCardPick(draftId, sessionId, cardId, hiddenCards);
    }

    private Object handleConnectSetUserData(WebSocket conn, JsonArray params) throws Exception {
        String userName = getString(params, 0);
        String sessionId = getString(params, 1);
        UserData userData = getObject(params, 2, UserData.class);
        String clientVersion = getString(params, 3);
        String userIdStr = getString(params, 4);
        return mageServer.connectSetUserData(userName, sessionId, userData, clientVersion, userIdStr);
    }

    private Object handleSearchCards(WebSocket conn, JsonArray params) throws Exception {
        CardCriteria criteria = getObject(params, 0, CardCriteria.class);
        if (criteria.getCount() == null) criteria.count(100L);

        if (criteria.getFormat() != null && !criteria.getFormat().isEmpty()) {
            mage.cards.decks.DeckValidator validator = mage.cards.decks.DeckValidatorFactory.instance.createDeckValidator(criteria.getFormat());
            if (validator instanceof mage.cards.decks.Constructed) {
                mage.cards.decks.Constructed constructed = (mage.cards.decks.Constructed) validator;
                if (constructed.getSetCodes() != null && !constructed.getSetCodes().isEmpty()) {
                    criteria.setCodes(constructed.getSetCodes());
                }
            }
        }

        List<CardInfo> cards = CardRepository.instance.findCards(criteria);
        return cards.stream().map(info -> new CardView(info.createMockCard())).collect(Collectors.toList());
    }

    private String getString(JsonArray params, int index) {
        return params.get(index).getAsString();
    }

    private UUID getUUID(JsonArray params, int index) {
        return UUID.fromString(params.get(index).getAsString());
    }

    private int getInt(JsonArray params, int index) {
        return params.get(index).getAsInt();
    }

    private boolean getBoolean(JsonArray params, int index) {
        return params.get(index).getAsBoolean();
    }

    private <T> T getObject(JsonArray params, int index, Class<T> classOfT) {
        return gson.fromJson(params.get(index), classOfT);
    }

    @Override
    public void onStart() {
        logger.info("WebSocket Server started on " + getAddress());
    }
}
