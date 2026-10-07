package mage.server.websocket.api;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import mage.constants.ManaType;
import mage.constants.PlayerAction;
import mage.server.websocket.rpc.RpcCall;
import mage.server.websocket.rpc.RpcException;
import mage.server.websocket.rpc.RpcMethod;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static mage.server.websocket.rpc.RpcParam.Type.ANY;
import static mage.server.websocket.rpc.RpcParam.Type.BOOLEAN;
import static mage.server.websocket.rpc.RpcParam.Type.INT;
import static mage.server.websocket.rpc.RpcParam.Type.STRING;
import static mage.server.websocket.rpc.RpcParam.of;
import static mage.server.websocket.rpc.RpcParam.optional;

/**
 * Web client bridge: playing, watching and replaying games.
 */
final class GameApi {

    private GameApi() {
    }

    static List<RpcMethod> methods(ApiContext ctx) {
        return Arrays.asList(
                RpcMethod.named("gameJoin")
                        .session(1)
                        .params(of("gameId", mage.server.websocket.rpc.RpcParam.Type.UUID), of("sessionId", STRING))
                        .doc("Join a started game as a player (after START_GAME). Also used to resync after a reconnect.")
                        .handler(call -> {
                            ctx.server.gameJoin(call.uuid(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("matchQuit")
                        .session(1)
                        .params(gameId(), of("sessionId", STRING))
                        .doc("Concede the whole match.")
                        .handler(call -> {
                            ctx.server.matchQuit(call.uuid(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("gameWatchStart")
                        .session(1)
                        .params(gameId(), of("sessionId", STRING))
                        .doc("Start spectating a game.")
                        .handler(call -> ctx.server.gameWatchStart(call.uuid(0), call.string(1))),

                RpcMethod.named("gameWatchStop")
                        .session(1)
                        .params(gameId(), of("sessionId", STRING))
                        .doc("Stop spectating a game.")
                        .handler(call -> {
                            ctx.server.gameWatchStop(call.uuid(0), call.string(1));
                            return true;
                        }),

                RpcMethod.named("sendPlayerUUID")
                        .session(1)
                        .params(gameId(), of("sessionId", STRING), optional("data", mage.server.websocket.rpc.RpcParam.Type.UUID))
                        .doc("Answer a prompt with an object or player id (targets, choices, attackers, blockers).")
                        .handler(call -> {
                            ctx.server.sendPlayerUUID(call.uuid(0), call.string(1), call.optUuid(2));
                            return true;
                        }),

                RpcMethod.named("sendPlayerString")
                        .session(1)
                        .params(gameId(), of("sessionId", STRING), of("data", STRING))
                        .doc("Answer a prompt with text (choices, \"special\" mana payment).")
                        .handler(call -> {
                            ctx.server.sendPlayerString(call.uuid(0), call.string(1), call.string(2));
                            return true;
                        }),

                RpcMethod.named("sendPlayerBoolean")
                        .session(1)
                        .params(gameId(), of("sessionId", STRING), of("data", BOOLEAN))
                        .doc("Answer a yes/no prompt, pass priority (false) or cancel mana payment (any value).")
                        .handler(call -> {
                            ctx.server.sendPlayerBoolean(call.uuid(0), call.string(1), call.bool(2));
                            return true;
                        }),

                RpcMethod.named("sendPlayerInteger")
                        .session(1)
                        .params(gameId(), of("sessionId", STRING), of("data", INT))
                        .doc("Answer an amount prompt.")
                        .handler(call -> {
                            ctx.server.sendPlayerInteger(call.uuid(0), call.string(1), call.integer(2));
                            return true;
                        }),

                RpcMethod.named("sendPlayerManaType")
                        .session(2)
                        .params(gameId(), of("playerId", mage.server.websocket.rpc.RpcParam.Type.UUID), of("sessionId", STRING),
                                of("manaType", STRING).typed("ManaType"))
                        .doc("Pay from the mana pool with one mana type.")
                        .handler(call -> {
                            ctx.server.sendPlayerManaType(call.uuid(0), call.uuid(1), call.string(2), manaType(call, 3));
                            return true;
                        }),

                RpcMethod.named("sendPlayerAction")
                        .session(2)
                        .params(of("action", STRING).typed("PlayerAction"), gameId(), of("sessionId", STRING), optional("data", ANY))
                        .doc("Send a player action: pass modes (F-keys), concede, undo, rollback, auto-answer and trigger-order settings.")
                        .handler(call -> {
                            ctx.server.sendPlayerAction(playerAction(call, 0), call.uuid(1), call.string(2),
                                    call.has(3) ? actionData(call.raw(3)) : null);
                            return true;
                        }),

                RpcMethod.named("cheatShow")
                        .session(1)
                        .params(gameId(), of("sessionId", STRING), of("playerId", mage.server.websocket.rpc.RpcParam.Type.UUID))
                        .doc("Test mode only: reveal a player's library.")
                        .handler(call -> {
                            ctx.server.cheatShow(call.uuid(0), call.string(1), call.uuid(2));
                            return true;
                        }),

                replay(ctx, "replayInit", "Open a saved game for replay."),
                replay(ctx, "replayStart", "Start the replay."),
                replay(ctx, "replayStop", "Stop the replay."),
                replay(ctx, "replayNext", "Step forward."),
                replay(ctx, "replayPrevious", "Step back."),

                RpcMethod.named("replaySkipForward")
                        .session(1)
                        .params(gameId(), of("sessionId", STRING), of("moves", INT))
                        .doc("Skip several steps forward.")
                        .handler(call -> {
                            ctx.server.replaySkipForward(call.uuid(0), call.string(1), call.integer(2));
                            return true;
                        })
        );
    }

    private static mage.server.websocket.rpc.RpcParam gameId() {
        return of("gameId", mage.server.websocket.rpc.RpcParam.Type.UUID);
    }

    private static RpcMethod replay(ApiContext ctx, String name, String description) {
        return RpcMethod.named(name)
                .session(1)
                .params(gameId(), of("sessionId", STRING))
                .doc(description)
                .handler(call -> {
                    UUID gameId = call.uuid(0);
                    String sessionId = call.string(1);
                    switch (name) {
                        case "replayInit":
                            ctx.server.replayInit(gameId, sessionId);
                            break;
                        case "replayStart":
                            ctx.server.replayStart(gameId, sessionId);
                            break;
                        case "replayStop":
                            ctx.server.replayStop(gameId, sessionId);
                            break;
                        case "replayNext":
                            ctx.server.replayNext(gameId, sessionId);
                            break;
                        case "replayPrevious":
                            ctx.server.replayPrevious(gameId, sessionId);
                            break;
                        default:
                            throw new IllegalStateException("Unknown replay method " + name);
                    }
                    return true;
                });
    }

    private static ManaType manaType(RpcCall call, int index) throws RpcException {
        String value = call.string(index);
        try {
            return ManaType.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw RpcException.invalidParams("Unknown mana type: " + value);
        }
    }

    private static PlayerAction playerAction(RpcCall call, int index) throws RpcException {
        String value = call.string(index);
        try {
            return PlayerAction.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw RpcException.invalidParams("Unknown player action: " + value);
        }
    }

    /**
     * Player actions carry a UUID, a number, a boolean or a string, depending on the action.
     */
    private static Object actionData(JsonElement data) throws RpcException {
        if (!data.isJsonPrimitive()) {
            throw RpcException.invalidParams("Player action data must be a string, number or boolean");
        }
        JsonPrimitive primitive = data.getAsJsonPrimitive();
        if (primitive.isBoolean()) {
            return primitive.getAsBoolean();
        }
        if (primitive.isNumber()) {
            return primitive.getAsInt();
        }
        String text = primitive.getAsString();
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException e) {
            return text;
        }
    }
}
