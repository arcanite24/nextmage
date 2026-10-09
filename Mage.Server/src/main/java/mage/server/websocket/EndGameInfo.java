package mage.server.websocket;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Web client bridge: the end of game summary (END_GAME_INFO) without the players' zones. Its PlayerViews carry every
 * battlefield, graveyard and exile in full (over 300 KB at the end of a four-player Commander game), while the client
 * reads only the scores and names from it: the final board already came with GAME_OVER.
 */
final class EndGameInfo {

    /** the PlayerView fields left out: whole zones of cards */
    static final String[] ZONES = {"battlefield", "graveyard", "exile", "sideboard", "helperCards", "commandList", "topCard"};

    private EndGameInfo() {
    }

    /** Drops the zones from the summary's players, in place; the callback as a JSON tree ({method, data, ...}). */
    static void slim(JsonObject callback) {
        JsonElement data = callback.get("data");
        if (data == null || !data.isJsonObject()) {
            return;
        }
        JsonObject view = data.getAsJsonObject();
        slimPlayer(view.get("clientPlayer"));
        JsonElement players = view.get("players");
        if (players != null && players.isJsonArray()) {
            for (JsonElement player : (JsonArray) players) {
                slimPlayer(player);
            }
        }
    }

    private static void slimPlayer(JsonElement player) {
        if (player == null || !player.isJsonObject()) {
            return;
        }
        for (String zone : ZONES) {
            player.getAsJsonObject().remove(zone);
        }
    }
}
