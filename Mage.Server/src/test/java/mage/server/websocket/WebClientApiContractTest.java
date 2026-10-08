package mage.server.websocket;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import mage.interfaces.MageServer;
import mage.interfaces.ServerState;
import mage.server.DisconnectReason;
import mage.server.websocket.api.ApiContext;
import mage.server.websocket.api.WebClientApi;
import mage.server.websocket.rpc.RpcConnection;
import mage.server.websocket.rpc.RpcDispatcher;
import mage.server.websocket.rpc.RpcException;
import mage.server.websocket.rpc.RpcMethod;
import mage.server.websocket.rpc.RpcParam;
import mage.server.websocket.rpc.RpcSessions;
import org.jboss.remoting.callback.InvokerCallbackHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Contract tests for the web client bridge: every RPC method maps to the right server call,
 * with the caller's own session, and access rules hold.
 */
public class WebClientApiContractTest {

    // RPC methods that are served by the bridge itself instead of a same-named MageServer method
    private static final Map<String, String> SERVER_METHOD_OVERRIDES = new HashMap<>();
    private static final Set<String> NOT_MAPPED_TO_SERVER = new HashSet<>(Arrays.asList(
            "disconnectSession", "playerLogout", // session manager
            "getExpansionSets", "getBasicLandSets", "searchCards", "lookupCards", "deckValidate", // card database services
            "deckImportFromUrl", "deckImportSources", // deck website import service
            "testEndGame", "testConcedeMatch" // test mode helpers on table manager
    ));

    static {
        SERVER_METHOD_OVERRIDES.put("submitDeck", "deckSubmit");
        SERVER_METHOD_OVERRIDES.put("sendFeedback", "serverAddFeedbackMessage");
        SERVER_METHOD_OVERRIDES.put("getGameTypes", "getServerState");
        SERVER_METHOD_OVERRIDES.put("getTournamentGameTypes", "getServerState");
        SERVER_METHOD_OVERRIDES.put("getTournamentTypes", "getServerState");
        SERVER_METHOD_OVERRIDES.put("getPlayerTypes", "getServerState");
        SERVER_METHOD_OVERRIDES.put("getDeckTypes", "getServerState");
        SERVER_METHOD_OVERRIDES.put("getDraftCubes", "getServerState");
    }

