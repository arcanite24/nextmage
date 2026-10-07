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
import mage.server.DisconnectReason;
import mage.server.Session;
import mage.server.managers.ManagerFactory;
import mage.utils.MageVersion;
import mage.cards.decks.Deck;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import mage.cards.decks.DeckValidator;
import mage.cards.decks.DeckValidatorError;
import mage.cards.decks.DeckValidatorFactory;
import mage.cards.Card;
import mage.MageObject;
import mage.ObjectColor;
import mage.constants.ManaType;
import mage.constants.MatchBufferTime;
import mage.constants.MatchTimeLimit;
import mage.constants.MultiplayerAttackOption;
import mage.constants.PlayerAction;
import mage.constants.RangeOfInfluence;
import mage.constants.SkillLevel;
import mage.game.draft.DraftOptions;
import mage.game.Game;
import mage.game.Table;
import mage.game.match.Match;
import mage.game.match.MatchOptions;
import mage.game.mulligan.MulliganType;
import mage.game.tournament.LimitedOptions;
import mage.game.tournament.TournamentOptions;
import mage.players.PlayerType;
import mage.players.net.UserData;
import mage.cards.repository.CardCriteria;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import mage.cards.repository.ExpansionInfo;
import mage.cards.repository.ExpansionRepository;
import mage.filter.predicate.card.CardTextPredicate;
import mage.view.CardView;
import java.util.List;
import java.util.stream.Collectors;
import org.apache.log4j.Logger;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.net.InetSocketAddress;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class WebSocketServerImpl extends WebSocketServer {
    private static final Logger logger = Logger.getLogger(WebSocketServerImpl.class);
    private static final String BRACKET_GROUP_GAME_CHANGERS = "Game Changers";
    private static final String BRACKET_GROUP_INFINITE_COMBOS = "Early-game 2-Card Combos";
    private static final String BRACKET_GROUP_MASS_LAND_DESTRUCTION = "Mass Land Destruction";
    private static final String BRACKET_GROUP_EXTRA_TURNS = "Extra Turns";
    private static final String RESOURCE_INFINITE_COMBOS = "brackets/infinite-combos.txt";
    private static final Map<String, List<Integer>> COMMANDER_BRACKET_LIMITS = new LinkedHashMap<>();
    private static final List<String> COMMANDER_GAME_CHANGERS = Arrays.asList(
            "Ad Nauseam",
            "Ancient Tomb",
            "Aura Shards",
            "Bolas's Citadel",
            "Braids, Cabal Minion",
            "Demonic Tutor",
            "Drannith Magistrate",
            "Chrome Mox",
            "Coalition Victory",
            "Consecrated Sphinx",
            "Crop Rotation",
            "Cyclonic Rift",
            "Enlightened Tutor",
            "Field of the Dead",
            "Fierce Guardianship",
            "Force of Will",
            "Gaea's Cradle",
            "Gamble",
            "Gifts Ungiven",
            "Glacial Chasm",
            "Grand Arbiter Augustin IV",
            "Grim Monolith",
            "Humility",
            "Imperial Seal",
            "Intuition",
            "Jeska's Will",
            "Lion's Eye Diamond",
            "Mana Vault",
            "Mishra's Workshop",
            "Mox Diamond",
            "Mystical Tutor",
            "Narset, Parter of Veils",
            "Natural Order",
            "Necropotence",
            "Notion Thief",
            "Rhystic Study",
            "Opposition Agent",
            "Orcish Bowmasters",
            "Panoptic Mirror",
            "Seedborn Muse",
            "Serra's Sanctum",
            "Smothering Tithe",
            "Survival of the Fittest",
            "Teferi's Protection",
            "Tergrid, God of Fright",
            "Thassa's Oracle",
            "The One Ring",
            "The Tabernacle at Pendrell Vale",
            "Underworld Breach",
            "Vampiric Tutor",
            "Worldly Tutor"
    );

    static {
        COMMANDER_BRACKET_LIMITS.put(BRACKET_GROUP_GAME_CHANGERS, Arrays.asList(0, 0, 0, 3, 99, 99));
        COMMANDER_BRACKET_LIMITS.put(BRACKET_GROUP_INFINITE_COMBOS, Arrays.asList(0, 0, 0, 0, 99, 99));
        COMMANDER_BRACKET_LIMITS.put(BRACKET_GROUP_MASS_LAND_DESTRUCTION, Arrays.asList(0, 0, 0, 0, 99, 99));
        COMMANDER_BRACKET_LIMITS.put(BRACKET_GROUP_EXTRA_TURNS, Arrays.asList(0, 0, 0, 3, 99, 99));
    }

    private final MageServer mageServer;
    private final ManagerFactory managerFactory;
    private final Map<String, MessageHandler> handlers = new HashMap<>();
    private final CountDownLatch startupLatch = new CountDownLatch(1);
    private volatile Exception startupException;

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
        if (startupLatch.getCount() > 0) {
            startupException = ex;
            startupLatch.countDown();
        }
        logger.error("WebSocket error", ex);
    }

    public void awaitStartup(long timeout, TimeUnit unit) throws Exception {
        if (!startupLatch.await(timeout, unit)) {
            throw new IllegalStateException("Timed out waiting for WebSocket server startup on " + getAddress());
        }

        if (startupException != null) {
            throw startupException;
        }
    }

    private void registerHandlers() {
        handlers.put("ping", this::handlePing);
        handlers.put("authRegister", this::handleAuthRegister);
        handlers.put("authSendTokenToEmail", this::handleAuthSendTokenToEmail);
        handlers.put("authResetPassword", this::handleAuthResetPassword);
        handlers.put("connectUser", this::handleConnectUser);
        handlers.put("connectAdmin", this::handleConnectAdmin);
        handlers.put("disconnectSession", this::handleDisconnectSession);
        handlers.put("playerLogout", this::handleDisconnectSession);
        
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

        // Player Data
        handlers.put("sendPlayerUUID", (conn, params) -> { mageServer.sendPlayerUUID(getUUID(params, 0), getString(params, 1), getNullableUUID(params, 2)); return true; });
        handlers.put("sendPlayerString", (conn, params) -> { mageServer.sendPlayerString(getUUID(params, 0), getString(params, 1), getString(params, 2)); return true; });
        handlers.put("sendPlayerBoolean", (conn, params) -> { mageServer.sendPlayerBoolean(getUUID(params, 0), getString(params, 1), getBoolean(params, 2)); return true; });
        handlers.put("sendPlayerInteger", (conn, params) -> { mageServer.sendPlayerInteger(getUUID(params, 0), getString(params, 1), getInt(params, 2)); return true; });
        handlers.put("sendPlayerManaType", (conn, params) -> { mageServer.sendPlayerManaType(getUUID(params, 0), getUUID(params, 1), getString(params, 2), ManaType.valueOf(getString(params, 3))); return true; });
        handlers.put("sendPlayerAction", this::handleSendPlayerAction);
        handlers.put("cheatShow", (conn, params) -> { mageServer.cheatShow(getUUID(params, 0), getString(params, 1), getUUID(params, 2)); return true; });
        
        // Tournaments & Drafts
        handlers.put("roomCreateTournament", this::handleRoomCreateTournament);
        handlers.put("roomJoinTournament", (conn, params) -> mageServer.roomJoinTournament(getString(params, 0), getUUID(params, 1), getUUID(params, 2), getString(params, 3), PlayerType.getByDescription(getString(params, 4)), getInt(params, 5), getObject(params, 6, DeckCardLists.class), params.size() > 7 ? getString(params, 7) : ""));
        handlers.put("tournamentStart", (conn, params) -> mageServer.tournamentStart(getString(params, 0), getUUID(params, 1), getUUID(params, 2)));
        handlers.put("tournamentJoin", (conn, params) -> { mageServer.tournamentJoin(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("tournamentQuit", (conn, params) -> { mageServer.tournamentQuit(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("tournamentFindById", (conn, params) -> mageServer.tournamentFindById(getUUID(params, 0)));
        
        handlers.put("draftJoin", (conn, params) -> { mageServer.draftJoin(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("draftQuit", (conn, params) -> { mageServer.draftQuit(getUUID(params, 0), getString(params, 1)); return true; });
        handlers.put("sendDraftCardPick", this::handleSendDraftCardPick);
        handlers.put("sendDraftCardMark", (conn, params) -> { mageServer.sendDraftCardMark(getUUID(params, 0), getString(params, 1), getNullableUUID(params, 2)); return true; });
        handlers.put("draftSetBoosterLoaded", (conn, params) -> { mageServer.draftSetBoosterLoaded(getUUID(params, 0), getString(params, 1)); return true; });

        // Decks
        handlers.put("deckSubmit", (conn, params) -> mageServer.deckSubmit(getString(params, 0), getUUID(params, 1), getObject(params, 2, DeckCardLists.class)));
        handlers.put("submitDeck", (conn, params) -> mageServer.deckSubmit(getString(params, 0), getUUID(params, 1), getObject(params, 2, DeckCardLists.class)));
        handlers.put("deckSave", (conn, params) -> { mageServer.deckSave(getString(params, 0), getUUID(params, 1), getObject(params, 2, DeckCardLists.class)); return true; });
        handlers.put("deckValidate", this::handleDeckValidate);

        // User
        handlers.put("connectSetUserData", this::handleConnectSetUserData);
        handlers.put("sendFeedback", (conn, params) -> {
            mageServer.serverAddFeedbackMessage(
                    getString(params, 0),
                    getString(params, 1),
                    getString(params, 2),
                    getString(params, 3),
                    getString(params, 4),
                    params.size() > 5 && !params.get(5).isJsonNull() ? getString(params, 5) : ""
            );
            return true;
        });
        
        // Utils
        handlers.put("serverGetMainRoomId", (conn, params) -> mageServer.serverGetMainRoomId());
        handlers.put("serverGetPromotionMessages", (conn, params) -> mageServer.serverGetPromotionMessages(getString(params, 0)));
        handlers.put("getServerState", (conn, params) -> mageServer.getServerState());
        handlers.put("getGameTypes", (conn, params) -> mageServer.getServerState().getGameTypes());
        handlers.put("getTournamentGameTypes", (conn, params) -> mageServer.getServerState().getTournamentGameTypes());
        handlers.put("getTournamentTypes", (conn, params) -> mageServer.getServerState().getTournamentTypes());
        handlers.put("getPlayerTypes", (conn, params) -> mageServer.getServerState().getPlayerTypes());
        handlers.put("getDeckTypes", (conn, params) -> mageServer.getServerState().getDeckTypes());
        handlers.put("getDraftCubes", (conn, params) -> mageServer.getServerState().getDraftCubes());
        handlers.put("getExpansionSets", (conn, params) -> handleGetExpansionSets());
        handlers.put("getBasicLandSets", (conn, params) -> handleGetBasicLandSets());
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
        handlers.put("adminTableRemove", this::handleAdminTableRemove);
        handlers.put("testEndGame", this::handleTestEndGame);
        handlers.put("testConcedeMatch", this::handleTestConcedeMatch);
        handlers.put("tableIsOwner", (conn, params) -> mageServer.tableIsOwner(getString(params, 0), getUUID(params, 1), getUUID(params, 2)));
        handlers.put("roomGetFinishedMatches", (conn, params) -> mageServer.roomGetFinishedMatches(getUUID(params, 0)));
        handlers.put("roomGetTableById", (conn, params) -> mageServer.roomGetTableById(getUUID(params, 0), getUUID(params, 1)));
    }

    private Object handleConnectAdmin(WebSocket conn, JsonArray params) throws Exception {
        String password = getString(params, 0);
        String sessionId = getString(params, 1);
        MageVersion version = new MageVersion(mage.server.Main.class);

        if (managerFactory.sessionManager().getSession(sessionId).isPresent()) {
            managerFactory.sessionManager().disconnect(sessionId, DisconnectReason.LostConnection, false);
        }
        managerFactory.sessionManager().createSession(sessionId, new WebSocketCallbackHandler(conn));

        return mageServer.connectAdmin(password, sessionId, version);
    }

    private Object handleAdminTableRemove(WebSocket conn, JsonArray params) throws Exception {
        String sessionId = getString(params, 0);
        UUID tableId = getUUID(params, 1);

        if (!managerFactory.sessionManager().checkAdminAccess(sessionId)) {
            return false;
        }

        managerFactory.tableManager().removeTable(tableId);
        managerFactory.gamesRoomManager().removeTable(tableId);
        return true;
    }

    private Object handleTestEndGame(WebSocket conn, JsonArray params) throws Exception {
        String sessionId = getString(params, 0);
        UUID tableId = getUUID(params, 1);

        if (!mage.server.Main.isTestMode()) {
            logger.warn("Rejected testEndGame request outside server test mode for tableId: " + tableId);
            return false;
        }

        java.util.Optional<Session> session = managerFactory.sessionManager().getSession(sessionId);
        if (!session.isPresent()) {
            logger.warn("Rejected testEndGame request for unknown session: " + sessionId);
            return false;
        }

        if (!managerFactory.tableManager().isTableOwner(tableId, session.get().getUserId())) {
            logger.warn("Rejected testEndGame request for non-owner session: " + sessionId + ", tableId: " + tableId);
            return false;
        }

        UUID targetTableId = findActiveChildOrSelfTableId(tableId);

        managerFactory.tableManager().endGameOnGameThread(targetTableId);
        return true;
    }

    private Object handleTestConcedeMatch(WebSocket conn, JsonArray params) throws Exception {
        String sessionId = getString(params, 0);
        UUID tableId = getUUID(params, 1);
        int losingPlayerIndex = params.size() > 2 ? getInt(params, 2) : 0;

        if (!mage.server.Main.isTestMode()) {
            logger.warn("Rejected testConcedeMatch request outside server test mode for tableId: " + tableId);
            return false;
        }

        java.util.Optional<Session> session = managerFactory.sessionManager().getSession(sessionId);
        if (!session.isPresent()) {
            logger.warn("Rejected testConcedeMatch request for unknown session: " + sessionId);
            return false;
        }

        if (!managerFactory.tableManager().isTableOwner(tableId, session.get().getUserId())) {
            logger.warn("Rejected testConcedeMatch request for non-owner session: " + sessionId + ", tableId: " + tableId);
            return false;
        }

        UUID targetTableId = findActiveChildOrSelfTableId(tableId);
        java.util.Optional<Match> match = managerFactory.tableManager().getMatch(targetTableId);
        if (!match.isPresent() || match.get().getPlayers().isEmpty()) {
            logger.warn("Rejected testConcedeMatch request for table without active match players: " + targetTableId);
            return false;
        }

        Match activeMatch = match.get();
        Game game = activeMatch.getGame();
        if (game == null) {
            logger.warn("Rejected testConcedeMatch request for table without active game: " + targetTableId);
            return false;
        }

        int safePlayerIndex = Math.max(0, Math.min(losingPlayerIndex, activeMatch.getPlayers().size() - 1));
        UUID losingPlayerId = activeMatch.getPlayers().get(safePlayerIndex).getPlayer().getId();
        managerFactory.threadExecutor().getGameExecutor().execute(() -> {
            activeMatch.quitMatch(losingPlayerId);
            game.concede(losingPlayerId);
            if (game.checkIfGameIsOver() || game.hasEnded()) {
                managerFactory.tableManager().endGame(targetTableId);
            } else {
                logger.warn("testConcedeMatch did not end game for tableId: " + targetTableId + ", playerId: " + losingPlayerId);
            }
        });
        return true;
    }

    private UUID findActiveChildOrSelfTableId(UUID tableId) {
        return managerFactory.tableManager().getTables().stream()
                .filter(table -> tableId.equals(table.getParentTableId()))
                .filter(table -> table.getMatch() != null && table.getMatch().getGame() != null)
                .findFirst()
                .map(Table::getId)
                .orElse(tableId);
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

    private Object handleAuthSendTokenToEmail(WebSocket conn, JsonArray params) throws Exception {
        String sessionId = getString(params, 0);
        String email = getString(params, 1);

        replaceSession(sessionId, conn);

        return mageServer.authSendTokenToEmail(sessionId, email);
    }

    private Object handleAuthResetPassword(WebSocket conn, JsonArray params) throws Exception {
        String sessionId = getString(params, 0);
        String email = getString(params, 1);
        String authToken = getString(params, 2);
        String password = getString(params, 3);

        replaceSession(sessionId, conn);

        return mageServer.authResetPassword(sessionId, email, authToken, password);
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

    private Object handleDisconnectSession(WebSocket conn, JsonArray params) {
        String sessionId = getString(params, 0);
        boolean keepGames = params.size() > 1 && !params.get(1).isJsonNull() && getBoolean(params, 1);
        DisconnectReason reason = keepGames
                ? DisconnectReason.DisconnectedByUserButKeepTables
                : DisconnectReason.DisconnectedByUser;

        managerFactory.sessionManager().disconnect(sessionId, reason, true);

        return true;
    }

    private void replaceSession(String sessionId, WebSocket conn) {
        if (managerFactory.sessionManager().getSession(sessionId).isPresent()) {
            managerFactory.sessionManager().disconnect(sessionId, DisconnectReason.LostConnection, false);
        }
        managerFactory.sessionManager().createSession(sessionId, new WebSocketCallbackHandler(conn));
    }

    private Object handlePing(WebSocket conn, JsonArray params) {
        if (params.size() == 0 || params.get(0).isJsonNull()) {
            return true;
        }

        String sessionId = getString(params, 0);
        String pingInfo = params.size() > 1 && !params.get(1).isJsonNull()
                ? getString(params, 1)
                : "websocket";

        return managerFactory.sessionManager().extendUserSession(sessionId, pingInfo);
    }

    private Object handleRoomCreateTable(WebSocket conn, JsonArray params) throws Exception {
        String sessionId = getString(params, 0);
        UUID roomId = getUUID(params, 1);
        JsonObject optionsJson = params.get(2).getAsJsonObject();

        return mageServer.roomCreateTable(sessionId, roomId, getMatchOptions(optionsJson));
    }

    private Object handleRoomCreateTournament(WebSocket conn, JsonArray params) throws Exception {
        String sessionId = getString(params, 0);
        UUID roomId = getUUID(params, 1);
        JsonObject optionsJson = params.get(2).getAsJsonObject();

        return mageServer.roomCreateTournament(sessionId, roomId, getTournamentOptions(optionsJson));
    }

    private MatchOptions getMatchOptions(JsonObject optionsJson) {
        String tableName = optionsJson.has("name") ? optionsJson.get("name").getAsString() : "Game";
        String gameType = optionsJson.has("gameType") ? optionsJson.get("gameType").getAsString() : "Two Player Duel";
        boolean multiPlayer = gameType.contains("Free For All") || gameType.contains("Commander");

        MatchOptions matchOptions = new MatchOptions(tableName, gameType, multiPlayer);

        applyMatchOptions(optionsJson, matchOptions);

        return matchOptions;
    }

    private void applyMatchOptions(JsonObject optionsJson, MatchOptions matchOptions) {
        if (optionsJson.has("deckType")) matchOptions.setDeckType(optionsJson.get("deckType").getAsString());
        if (optionsJson.has("winsNeeded")) matchOptions.setWinsNeeded(optionsJson.get("winsNeeded").getAsInt());
        if (optionsJson.has("freeMulligans")) matchOptions.setFreeMulligans(optionsJson.get("freeMulligans").getAsInt());
        if (optionsJson.has("customStartLifeEnabled")) matchOptions.setCustomStartLifeEnabled(optionsJson.get("customStartLifeEnabled").getAsBoolean());
        if (optionsJson.has("customStartLife")) matchOptions.setCustomStartLife(optionsJson.get("customStartLife").getAsInt());
        if (optionsJson.has("customStartHandSizeEnabled")) matchOptions.setCustomStartHandSizeEnabled(optionsJson.get("customStartHandSizeEnabled").getAsBoolean());
        if (optionsJson.has("customStartHandSize")) matchOptions.setCustomStartHandSize(optionsJson.get("customStartHandSize").getAsInt());
        if (optionsJson.has("planeChase")) matchOptions.setPlaneChase(optionsJson.get("planeChase").getAsBoolean());
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
        if (optionsJson.has("attackOption")) {
            try { matchOptions.setAttackOption(MultiplayerAttackOption.valueOf(optionsJson.get("attackOption").getAsString())); } catch (Exception e) {}
        }
        if (optionsJson.has("range")) {
            try { matchOptions.setRange(RangeOfInfluence.valueOf(optionsJson.get("range").getAsString())); } catch (Exception e) {}
        }
        if (optionsJson.has("skillLevel")) {
            try { matchOptions.setSkillLevel(SkillLevel.valueOf(optionsJson.get("skillLevel").getAsString())); } catch (Exception e) {}
        }
        if (optionsJson.has("mulliganType")) {
            try { matchOptions.setMullgianType(MulliganType.valueOf(optionsJson.get("mulliganType").getAsString())); } catch (Exception e) {}
        }
        if (optionsJson.has("perPlayerEmblemCards")) {
            matchOptions.setPerPlayerEmblemCards(getDeckCardInfos(optionsJson.get("perPlayerEmblemCards")));
        }
        if (optionsJson.has("globalEmblemCards")) {
            matchOptions.setGlobalEmblemCards(getDeckCardInfos(optionsJson.get("globalEmblemCards")));
        }
        
        // Default quitRatio to 100 (allow everyone) if not specified, to avoid blocking users with >0% quit ratio from creating tables
        matchOptions.setQuitRatio(optionsJson.has("quitRatio") ? optionsJson.get("quitRatio").getAsInt() : 100);
        
        if (optionsJson.has("minimumRating")) matchOptions.setMinimumRating(optionsJson.get("minimumRating").getAsInt());
        if (optionsJson.has("edhPowerLevel")) matchOptions.setEdhPowerLevel(optionsJson.get("edhPowerLevel").getAsInt());
        if (optionsJson.has("bannedUsers") && optionsJson.get("bannedUsers").isJsonArray()) {
            Set<String> bannedUsers = new HashSet<>();
            for (JsonElement bannedUserJson : optionsJson.get("bannedUsers").getAsJsonArray()) {
                if (!bannedUserJson.isJsonNull()) {
                    bannedUsers.add(bannedUserJson.getAsString());
                }
            }
            matchOptions.setBannedUsers(bannedUsers);
        }
        
        if (optionsJson.has("playerTypes") && optionsJson.get("playerTypes").isJsonArray()) {
            for (JsonElement playerTypeJson : optionsJson.get("playerTypes").getAsJsonArray()) {
                matchOptions.getPlayerTypes().add(getPlayerType(playerTypeJson));
            }
        }

        if (matchOptions.getPlayerTypes().isEmpty()) {
            matchOptions.getPlayerTypes().add(PlayerType.HUMAN);
            matchOptions.getPlayerTypes().add(PlayerType.HUMAN);
        }
    }

    private TournamentOptions getTournamentOptions(JsonObject optionsJson) {
        String name = optionsJson.has("name") ? optionsJson.get("name").getAsString() : "Tournament";
        String tournamentType = optionsJson.has("tournamentType") ? optionsJson.get("tournamentType").getAsString() : "Constructed";
        JsonObject matchOptionsJson = optionsJson.has("matchOptions") && optionsJson.get("matchOptions").isJsonObject()
                ? optionsJson.get("matchOptions").getAsJsonObject()
                : new JsonObject();
        String gameType = matchOptionsJson.has("gameType") ? matchOptionsJson.get("gameType").getAsString() : "Two Player Duel";
        boolean multiPlayer = optionsJson.has("singleMultiplayerGame")
                ? optionsJson.get("singleMultiplayerGame").getAsBoolean()
                : gameType.contains("Free For All") || gameType.contains("Commander");

        TournamentOptions tournamentOptions = new TournamentOptions(name, gameType, multiPlayer);
        tournamentOptions.setTournamentType(tournamentType);
        tournamentOptions.setPassword("");
        applyMatchOptions(matchOptionsJson, tournamentOptions.getMatchOptions());

        if (optionsJson.has("playerTypes") && optionsJson.get("playerTypes").isJsonArray()) {
            for (JsonElement playerTypeJson : optionsJson.get("playerTypes").getAsJsonArray()) {
                tournamentOptions.getPlayerTypes().add(getPlayerType(playerTypeJson));
            }
        }

        if (optionsJson.has("watchingAllowed")) tournamentOptions.setWatchingAllowed(optionsJson.get("watchingAllowed").getAsBoolean());
        if (optionsJson.has("planeChase")) tournamentOptions.setPlaneChase(optionsJson.get("planeChase").getAsBoolean());
        if (optionsJson.has("numberRounds")) tournamentOptions.setNumberRounds(optionsJson.get("numberRounds").getAsInt());
        if (optionsJson.has("password") && !optionsJson.get("password").isJsonNull()) tournamentOptions.setPassword(optionsJson.get("password").getAsString());
        if (optionsJson.has("quitRatio")) tournamentOptions.setQuitRatio(optionsJson.get("quitRatio").getAsInt()); else tournamentOptions.setQuitRatio(100);
        if (optionsJson.has("minimumRating")) tournamentOptions.setMinimumRating(optionsJson.get("minimumRating").getAsInt());

        if (optionsJson.has("limitedOptions") && optionsJson.get("limitedOptions").isJsonObject()) {
            tournamentOptions.setLimitedOptions(getLimitedOptions(optionsJson.get("limitedOptions").getAsJsonObject(), tournamentType));
        }

        return tournamentOptions;
    }

    private LimitedOptions getLimitedOptions(JsonObject optionsJson, String tournamentType) {
        LimitedOptions limitedOptions = tournamentType.toLowerCase().contains("draft")
                ? new DraftOptions()
                : new LimitedOptions();

        if (optionsJson.has("sets") && optionsJson.get("sets").isJsonArray()) {
            for (JsonElement setJson : optionsJson.get("sets").getAsJsonArray()) {
                limitedOptions.getSetCodes().add(setJson.getAsString());
            }
        }

        if (optionsJson.has("constructionTime")) limitedOptions.setConstructionTime(optionsJson.get("constructionTime").getAsInt());
        if (optionsJson.has("draftCubeName") && !optionsJson.get("draftCubeName").isJsonNull()) limitedOptions.setDraftCubeName(optionsJson.get("draftCubeName").getAsString());
        if (optionsJson.has("cubeFromDeck") && optionsJson.get("cubeFromDeck").isJsonObject()) {
            try {
                Deck cubeFromDeck = Deck.load(gson.fromJson(optionsJson.get("cubeFromDeck"), DeckCardLists.class), true, true);
                cubeFromDeck.clearLayouts();
                limitedOptions.setCubeFromDeck(cubeFromDeck);
            } catch (Exception e) {
                logger.warn("Failed to load cubeFromDeck from websocket tournament options", e);
            }
        }
        if (optionsJson.has("jumpstartPacks") && !optionsJson.get("jumpstartPacks").isJsonNull()) {
            limitedOptions.setJumpstartPacks(optionsJson.get("jumpstartPacks").getAsString());
        }
        if (optionsJson.has("numberBoosters")) limitedOptions.setNumberBoosters(optionsJson.get("numberBoosters").getAsInt());
        if (optionsJson.has("isRandom")) limitedOptions.setIsRandom(optionsJson.get("isRandom").getAsBoolean());
        if (optionsJson.has("isReshuffled")) limitedOptions.setIsReshuffled(optionsJson.get("isReshuffled").getAsBoolean());
        if (optionsJson.has("isRichMan")) limitedOptions.setIsRichMan(optionsJson.get("isRichMan").getAsBoolean());
        if (optionsJson.has("isJumpstart")) limitedOptions.setIsJumpstart(optionsJson.get("isJumpstart").getAsBoolean());

        if (limitedOptions instanceof DraftOptions) {
            try {
                ((DraftOptions) limitedOptions).setTiming(
                        optionsJson.has("timing")
                                ? DraftOptions.TimingOption.valueOf(optionsJson.get("timing").getAsString())
                                : DraftOptions.TimingOption.REGULAR
                );
            } catch (Exception e) {
                ((DraftOptions) limitedOptions).setTiming(DraftOptions.TimingOption.REGULAR);
            }
        }

        return limitedOptions;
    }

    private List<DeckCardInfo> getDeckCardInfos(JsonElement cardsJson) {
        List<DeckCardInfo> cards = new ArrayList<>();
        if (cardsJson == null || cardsJson.isJsonNull() || !cardsJson.isJsonArray()) {
            return cards;
        }

        for (JsonElement cardJson : cardsJson.getAsJsonArray()) {
            if (cardJson == null || cardJson.isJsonNull() || !cardJson.isJsonObject()) {
                continue;
            }
            JsonObject cardObject = cardJson.getAsJsonObject();
            String cardName = getNullableString(cardObject, "cardName");
            String cardNumber = getNullableString(cardObject, "cardNumber");
            String setCode = getNullableString(cardObject, "setCode");
            if (cardName == null || cardName.trim().isEmpty() || cardNumber == null || setCode == null) {
                continue;
            }

            int amount = 1;
            if (cardObject.has("amount") && !cardObject.get("amount").isJsonNull()) {
                try {
                    amount = Math.max(1, Math.min(99, cardObject.get("amount").getAsInt()));
                } catch (Exception e) {
                    amount = 1;
                }
            }
            cards.add(new DeckCardInfo(cardName.trim(), cardNumber, setCode, amount));
        }
        return cards;
    }

    private String getNullableString(JsonObject object, String key) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            return null;
        }
        String value = object.get(key).getAsString().trim();
        return value.isEmpty() ? null : value;
    }

    private PlayerType getPlayerType(JsonElement playerTypeJson) {
        String playerTypeName = playerTypeJson.getAsString();

        try {
            return PlayerType.valueOf(playerTypeName);
        } catch (IllegalArgumentException ignored) {
            return PlayerType.getByDescription(playerTypeName);
        }
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

    private List<BasicLandSetInfo> handleGetBasicLandSets() {
        return ExpansionRepository.instance.getSetsWithBasicLandsByReleaseDate()
                .stream()
                .map(BasicLandSetInfo::new)
                .collect(Collectors.toList());
    }

    private List<ExpansionSetInfo> handleGetExpansionSets() {
        return ExpansionRepository.instance.getAll()
                .stream()
                .map(ExpansionSetInfo::new)
                .collect(Collectors.toList());
    }

    private static class ExpansionSetInfo {
        private final String setCode;
        private final String name;
        private final String blockName;
        private final long releaseDate;
        private final String type;
        private final boolean hasBoosters;
        private final boolean hasBasicLands;

        private ExpansionSetInfo(ExpansionInfo expansionInfo) {
            this.setCode = expansionInfo.getCode();
            this.name = expansionInfo.getName();
            this.blockName = expansionInfo.getBlockName();
            this.releaseDate = expansionInfo.getReleaseDate() == null ? 0L : expansionInfo.getReleaseDate().getTime();
            this.type = expansionInfo.getType() == null ? "" : expansionInfo.getType().name();
            this.hasBoosters = expansionInfo.hasBoosters();
            this.hasBasicLands = expansionInfo.hasBasicLands();
        }
    }

    private static final class BasicLandSetInfo extends ExpansionSetInfo {
        private final boolean hasSnowBasics;

        private BasicLandSetInfo(ExpansionInfo expansionInfo) {
            super(expansionInfo);
            this.hasSnowBasics = CardRepository.haveSnowLands(expansionInfo.getCode());
        }
    }

    private static final class DeckValidationResultInfo {
        private final String deckType;
        private final String name;
        private final String shortName;
        private final boolean valid;
        private final boolean partlyValid;
        private final List<DeckValidationErrorInfo> errors;
        private final int edhPowerLevel;
        private final List<String> edhPowerCards;
        private final List<String> edhPowerDetails;
        private final List<CommanderBracketInfo> commanderBrackets;

        private DeckValidationResultInfo(String deckType, DeckValidator validator, Deck deck, boolean valid) {
            this.deckType = deckType;
            this.name = validator.getName();
            this.shortName = validator.getShortName();
            this.valid = valid;
            this.partlyValid = validator.isPartlyValid();
            this.errors = validator.getErrorsListSorted().stream()
                    .map(DeckValidationErrorInfo::new)
                    .collect(Collectors.toList());
            this.edhPowerCards = new ArrayList<>();
            this.edhPowerDetails = new ArrayList<>();
            this.edhPowerLevel = validator.getEdhPowerLevel(deck, this.edhPowerCards, this.edhPowerDetails);
            this.commanderBrackets = createCommanderBracketInfos(deck);
        }
    }

    private static final class CommanderBracketInfo {
        private final int level;
        private final String name;
        private final String shortName;
        private final boolean valid;
        private final List<String> badCards;
        private final List<CommanderBracketGroupInfo> groups;

        private CommanderBracketInfo(int level, CommanderBracketCollection collection) {
            this.level = level;
            this.name = "Bracket " + level;
            this.shortName = "B" + level;
            this.groups = collection.toGroupInfos(level);
            this.badCards = collection.badCardsForLevel(level);
            this.valid = this.badCards.isEmpty();
        }
    }

    private static final class CommanderBracketGroupInfo {
        private final String name;
        private final int count;
        private final int max;
        private final List<String> cards;

        private CommanderBracketGroupInfo(String name, List<String> cards, int max) {
            this.name = name;
            this.count = cards.size();
            this.max = max;
            this.cards = cards;
        }
    }

    private static final class CommanderBracketCollection {
        private final Map<String, List<String>> groups = new LinkedHashMap<>();

        private CommanderBracketCollection() {
            groups.put(BRACKET_GROUP_GAME_CHANGERS, new ArrayList<>());
            groups.put(BRACKET_GROUP_INFINITE_COMBOS, new ArrayList<>());
            groups.put(BRACKET_GROUP_MASS_LAND_DESTRUCTION, new ArrayList<>());
            groups.put(BRACKET_GROUP_EXTRA_TURNS, new ArrayList<>());
        }

        private List<CommanderBracketGroupInfo> toGroupInfos(int level) {
            return groups.entrySet().stream()
                    .map(entry -> new CommanderBracketGroupInfo(entry.getKey(), entry.getValue(), maxCardsForGroup(entry.getKey(), level)))
                    .collect(Collectors.toList());
        }

        private List<String> badCardsForLevel(int level) {
            List<String> badCards = new ArrayList<>();
            groups.forEach((groupName, cards) -> {
                if (cards.size() > maxCardsForGroup(groupName, level)) {
                    badCards.addAll(cards);
                }
            });
            return badCards.stream().distinct().sorted().collect(Collectors.toList());
        }
    }

    private static final class DeckValidationErrorInfo {
        private final String type;
        private final String group;
        private final String message;
        private final String cardName;

        private DeckValidationErrorInfo(DeckValidatorError error) {
            this.type = error.getErrorType().name();
            this.group = error.getGroup();
            this.message = error.getMessage();
            this.cardName = error.getCardName();
        }
    }

    private static List<CommanderBracketInfo> createCommanderBracketInfos(Deck deck) {
        CommanderBracketCollection collection = collectCommanderBracketCards(deck);
        List<CommanderBracketInfo> result = new ArrayList<>();
        for (int level = 1; level <= 5; level++) {
            result.add(new CommanderBracketInfo(level, collection));
        }
        return result;
    }

    private static CommanderBracketCollection collectCommanderBracketCards(Deck deck) {
        CommanderBracketCollection collection = new CommanderBracketCollection();
        List<Card> deckCards = new ArrayList<>();
        deckCards.addAll(deck.getCards());
        deckCards.addAll(deck.getSideboard());

        deckCards.stream()
                .map(MageObject::getName)
                .filter(COMMANDER_GAME_CHANGERS::contains)
                .sorted()
                .forEach(collection.groups.get(BRACKET_GROUP_GAME_CHANGERS)::add);

        Set<String> infiniteCombos = loadCommanderInfiniteCombos();
        Set<Card> foundComboCards = new HashSet<>();
        for (Card card1 : deckCards) {
            for (Card card2 : deckCards) {
                if (card1 == card2) {
                    continue;
                }
                List<String> names = Arrays.asList(card1.getName(), card2.getName());
                Collections.sort(names);
                if (infiniteCombos.contains(String.join("@", names))) {
                    foundComboCards.add(card1);
                    foundComboCards.add(card2);
                    break;
                }
            }
        }
        foundComboCards.stream()
                .map(MageObject::getName)
                .sorted()
                .forEach(collection.groups.get(BRACKET_GROUP_INFINITE_COMBOS)::add);

        deckCards.stream()
                .filter(card -> card.getRules().stream()
                        .map(s -> s.toLowerCase(java.util.Locale.ENGLISH))
                        .anyMatch(s -> (s.contains("destroy") || s.contains("sacrifice"))
                                && (s.contains("all") || s.contains("x target") || s.contains("{x} target"))
                                && isTextContainsLandName(s)))
                .map(Card::getName)
                .sorted()
                .forEach(collection.groups.get(BRACKET_GROUP_MASS_LAND_DESTRUCTION)::add);

        deckCards.stream()
                .filter(card -> card.getRules().stream()
                        .map(s -> s.toLowerCase(java.util.Locale.ENGLISH))
                        .anyMatch(s -> s.contains("extra turn")))
                .map(Card::getName)
                .sorted()
                .forEach(collection.groups.get(BRACKET_GROUP_EXTRA_TURNS)::add);

        return collection;
    }

    private static Set<String> loadCommanderInfiniteCombos() {
        Set<String> combos = new HashSet<>();
        InputStream in = WebSocketServerImpl.class.getClassLoader().getResourceAsStream(RESOURCE_INFINITE_COMBOS);
        if (in == null) {
            logger.warn("Commander brackets: can't load infinite combos list");
            return combos;
        }

        try (InputStreamReader input = new InputStreamReader(in);
             BufferedReader reader = new BufferedReader(input)) {
            String line = reader.readLine();
            while (line != null) {
                try {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) {
                        continue;
                    }
                    List<String> cards = Arrays.asList(line.split("@"));
                    if (cards.size() != 2) {
                        logger.warn("wrong line format in commander brackets file: " + line);
                        continue;
                    }
                    Collections.sort(cards);
                    combos.add(String.join("@", cards));
                } finally {
                    line = reader.readLine();
                }
            }
        } catch (Exception e) {
            logger.warn("Commander brackets: can't load infinite combos list - " + e, e);
        }
        return combos;
    }

    private static int maxCardsForGroup(String groupName, int level) {
        return COMMANDER_BRACKET_LIMITS.get(groupName).get(level);
    }

    private static boolean isTextContainsLandName(String lowerText) {
        return lowerText.contains("lands")
                || lowerText.contains("plains")
                || lowerText.contains("island")
                || lowerText.contains("swamp")
                || lowerText.contains("mountain")
                || lowerText.contains("forest");
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
        // params[0] (user name) is kept for wire compatibility; the server resolves the user from the session
        String sessionId = getString(params, 1);
        UserData userData = getObject(params, 2, UserData.class);
        String clientVersion = getString(params, 3);
        String userIdStr = getString(params, 4);
        return mageServer.connectSetUserData(sessionId, userData, clientVersion, userIdStr);
    }

    private Object handleSearchCards(WebSocket conn, JsonArray params) throws Exception {
        CardCriteria criteria = getObject(params, 0, CardCriteria.class);
        if (criteria.getCount() == null) criteria.count(100L);
        boolean hasWebTextSearch = hasWebTextSearch(criteria);
        boolean hasWebSearchRefinements = hasWebSearchRefinements(criteria);
        Long requestedStart = criteria.getStart();
        Long requestedCount = criteria.getCount();
        if (hasWebSearchRefinements) {
            criteria.start(null);
            criteria.count(null);
        }

        if (criteria.getFormat() != null && !criteria.getFormat().isEmpty()) {
            DeckValidator validator = DeckValidatorFactory.instance.createDeckValidator(criteria.getFormat());
            if (validator instanceof mage.cards.decks.Constructed) {
                mage.cards.decks.Constructed constructed = (mage.cards.decks.Constructed) validator;
                if (constructed.getSetCodes() != null && !constructed.getSetCodes().isEmpty()) {
                    criteria.setCodes(constructed.getSetCodes());
                }
            }
        }

        List<CardInfo> cards = CardRepository.instance.findCards(criteria);
        if (hasWebTextSearch) {
            CardTextPredicate textPredicate = new CardTextPredicate(
                    criteria.getSearchText(),
                    criteria.isSearchNames(),
                    criteria.isSearchTypes(),
                    criteria.isSearchRules(),
                    criteria.isUniqueNames()
            );
            cards = cards.stream()
                    .filter(info -> textPredicate.apply(info.createMockCard(), null))
                    .collect(Collectors.toList());
        }
        if (hasWebSearchRefinements) {
            cards = cards.stream()
                    .filter(info -> matchesWebSearchRefinements(info, criteria))
                    .collect(Collectors.toList());
        }

        return cards.stream()
                .skip(requestedStart == null ? 0L : requestedStart)
                .limit(requestedCount == null ? Long.MAX_VALUE : requestedCount)
                .map(info -> new CardView(info.createMockCard()))
                .collect(Collectors.toList());
    }

    private boolean hasWebTextSearch(CardCriteria criteria) {
        return criteria.getSearchText() != null && !criteria.getSearchText().trim().isEmpty()
                && (criteria.isSearchNames() || criteria.isSearchTypes() || criteria.isSearchRules());
    }

    private boolean hasWebSearchRefinements(CardCriteria criteria) {
        return hasWebTextSearch(criteria)
                || !criteria.getWebColors().isEmpty()
                || !criteria.getWebExcludedColors().isEmpty()
                || !criteria.getExcludedRarities().isEmpty()
                || (criteria.getManaValue() != null && criteria.getManaValueOperator() != null && !criteria.getManaValueOperator().equals("eq"));
    }

    private boolean matchesWebSearchRefinements(CardInfo info, CardCriteria criteria) {
        return matchesWebColors(info, criteria.getWebColors(), criteria.getColorMatch())
                && !matchesAnyWebColor(info, criteria.getWebExcludedColors())
                && !criteria.getExcludedRarities().contains(info.getRarity())
                && matchesWebManaValue(info, criteria.getManaValue(), criteria.getManaValueOperator());
    }

    private boolean matchesWebManaValue(CardInfo info, Integer manaValue, String operator) {
        if (manaValue == null || operator == null || operator.equals("eq")) return true;
        switch (operator) {
            case "lte":
                return info.getManaValue() <= manaValue;
            case "gte":
                return info.getManaValue() >= manaValue;
            default:
                return true;
        }
    }

    private boolean matchesWebColors(CardInfo info, List<String> colors, String colorMatch) {
        if (colors.isEmpty()) return true;

        Set<String> requestedColors = normalizeWebColors(colors);
        Set<String> cardColors = webColorsFor(info);
        boolean cardColorless = cardColors.isEmpty();
        boolean wantsColorless = requestedColors.contains("colorless");

        if (cardColorless) {
            return wantsColorless;
        }
        requestedColors.remove("colorless");
        if (requestedColors.isEmpty()) return false;

        switch (colorMatch == null ? "any" : colorMatch) {
            case "exact":
                return cardColors.equals(requestedColors);
            case "include":
                return cardColors.containsAll(requestedColors);
            case "any":
            default:
                for (String color : requestedColors) {
                    if (cardColors.contains(color)) return true;
                }
                return false;
        }
    }

    private boolean matchesAnyWebColor(CardInfo info, List<String> colors) {
        if (colors.isEmpty()) return false;
        Set<String> excludedColors = normalizeWebColors(colors);
        Set<String> cardColors = webColorsFor(info);
        if (cardColors.isEmpty()) {
            return excludedColors.contains("colorless");
        }
        for (String color : excludedColors) {
            if (cardColors.contains(color)) return true;
        }
        return false;
    }

    private Set<String> normalizeWebColors(List<String> colors) {
        return colors.stream()
                .filter(color -> color != null && !color.trim().isEmpty())
                .map(color -> color.trim().toLowerCase(Locale.ENGLISH))
                .collect(Collectors.toSet());
    }

    private Set<String> webColorsFor(CardInfo info) {
        ObjectColor color = info.getColor();
        Set<String> colors = new HashSet<>();
        if (color.isWhite()) colors.add("white");
        if (color.isBlue()) colors.add("blue");
        if (color.isBlack()) colors.add("black");
        if (color.isRed()) colors.add("red");
        if (color.isGreen()) colors.add("green");
        return colors;
    }

    private Object handleDeckValidate(WebSocket conn, JsonArray params) throws Exception {
        String deckType = getString(params, 0);
        DeckCardLists deckCardLists = getObject(params, 1, DeckCardLists.class);
        DeckValidator validator = DeckValidatorFactory.instance.createDeckValidator(deckType);
        if (validator == null) {
            throw new IllegalArgumentException("Unknown deck type: " + deckType);
        }

        Deck deck = Deck.load(deckCardLists, false, false);
        boolean valid = validator.validate(deck);
        return new DeckValidationResultInfo(deckType, validator, deck, valid);
    }

    private String getString(JsonArray params, int index) {
        return params.get(index).getAsString();
    }

    private UUID getUUID(JsonArray params, int index) {
        return UUID.fromString(params.get(index).getAsString());
    }

    private UUID getNullableUUID(JsonArray params, int index) {
        if (params.size() <= index || params.get(index).isJsonNull()) {
            return null;
        }
        return getUUID(params, index);
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
        startupLatch.countDown();
    }
}
