package mage.server.websocket;

import mage.interfaces.MageServer;
import mage.interfaces.callback.ClientCallbackMethod;
import mage.server.websocket.api.ApiContext;
import mage.server.websocket.api.WebClientApi;
import mage.server.websocket.rpc.RpcMethod;
import mage.server.websocket.rpc.RpcParam;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Keeps the web client protocol reference and the client's generated method map in sync with the server.
 * <p>
 * After changing RPC methods or callbacks, regenerate with:
 * {@code mvn -pl Mage.Server test -Dtest=WebClientApiDocsTest -Dxmage.updateWebApiDocs=true}
 */
public class WebClientApiDocsTest {

    private static final Path DOC_FILE = Paths.get("..", "docs", "WebSocketAPI.md");
    private static final Path TS_FILE = Paths.get("..", "Mage.Web.Client", "src", "protocol", "generated", "protocol.ts");
    private static final String BEGIN_METHODS = "<!-- BEGIN GENERATED: methods -->";
    private static final String END_METHODS = "<!-- END GENERATED: methods -->";
    private static final String BEGIN_CALLBACKS = "<!-- BEGIN GENERATED: callbacks -->";
    private static final String END_CALLBACKS = "<!-- END GENERATED: callbacks -->";

    // payload of each server callback ("data" field), see where the server fires them
    private static final Map<ClientCallbackMethod, String> CALLBACK_DATA = new HashMap<>();