    private final List<String> serverCalls = new ArrayList<>();
    private final Map<String, Object[]> serverArgs = new HashMap<>();
    private FakeSessions sessions;
    private RpcDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        sessions = new FakeSessions();
        MageServer server = (MageServer) Proxy.newProxyInstance(
                MageServer.class.getClassLoader(),
                new Class<?>[]{MageServer.class},
                (proxy, method, args) -> {
                    serverCalls.add(method.getName());
                    serverArgs.put(method.getName(), args == null ? new Object[0] : args);
                    if (method.getReturnType() == boolean.class) {
                        return true;
                    }
                    if (method.getReturnType() == ServerState.class) {
                        return new ServerState(Collections.emptyList(), Collections.emptyList(),
                                new mage.players.PlayerType[0], new String[0], new String[0], false, null, 0, 0);
                    }
                    return null;
                });
        dispatcher = WebClientApi.createDispatcher(new ApiContext(server, null, sessions));
    }

    @TestFactory
    Stream<DynamicTest> everyMethodCallsTheServerWithTheCallersSession() {
        return dispatcher.getMethods().stream()
                .filter(method -> !NOT_MAPPED_TO_SERVER.contains(method.getName()))
                .map(method -> DynamicTest.dynamicTest(method.getName(), () -> {
                    setUp();
                    FakeConnection connection = new FakeConnection();
                    if (method.getAccess() != RpcMethod.Access.ESTABLISH) {
                        login(connection);
                    }

                    dispatcher.dispatch(method.getName(), sampleParams(method, "client-chosen-session"), connection);

                    String expected = SERVER_METHOD_OVERRIDES.getOrDefault(method.getName(),
                            method.getAliasOf() != null ? method.getAliasOf() : method.getName());
                    expected = SERVER_METHOD_OVERRIDES.getOrDefault(expected, expected);
                    assertThat(serverCalls).as("server calls of " + method.getName()).contains(expected);

                    if (method.getSessionParam() >= 0) {
                        List<Object> args = Arrays.asList(serverArgs.get(expected));
                        assertThat(args).as("session passed to the server by " + method.getName())
                                .contains(connection.getSessionId())
                                .doesNotContain("client-chosen-session");
                    }
                }));
    }

    @Test
    void everyMethodIsDocumented() {
        for (RpcMethod method : dispatcher.getMethods()) {
            assertThat(method.getDescription()).as(method.getName()).isNotBlank();
            if (method.getSessionParam() >= 0) {
                assertThat(method.getParams().get(method.getSessionParam()).getName())
                        .as("session param of " + method.getName()).isEqualTo("sessionId");
            }
        }
    }

    @Test
    void sessionMethodsRequireLogin() {
        FakeConnection connection = new FakeConnection();
        assertThatThrownBy(() -> dispatcher.dispatch("roomGetAllTables", params(UUID.randomUUID().toString()), connection))
                .isInstanceOfSatisfying(RpcException.class, e -> assertThat(e.getCode()).isEqualTo(RpcException.NOT_AUTHORIZED));
        assertThat(serverCalls).isEmpty();
    }

    @Test
    void loginIssuesAServerSessionAndIgnoresTheClientsId() throws Exception {
        FakeConnection connection = new FakeConnection();
        dispatcher.dispatch("connectUser", params("alice", "", "my-own-id"), connection);

        assertThat(connection.getSessionId()).isNotNull().isNotEqualTo("my-own-id");
        assertThat(sessions.created).containsExactly(connection.getSessionId());
        assertThat(sessions.hosts.get(connection.getSessionId())).isEqualTo("10.0.0.7");
        assertThat(serverArgs.get("connectUser")[2]).isEqualTo(connection.getSessionId());
    }

    @Test
    void reLoginOnTheSameConnectionReplacesTheOldSession() throws Exception {
        FakeConnection connection = new FakeConnection();
        dispatcher.dispatch("connectUser", params("alice", "", "x"), connection);
        String first = connection.getSessionId();
        dispatcher.dispatch("connectUser", params("alice", "", "x"), connection);

        assertThat(connection.getSessionId()).isNotEqualTo(first);
        assertThat(sessions.disconnected).containsExactly(first + ":" + DisconnectReason.LostConnection);
    }

    @Test
    void anotherConnectionCannotUseASessionIdItDoesNotOwn() throws Exception {
        FakeConnection alice = new FakeConnection();
        login(alice);
        FakeConnection mallory = new FakeConnection();
        login(mallory);

        dispatcher.dispatch("matchQuit", params(UUID.randomUUID().toString(), alice.getSessionId()), mallory);

        assertThat(serverArgs.get("matchQuit")[1]).isEqualTo(mallory.getSessionId());
    }

    @Test
    void chatAuthorIsTheLoggedInUser() throws Exception {
        FakeConnection connection = new FakeConnection();
        login(connection);
        sessions.names.put(connection.getSessionId(), "alice");

        dispatcher.dispatch("chatSendMessage", params(UUID.randomUUID().toString(), "admin", "hi"), connection);

        assertThat(serverArgs.get("chatSendMessage")[1]).isEqualTo("alice");
    }

    @Test
    void pingWorksBeforeLogin() throws Exception {
        assertThat(dispatcher.dispatch("ping", new JsonArray(), new FakeConnection())).isEqualTo(true);
        assertThat(serverCalls).isEmpty();
    }

    @Test
    void unknownMethodAndBadParamsAreReported() throws Exception {
        FakeConnection connection = new FakeConnection();
        login(connection);

        assertThatThrownBy(() -> dispatcher.dispatch("noSuchMethod", new JsonArray(), connection))
                .isInstanceOfSatisfying(RpcException.class, e -> assertThat(e.getCode()).isEqualTo(RpcException.METHOD_NOT_FOUND));
        assertThatThrownBy(() -> dispatcher.dispatch("roomGetAllTables", new JsonArray(), connection))
                .isInstanceOfSatisfying(RpcException.class, e -> assertThat(e.getCode()).isEqualTo(RpcException.INVALID_PARAMS));
        assertThatThrownBy(() -> dispatcher.dispatch("roomGetAllTables", params("not-a-uuid"), connection))
                .isInstanceOfSatisfying(RpcException.class, e -> assertThat(e.getCode()).isEqualTo(RpcException.INVALID_PARAMS));
        assertThatThrownBy(() -> dispatcher.dispatch("sendPlayerAction",
                params("NOT_AN_ACTION", UUID.randomUUID().toString(), "s"), connection))
                .isInstanceOfSatisfying(RpcException.class, e -> assertThat(e.getCode()).isEqualTo(RpcException.INVALID_PARAMS));
    }

    @Test
    void methodNamesAreUnique() {
        List<String> names = dispatcher.getMethods().stream().map(RpcMethod::getName).collect(Collectors.toList());
        assertThat(names).doesNotHaveDuplicates();
    }

    private void login(FakeConnection connection) throws Exception {
        dispatcher.dispatch("connectUser", params("user", "", "ignored"), connection);
        serverCalls.clear();
        serverArgs.clear();
    }

    private static JsonArray params(String... values) {
        JsonArray array = new JsonArray();
        for (String value : values) {
            array.add(value);
        }
        return array;
    }

    private static JsonArray sampleParams(RpcMethod method, String sessionValue) {
        JsonArray array = new JsonArray();
        for (int i = 0; i < method.getParams().size(); i++) {
            RpcParam param = method.getParams().get(i);
            if (i == method.getSessionParam()) {
                array.add(sessionValue);
                continue;
            }
            switch (param.getTsType()) {
                case "PlayerAction":
                    array.add("PASS_PRIORITY_UNTIL_NEXT_TURN");
                    continue;
                case "ManaType":
                    array.add("RED");
                    continue;
                case "UUID[]":
                    array.add(new JsonArray());
                    continue;
                default:
                    break;
            }
            switch (param.getType()) {
                case UUID:
                    array.add(UUID.randomUUID().toString());
                    break;
                case INT:
                    array.add(new JsonPrimitive(1));
                    break;
                case BOOLEAN:
                    array.add(new JsonPrimitive(true));
                    break;
                case OBJECT:
                    JsonObject object = new JsonObject();
                    if ("DeckCardLists".equals(param.getTsType())) {
                        object.add("cards", new JsonArray());
                        object.add("sideboard", new JsonArray());
                    }
                    array.add(object);
                    break;
                case ARRAY:
                    array.add(new JsonArray());
                    break;
                case STRING:
                    array.add(param.getName().equals("playerType") ? "HUMAN" : "text");
                    break;
                case ANY:
                default:
                    array.add("text");
                    break;
            }
        }
        return array;
    }

    private static final class FakeConnection implements RpcConnection {
        private String sessionId;

        @Override
        public String getSessionId() {
            return sessionId;
        }

        @Override
        public void bindSession(String sessionId) {
            this.sessionId = sessionId;
        }

        @Override
        public String getRemoteHost() {
            return "10.0.0.7";
        }

        @Override
        public InvokerCallbackHandler createCallbackHandler() {
            return null;
        }
    }

    private static final class FakeSessions implements RpcSessions {
        final List<String> created = new ArrayList<>();
        final List<String> disconnected = new ArrayList<>();
        final Map<String, String> hosts = new HashMap<>();
        final Map<String, String> names = new HashMap<>();

        @Override
        public void create(String sessionId, InvokerCallbackHandler callbackHandler, String host) {
            created.add(sessionId);
            hosts.put(sessionId, host);
        }

        @Override
        public boolean exists(String sessionId) {
            return created.contains(sessionId) && disconnected.stream().noneMatch(d -> d.startsWith(sessionId + ":"));
        }

        @Override
        public void disconnect(String sessionId, DisconnectReason reason) {
            disconnected.add(sessionId + ":" + reason);
        }

        @Override
        public Optional<String> userName(String sessionId) {
            return Optional.of(names.getOrDefault(sessionId, "user"));
        }
    }
}
