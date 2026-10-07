package mage.server.websocket;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.interfaces.MageServer;
import mage.interfaces.ServerState;
import mage.players.PlayerType;
import org.java_websocket.WebSocket;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft;
import org.java_websocket.drafts.Draft_6455;
import org.java_websocket.extensions.permessage_deflate.PerMessageDeflateExtension;
import org.java_websocket.handshake.ServerHandshake;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Web client bridge over a real socket: handshake, framing, error objects and origin checks.
 */
public class WebSocketTransportTest {

    private WebSocketServerImpl server;
    private int port;

    @BeforeEach
    void startServer() throws Exception {
        start("https://play.example.com");
    }

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.shutdown();
        }
    }

    private void start(String allowedOrigins) throws Exception {
        try (ServerSocket socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }
        MageServer mageServer = (MageServer) Proxy.newProxyInstance(MageServer.class.getClassLoader(),
                new Class<?>[]{MageServer.class}, (proxy, method, args) -> {
                    if (method.getReturnType() == ServerState.class) {
                        return new ServerState(Collections.emptyList(), Collections.emptyList(),
                                new PlayerType[0], new String[]{"Constructed - Standard"}, new String[0], false, null, 0, 0);
                    }
                    return null;
                });
        server = new WebSocketServerImpl(new InetSocketAddress("127.0.0.1", port), mageServer, null, allowedOrigins);
        server.start();
        server.awaitStartup(10, TimeUnit.SECONDS);
    }

    @Test
    void publicRequestWorksOverABrowserLikeHandshake() throws Exception {
        TestClient client = TestClient.connect(port, null);
        try {
            JsonObject response = client.request("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getDeckTypes\",\"params\":[]}");
            assertThat(response.get("id").getAsInt()).isEqualTo(1);
            assertThat(response.get("result").getAsJsonArray().get(0).getAsString()).isEqualTo("Constructed - Standard");
        } finally {
            client.closeBlocking();
        }
    }

    @Test
    void errorsAreJsonRpcErrorObjects() throws Exception {
        TestClient client = TestClient.connect(port, null);
        try {
            assertThat(errorCode(client.request("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"nope\"}"))).isEqualTo(-32601);
            assertThat(errorCode(client.request("{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"roomGetAllTables\",\"params\":[\"" + java.util.UUID.randomUUID() + "\"]}")))
                    .isEqualTo(-32001);
            assertThat(errorCode(client.request("not json"))).isEqualTo(-32700);
            assertThat(errorCode(client.request("{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"getDeckTypes\",\"params\":{}}"))).isEqualTo(-32600);
        } finally {
            client.closeBlocking();
        }
    }

    @Test
    void responsesKeepRequestOrderPerConnection() throws Exception {
        TestClient client = TestClient.connect(port, null);
        try {
            for (int i = 1; i <= 20; i++) {
                client.send("{\"jsonrpc\":\"2.0\",\"id\":" + i + ",\"method\":\"getDeckTypes\"}");
            }
            for (int i = 1; i <= 20; i++) {
                assertThat(client.next().get("id").getAsInt()).isEqualTo(i);
            }
        } finally {
            client.closeBlocking();
        }
    }

    @Test
    void allowedOriginsAreEnforcedForBrowsers() throws Exception {
        TestClient allowed = TestClient.connect(port, "https://play.example.com");
        try {
            assertThat(allowed.isOpen()).isTrue();
        } finally {
            allowed.closeBlocking();
        }
        TestClient blocked = TestClient.connect(port, "https://evil.example.com");
        try {
            assertThat(blocked.isOpen()).isFalse();
        } finally {
            blocked.closeBlocking();
        }
    }

    @Test
    void concurrentSendsOnACompressedConnectionAllArrive() throws Exception {
        TestClient client = TestClient.connect(port, null, true);
        try {
            WebSocket conn = server.getConnections().iterator().next();
            String payload = String.join("", Collections.nCopies(200, "compressible text "));
            int threads = 8;
            int perThread = 100;
            ExecutorService pool = Executors.newFixedThreadPool(threads);
            List<Future<?>> sends = new ArrayList<>();
            for (int t = 0; t < threads; t++) {
                // RPC responses and server callbacks share a connection but come from different threads
                sends.add(pool.submit(() -> {
                    for (int i = 0; i < perThread; i++) {
                        WebSocketServerImpl.sendText(conn, "{\"n\":" + i + ",\"text\":\"" + payload + "\"}");
                    }
                }));
            }
            for (Future<?> send : sends) {
                send.get(20, TimeUnit.SECONDS);
            }
            pool.shutdown();
            for (int i = 0; i < threads * perThread; i++) {
                assertThat(client.next().get("text").getAsString()).isEqualTo(payload);
            }
        } finally {
            client.closeBlocking();
        }
    }

    private static int errorCode(JsonObject response) {
        return response.get("error").getAsJsonObject().get("code").getAsInt();
    }

    private static final class TestClient extends WebSocketClient {
        private final BlockingQueue<String> messages = new LinkedBlockingQueue<>();

        private TestClient(URI uri, Draft draft, Map<String, String> headers) {
            super(uri, draft, headers);
        }

        static TestClient connect(int port, String origin) throws InterruptedException {
            return connect(port, origin, false);
        }

        static TestClient connect(int port, String origin, boolean compressed) throws InterruptedException {
            Map<String, String> headers = new HashMap<>();
            if (origin != null) {
                headers.put("Origin", origin);
            }
            Draft draft = compressed
                    ? new Draft_6455(Collections.singletonList(new PerMessageDeflateExtension()))
                    : new Draft_6455();
            TestClient client = new TestClient(URI.create("ws://127.0.0.1:" + port), draft, headers);
            client.connectBlocking(5, TimeUnit.SECONDS);
            return client;
        }

        JsonObject request(String json) throws InterruptedException {
            send(json);
            return next();
        }

        JsonObject next() throws InterruptedException {
            String message = messages.poll(5, TimeUnit.SECONDS);
            assertThat(message).as("response from server").isNotNull();
            return JsonParser.parseString(message).getAsJsonObject();
        }

        @Override
        public void onOpen(ServerHandshake handshake) {
        }

        @Override
        public void onMessage(String message) {
            messages.add(message);
        }

        @Override
        public void onClose(int code, String reason, boolean remote) {
        }

        @Override
        public void onError(Exception ex) {
        }
    }
}
