package mage.server.websocket;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import mage.constants.Constants;
import mage.constants.Zone;

import java.util.HashSet;
import java.util.Set;

/**
 * Web client bridge: names the pre-game questions that the server asks through generic dialogs, so the web client
 * doesn't have to recognize them by their English text.
 * <p>
 * The marker is added to the JSON copy of the prompt only, as {@code data.options["webPrompt"]}; the Java objects
 * (and so the desktop client) are untouched. Before the first turn ({@code gameView.step} absent):
 * <ul>
 * <li>{@code "mulligan"}: a {@code GAME_ASK} from {@code HumanPlayer.chooseMulligan}. Every other yes/no question
 * comes from {@code chooseUse}, which always sets {@link Constants.Option#AUTO_ANSWER_MESSAGE}; the mulligan
 * question never does.</li>
 * <li>{@code "mulliganBottom"}: a {@code GAME_TARGET} for cards in hand ({@code targetZone} {@code HAND}), as the
 * London mulligan asks for the cards to put on the bottom of the library.</li>
 * <li>{@code "startingPlayer"}: a {@code GAME_TARGET} whose choices are all players of the game.</li>
 * </ul>
 */
final class PromptMarkers {

    static final String OPTION = "webPrompt";
    static final String MULLIGAN = "mulligan";
    static final String MULLIGAN_BOTTOM = "mulliganBottom";
    static final String STARTING_PLAYER = "startingPlayer";

    private PromptMarkers() {
    }

    /**
     * Adds the marker to a serialized callback ({@code {"method": ..., "data": {...}}}) when it applies.
     *
     * @return the marker added, or null
     */
    static String annotate(JsonObject callback) {
        JsonElement methodElement = callback.get("method");
        JsonElement dataElement = callback.get("data");
        if (methodElement == null || !methodElement.isJsonPrimitive() || dataElement == null || !dataElement.isJsonObject()) {
            return null;
        }
        JsonObject data = dataElement.getAsJsonObject();
        String marker = classify(methodElement.getAsString(), data);
        if (marker != null) {
            JsonElement options = data.get("options");
            if (options == null || !options.isJsonObject()) {
                options = new JsonObject();
                data.add("options", options);
            }
            options.getAsJsonObject().addProperty(OPTION, marker);
        }
        return marker;
    }

    static String classify(String method, JsonObject data) {
        JsonObject gameView = object(data, "gameView");
        if (gameView == null || has(gameView, "step")) {
            // only questions asked before the first turn are marked
            return null;
        }
        JsonObject options = object(data, "options");
        switch (method) {
            case "GAME_ASK":
                if (options != null && !has(options, Constants.Option.AUTO_ANSWER_MESSAGE)
                        && has(options, "UI.left.btn.text")) {
                    return MULLIGAN;
                }
                return null;
            case "GAME_TARGET":
                if (options != null && options.has("targetZone") && options.get("targetZone").isJsonPrimitive()
                        && Zone.HAND.name().equals(options.get("targetZone").getAsString())) {
                    return MULLIGAN_BOTTOM;
                }
                Set<String> targets = strings(data.get("targets"));
                if (!targets.isEmpty() && playerIds(gameView).containsAll(targets)) {
                    return STARTING_PLAYER;
                }
                return null;
            default:
                return null;
        }
    }

    private static boolean has(JsonObject object, String key) {
        JsonElement value = object.get(key);
        return value != null && !value.isJsonNull();
    }

    private static JsonObject object(JsonObject parent, String key) {
        JsonElement value = parent.get(key);
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : null;
    }

    private static Set<String> strings(JsonElement value) {
        Set<String> result = new HashSet<>();
        if (value != null && value.isJsonArray()) {
            for (JsonElement item : value.getAsJsonArray()) {
                if (item.isJsonPrimitive()) {
                    result.add(item.getAsString());
                }
            }
        }
        return result;
    }

    private static Set<String> playerIds(JsonObject gameView) {
        Set<String> ids = new HashSet<>();
        JsonElement players = gameView.get("players");
        if (players != null && players.isJsonArray()) {
            for (JsonElement player : (JsonArray) players) {
                if (player.isJsonObject() && player.getAsJsonObject().has("playerId")) {
                    ids.add(player.getAsJsonObject().get("playerId").getAsString());
                }
            }
        }
        return ids;
    }
}