    static {
        CALLBACK_DATA.put(ClientCallbackMethod.CHATMESSAGE, "ChatMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.SHOW_USERMESSAGE, "string[]");
        CALLBACK_DATA.put(ClientCallbackMethod.SERVER_MESSAGE, "ChatMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.JOINED_TABLE, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.START_TOURNAMENT, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.TOURNAMENT_INIT, "TournamentView");
        CALLBACK_DATA.put(ClientCallbackMethod.TOURNAMENT_UPDATE, "TournamentView");
        CALLBACK_DATA.put(ClientCallbackMethod.TOURNAMENT_OVER, "string");
        CALLBACK_DATA.put(ClientCallbackMethod.START_DRAFT, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.SIDEBOARD, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.CONSTRUCT, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.DRAFT_OVER, "null");
        CALLBACK_DATA.put(ClientCallbackMethod.DRAFT_INIT, "DraftClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.DRAFT_PICK, "DraftClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.DRAFT_UPDATE, "DraftClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.SHOW_TOURNAMENT, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.WATCHGAME, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.VIEW_LIMITED_DECK, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.VIEW_SIDEBOARD, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.USER_REQUEST_DIALOG, "UserRequestMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_REDRAW_GUI, "null");
        CALLBACK_DATA.put(ClientCallbackMethod.START_GAME, "TableClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_INIT, "GameView");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_UPDATE_AND_INFORM, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_INFORM_PERSONAL, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_ERROR, "string");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_UPDATE, "GameView");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_TARGET, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_CHOOSE_ABILITY, "AbilityPickerView");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_CHOOSE_PILE, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_CHOOSE_CHOICE, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_ASK, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_SELECT, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_PLAY_MANA, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_PLAY_XMANA, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_GET_AMOUNT, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_GET_MULTI_AMOUNT, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.GAME_OVER, "GameClientMessage");
        CALLBACK_DATA.put(ClientCallbackMethod.END_GAME_INFO, "GameEndView");
        CALLBACK_DATA.put(ClientCallbackMethod.REPLAY_GAME, "null");
        CALLBACK_DATA.put(ClientCallbackMethod.REPLAY_INIT, "GameView");
        CALLBACK_DATA.put(ClientCallbackMethod.REPLAY_UPDATE, "GameView");
        CALLBACK_DATA.put(ClientCallbackMethod.REPLAY_DONE, "string");
    }

    @Test
    void protocolReferenceIsUpToDate() throws IOException {
        List<RpcMethod> methods = createMethods();

        String doc = new String(Files.readAllBytes(DOC_FILE), StandardCharsets.UTF_8);
        String expectedDoc = replaceSection(replaceSection(doc, BEGIN_METHODS, END_METHODS, methodsMarkdown(methods)),
                BEGIN_CALLBACKS, END_CALLBACKS, callbacksMarkdown());
        String expectedTs = typescript(methods);

        if (Boolean.getBoolean("xmage.updateWebApiDocs")) {
            Files.write(DOC_FILE, expectedDoc.getBytes(StandardCharsets.UTF_8));
            Files.createDirectories(TS_FILE.getParent());
            Files.write(TS_FILE, expectedTs.getBytes(StandardCharsets.UTF_8));
            doc = expectedDoc;
        }

        String hint = "regenerate with -Dxmage.updateWebApiDocs=true (see class javadoc)";
        assertThat(doc).as("docs/WebSocketAPI.md is stale, " + hint).isEqualTo(expectedDoc);
        assertThat(TS_FILE).as("generated client protocol is missing, " + hint).exists();
        assertThat(new String(Files.readAllBytes(TS_FILE), StandardCharsets.UTF_8))
                .as("generated client protocol is stale, " + hint).isEqualTo(expectedTs);
    }

    @Test
    void everyCallbackHasADocumentedPayload() {
        for (ClientCallbackMethod method : ClientCallbackMethod.values()) {
            assertThat(CALLBACK_DATA).as("payload type of " + method).containsKey(method);
        }
    }

    private static List<RpcMethod> createMethods() {
        MageServer server = (MageServer) Proxy.newProxyInstance(MageServer.class.getClassLoader(),
                new Class<?>[]{MageServer.class}, (proxy, method, args) -> null);
        return WebClientApi.createDispatcher(new ApiContext(server, null, null)).getMethods();
    }

    private static String replaceSection(String text, String begin, String end, String content) {
        int start = text.indexOf(begin);
        int finish = text.indexOf(end);
        assertThat(start).as("marker " + begin + " in " + DOC_FILE).isGreaterThanOrEqualTo(0);
        assertThat(finish).as("marker " + end + " in " + DOC_FILE).isGreaterThan(start);
        return text.substring(0, start + begin.length()) + "\n" + content + text.substring(finish);
    }

    private static String methodsMarkdown(List<RpcMethod> methods) {
        StringBuilder sb = new StringBuilder();
        sb.append("| Method | Params | Result | Access | Description |\n");
        sb.append("|--------|--------|--------|--------|-------------|\n");
        for (RpcMethod method : methods) {
            String params = method.getParams().stream()
                    .map(p -> "`" + p.getName() + (p.isOptional() ? "?" : "") + ": " + p.getTsType() + "`")
                    .collect(Collectors.joining(", "));
            sb.append("| `").append(method.getName()).append("` | ")
                    .append(params.isEmpty() ? "-" : params).append(" | `")
                    .append(method.getResultType().replace("|", "\\|")).append("` | ")
                    .append(accessLabel(method)).append(" | ")
                    .append(method.getDescription().replace("|", "\\|")).append(" |\n");
        }
        return sb.toString();
    }

    private static String accessLabel(RpcMethod method) {
        switch (method.getAccess()) {
            case PUBLIC:
                return "public";
            case ESTABLISH:
                return "login";
            case SESSION:
            default:
                return "session";
        }
    }

    private static String callbacksMarkdown() {
        StringBuilder sb = new StringBuilder();
        sb.append("| Method | Data | Delivery | Description |\n");
        sb.append("|--------|------|----------|-------------|\n");
        for (ClientCallbackMethod method : ClientCallbackMethod.values()) {
            sb.append("| `").append(method.name()).append("` | `").append(CALLBACK_DATA.get(method)).append("` | ")
                    .append(method.getType().name())
                    .append(method.getType().canComeInAnyOrder() ? " (may be dropped when outdated)" : " (ordered)")
                    .append(" | ").append(callbackDescription(method)).append(" |\n");
        }
        return sb.toString();
    }

    private static String callbackDescription(ClientCallbackMethod method) {
        switch (method.getType()) {
            case DIALOG:
                return "Prompt: the player must answer with a sendPlayer* call.";
            case UPDATE:
                return "State snapshot; newer ones replace older ones.";
            case MESSAGE:
                return "Message for the player or a log.";
            case CLIENT_SIDE_EVENT:
                return "Not sent by the server.";
            case TABLE_CHANGE:
            default:
                return "Lifecycle event: open, switch or close a screen.";
        }
    }

    private static String typescript(List<RpcMethod> methods) {
        StringBuilder sb = new StringBuilder();
        sb.append("// Generated by Mage.Server WebClientApiDocsTest from the server's RPC registry. Do not edit.\n");
        sb.append("// Regenerate: mvn -pl Mage.Server test -Dtest=WebClientApiDocsTest -Dxmage.updateWebApiDocs=true\n\n");
        sb.append("export type RpcAccess = 'public' | 'session' | 'login';\n\n");
        sb.append("export interface RpcParamSpec {\n  readonly name: string;\n  readonly type: string;\n  readonly optional: boolean;\n}\n\n");
        sb.append("export interface RpcMethodSpec {\n  readonly access: RpcAccess;\n  readonly sessionParam: number;\n")
                .append("  readonly params: readonly RpcParamSpec[];\n  readonly result: string;\n}\n\n");
        sb.append("export const RPC_METHODS = {\n");
        for (RpcMethod method : methods) {
            sb.append("  ").append(method.getName()).append(": {\n");
            sb.append("    access: '").append(accessLabel(method)).append("',\n");
            sb.append("    sessionParam: ").append(method.getSessionParam()).append(",\n");
            sb.append("    params: [");
            for (int i = 0; i < method.getParams().size(); i++) {
                RpcParam p = method.getParams().get(i);
                sb.append(i == 0 ? "\n" : "")
                        .append("      { name: '").append(p.getName()).append("', type: '").append(p.getTsType())
                        .append("', optional: ").append(p.isOptional()).append(" },\n");
            }
            sb.append(method.getParams().isEmpty() ? "" : "    ").append("],\n");
            sb.append("    result: '").append(method.getResultType()).append("',\n");
            sb.append("  },\n");
        }
        sb.append("} as const satisfies Record<string, RpcMethodSpec>;\n\n");
        sb.append("export type RpcMethodName = keyof typeof RPC_METHODS;\n\n");

        Map<String, String> callbacks = new LinkedHashMap<>();
        for (ClientCallbackMethod method : ClientCallbackMethod.values()) {
            callbacks.put(method.name(), String.format("{ type: '%s', anyOrder: %s, data: '%s' }",
                    method.getType().name(), method.getType().canComeInAnyOrder(), CALLBACK_DATA.get(method)));
        }
        sb.append("export const CALLBACK_METHODS = {\n");
        callbacks.forEach((name, spec) -> sb.append("  ").append(name).append(": ").append(spec).append(",\n"));
        sb.append("} as const;\n\n");
        sb.append("export type CallbackMethodName = keyof typeof CALLBACK_METHODS;\n");
        return sb.toString();
    }
}
