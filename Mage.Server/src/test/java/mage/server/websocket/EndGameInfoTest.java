package mage.server.websocket;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Web client bridge: the end of game summary goes out without the players' zones, keeping what the client reads.
 */
public class EndGameInfoTest {

    private static final String PLAYER = "{\"playerId\":\"p1\",\"name\":\"Alice\",\"life\":7,\"wins\":1,"
            + "\"battlefield\":{\"c1\":{\"name\":\"Forest\"}},\"graveyard\":{\"c2\":{}},\"exile\":{},\"sideboard\":{},"
            + "\"commandList\":[{}],\"topCard\":{\"name\":\"Island\"}}";

    @Test
    void playersKeepTheirScoresButNotTheirZones() {
        JsonObject callback = JsonParser.parseString("{\"method\":\"END_GAME_INFO\",\"data\":{\"gameInfo\":\"You won\",\"wins\":1,"
                + "\"winsNeeded\":2,\"clientPlayer\":" + PLAYER + ",\"players\":[" + PLAYER + "," + PLAYER + "]}}").getAsJsonObject();
        EndGameInfo.slim(callback);

        JsonObject data = callback.getAsJsonObject("data");
        assertThat(data.get("gameInfo").getAsString()).isEqualTo("You won");
        assertThat(data.get("winsNeeded").getAsInt()).isEqualTo(2);
        for (JsonObject player : new JsonObject[]{data.getAsJsonObject("clientPlayer"),
                data.getAsJsonArray("players").get(0).getAsJsonObject(), data.getAsJsonArray("players").get(1).getAsJsonObject()}) {
            assertThat(player.keySet()).containsExactlyInAnyOrder("playerId", "name", "life", "wins");
        }
    }

    @Test
    void anEmptySummaryIsLeftAlone() {
        JsonObject callback = JsonParser.parseString("{\"method\":\"END_GAME_INFO\",\"data\":null}").getAsJsonObject();
        EndGameInfo.slim(callback);
        assertThat(callback.get("data").isJsonNull()).isTrue();
    }
}
