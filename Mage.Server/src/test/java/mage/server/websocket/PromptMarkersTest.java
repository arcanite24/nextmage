package mage.server.websocket;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.constants.Constants;
import mage.interfaces.callback.ClientCallback;
import mage.interfaces.callback.ClientCallbackMethod;
import mage.view.GameClientMessage;
import org.junit.jupiter.api.Test;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Web client bridge: pre-game prompts carry a marker instead of being recognized by their text.
 */
public class PromptMarkersTest {

    private static final String ME = "11111111-1111-1111-1111-111111111111";
    private static final String THEM = "22222222-2222-2222-2222-222222222222";
    private static final String CARD = "33333333-3333-3333-3333-333333333333";

    private static JsonObject callback(String method, String data) {
        return JsonParser.parseString("{\"method\":\"" + method + "\",\"data\":" + data + "}").getAsJsonObject();
    }

    private static String pregameView() {
        return "{\"players\":[{\"playerId\":\"" + ME + "\"},{\"playerId\":\"" + THEM + "\"}]}";
    }

    private static String inGameView() {
        return "{\"step\":\"UPKEEP\",\"players\":[{\"playerId\":\"" + ME + "\"},{\"playerId\":\"" + THEM + "\"}]}";
    }

    private static String marker(JsonObject callback) {
        JsonObject options = callback.getAsJsonObject("data").getAsJsonObject("options");
        return options == null || !options.has(PromptMarkers.OPTION) ? null : options.get(PromptMarkers.OPTION).getAsString();
    }

    @Test
    void mulliganQuestionIsMarked() {
        JsonObject json = callback("GAME_ASK", "{\"gameView\":" + pregameView()
                + ",\"message\":\"Mulligan for free?\",\"options\":{\"UI.left.btn.text\":\"Mulligan\",\"UI.right.btn.text\":\"Keep\"}}");
        assertThat(PromptMarkers.annotate(json)).isEqualTo(PromptMarkers.MULLIGAN);
        assertThat(marker(json)).isEqualTo("mulligan");
    }

    @Test
    void otherPregameQuestionsAreNotMulligans() {
        // chooseUse (Leyline, Serum Powder...) always carries the auto-answer key
        JsonObject json = callback("GAME_ASK", "{\"gameView\":" + pregameView()
                + ",\"options\":{\"UI.left.btn.text\":\"Yes\",\"" + Constants.Option.AUTO_ANSWER_MESSAGE + "\":\"Put it onto the battlefield?\"}}");
        assertThat(PromptMarkers.annotate(json)).isNull();
        assertThat(marker(json)).isNull();
    }

    @Test
    void questionsDuringTheGameAreNeverMarked() {
        JsonObject json = callback("GAME_ASK", "{\"gameView\":" + inGameView()
                + ",\"options\":{\"UI.left.btn.text\":\"Mulligan\",\"UI.right.btn.text\":\"Keep\"}}");
        assertThat(PromptMarkers.annotate(json)).isNull();
    }

    @Test
    void londonBottomIsMarked() {
        JsonObject json = callback("GAME_TARGET", "{\"gameView\":" + pregameView()
                + ",\"targets\":[\"" + CARD + "\"],\"options\":{\"targetZone\":\"HAND\",\"chosenTargets\":[]}}");
        assertThat(PromptMarkers.annotate(json)).isEqualTo(PromptMarkers.MULLIGAN_BOTTOM);
    }

    @Test
    void choosingAmongPlayersBeforeTheGameIsTheStartingPlayer() {
        JsonObject json = callback("GAME_TARGET", "{\"gameView\":" + pregameView()
                + ",\"targets\":[\"" + ME + "\",\"" + THEM + "\"],\"options\":{\"targetZone\":\"ALL\"}}");
        assertThat(PromptMarkers.annotate(json)).isEqualTo(PromptMarkers.STARTING_PLAYER);
    }

    @Test
    void targetsDuringTheGameAreNotMarked() {
        JsonObject json = callback("GAME_TARGET", "{\"gameView\":" + inGameView()
                + ",\"targets\":[\"" + ME + "\",\"" + THEM + "\"],\"options\":{\"targetZone\":\"ALL\"}}");
        assertThat(PromptMarkers.annotate(json)).isNull();
    }

    @Test
    void serializedPromptsWithoutAViewAreLeftAlone() {
        Map<String, Serializable> options = new HashMap<>();
        options.put("UI.left.btn.text", "Mulligan");
        ClientCallback callback = new ClientCallback(ClientCallbackMethod.GAME_ASK, UUID.randomUUID(),
                new GameClientMessage(null, options, "Mulligan?"));
        JsonObject json = JsonParser.parseString(WebSocketCallbackHandler.serialize(callback)).getAsJsonObject();
        assertThat(json.get("method").getAsString()).isEqualTo("GAME_ASK");
        assertThat(marker(json)).isNull();
        // desktop objects are never changed
        assertThat(options).doesNotContainKey(PromptMarkers.OPTION);
    }
}
