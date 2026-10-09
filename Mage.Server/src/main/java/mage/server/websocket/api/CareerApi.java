package mage.server.websocket.api;

import mage.cards.decks.DeckCardLists;
import mage.game.match.MatchOptions;
import mage.players.PlayerType;
import mage.server.career.CareerContent;
import mage.server.career.CareerPayout;
import mage.server.career.CareerProfile;
import mage.server.career.CareerService;
import mage.server.career.CareerStore;
import mage.server.websocket.rpc.RpcCall;
import mage.server.websocket.rpc.RpcException;
import mage.server.websocket.rpc.RpcMethod;
import mage.view.TableView;
import org.apache.log4j.Logger;

import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.object;
import static mage.server.websocket.rpc.RpcParam.of;

/**
 * Web client bridge: the optional single-player Career. Everything is kept and decided on the server: the
 * collection, coins, which opponents are open, and what a match pays.
 */
final class CareerApi {

    private static final Logger logger = Logger.getLogger(CareerApi.class);

    private CareerApi() {
    }

    /** The Career screen's state: whether Career is offered, and the account's Career if it has one. */
    public static class CareerState {
        public boolean enabled;
        public CareerProfile profile;
        /** the latest payouts, newest first */
        public List<CareerPayout> recent;
    }

    /** A Career match was set up; the game starts like any other. */
    public static class CareerMatch {
        public String tableId;
        public String opponentId;
    }

    static List<RpcMethod> methods(ApiContext ctx) {
        return Arrays.asList(
                RpcMethod.named("careerState")
                        .returns("CareerState")
                        .doc("Whether this server offers Career, and the signed-in account's Career (profile null before it opens one).")
                        .handler(call -> {
                            CareerState state = new CareerState();
                            state.enabled = enabled(ctx);
                            if (state.enabled) {
                                String user = user(ctx, call);
                                state.profile = store(() -> CareerStore.get().profile(user));
                                state.recent = store(() -> CareerStore.get().payouts(user, 10));
                            }
                            return state;
                        }),

                RpcMethod.named("careerStarters")
                        .returns("CareerStarter[]")
                        .doc("The starter decks a Career can open with.")
                        .handler(call -> {
                            career(ctx, call);
                            return CareerContent.get().starters();
                        }),

                RpcMethod.named("careerStart")
                        .params(of("starterId", STRING))
                        .returns("CareerProfile")
                        .doc("Open a Career with a starter deck: its cards become the collection, plus coins for a first pack.")
                        .handler(call -> {
                            String user = career(ctx, call);
                            String starterId = call.string(0);
                            return store(() -> CareerService.get().start(user, starterId));
                        }),

                RpcMethod.named("careerCollection")
                        .returns("CareerCard[]")
                        .doc("Every card the account owns in Career, by printing. Basic lands are free and not listed.")
                        .handler(call -> {
                            String user = career(ctx, call);
                            return store(() -> CareerStore.get().collection(user));
                        }),

                RpcMethod.named("careerOpponents")
                        .returns("CareerOpponent[]")
                        .doc("The AI opponents in tiers, with the account's wins against each and which are open. A tier opens "
                                + "after enough wins in the one before.")
                        .handler(call -> {
                            String user = career(ctx, call);
                            return store(() -> CareerService.get().opponents(user));
                        }),

                RpcMethod.named("careerPlay")
                        .params(of("opponentId", STRING), object("deck", "DeckCardLists"))
                        .returns("CareerMatch")
                        .doc("Start a Career match against an open opponent with a deck of owned cards (basic lands are free). "
                                + "The server sets up the table and starts the match; the game arrives like any other.")
                        .handler(call -> play(ctx, call)),

                RpcMethod.named("careerShop")
                        .returns("CareerShopSet[]")
                        .doc("The sets the Career shop sells packs of, newest first, with the price in coins.")
                        .handler(call -> {
                            career(ctx, call);
                            return CareerService.get().shop();
                        }),

                RpcMethod.named("careerBuyPack")
                        .params(of("setCode", STRING))
                        .returns("CareerPackResult")
                        .doc("Buy and open a pack. Copies past four of a card become coins (commons, uncommons) or a wildcard "
                                + "(rares, mythics); those cards say so in convertedTo.")
                        .handler(call -> {
                            String user = career(ctx, call);
                            String setCode = call.string(0);
                            return store(() -> CareerService.get().buyPack(user, setCode));
                        }),

                RpcMethod.named("careerCraft")
                        .params(of("setCode", STRING), of("cardNumber", STRING))
                        .returns("CareerProfile")
                        .doc("Craft one copy of a card: commons and uncommons cost coins, rares and mythics a wildcard of their rarity.")
                        .handler(call -> {
                            String user = career(ctx, call);
                            String setCode = call.string(0);
                            String cardNumber = call.string(1);
                            return store(() -> CareerService.get().craft(user, setCode, cardNumber));
                        }),

                RpcMethod.named("careerExport")
                        .returns("string")
                        .doc("The account's whole Career as a signed text file, to keep a copy.")
                        .handler(call -> {
                            String user = career(ctx, call);
                            return store(() -> CareerService.get().export(user));
                        }),

                RpcMethod.named("careerImport")
                        .params(of("data", STRING))
                        .returns("CareerProfile")
                        .doc("Bring back an exported Career, for an account that has none. Only files this server made for this "
                                + "account are taken.")
                        .handler(call -> {
                            String user = career(ctx, call);
                            String data = call.string(0);
                            return store(() -> CareerService.get().importFile(user, data));
                        })
        );
    }

    static boolean enabled(ApiContext ctx) {
        return ctx.managers != null && CareerService.enabled(ctx.managers.configSettings().isAuthenticationActivated());
    }

    static String user(ApiContext ctx, RpcCall call) throws RpcException {
        return ctx.sessions.userName(call.sessionId()).orElseThrow(() -> RpcException.notAuthorized("Sign in first"));
    }

    /** the signed-in account, when this server offers Career */
    static String career(ApiContext ctx, RpcCall call) throws RpcException {
        String user = user(ctx, call);
        if (!enabled(ctx)) {
            throw RpcException.notAuthorized("This server doesn't offer Career");
        }
        return user;
    }

    interface StoreCall<T> {
        T run() throws SQLException, CareerService.CareerException;
    }

    static <T> T store(StoreCall<T> work) throws RpcException {
        try {
            return work.run();
        } catch (CareerService.CareerException e) {
            throw RpcException.invalidParams(e.getMessage());
        } catch (SQLException | IllegalStateException e) {
            logger.error("Career store failed", e);
            throw new RpcException(RpcException.SERVER_ERROR, "Career progress can't be read or saved right now", e);
        }
    }

    private static Object play(ApiContext ctx, RpcCall call) throws RpcException {
        String user = career(ctx, call);
        String opponentId = call.string(0);
        DeckCardLists deck = call.object(1, DeckCardLists.class);
        CareerContent content = CareerContent.get();
        CareerContent.Opponent opponent = content.opponent(opponentId);
        if (opponent == null) {
            throw RpcException.invalidParams("There is no opponent " + opponentId + ".");
        }
        if (store(() -> CareerStore.get().profile(user)) == null) {
            throw RpcException.invalidParams("Open a Career first.");
        }
        if (!store(() -> CareerService.get().unlocked(user, opponentId))) {
            throw RpcException.invalidParams(opponent.name + " isn't open yet: win more games in the tier before.");
        }
        int size = deck.getCards().stream().mapToInt(card -> card.getAmount()).sum();
        if (size < 60) {
            throw RpcException.invalidParams("A Career deck needs at least 60 cards; this one has " + size + ".");
        }
        List<String> problems = store(() -> CareerService.get().ownershipProblems(user, deck));
        if (!problems.isEmpty()) {
            throw RpcException.invalidParams("You don't own enough copies: " + String.join("; ", problems.subList(0, Math.min(5, problems.size())))
                    + (problems.size() > 5 ? " (and " + (problems.size() - 5) + " more)" : "") + ".");
        }
        DeckCardLists opponentDeck;
        try {
            opponentDeck = content.opponentDeck(opponent);
        } catch (java.io.IOException e) {
            throw new RpcException(RpcException.SERVER_ERROR, "The opponent's deck can't be read", e);
        }

        String sessionId = call.sessionId();
        UUID roomId = ctx.managers.gamesRoomManager().getMainRoomId();
        MatchOptions options = new MatchOptions(user + " vs " + opponent.name, "Two Player Duel", false);
        options.setDeckType("Constructed - Freeform");
        options.setWinsNeeded(1);
        // a rollback could replay a lost game for its payout
        options.setRollbackTurnsAllowed(false);
        options.setSpectatorsAllowed(true);
        int skill = opponent.skill != null ? opponent.skill : content.tier(opponent.tier).skill;
        PlayerType aiType = opponent.aiType != null ? PlayerType.valueOf(opponent.aiType) : PlayerType.COMPUTER_MAD;
        // the table's seats: without them nobody can join
        options.getPlayerTypes().add(PlayerType.HUMAN);
        options.getPlayerTypes().add(aiType);
        UUID tableId = null;
        try {
            TableView table = ctx.server.roomCreateTable(sessionId, roomId, options);
            tableId = table.getTableId();
            CareerService.get().register(tableId, user, opponent.id, opponent.tier);
            if (!ctx.server.roomJoinTable(sessionId, roomId, tableId, user, PlayerType.HUMAN, 1, deck, "")) {
                throw RpcException.invalidParams("Your deck wasn't accepted for the table.");
            }
            String aiName = opponent.name.length() > 14 ? opponent.name.substring(0, 14).trim() : opponent.name;
            if (!ctx.server.roomJoinTable(sessionId, roomId, tableId, aiName, aiType, skill, opponentDeck, "")) {
                throw new RpcException(RpcException.SERVER_ERROR, opponent.name + " couldn't take a seat.");
            }
            if (!ctx.server.matchStart(sessionId, roomId, tableId)) {
                throw new RpcException(RpcException.SERVER_ERROR, "The match couldn't start.");
            }
        } catch (RpcException e) {
            abandon(ctx, sessionId, roomId, tableId);
            throw e;
        } catch (Exception e) {
            abandon(ctx, sessionId, roomId, tableId);
            throw new RpcException(RpcException.SERVER_ERROR, "The Career match couldn't be set up: " + e.getMessage(), e);
        }
        CareerMatch match = new CareerMatch();
        match.tableId = tableId.toString();
        match.opponentId = opponent.id;
        return match;
    }

    private static void abandon(ApiContext ctx, String sessionId, UUID roomId, UUID tableId) {
        if (tableId == null) {
            return;
        }
        CareerService.get().forget(tableId);
        try {
            ctx.server.tableRemove(sessionId, roomId, tableId);
        } catch (Exception e) {
            logger.warn("Career: an unfinished table couldn't be removed", e);
        }
    }
}
